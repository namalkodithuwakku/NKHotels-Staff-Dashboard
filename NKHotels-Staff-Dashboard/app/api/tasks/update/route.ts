import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { canManageProperties, readServerSession } from "../../../lib/serverSession";

type TaskRow = { id: string; status: string };
type StaffRow = { id: string; display_name: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    const tasks = await supabaseAdmin<TaskRow[]>(`nkh_tasks?select=id,status&${filter}&limit=1`);
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
    return NextResponse.json({ success: true, taskId: task.id, status });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Task update failed." }, { status: 500 });
  }
}
