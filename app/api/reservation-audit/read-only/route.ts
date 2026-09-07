import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const runtime = "nodejs";

type Property = {
  id: string;
  client_code: string;
  property_name: string;
  calendar_sheet_code: string | null;
  calendar_source_mode: "google_sheet" | "supabase" | null;
};

type Booking = {
  id: string;
  property_id: string;
  source_key: string;
  booking_group_key: string | null;
  booking_reference: string | null;
  guest_name: string;
  room_name: string;
  room_type: string | null;
  booking_source: string;
  booking_status: string;
  check_in: string;
  check_out: string;
  notes: string | null;
};

type SyncState = Record<string, unknown>;

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function authorized(request: NextRequest) {
  const configured = String(process.env.NKH_RESERVATION_AUDIT_SECRET || "").trim();
  if (!configured) return false;
  const header = String(request.headers.get("authorization") || "").trim();
  if (!header.toLowerCase().startsWith("bearer ")) return false;
  const supplied = header.slice(7).trim();
  return Boolean(supplied) && safeEqual(supplied, configured);
}

function validDate(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export async function GET(request: NextRequest) {
  try {
    if (!process.env.NKH_RESERVATION_AUDIT_SECRET) {
      return NextResponse.json({ success: false, error: "Reservation audit access is not configured." }, { status: 503 });
    }
    if (!authorized(request)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const from = validDate(request.nextUrl.searchParams.get("from"));
    const to = validDate(request.nextUrl.searchParams.get("to"));
    const propertyFilter = String(request.nextUrl.searchParams.get("property") || "").trim();
    const reference = String(request.nextUrl.searchParams.get("reference") || "").trim();

    if (!from || !to) {
      return NextResponse.json({ success: false, error: "from and to are required in YYYY-MM-DD format." }, { status: 400 });
    }
    if (from >= to) {
      return NextResponse.json({ success: false, error: "to must be later than from." }, { status: 400 });
    }

    const properties = await supabaseAdmin<Property[]>(
      "nkh_properties?select=id,client_code,property_name,calendar_sheet_code,calendar_source_mode&client_status=in.(Active,Onboarding)&order=property_name.asc",
    );

    const wanted = propertyFilter.toLowerCase();
    const selected = propertyFilter
      ? properties.filter(item => item.id.toLowerCase() === wanted || item.client_code.toLowerCase() === wanted || item.property_name.toLowerCase() === wanted)
      : properties.filter(item => item.calendar_source_mode === "supabase" || Boolean(item.calendar_sheet_code));

    if (propertyFilter && selected.length === 0) {
      return NextResponse.json({ success: false, error: "Property not found." }, { status: 404 });
    }

    const results = await Promise.all(selected.map(async property => {
      const propertyId = encodeURIComponent(property.id);
      let bookingPath = `nkh_calendar_bookings?property_id=eq.${propertyId}&check_in=lt.${encodeURIComponent(to)}&check_out=gt.${encodeURIComponent(from)}&select=id,property_id,source_key,booking_group_key,booking_reference,guest_name,room_name,room_type,booking_source,booking_status,check_in,check_out,notes&order=check_in.asc,guest_name.asc`;
      if (reference) bookingPath += `&booking_reference=eq.${encodeURIComponent(reference)}`;

      const [bookings, syncRows] = await Promise.all([
        supabaseAdmin<Booking[]>(bookingPath),
        supabaseAdmin<SyncState[]>(`nkh_calendar_sync_state?property_id=eq.${propertyId}&select=*`),
      ]);

      return {
        property: { id: property.id, code: property.client_code, name: property.property_name },
        sync: syncRows[0] || null,
        bookings,
      };
    }));

    return NextResponse.json({
      success: true,
      readOnly: true,
      generatedAt: new Date().toISOString(),
      window: { from, to },
      filters: { property: propertyFilter || null, reference: reference || null },
      summary: {
        properties: results.length,
        bookings: results.reduce((sum, item) => sum + item.bookings.length, 0),
      },
      properties: results,
    }, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to load reservation calendar data." }, { status: 500 });
  }
}
