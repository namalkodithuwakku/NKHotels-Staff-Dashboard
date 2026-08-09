import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { isSupervisorRequestAuthorized } from "../../lib/supervisorAuth";

type TaskRow = { id:string; status:string; priority:string; task_type:string; source:string; property_name_snapshot:string|null; booking_id:string|null; assigned_name_snapshot:string|null; subject:string; notes:string|null; created_at:string; started_at:string|null; completed_at:string|null; completion_note:string|null; source_metadata:Record<string,unknown>|null };

export async function GET(request: NextRequest) {
  if (!isSupervisorRequestAuthorized(request)) return NextResponse.json({ success:false, error:"Unauthorized" }, { status:401 });
  try {
    const url = new URL(request.url);
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") || 200)));
    const status = String(url.searchParams.get("status") || "").trim();
    const assignedTo = String(url.searchParams.get("assignedTo") || "").trim();
    const property = String(url.searchParams.get("property") || "").trim();
    const filters = ["archived_at=is.null"];
    if (status) filters.push(`status=eq.${encodeURIComponent(status)}`);
    if (assignedTo) filters.push(`assigned_name_snapshot=eq.${encodeURIComponent(assignedTo)}`);
    if (property) filters.push(`property_name_snapshot=eq.${encodeURIComponent(property)}`);
    const rows = await supabaseAdmin<TaskRow[]>(`nkh_tasks?select=id,status,priority,task_type,source,property_name_snapshot,booking_id,assigned_name_snapshot,subject,notes,created_at,started_at,completed_at,completion_note,source_metadata&${filters.join("&")}&order=created_at.desc&limit=${limit}`);
    return NextResponse.json({ success:true, count:rows.length, tasks:rows });
  } catch (error) {
    return NextResponse.json({ success:false, error:error instanceof Error ? error.message : "Unable to load supervisor tasks." }, { status:500 });
  }
}
