import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type Staff = { id: string; display_name: string };
type Entry = { staff_id: string; shift_date: string; start_time: string | null; end_time: string | null; shift_label: string | null };

const slots = [
  { key: "reservations_06_12", start: "06:00", end: "12:00", label: "Reservations Management" },
  { key: "reservations_12_14", start: "12:00", end: "14:00", label: "Reservations Management" },
  { key: "reservations_14_16", start: "14:00", end: "16:00", label: "Reservations Management" },
  { key: "reservations_16_22", start: "16:00", end: "22:00", label: "Reservations Management" },
  { key: "digital_12_14", start: "12:00", end: "14:00", label: "Digital Marketing" },
  { key: "digital_14_16", start: "14:00", end: "16:00", label: "Digital Marketing" },
] as const;

function authorized(request: NextRequest) {
  const secret = process.env.NKH_ROSTER_SYNC_SECRET;
  return Boolean(secret && request.headers.get("x-nkh-roster-secret") === secret);
}
function canonicalName(value: unknown) {
  const name = String(value || "").trim();
  if (/^hasitha$/i.test(name)) return "Hashitha";
  return name;
}
function time5(value: string | null) { return String(value || "").slice(0, 5); }

export async function GET(request: NextRequest) {
  try {
    if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const from = request.nextUrl.searchParams.get("from") || new Date().toISOString().slice(0, 8) + "01";
    const to = request.nextUrl.searchParams.get("to") || "2027-12-31";
    const [staff, entries] = await Promise.all([
      supabaseAdmin<Staff[]>("nkh_staff?select=id,display_name&employment_status=eq.Active"),
      supabaseAdmin<Entry[]>(`nkh_roster_entries?select=staff_id,shift_date,start_time,end_time,shift_label&shift_date=gte.${encodeURIComponent(from)}&shift_date=lte.${encodeURIComponent(to)}&status=eq.Scheduled&order=shift_date.asc,start_time.asc`),
    ]);
    const names = new Map(staff.map(item => [item.id, item.display_name]));
    const byDate = new Map<string, Record<string, string>>();
    for (const entry of entries) {
      const slot = slots.find(item => item.start === time5(entry.start_time) && item.end === time5(entry.end_time) && item.label === entry.shift_label);
      if (!slot) continue;
      const row = byDate.get(entry.shift_date) || {};
      row[slot.key] = names.get(entry.staff_id) || "";
      byDate.set(entry.shift_date, row);
    }
    const rows = Array.from(byDate.entries()).map(([date, row]) => ({ date, ...row }));
    return NextResponse.json({ success: true, rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Roster export failed." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const payload = await request.json() as { rows?: Array<Record<string, unknown>> };
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    const dated = rows.filter(row => /^\d{4}-\d{2}-\d{2}$/.test(String(row.date || "")));
    if (!dated.length) return NextResponse.json({ success: true, imported: 0 });

    const staff = await supabaseAdmin<Staff[]>("nkh_staff?select=id,display_name&employment_status=eq.Active");
    const staffByName = new Map(staff.map(item => [item.display_name.toLowerCase(), item.id]));
    const minDate = dated.map(row => String(row.date)).sort()[0];
    const maxDate = dated.map(row => String(row.date)).sort().at(-1)!;

    await supabaseAdmin(
      `nkh_roster_entries?shift_date=gte.${minDate}&shift_date=lte.${maxDate}&shift_label=in.(Reservations%20Management,Digital%20Marketing)`,
      { method: "DELETE", prefer: "return=minimal" }
    );

    const inserts: Record<string, unknown>[] = [];
    for (const row of dated) {
      for (const slot of slots) {
        const name = canonicalName(row[slot.key]);
        if (!name) continue;
        const staffId = staffByName.get(name.toLowerCase());
        if (!staffId) continue;
        inserts.push({
          staff_id: staffId, shift_date: String(row.date), start_time: slot.start, end_time: slot.end,
          status: "Scheduled", shift_label: slot.label, source: "Live Roster Sheet",
          notes: "Synced from NK Hotels Live Roster"
        });
      }
    }
    if (inserts.length) await supabaseAdmin("nkh_roster_entries", { method: "POST", prefer: "return=minimal", body: inserts });
    return NextResponse.json({ success: true, imported: inserts.length, dates: dated.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Roster import failed." }, { status: 500 });
  }
}
