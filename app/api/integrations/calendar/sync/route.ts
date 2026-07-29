import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type RoomInput = { sourceKey?: string; roomName?: string; roomType?: string; roomStatus?: string; sortOrder?: number };
type BookingInput = { sourceKey?: string; groupKey?: string; bookingReference?: string; guestName?: string; roomName?: string; roomType?: string; bookingSource?: string; bookingStatus?: string; checkIn?: string; checkOut?: string; notes?: string };

function authorized(request: NextRequest) {
  const configured = String(process.env.NKH_CALENDAR_SYNC_SECRET || "");
  const supplied = String(request.headers.get("x-nkh-calendar-secret") || "");
  return Boolean(configured && supplied && configured === supplied);
}
function text(value: unknown, fallback = "") { return String(value ?? fallback).trim(); }

export async function GET(request: NextRequest) {
  try {
    if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const properties = await supabaseAdmin<Array<{ id: string; client_code: string; property_name: string; calendar_sheet_code: string }>>(
      "nkh_properties?select=id,client_code,property_name,calendar_sheet_code&client_status=in.(Active,Onboarding)&calendar_source_mode=eq.google_sheet&calendar_sheet_code=not.is.null&order=property_name.asc"
    );
    return NextResponse.json({ success: true, properties });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load calendar sources." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const input = await request.json() as { propertyId?: string; rooms?: RoomInput[]; bookings?: BookingInput[]; error?: string };
    const propertyId = text(input.propertyId);
    if (!propertyId) return NextResponse.json({ error: "Property ID is required." }, { status: 400 });
    const sourceRows = await supabaseAdmin<Array<{ calendar_source_mode: string }>>(
      `nkh_properties?id=eq.${encodeURIComponent(propertyId)}&select=calendar_source_mode&limit=1`
    );
    if (sourceRows[0]?.calendar_source_mode !== "google_sheet") {
      return NextResponse.json({ error: "Google Sheet sync is off for this property." }, { status: 409 });
    }
    const now = new Date().toISOString();

    if (input.error) {
      await supabaseAdmin("nkh_calendar_sync_state?on_conflict=property_id", {
        method: "POST", prefer: "resolution=merge-duplicates,return=minimal",
        body: { property_id: propertyId, last_started_at: now, last_status: "Failed", last_error: text(input.error).slice(0, 1000), updated_at: now },
      });
      return NextResponse.json({ success: false, recorded: true });
    }

    const rooms = (Array.isArray(input.rooms) ? input.rooms : [])
      .map((room, index) => ({
        property_id: propertyId,
        source_key: text(room.sourceKey, text(room.roomName)),
        room_name: text(room.roomName),
        room_type: text(room.roomType) || null,
        room_status: text(room.roomStatus, "Available"),
        sort_order: Number.isFinite(Number(room.sortOrder)) ? Number(room.sortOrder) : index,
        updated_at: now,
      }))
      .filter(room => room.source_key && room.room_name);
    const bookings = (Array.isArray(input.bookings) ? input.bookings : [])
      .map(booking => ({
        property_id: propertyId,
        source_key: text(booking.sourceKey, `${text(booking.roomName)}|${text(booking.checkIn)}|${text(booking.checkOut)}|${text(booking.guestName)}`),
        booking_group_key: text(booking.groupKey, `${text(booking.guestName).toLowerCase()}|${text(booking.bookingSource, "FIT").toLowerCase()}|${text(booking.checkIn)}|${text(booking.checkOut)}|${text(booking.notes).toLowerCase()}`),
        booking_reference: text(booking.bookingReference) || null,
        guest_name: text(booking.guestName, "Guest"),
        room_name: text(booking.roomName),
        room_type: text(booking.roomType) || null,
        booking_source: text(booking.bookingSource, "FIT"),
        booking_status: text(booking.bookingStatus, "Confirmed"),
        check_in: text(booking.checkIn),
        check_out: text(booking.checkOut),
        notes: text(booking.notes) || null,
        updated_at: now,
      }))
      .filter(booking => booking.source_key && booking.room_name && /^\d{4}-\d{2}-\d{2}$/.test(booking.check_in) && /^\d{4}-\d{2}-\d{2}$/.test(booking.check_out) && booking.check_out > booking.check_in);

    await Promise.all([
      supabaseAdmin(`nkh_calendar_rooms?property_id=eq.${encodeURIComponent(propertyId)}`, { method: "DELETE", prefer: "return=minimal" }),
      supabaseAdmin(`nkh_calendar_bookings?property_id=eq.${encodeURIComponent(propertyId)}`, { method: "DELETE", prefer: "return=minimal" }),
    ]);
    if (rooms.length) await supabaseAdmin("nkh_calendar_rooms", { method: "POST", prefer: "return=minimal", body: rooms });
    if (bookings.length) await supabaseAdmin("nkh_calendar_bookings", { method: "POST", prefer: "return=minimal", body: bookings });
    await supabaseAdmin("nkh_calendar_sync_state?on_conflict=property_id", {
      method: "POST", prefer: "resolution=merge-duplicates,return=minimal",
      body: { property_id: propertyId, last_started_at: now, last_completed_at: now, last_status: "Ready", last_error: null, rooms_synced: rooms.length, bookings_synced: bookings.length, updated_at: now },
    });
    return NextResponse.json({ success: true, rooms: rooms.length, bookings: bookings.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Calendar sync failed." }, { status: 500 });
  }
}
