import { NextRequest, NextResponse } from "next/server";
import { hasChannelAccess, readServerSession } from "../../../lib/serverSession";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

type WhatsAppConversation = {
  unread_count?: number | null;
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

  const [conversations, pendingSms] = await Promise.all([
    whatsappAllowed ? supabaseAdmin<WhatsAppConversation[]>(
      "wa_conversations?select=unread_count&unread_count=gt.0"
    ).catch(() => []) : [],
    smsAllowed ? supabaseAdmin<Array<{ id: string }>>(
      "nkh_task_notifications?select=id&channel=eq.SMS&delivery_status=eq.Pending"
    ).catch(() => []) : [],
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
