import { NextRequest, NextResponse } from "next/server";
import { emailAddress, emailSubjectPattern } from "../../../lib/emailLearning";
import { canManageProperties, readServerSession } from "../../../lib/serverSession";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
type Task = { id:string; status:string; source_email_id:string|null; subject:string|null; source_metadata:{sender?:string}|null };
type Rule = { id:string; ignore_count:number };
export async function POST(request: NextRequest) {
  try {
    const session = readServerSession(request);
    if (!canManageProperties(session)) return NextResponse.json({success:false,error:"Please sign in again."},{status:401});
    const input = await request.json();
    const ids = Array.from(new Set((Array.isArray(input.taskIds)?input.taskIds:[input.taskId]).filter(Boolean))).slice(0,100) as string[];
    const reason = String(input.reason || "No action required").trim().slice(0,500);
    if (!ids.length) return NextResponse.json({success:false,error:"Select at least one task."},{status:400});
    let ignored=0;
    for (const id of ids) {
      const task=(await supabaseAdmin<Task[]>(`nkh_tasks?id=eq.${encodeURIComponent(id)}&select=id,status,source_email_id,subject,source_metadata&limit=1`))[0];
      if (!task) continue;
      await supabaseAdmin(`nkh_tasks?id=eq.${task.id}`,{method:"PATCH",prefer:"return=minimal",body:{status:"Ignored"}});
      await supabaseAdmin("nkh_task_events",{method:"POST",prefer:"return=minimal",body:{task_id:task.id,event_type:"Ignored",from_status:task.status,to_status:"Ignored",actor_name_snapshot:session?.name||null,note:reason}});
      const sender=emailAddress(String(task.source_metadata?.sender||""));
      if (task.source_email_id && sender) {
        const pattern=emailSubjectPattern(String(task.subject||""));
        const rule=(await supabaseAdmin<Rule[]>(`nkh_email_filter_rules?sender_key=eq.${encodeURIComponent(sender)}&subject_pattern=eq.${encodeURIComponent(pattern)}&select=id,ignore_count&limit=1`))[0];
        const count=Number(rule?.ignore_count||0)+1;
        if(rule) await supabaseAdmin(`nkh_email_filter_rules?id=eq.${rule.id}`,{method:"PATCH",prefer:"return=minimal",body:{ignore_count:count,is_active:count>=3,ignore_reason:reason,last_ignored_at:new Date().toISOString()}});
        else await supabaseAdmin("nkh_email_filter_rules",{method:"POST",prefer:"return=minimal",body:{sender_key:sender,subject_pattern:pattern,ignore_count:1,is_active:false,ignore_reason:reason}});
        await supabaseAdmin("nkh_email_filter_feedback",{method:"POST",prefer:"return=minimal",body:{task_id:task.id,source_email_id:task.source_email_id,sender_key:sender,subject_pattern:pattern,ignore_reason:reason,actor_name:session?.name||null}});
      }
      ignored++;
    }
    return NextResponse.json({success:true,ignored});
  } catch(error) { return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to ignore tasks."},{status:500}); }
}
