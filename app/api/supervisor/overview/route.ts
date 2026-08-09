import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { isSupervisorRequestAuthorized } from "../../../lib/supervisorAuth";

type TaskRow = { id:string; status:string; priority:string; task_type:string; source:string; property_name_snapshot:string|null; booking_id:string|null; assigned_name_snapshot:string|null; subject:string; notes:string|null; created_at:string; started_at:string|null; completed_at:string|null };
type EmailRow = { id:string; received_at:string|null };
type StaffRow = { id:string; display_name:string|null; access_level:string|null; employment_status:string|null };

function isClosed(status:string) { return ["done","completed","ignored","acknowledged","cancelled","canceled"].some(v => status.toLowerCase().includes(v)); }

export async function GET(request: NextRequest) {
  if (!isSupervisorRequestAuthorized(request)) return NextResponse.json({ success:false, error:"Unauthorized" }, { status:401 });
  try {
    const [tasks, emails, staff] = await Promise.all([
      supabaseAdmin<TaskRow[]>("nkh_tasks?select=id,status,priority,task_type,source,property_name_snapshot,booking_id,assigned_name_snapshot,subject,notes,created_at,started_at,completed_at&archived_at=is.null&order=created_at.desc&limit=500"),
      supabaseAdmin<EmailRow[]>("nkh_email_inbox?select=id,received_at&status=eq.Needs%20Review&order=received_at.asc&limit=200"),
      supabaseAdmin<StaffRow[]>("nkh_staff?select=id,display_name,access_level,employment_status&order=display_name.asc&limit=100"),
    ]);
    const now = Date.now();
    const open = tasks.filter(t => !isClosed(t.status));
    const urgent = open.filter(t => ["high","urgent","critical"].includes(String(t.priority||"").toLowerCase()));
    const overdue = open.filter(t => now - new Date(t.created_at).getTime() >= 6*60*60*1000);
    const stale = open.filter(t => now - new Date(t.created_at).getTime() >= 24*60*60*1000);
    const inProgress = open.filter(t => String(t.status).toLowerCase().includes("progress"));
    const unassigned = open.filter(t => !t.assigned_name_snapshot);
    const activeStaff = staff.filter(s => String(s.employment_status || "").toLowerCase() === "active");
    return NextResponse.json({
      success:true,
      generatedAt:new Date().toISOString(),
      counts:{ open:open.length, urgent:urgent.length, inProgress:inProgress.length, overdue6h:overdue.length, stale24h:stale.length, unassigned:unassigned.length, emailQueue:emails.length, activeStaff:activeStaff.length },
      urgentTasks:urgent.slice(0,30),
      overdueTasks:overdue.slice(0,50),
      unassignedTasks:unassigned.slice(0,30),
      staff:staff.map(s=>({ id:s.id, name:s.display_name||"", access:s.access_level||"", status:s.employment_status||"" })),
    });
  } catch (error) {
    return NextResponse.json({ success:false, error:error instanceof Error ? error.message : "Unable to build supervisor overview." }, { status:500 });
  }
}
