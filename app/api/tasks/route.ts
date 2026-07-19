import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { canManageProperties, readServerSession } from "../../lib/serverSession";

type TaskRow = {
  id: string; status: string; intent: string | null; task_type: string; source: string;
  property_name_snapshot: string | null; booking_id: string | null; priority: string;
  assigned_name_snapshot: string | null; shift_label: string | null; created_at: string;
  started_at: string | null; completed_at: string | null; completed_by_name_snapshot: string | null;
  subject: string; notes: string | null;
};

const fields = "id,status,intent,task_type,source,property_name_snapshot,booking_id,priority,assigned_name_snapshot,shift_label,created_at,started_at,completed_at,completed_by_name_snapshot,subject,notes";

export async function GET(request: NextRequest) {
  try {
    if (!canManageProperties(readServerSession(request))) {
      return NextResponse.json({ success: false, error: "Please sign in again." }, { status: 401 });
    }
    const rows = await supabaseAdmin<TaskRow[]>(`nkh_tasks?select=${fields}&archived_at=is.null&order=created_at.desc&limit=500`);
    const tasks = rows.map(row => ({
      id: row.id,
      status: row.status,
      intent: row.intent || undefined,
      type: row.task_type,
      source: row.source,
      property: row.property_name_snapshot || "",
      bookingId: row.booking_id || undefined,
      priority: row.priority,
      assignedTo: row.assigned_name_snapshot || undefined,
      shift: row.shift_label || undefined,
      createdTime: row.created_at,
      startedTime: row.started_at || undefined,
      doneTime: row.completed_at || undefined,
      completedBy: row.completed_by_name_snapshot || undefined,
      subject: row.subject,
      notes: row.notes || undefined,
    }));
    return NextResponse.json({ success: true, tasks });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to load tasks." }, { status: 500 });
  }
}
