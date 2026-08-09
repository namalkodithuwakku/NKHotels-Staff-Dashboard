import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { AI_SUPERVISOR_NAME, isSupervisorRequestAuthorized } from "../../../../lib/supervisorAuth";

type TaskRow = { id:string; status:string; assigned_name_snapshot:string|null; priority:string };
type StaffRow = { id:string; display_name:string|null };
const allowedStatus = new Set(["Pending","In Progress","Done"]);
const allowedPriority = new Set(["Normal","High","Urgent","Critical"]);

async function first<T>(path:string) { const rows = await supabaseAdmin<T[]>(path); return rows[0] || null; }

export async function POST(request: NextRequest) {
  if (!isSupervisorRequestAuthorized(request)) return NextResponse.json({ success:false, error:"Unauthorized" }, { status:401 });
  try {
    const body = await request.json();
    const taskId = String(body.taskId || "").trim();
    if (!taskId) return NextResponse.json({ success:false, error:"taskId is required." }, { status:400 });
    const task = await first<TaskRow>(`nkh_tasks?select=id,status,assigned_name_snapshot,priority&id=eq.${encodeURIComponent(taskId)}&limit=1`);
    if (!task) return NextResponse.json({ success:false, error:"Task not found." }, { status:404 });

    const patch:Record<string,unknown> = {};
    const requestedStatus = String(body.status || "").trim();
    const requestedPriority = String(body.priority || "").trim();
    const assignedTo = String(body.assignedTo || "").trim();
    let staff:StaffRow|null = null;
    if (assignedTo) {
      staff = await first<StaffRow>(`nkh_staff?select=id,display_name&or=(display_name.eq.${encodeURIComponent(assignedTo)},google_staff_name.eq.${encodeURIComponent(assignedTo)})&limit=1`);
      if (!staff) return NextResponse.json({ success:false, error:"Assigned staff member not found." }, { status:400 });
      patch.assigned_staff_id = staff.id;
      patch.assigned_name_snapshot = assignedTo;
    }
    if (requestedPriority) {
      if (!allowedPriority.has(requestedPriority)) return NextResponse.json({ success:false, error:"Invalid priority." }, { status:400 });
      patch.priority = requestedPriority;
    }
    if (requestedStatus) {
      if (!allowedStatus.has(requestedStatus)) return NextResponse.json({ success:false, error:"Invalid status." }, { status:400 });
      patch.status = requestedStatus;
      const now = new Date().toISOString();
      if (requestedStatus === "In Progress") patch.started_at = now;
      if (requestedStatus === "Done") { patch.completed_at = now; patch.completed_by_name_snapshot = AI_SUPERVISOR_NAME; }
    }
    if (body.note !== undefined) patch.notes = String(body.note || "").trim() || null;
    if (!Object.keys(patch).length) return NextResponse.json({ success:false, error:"No changes requested." }, { status:400 });

    await supabaseAdmin(`nkh_tasks?id=eq.${encodeURIComponent(task.id)}`, { method:"PATCH", prefer:"return=minimal", body:patch });
    await supabaseAdmin("nkh_task_events", { method:"POST", prefer:"return=minimal", body:{
      task_id:task.id,
      event_type:"AI Supervisor Update",
      from_status:task.status,
      to_status:requestedStatus || task.status,
      actor_staff_id:null,
      actor_name_snapshot:AI_SUPERVISOR_NAME,
      note:String(body.reason || body.note || "").trim() || null,
      event_data:{ previous_assignee:task.assigned_name_snapshot, assigned_to:assignedTo || task.assigned_name_snapshot, previous_priority:task.priority, priority:requestedPriority || task.priority }
    }});
    return NextResponse.json({ success:true, taskId:task.id, updated:true });
  } catch (error) {
    return NextResponse.json({ success:false, error:error instanceof Error ? error.message : "Supervisor task update failed." }, { status:500 });
  }
}
