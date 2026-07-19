import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

const secret = process.env.INBOX_INTEGRATION_SECRET;
function authorized(received: string | null) { if (!secret || !received) return false; const a = Buffer.from(secret), b = Buffer.from(received); return a.length === b.length && timingSafeEqual(a, b); }
type Property = { id: string; property_name: string };
type Roster = { start_time: string | null; end_time: string | null; staff: { id: string; display_name: string } };

function colomboNow() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const get = (type: string) => parts.find(part => part.type === type)?.value || "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}:00` };
}

export async function POST(request: NextRequest) {
  if (!authorized(request.headers.get("x-nkh-inbox-secret"))) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  try {
    const input = await request.json(), propertyName = String(input.property || "").trim(), subject = String(input.subject || "").trim(), notes = String(input.note || "").trim();
    if (!propertyName || !subject || !notes) return NextResponse.json({ success: false, error: "Property, subject and note are required" }, { status: 400 });
    const now = colomboNow();
    const [properties, roster] = await Promise.all([
      supabaseAdmin<Property[]>(`nkh_properties?select=id,property_name&property_name=eq.${encodeURIComponent(propertyName)}&limit=1`),
      supabaseAdmin<Roster[]>(`nkh_roster_entries?select=start_time,end_time,staff:nkh_staff(id,display_name)&shift_date=eq.${now.date}&status=eq.Scheduled`),
    ]);
    const active = roster.find(item => item.start_time && item.end_time && item.start_time <= now.time && item.end_time >= now.time)?.staff;
    const priority = ["Normal", "High", "Urgent", "Critical"].includes(input.priority) ? input.priority : "Normal";
    const rows = await supabaseAdmin<Array<{ id: string }>>("nkh_tasks", { method: "POST", prefer: "return=representation", body: {
      status: "Pending", priority, task_type: String(input.taskType || "Other"), source: "WhatsApp AI",
      property_id: properties[0]?.id || null, property_name_snapshot: propertyName, subject, notes,
      assigned_staff_id: active?.id || null, assigned_name_snapshot: active?.display_name || null,
      source_whatsapp_message_id: input.sourceMessageId || null, source_conversation_id: input.conversationId || null,
      created_by_name_snapshot: "WhatsApp AI",
    }});
    const task = rows[0];
    await supabaseAdmin("nkh_task_events", { method: "POST", prefer: "return=minimal", body: { task_id: task.id, event_type: "Created", to_status: "Pending", actor_name_snapshot: "WhatsApp AI", event_data: { source: "WhatsApp" } } });
    if (input.sourceMessageId && input.conversationId) await supabaseAdmin("wa_task_links", { method: "POST", prefer: "return=minimal", body: { conversation_id: input.conversationId, property_id: properties[0]?.id || null, source_message_id: input.sourceMessageId, dashboard_task_id: task.id, task_status: "Pending", assigned_to: active?.display_name || null } });
    return NextResponse.json({ success: true, id: task.id, taskId: task.id, assignedTo: active?.display_name || null });
  } catch (error) { return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Task creation failed" }, { status: 500 }); }
}
