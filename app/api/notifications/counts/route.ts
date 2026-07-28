import { NextRequest, NextResponse } from "next/server";
import { hasChannelAccess, readServerSession } from "../../../lib/serverSession";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

type WhatsAppConversation = {
  unread_count?: number | null;
};

type TaskStatus = {
  status?: string | null;
};

export async function GET(request: NextRequest) {
  const session = readServerSession(request);
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Staff access required." },
      { status: 401 }
    );
  }

  const [whatsappAllowed, smsAllowed] = await Promise.all([
    hasChannelAccess(session, "whatsapp"),
    hasChannelAccess(session, "sms"),
  ]);

  const [conversations, pendingSms, tasks] = await Promise.all([
    whatsappAllowed ? supabaseAdmin<WhatsAppConversation[]>(
      "wa_conversations?select=unread_count&unread_count=gt.0"
    ).catch(() => []) : [],
    smsAllowed ? supabaseAdmin<Array<{ id: string }>>(
      "nkh_task_notifications?select=id&channel=eq.SMS&delivery_status=eq.Pending"
    ).catch(() => []) : [],
    supabaseAdmin<TaskStatus[]>(
      "nkh_tasks?select=status&order=created_at.desc&limit=5000"
    ).catch(() => []),
  ]);

  const whatsapp = conversations.reduce(
    (total, item) => total + Math.max(0, Number(item.unread_count || 0)),
    0
  );
  const openTasks = tasks.reduce((total, task) => {
    const status = String(task.status || "").trim().toLowerCase();
    const closed = status.includes("done") ||
      status.includes("completed") ||
      status.includes("ignored") ||
      status.includes("acknowledged") ||
      status.includes("cancelled") ||
      status.includes("canceled");
    return total + (closed ? 0 : 1);
  }, 0);

  return NextResponse.json({
    success: true,
    counts: {
      tasks: openTasks,
      whatsapp,
      sms: pendingSms.length,
    },
  });
}
