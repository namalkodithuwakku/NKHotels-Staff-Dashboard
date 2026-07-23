import { NextRequest, NextResponse } from "next/server";
import { readServerSession } from "../../../lib/serverSession";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

type WhatsAppConversation = {
  unread_count?: number | null;
};

export async function GET(request: NextRequest) {
  if (!readServerSession(request)) {
    return NextResponse.json(
      { success: false, error: "Staff access required." },
      { status: 401 }
    );
  }

  const [conversations, pendingSms] = await Promise.all([
    supabaseAdmin<WhatsAppConversation[]>(
      "wa_conversations?select=unread_count&unread_count=gt.0"
    ).catch(() => []),
    supabaseAdmin<Array<{ id: string }>>(
      "nkh_task_notifications?select=id&channel=eq.SMS&delivery_status=eq.Pending"
    ).catch(() => []),
  ]);

  const whatsapp = conversations.reduce(
    (total, item) => total + Math.max(0, Number(item.unread_count || 0)),
    0
  );

  return NextResponse.json({
    success: true,
    counts: {
      whatsapp,
      sms: pendingSms.length,
    },
  });
}
