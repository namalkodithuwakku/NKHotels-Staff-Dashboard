import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { isMasterSession, readServerSession } from "../../lib/serverSession";

type Property = { id: string; client_code: string; property_name: string; calendar_sheet_code: string | null; calendar_source_mode: "google_sheet" | "supabase"; currency_code: string | null };
type Room = { id: string; property_id: string; source_key: string; room_name: string; room_type: string | null; room_status: string; sort_order: number };
type Booking = { id: string; property_id: string; source_key: string; booking_group_key: string | null; booking_reference: string | null; guest_name: string; room_name: string; room_type: string | null; booking_source: string; booking_status: string; check_in: string; check_out: string; notes: string | null };
function validDate(value: string | null) { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null; }

function validMonth(value: string | null) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  return value;
}

export async function GET(request: NextRequest) {
  try {
    const session = readServerSession(request);
    if (!session) {
      return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    }
    const month = validMonth(request.nextUrl.searchParams.get("month"));
    const requestedProperty = String(request.nextUrl.searchParams.get("propertyId") || "");
    const properties = await supabaseAdmin<Property[]>(
      "nkh_properties?select=id,client_code,property_name,calendar_sheet_code,calendar_source_mode,currency_code&client_status=in.(Active,Onboarding)&order=property_name.asc"
    );
    const property = properties.find(item => item.id === requestedProperty)
      || properties.find(item => item.calendar_source_mode === "supabase" || Boolean(item.calendar_sheet_code))
      || properties[0]
      || null;
    if (!property) return NextResponse.json({ properties: [], property: null, rooms: [], bookings: [], sync: null, month });

    const [year, monthNumber] = month.split("-").map(Number);
    const requestedFrom = validDate(request.nextUrl.searchParams.get("from"));
    const requestedTo = validDate(request.nextUrl.searchParams.get("to"));
    const from = requestedFrom || `${month}-01`;
    const toDate = new Date(Date.UTC(year, monthNumber, 1));
    const to = requestedTo || `${toDate.getUTCFullYear()}-${String(toDate.getUTCMonth() + 1).padStart(2, "0")}-01`;
    const propertyId = encodeURIComponent(property.id);
    const [rooms, bookings, syncRows] = await Promise.all([
      supabaseAdmin<Room[]>(`nkh_calendar_rooms?property_id=eq.${propertyId}&select=*&order=sort_order.asc,room_name.asc`),
      supabaseAdmin<Booking[]>(`nkh_calendar_bookings?property_id=eq.${propertyId}&booking_status=neq.Cancelled&check_in=lt.${to}&check_out=gt.${from}&select=*&order=check_in.asc,room_name.asc`),
      supabaseAdmin<unknown[]>(`nkh_calendar_sync_state?property_id=eq.${propertyId}&select=*`),
    ]);
    return NextResponse.json({ properties, property, rooms, bookings, sync: syncRows[0] || null, month, permissions: { canDelete: isMasterSession(session) } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load calendar." }, { status: 500 });
  }
}
