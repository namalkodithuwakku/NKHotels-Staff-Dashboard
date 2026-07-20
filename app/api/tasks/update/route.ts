import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { canManageProperties, readServerSession } from "../../../lib/serverSession";

type TaskRow = {
  id: string;
  status: string;
  subject: string | null;
  property_name_snapshot: string | null;
};
type StaffRow = { id: string; display_name: string };
type WhatsAppTaskLink = {
  id: string;
  conversation_id: string;
  completion_reply_sent_at: string | null;
  conversation: { contact: { wa_id: string } | null } | null;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function sendWhatsAppCompletion_(
  task: TaskRow,
  staffName: string,
  completionNote: string,
) {
  const links = await supabaseAdmin<WhatsAppTaskLink[]>(
    `wa_task_links?dashboard_task_id=eq.${encodeURIComponent(task.id)}&select=id,conversation_id,completion_reply_sent_at,conversation:wa_conversations(contact:wa_contacts(wa_id))&limit=1`,
  );
  const link = links[0];
  if (!link || link.completion_reply_sent_at) return { sent: false, skipped: true };

  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const waId = link.conversation?.contact?.wa_id;
  if (!token || !phoneId || !waId) {
    throw new Error("WhatsApp completion settings or contact are missing.");
  }

  const text = [
    "✅ Task completed",
    task.property_name_snapshot || null,
    task.subject || null,
    staffName ? `Completed by: ${staffName}` : null,
    completionNote ? `Note: ${completionNote}` : null,
  ].filter(Boolean).join("\n");
  const version = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: waId,
      type: "text",
      text: { preview_url: false, body: text },
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || "WhatsApp rejected the completion message.");
  }

  const sentAt = new Date().toISOString();
  await Promise.all([
    supabaseAdmin("wa_messages", {
      method: "POST",
      prefer: "return=minimal",
      body: {
        conversation_id: link.conversation_id,
        meta_message_id: data?.messages?.[0]?.id || null,
        direction: "outgoing",
        message_type: "text",
        body: text,
        delivery_status: "sent",
        sent_by: staffName || "NKH Team",
        meta_timestamp: sentAt,
        raw_payload: data,
      },
    }),
    supabaseAdmin(`wa_conversations?id=eq.${encodeURIComponent(link.conversation_id)}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: { last_message_preview: text.slice(0, 180), last_message_at: sentAt },
    }),
    supabaseAdmin(`wa_task_links?id=eq.${encodeURIComponent(link.id)}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: {
        task_status: "Done",
        completion_note: completionNote || null,
        completion_reply_sent_at: sentAt,
      },
    }),
  ]);
  return { sent: true, skipped: false };
}

export async function GET(request: NextRequest) {
  try {
    const session = readServerSession(request);
    if (!canManageProperties(session)) return NextResponse.json({ success: false, error: "Please sign in again." }, { status: 401 });
    const taskId = request.nextUrl.searchParams.get("taskId") || "";
    const requested = request.nextUrl.searchParams.get("status") || "";
    const staffName = request.nextUrl.searchParams.get("staffName") || session?.name || "";
    const completionNote = request.nextUrl.searchParams.get("completionNote") || "";
    const status = requested.toLowerCase().includes("progress") ? "In Progress" : requested.toLowerCase().includes("done") || requested.toLowerCase().includes("complete") ? "Done" : "Pending";
    if (!taskId) return NextResponse.json({ success: false, error: "Task ID is required." }, { status: 400 });

    const filter = uuid.test(taskId) ? `id=eq.${encodeURIComponent(taskId)}` : `legacy_task_id=eq.${encodeURIComponent(taskId)}`;
    const tasks = await supabaseAdmin<TaskRow[]>(`nkh_tasks?select=id,status,subject,property_name_snapshot&${filter}&limit=1`);
    const task = tasks[0];
    if (!task) return NextResponse.json({ success: false, error: "Task was not found." }, { status: 404 });
    const staff = staffName ? (await supabaseAdmin<StaffRow[]>(`nkh_staff?select=id,display_name&or=(display_name.eq.${encodeURIComponent(staffName)},google_staff_name.eq.${encodeURIComponent(staffName)})&limit=1`))[0] : null;
    const now = new Date().toISOString();
    const update: Record<string, unknown> = { status };
    if (status === "In Progress") { update.started_at = now; update.assigned_staff_id = staff?.id || null; update.assigned_name_snapshot = staffName || null; }
    if (status === "Done") { update.completed_at = now; update.completed_by_staff_id = staff?.id || null; update.completed_by_name_snapshot = staffName || null; update.completion_note = completionNote || null; }
    await supabaseAdmin(`nkh_tasks?id=eq.${task.id}`, { method: "PATCH", prefer: "return=minimal", body: update });
    await supabaseAdmin("nkh_task_events", { method: "POST", prefer: "return=minimal", body: {
      task_id: task.id, event_type: status === "Done" ? "Completed" : status === "In Progress" ? "Started" : "Status Changed",
      from_status: task.status, to_status: status, actor_staff_id: staff?.id || null, actor_name_snapshot: staffName || null,
      note: completionNote || null,
    }});
    await supabaseAdmin(`wa_task_links?dashboard_task_id=eq.${encodeURIComponent(task.id)}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: { task_status: status, assigned_to: staffName || null, completion_note: completionNote || null },
    });

    let whatsapp = { sent: false, skipped: true };
    let whatsappWarning: string | null = null;
    if (status === "Done") {
      try {
        whatsapp = await sendWhatsAppCompletion_(task, staffName, completionNote);
      } catch (reason) {
        whatsappWarning = reason instanceof Error ? reason.message : "WhatsApp completion confirmation failed.";
        console.error("WhatsApp completion confirmation failed", { taskId: task.id, error: whatsappWarning });
      }
    }
    return NextResponse.json({ success: true, taskId: task.id, status, whatsapp, whatsappWarning });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Task update failed." }, { status: 500 });
  }
}