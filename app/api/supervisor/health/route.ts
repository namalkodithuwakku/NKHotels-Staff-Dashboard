import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { isSupervisorRequestAuthorized } from "../../../lib/supervisorAuth";

export async function GET(request: NextRequest) {
  if (!isSupervisorRequestAuthorized(request)) return NextResponse.json({ success:false, error:"Unauthorized" }, { status:401 });
  try {
    const started = Date.now();
    const rows = await supabaseAdmin<Array<{ id:string }>>("nkh_tasks?select=id&limit=1");
    return NextResponse.json({ success:true, service:"NKH AI Supervisor", supabase:true, taskStoreReachable:Array.isArray(rows), checkedAt:new Date().toISOString(), latencyMs:Date.now()-started });
  } catch (error) {
    return NextResponse.json({ success:false, service:"NKH AI Supervisor", supabase:false, error:error instanceof Error ? error.message : "Health check failed." }, { status:503 });
  }
}
