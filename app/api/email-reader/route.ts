import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

type EmailRow = {
  id: string; gmail_message_id: string; gmail_url: string | null; sender: string | null;
  recipients: string | null; subject: string | null; body_text: string | null;
  attachment_names: string | null; received_at: string | null; property_name_snapshot: string | null;
  booking_id: string | null; event_type: string | null; category: string | null; task_type: string | null;
  priority: string; ai_title: string | null; summary: string | null; recommended_action: string | null;
};

export async function GET() {
  try {
    const rows = await supabaseAdmin<EmailRow[]>(
      "nkh_email_inbox?select=id,gmail_message_id,gmail_url,sender,recipients,subject,body_text,attachment_names,received_at,property_name_snapshot,booking_id,event_type,category,task_type,priority,ai_title,summary,recommended_action&status=eq.Needs%20Review&order=received_at.desc&limit=200"
    );
    const items = rows.map(row => ({
      id: row.gmail_message_id, emailId: row.gmail_message_id, inboxId: row.id,
      gmailLink: row.gmail_url, from: row.sender, to: row.recipients, subject: row.subject,
      body: row.body_text, attachmentNames: row.attachment_names, time: row.received_at,
      property: row.property_name_snapshot, bookingId: row.booking_id, event: row.event_type,
      category: row.category, taskType: row.task_type, priority: row.priority,
      aiTitle: row.ai_title, summary: row.summary, action: row.recommended_action,
    }));
    return NextResponse.json({ success: true, items, source: "Supabase" });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to load email inbox." }, { status: 500 });
  }
}