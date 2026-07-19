import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { canManageProperties, readServerSession } from "../../../lib/serverSession";

type NamedRow = { id: string; property_name?: string; display_name?: string };
type CreatedTask = { id: string };

async function first<T>(path: string) {
  const rows = await supabaseAdmin<T[]>(path);
  return rows[0] || null;
}

export async function POST(request: NextRequest) {
  try {
    const session = readServerSession(request);
    if (!canManageProperties(session)) return NextResponse.json({ success: false, error: "Please sign in again." }, { status: 401 });
    const body = await request.json();
    const propertyName = String(body.property || "").trim();
    const staffName = String(body.staffName || session?.name || "").trim();
    const subject = String(body.subject || body.taskType || "").trim();
    if (!propertyName || !subject) return NextResponse.json({ success: false, error: "Property and subject are required." }, { status: 400 });

    const [property, staff] = await Promise.all([
      first<NamedRow>(`nkh_properties?select=id,property_name&property_name=eq.${encodeURIComponent(propertyName)}&limit=1`),
      staffName ? first<NamedRow>(`nkh_staff?select=id,display_name&or=(display_name.eq.${encodeURIComponent(staffName)},google_staff_name.eq.${encodeURIComponent(staffName)})&limit=1`) : null,
    ]);
    const rows = await supabaseAdmin<CreatedTask[]>("nkh_tasks", {
      method: "POST", prefer: "return=representation",
      body: {
        status: "Pending", priority: ["Normal", "High", "Urgent", "Critical"].includes(body.priority) ? body.priority : "Normal",
        task_type: String(body.taskType || "Other"), source: String(body.source || "Staff Dashboard"),
        property_id: property?.id || null, property_name_snapshot: propertyName, subject,
        notes: String(body.note || "").trim() || null, assigned_staff_id: staff?.id || null,
        assigned_name_snapshot: staffName || null, shift_label: String(body.shift || "").trim() || null,
        created_by_staff_id: staff?.id || null, created_by_name_snapshot: session?.name || staffName || null,
      },
    });
    const task = rows[0];
    await supabaseAdmin("nkh_task_events", { method: "POST", prefer: "return=minimal", body: {
      task_id: task.id, event_type: "Created", to_status: "Pending", actor_staff_id: staff?.id || null,
      actor_name_snapshot: session?.name || staffName || null,
    }});
    return NextResponse.json({ success: true, id: task.id, taskId: task.id, task });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to create task." }, { status: 500 });
  }
}
