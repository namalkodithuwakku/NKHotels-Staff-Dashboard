import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { isSupervisorRequestAuthorized } from "../../lib/supervisorAuth";

type EmailRow = {
  id: string;
  gmail_message_id: string;
  gmail_url: string | null;
  sender: string | null;
  recipients: string | null;
  subject: string | null;
  body_text: string | null;
  attachment_names: string | null;
  received_at: string | null;
  property_name_snapshot: string | null;
  booking_id: string | null;
  event_type: string | null;
  category: string | null;
  task_type: string | null;
  priority: string | null;
  ai_title: string | null;
  summary: string | null;
  recommended_action: string | null;
  status: string | null;
  task_id: string | null;
};

export async function GET(request: NextRequest) {
  if (!isSupervisorRequestAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 100)));
    const rows = await supabaseAdmin<EmailRow[]>(
      `nkh_email_inbox?select=id,gmail_message_id,gmail_url,sender,recipients,subject,body_text,attachment_names,received_at,property_name_snapshot,booking_id,event_type,category,task_type,priority,ai_title,summary,recommended_action,status,task_id&status=eq.Needs%20Review&order=received_at.asc&limit=${limit}`
    );

    return NextResponse.json({
      success: true,
      count: rows.length,
      items: rows.map((row) => ({
        inboxId: row.id,
        emailId: row.gmail_message_id,
        gmailLink: row.gmail_url,
        from: row.sender,
        to: row.recipients,
        subject: row.subject,
        body: row.body_text,
        attachmentNames: row.attachment_names,
        time: row.received_at,
        property: row.property_name_snapshot,
        bookingId: row.booking_id,
        event: row.event_type,
        category: row.category,
        taskType: row.task_type,
        priority: row.priority,
        aiTitle: row.ai_title,
        summary: row.summary,
        action: row.recommended_action,
        status: row.status,
        taskId: row.task_id,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to load AI supervisor email queue." },
      { status: 500 }
    );
  }
}
