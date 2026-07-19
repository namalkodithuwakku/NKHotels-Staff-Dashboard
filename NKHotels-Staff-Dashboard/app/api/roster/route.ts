import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { canManageProperties, readServerSession } from "../../lib/serverSession";

type Staff = { id: string; display_name: string; color_hex: string; employment_status: string };
type Property = { id: string; property_name: string; client_code: string };
type Entry = { id: string; staff_id: string; property_id: string | null; shift_date: string; start_time: string | null; end_time: string | null; status: string; shift_label: string | null; notes: string | null };

function authenticated(request: NextRequest) { return canManageProperties(readServerSession(request)); }

export async function GET(request: NextRequest) {
  try {
    if (!authenticated(request)) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");
    if (!from || !to) return NextResponse.json({ error: "A date range is required." }, { status: 400 });
    const [staff, properties, entries] = await Promise.all([
      supabaseAdmin<Staff[]>("nkh_staff?select=id,display_name,color_hex,employment_status&employment_status=eq.Active&order=display_name.asc"),
      supabaseAdmin<Property[]>("nkh_properties?select=id,property_name,client_code&client_status=in.(Active,Onboarding)&order=property_name.asc"),
      supabaseAdmin<Entry[]>(`nkh_roster_entries?select=id,staff_id,property_id,shift_date,start_time,end_time,status,shift_label,notes&shift_date=gte.${encodeURIComponent(from)}&shift_date=lte.${encodeURIComponent(to)}&status=neq.Cancelled&order=start_time.asc.nullslast`),
    ]);
    return NextResponse.json({ staff, properties, entries });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load roster." }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  try {
    const session = readServerSession(request);
    if (!canManageProperties(session)) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const input = await request.json();
    const status = String(input.status || "Scheduled");
    if (!input.staff_id || !input.shift_date) return NextResponse.json({ error: "Staff member and date are required." }, { status: 400 });
    if (status === "Scheduled" && (!input.start_time || !input.end_time)) return NextResponse.json({ error: "Start and end times are required for a scheduled shift." }, { status: 400 });
    const data = await supabaseAdmin<Entry[]>("nkh_roster_entries", { method: "POST", prefer: "return=representation", body: { staff_id: input.staff_id, property_id: input.property_id || null, shift_date: input.shift_date, start_time: status === "Scheduled" ? input.start_time : null, end_time: status === "Scheduled" ? input.end_time : null, status, shift_label: input.shift_label || null, notes: input.notes || null, source: "Dashboard", created_by: session?.name || null } });
    return NextResponse.json(data[0], { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create shift." }, { status: 500 }); }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!authenticated(request)) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const input = await request.json();
    if (!input.id) return NextResponse.json({ error: "Shift ID is required." }, { status: 400 });
    const status = String(input.status || "Scheduled");
    if (status === "Scheduled" && (!input.start_time || !input.end_time)) return NextResponse.json({ error: "Start and end times are required." }, { status: 400 });
    const data = await supabaseAdmin<Entry[]>(`nkh_roster_entries?id=eq.${encodeURIComponent(input.id)}`, { method: "PATCH", prefer: "return=representation", body: { staff_id: input.staff_id, property_id: input.property_id || null, shift_date: input.shift_date, start_time: status === "Scheduled" ? input.start_time : null, end_time: status === "Scheduled" ? input.end_time : null, status, shift_label: input.shift_label || null, notes: input.notes || null } });
    return NextResponse.json(data[0]);
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update shift." }, { status: 500 }); }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!authenticated(request)) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Shift ID is required." }, { status: 400 });
    await supabaseAdmin(`nkh_roster_entries?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", prefer: "return=minimal" });
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete shift." }, { status: 500 }); }
}
