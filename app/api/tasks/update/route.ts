import { after, NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { readServerSession } from "../../../lib/serverSession";
import { authorizeNKH } from "../../../lib/nkhAuthorization";
import { sendWhatsAppTaskDone } from "../../../lib/whatsappTaskNotifications";

type TaskRow = {
  id: string;
  status: string;
  subject: string | null;
  property_name_snapshot: string | null;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeNKH(request,"operations.assigned");
    if (!auth.ok) return NextResponse.json({success:false,error:"Task access unavailable."},{status:auth.status});
    const session = readServerSession(request)!;
    const input = await request.json();
    const taskId = String(input.taskId || "");
    const requested = String(input.status || "");
    const staffName = session.name;
    const completionNote = String(input.completionNote || "").slice(0,4000);
    if (!["pending","in progress","done","completed"].includes(requested.trim().toLowerCase())) return NextResponse.json({success:false,error:"Invalid task status."},{status:400});
    const status = requested.toLowerCase().includes("progress") ? "In Progress" : requested.toLowerCase().includes("done") || requested.toLowerCase().includes("complete") ? "Done" : "Pending";
    if (!taskId) return NextResponse.json({ success: false, error: "Task ID is required." }, { status: 400 });

    const filter = uuid.test(taskId) ? `id=eq.${encodeURIComponent(taskId)}` : `legacy_task_id=eq.${encodeURIComponent(taskId)}`;
    const tasks = await supabaseAdmin<TaskRow[]>(`nkh_tasks?select=id,status,subject,property_name_snapshot&${filter}&archived_at=is.null&limit=1`);
    const task = tasks[0];
    if (!task) return NextResponse.json({ success: false, error: "Task was not found." }, { status: 404 });
    const staff = {id:auth.staffId};
    const now = new Date().toISOString();
    const update: Record<string, unknown> = { status };
    if (status === "In Progress") { update.started_at = now; update.assigned_staff_id = staff?.id || null; update.assigned_name_snapshot = staffName || null; }
    if (status === "Done") { update.completed_at = now; update.completed_by_staff_id = staff?.id || null; update.completed_by_name_snapshot = staffName || null; update.completion_note = completionNote || null; }
    await supabaseAdmin(`nkh_tasks?id=eq.${task.id}`, { method: "PATCH", prefer: "return=minimal", body: update });
    after(async () => {
      try {
        await Promise.all([
          supabaseAdmin("nkh_task_events", { method: "POST", prefer: "return=minimal", body: {
            task_id: task.id, event_type: status === "Done" ? "Completed" : status === "In Progress" ? "Started" : "Status Changed",
            from_status: task.status, to_status: status, actor_staff_id: staff?.id || null, actor_name_snapshot: staffName || null,
            note: completionNote || null,
          }}),
          supabaseAdmin(`wa_task_links?dashboard_task_id=eq.${encodeURIComponent(task.id)}`, {
            method: "PATCH",
            prefer: "return=minimal",
            body: status === "Done"
              ? { task_status: status, assigned_to: staffName || null, completion_note: completionNote || null }
              : { task_status: status, assigned_to: staffName || null },
          }),
        ]);
        if (status === "Done") {
          await sendWhatsAppTaskDone({
            taskId: task.id,
            property: task.property_name_snapshot,
            subject: task.subject,
            staffName,
            completionNote,
          });
        }
      } catch (reason) {
        console.error("Background task completion follow-up failed", {
          taskId: task.id,
          error: reason instanceof Error ? reason.message : String(reason),
        });
      }
    });
    return NextResponse.json({
      success: true,
      taskId: task.id,
      status,
      backgroundFollowUpQueued: true,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Task update failed." }, { status: 500 });
  }
}
