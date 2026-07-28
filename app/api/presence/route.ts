import { NextRequest, NextResponse } from "next/server";
import { readServerSession } from "../../lib/serverSession";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

export async function POST(request: NextRequest) {
  try {
    const session = readServerSession(request);
    if (!session) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const input = await request.json().catch(() => ({}));
    const staff = await supabaseAdmin<Array<{ id: string }>>(`nkh_staff?select=id&or=(display_name.eq.${encodeURIComponent(session.name)},google_staff_name.eq.${encodeURIComponent(session.name)})&employment_status=eq.Active&limit=1`);
    if (!staff[0]) return NextResponse.json({ error: "Staff profile was not found." }, { status: 404 });
    const now = new Date().toISOString(), visible = input.visibility_state !== "Hidden";
    await supabaseAdmin("nkh_staff_presence?on_conflict=staff_id", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: { staff_id: staff[0].id, last_seen_at: now, ...(visible ? { last_active_at: now } : {}), visibility_state: visible ? "Visible" : "Hidden", current_view: String(input.current_view || "").slice(0, 80) || null, updated_at: now } });
    return NextResponse.json({ success: true, at: now });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update presence." }, { status: 500 }); }
}
