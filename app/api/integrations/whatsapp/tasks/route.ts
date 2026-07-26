import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { sendWhatsAppTaskCreated } from "../../../../lib/whatsappTaskNotifications";

const secret = process.env.INBOX_INTEGRATION_SECRET;
function safeMatch(received: string | null) {
  if (!secret || !received) return false;
  const a = Buffer.from(secret), b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}
function authorized(request: NextRequest) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null;
  return safeMatch(request.headers.get("x-nkh-inbox-secret"))
    || safeMatch(bearer)
    || safeMatch(request.nextUrl.searchParams.get("secret"));
}
type Property = { id: string; property_name: string };
type Roster = { start_time: string | null; end_time: string | null; staff: { id: string; display_name: string } };
type ExistingTask = { id: string; status: string; assigned_name_snapshot: string | null };

function colomboNow() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const get = (type: string) => parts.find(part => part.type === type)?.value || "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}:00` };
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  try {
    const input = await request.json();
    const propertyName = String(input.property || input.propertyName || input.property_name || "Property not identified").trim();
    const subject = String(input.subject || input.title || input.taskTitle || input.task_title || "WhatsApp request").trim();
    const notes = String(input.note || input.notes || input.summary || input.body || input.message || subject).trim();
    const conversationId = String(input.conversationId || input.conversation_id || "").trim() || null;
    const sourceMessageId = String(input.sourceMessageId || input.source_message_id || input.messageId || input.message_id || "").trim() || null;
    if (!subject || !notes) return NextResponse.json({ success: false, error: "A WhatsApp subject or message is required" }, { status: 400 });

    if (sourceMessageId) {
      const existing = await supabaseAdmin<ExistingTask[]>(
        `nkh_tasks?source_whatsapp_message_id=eq.${encodeURIComponent(sourceMessageId)}&select=id,status,assigned_name_snapshot&limit=1`,
      );
      if (existing[0]) {
        return NextResponse.json({
          success: true,
          duplicate: true,
          id: existing[0].id,
          taskId: existing[0].id,
          status: existing[0].status,
          assignedTo: existing[0].assigned_name_snapshot,
        });
      }
    }

    const now = colomboNow();
    const [properties, roster] = await Promise.all([
      supabaseAdmin<Property[]>(`nkh_properties?select=id,property_name&property_name=eq.${encodeURIComponent(propertyName)}&limit=1`),
      supabaseAdmin<Roster[]>(`nkh_roster_entries?select=start_time,end_time,staff:nkh_staff(id,display_name)&shift_date=eq.${now.date}&status=eq.Scheduled`),
    ]);
    const active = roster.find(item => item.start_time && item.end_time && item.start_time <= now.time && item.end_time >= now.time)?.staff;
    const priority = ["Normal", "High", "Urgent", "Critical"].includes(input.priority) ? input.priority : "Normal";
    const rows = await supabaseAdmin<Array<{ id: string }>>("nkh_tasks", { method: "POST", prefer: "return=representation", body: {
      status: "Pending", priority, task_type: String(input.taskType || input.task_type || "Other"), source: "WhatsApp AI",
      property_id: properties[0]?.id || null, property_name_snapshot: propertyName, subject, notes,
      assigned_staff_id: active?.id || null, assigned_name_snapshot: active?.display_name || null,
      source_whatsapp_message_id: sourceMessageId, source_conversation_id: conversationId,
      created_by_name_snapshot: "WhatsApp AI",
    }});
    const task = rows[0];
    await supabaseAdmin("nkh_task_events", { method: "POST", prefer: "return=minimal", body: { task_id: task.id, event_type: "Created", to_status: "Pending", actor_name_snapshot: "WhatsApp AI", event_data: { source: "WhatsApp" } } });
    let whatsapp = { sent: false, skipped: true } as { sent: boolean; skipped: boolean; reason?: string };
    let whatsappWarning: string | null = null;
    if (sourceMessageId && conversationId) {
      await supabaseAdmin("wa_task_links", { method: "POST", prefer: "return=minimal", body: { conversation_id: conversationId, property_id: properties[0]?.id || null, source_message_id: sourceMessageId, dashboard_task_id: task.id, task_status: "Pending", assigned_to: active?.display_name || null } });
      if (input.acknowledgementHandledExternally !== true && input.acknowledgement_handled_externally !== true) {
        try {
          whatsapp = await sendWhatsAppTaskCreated({
            taskId: task.id,
            property: propertyName,
            subject,
            assignedTo: active?.display_name || null,
          });
        } catch (reason) {
          whatsappWarning = reason instanceof Error ? reason.message : "WhatsApp task confirmation failed.";
          console.error("WhatsApp task-created confirmation failed", { taskId: task.id, error: whatsappWarning });
        }
      } else {
        whatsapp = { sent: false, skipped: true, reason: "Acknowledgement handled by WhatsApp Inbox" };
      }
    }
    return NextResponse.json({
      success: true,
      id: task.id,
      taskId: task.id,
      assignedTo: active?.display_name || null,
      linkedToWhatsApp: Boolean(sourceMessageId && conversationId),
      whatsapp,
      whatsappWarning,
    });
  } catch (error) { return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Task creation failed" }, { status: 500 }); }
}
