import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { AI_SUPERVISOR_NAME, isSupervisorRequestAuthorized } from "../../../lib/supervisorAuth";

type InboxRow = { id:string; status:string|null };
async function first<T>(path:string) { const rows = await supabaseAdmin<T[]>(path); return rows[0] || null; }

export async function POST(request: NextRequest) {
  if (!isSupervisorRequestAuthorized(request)) return NextResponse.json({ success:false, error:"Unauthorized" }, { status:401 });
  try {
    const body = await request.json();
    const emailId = String(body.emailId || "").trim();
    const reason = String(body.reason || "Reviewed by AI Supervisor — no operational task required").trim();
    if (!emailId) return NextResponse.json({ success:false, error:"emailId is required." }, { status:400 });
    const inbox = await first<InboxRow>(`nkh_email_inbox?select=id,status&gmail_message_id=eq.${encodeURIComponent(emailId)}&limit=1`);
    if (!inbox) return NextResponse.json({ success:false, error:"Email not found." }, { status:404 });
    if (String(inbox.status || "").toLowerCase() !== "needs review") return NextResponse.json({ success:true, resolved:false, alreadyHandled:true });
    const now = new Date().toISOString();
    await Promise.all([
      supabaseAdmin(`nkh_email_inbox?id=eq.${encodeURIComponent(inbox.id)}`, { method:"PATCH", prefer:"return=minimal", body:{ status:"Reviewed by AI Supervisor", handled_by_staff_id:null, handled_by_name_snapshot:AI_SUPERVISOR_NAME, handled_at:now } }),
      supabaseAdmin("nkh_email_audit", { method:"POST", prefer:"return=minimal", body:{ email_inbox_id:inbox.id, gmail_message_id:emailId, action:"Reviewed — No Task Required", actor_staff_id:null, actor_name_snapshot:AI_SUPERVISOR_NAME, details:{ reason } } }),
    ]);
    return NextResponse.json({ success:true, resolved:true });
  } catch (error) {
    return NextResponse.json({ success:false, error:error instanceof Error ? error.message : "Unable to resolve supervisor email." }, { status:500 });
  }
}
