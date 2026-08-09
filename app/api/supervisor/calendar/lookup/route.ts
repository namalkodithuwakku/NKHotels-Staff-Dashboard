import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { isSupervisorRequestAuthorized } from "../../../lib/supervisorAuth";

type PropertyRow = { id: string; property_name: string; client_code?: string | null };
type BookingRow = {
  id: string;
  property_id: string;
  booking_reference: string | null;
  guest_name: string | null;
  booking_source: string | null;
  booking_status: string | null;
  check_in: string | null;
  check_out: string | null;
  room_name: string | null;
};

function clean(value: string | null, max = 200) {
  return String(value || "").trim().slice(0, max);
}

export async function GET(request: NextRequest) {
  if (!isSupervisorRequestAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const reference = clean(request.nextUrl.searchParams.get("reference"), 120);
    const propertyName = clean(request.nextUrl.searchParams.get("property"), 200);
    const guestName = clean(request.nextUrl.searchParams.get("guest"), 200);
    const checkIn = clean(request.nextUrl.searchParams.get("checkIn"), 20);
    const checkOut = clean(request.nextUrl.searchParams.get("checkOut"), 20);

    if (!reference && !propertyName && !guestName) {
      return NextResponse.json({ success: false, error: "Provide at least reference, property, or guest." }, { status: 400 });
    }

    let propertyId: string | null = null;
    let property: PropertyRow | null = null;
    if (propertyName) {
      const rows = await supabaseAdmin<PropertyRow[]>(
        `nkh_properties?select=id,property_name,client_code&property_name=eq.${encodeURIComponent(propertyName)}&limit=1`
      );
      property = rows[0] || null;
      propertyId = property?.id || null;
    }

    const filters = ["select=id,property_id,booking_reference,guest_name,booking_source,booking_status,check_in,check_out,room_name", "booking_status=neq.Cancelled", "limit=50"];
    if (propertyId) filters.push(`property_id=eq.${encodeURIComponent(propertyId)}`);
    if (reference) filters.push(`booking_reference=eq.${encodeURIComponent(reference)}`);
    if (!reference && guestName) filters.push(`guest_name=ilike.${encodeURIComponent(`*${guestName}*`)}`);
    if (checkIn) filters.push(`check_in=eq.${encodeURIComponent(checkIn)}`);
    if (checkOut) filters.push(`check_out=eq.${encodeURIComponent(checkOut)}`);

    const bookings = await supabaseAdmin<BookingRow[]>(`nkh_calendar_bookings?${filters.join("&")}`);

    return NextResponse.json({
      success: true,
      found: bookings.length > 0,
      matchedBy: reference ? "booking_reference" : "property_guest_dates",
      property,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Calendar lookup failed." }, { status: 500 });
  }
}
