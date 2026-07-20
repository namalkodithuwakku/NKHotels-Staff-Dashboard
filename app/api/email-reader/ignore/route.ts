import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { isMasterSession, readServerSession } from "../../../lib/serverSession";

export async function POST(request: NextRequest) {
  try {
    const session = readServerSession(request);
    if (!session) return NextResponse.json({ success: false, error: "Please sign in again." }, { status: 401 });
    const body = await request.json();
    const singleId = String(body.emailId || "").trim();
    const emailIds = Array.from(new Set([
      ...((Array.isArray(body.emailIds) ? body.emailIds : []).map((value: unknown) => String(value || "").trim())),
      ...(singleId ? [singleId] : []),
    ].filter(Boolean))).slice(0, 100);
    if (!emailIds.length) return NextResponse.json({ success: false, error: "Email ID required." }, { status: 400 });
    if (emailIds.length > 1 && !isMasterSession(session)) return NextResponse.json({ success: false, error: "Bulk ignore is available to Master only." }, { status: 403 });

    const staffRows = await supabaseAdmin<Array<{ id: string }>>(`nkh_staff?select=id&or=(display_name.eq.${encodeURIComponent(session.name)},google_staff_name.eq.${encodeURIComponent(session.name)})&limit=1`);
    const now = new Date().toISOString(), reason = String(body.reason || "No action required").trim();
    const results = await Promise.all(emailIds.map(async emailId => {
      try {
        const rows = await supabaseAdmin<Array<{ id: string }>>(`nkh_email_inbox?select=id&gmail_message_id=eq.${encodeURIComponent(emailId)}&status=eq.Needs%20Review&limit=1`);
        if (!rows[0]) return { emailId, success: false, error: "Email was not found or already handled." };
        await Promise.all([
          supabaseAdmin(`nkh_email_inbox?id=eq.${rows[0].id}`, { method: "PATCH", prefer: "return=minimal", body: { status: "Ignored", handled_at: now, handled_by_staff_id: staffRows[0]?.id || null, handled_by_name_snapshot: session.name } }),
          supabaseAdmin("nkh_email_audit", { method: "POST", prefer: "return=minimal", body: { email_inbox_id: rows[0].id, gmail_message_id: emailId, action: "Ignored", actor_staff_id: staffRows[0]?.id || null, actor_name_snapshot: session.name, details: { reason } } }),
        ]);
        return { emailId, success: true };
      } catch (error) { return { emailId, success: false, error: error instanceof Error ? error.message : "Ignore failed." }; }
    }));
    const ignored = results.filter(row => row.success).map(row => row.emailId), failed = results.filter(row => !row.success);
    return NextResponse.json({ success: failed.length === 0, ignored, ignoredCount: ignored.length, failed }, { status: failed.length ? 207 : 200 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to ignore email." }, { status: 500 });
  }
}