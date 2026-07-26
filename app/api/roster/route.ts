import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { canManageProperties, readServerSession } from "../../lib/serverSession";

type Staff = { id: string; display_name: string; color_hex: string; employment_status: string };
type Property = { id: string; property_name: string; client_code: string };
type Entry = { id: string; staff_id: string; property_id: string | null; shift_date: string; start_time: string | null; end_time: string | null; status: string; shift_label: string | null; notes: string | null };

function authenticated(request: NextRequest) { return canManageProperties(readServerSession(request)); }
function dateValue(value: unknown) {
  const text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error("A valid shift date is required.");
  return text;
}
function monthDates(anchorValue: string, mode: string, weekdaysValue: unknown) {
  if (mode === "single") return [anchorValue];
  const anchor = new Date(`${anchorValue}T12:00:00`);
  const weekdays = Array.from(new Set((Array.isArray(weekdaysValue) ? weekdaysValue : [])
    .map(value => Number(value))
    .filter(value => Number.isInteger(value) && value >= 0 && value <= 6)));
  if (!weekdays.length) weekdays.push(anchor.getDay());
  const start = mode === "full_month"
    ? new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12)
    : new Date(anchor);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 12);
  const result: string[] = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    if (weekdays.includes(cursor.getDay())) {
      result.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`);
    }
  }
  return result.slice(0, 31);
}
function entryBody(input: Record<string, unknown>, status: string, shiftDate: string, createdBy?: string | null) {
  return {
    staff_id: input.staff_id,
    property_id: status === "Scheduled" ? input.property_id || null : null,
    shift_date: shiftDate,
    start_time: status === "Scheduled" ? input.start_time : null,
    end_time: status === "Scheduled" ? input.end_time : null,
    status,
    shift_label: input.shift_label || null,
    notes: input.notes || null,
    ...(createdBy !== undefined ? { source: "Dashboard", created_by: createdBy } : {}),
  };
}
function samePattern(entry: Entry, status: string, startTime: unknown) {
  if (entry.status !== status) return false;
  if (status !== "Scheduled") return true;
  return String(entry.start_time || "").slice(0, 5) === String(startTime || "").slice(0, 5);
}
async function monthEntries(staffId: unknown, dates: string[]) {
  if (!dates.length) return [];
  return supabaseAdmin<Entry[]>(
    `nkh_roster_entries?select=id,staff_id,property_id,shift_date,start_time,end_time,status,shift_label,notes&staff_id=eq.${encodeURIComponent(String(staffId))}&shift_date=gte.${dates[0]}&shift_date=lte.${dates[dates.length - 1]}&status=neq.Cancelled`
  );
}

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
    const input = await request.json() as Record<string, unknown>;
    const status = String(input.status || "Scheduled");
    if (!input.staff_id || !input.shift_date) return NextResponse.json({ error: "Staff member and date are required." }, { status: 400 });
    if (status === "Scheduled" && (!input.start_time || !input.end_time)) return NextResponse.json({ error: "Start and end times are required for a scheduled shift." }, { status: 400 });
    const anchor = dateValue(input.shift_date);
    const dates = monthDates(anchor, String(input.apply_mode || "single"), input.repeat_weekdays);
    const existing = await monthEntries(input.staff_id, dates);
    const rows = dates
      .filter(shiftDate => !existing.some(entry => entry.shift_date === shiftDate && samePattern(entry, status, input.start_time)))
      .map(shiftDate => entryBody(input, status, shiftDate, session?.name || null));
    const data = rows.length
      ? await supabaseAdmin<Entry[]>("nkh_roster_entries", { method: "POST", prefer: "return=representation", body: rows })
      : [];
    return NextResponse.json({ success: true, first: data[0] || null, created: data.length, skipped: dates.length - data.length }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create shift." }, { status: 500 }); }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!authenticated(request)) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const input = await request.json() as Record<string, unknown>;
    if (!input.id) return NextResponse.json({ error: "Shift ID is required." }, { status: 400 });
    const status = String(input.status || "Scheduled");
    if (status === "Scheduled" && (!input.start_time || !input.end_time)) return NextResponse.json({ error: "Start and end times are required." }, { status: 400 });
    const anchor = dateValue(input.shift_date);
    const dates = monthDates(anchor, String(input.apply_mode || "single"), input.repeat_weekdays);
    const current = await supabaseAdmin<Entry[]>(`nkh_roster_entries?id=eq.${encodeURIComponent(String(input.id))}`, { method: "PATCH", prefer: "return=representation", body: entryBody(input, status, anchor) });
    if (dates.length === 1) return NextResponse.json({ success: true, first: current[0] || null, updated: current.length, created: 0, skipped: 0 });

    const existing = await monthEntries(input.staff_id, dates);
    const originalStatus = String(input.original_status || status);
    const originalStart = input.original_start_time;
    let updated = current.length;
    let skipped = 0;
    const creates: Array<Record<string, unknown>> = [];
    for (const shiftDate of dates.filter(value => value !== anchor)) {
      const candidates = existing.filter(entry => entry.shift_date === shiftDate);
      const match = candidates.find(entry => samePattern(entry, originalStatus, originalStart));
      if (match) {
        await supabaseAdmin(`nkh_roster_entries?id=eq.${encodeURIComponent(match.id)}`, { method: "PATCH", prefer: "return=minimal", body: entryBody(input, status, shiftDate) });
        updated += 1;
      } else if (candidates.some(entry => samePattern(entry, status, input.start_time))) {
        skipped += 1;
      } else {
        creates.push(entryBody(input, status, shiftDate));
      }
    }
    const created = creates.length
      ? await supabaseAdmin<Entry[]>("nkh_roster_entries", { method: "POST", prefer: "return=representation", body: creates })
      : [];
    return NextResponse.json({ success: true, first: current[0] || null, updated, created: created.length, skipped });
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
