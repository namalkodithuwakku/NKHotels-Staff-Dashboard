import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { readServerSession } from "../../../lib/serverSession";

type Property = { calendar_source_mode: string };
type Room = { room_name: string; room_type: string | null };
type Existing = { id: string };

async function editableProperty(propertyId: string) {
  const rows = await supabaseAdmin<Property[]>(
    `nkh_properties?id=eq.${encodeURIComponent(propertyId)}&select=calendar_source_mode&limit=1`
  );
  return rows[0]?.calendar_source_mode === "supabase";
}

async function selectedRoom(propertyId: string, roomName: string) {
  const rows = await supabaseAdmin<Room[]>(
    `nkh_calendar_rooms?property_id=eq.${encodeURIComponent(propertyId)}&room_name=eq.${encodeURIComponent(roomName)}&select=room_name,room_type&limit=1`
  );
  return rows[0] || null;
}

async function hasCollision(propertyId: string, roomName: string, checkIn: string, checkOut: string, ignoredId = "") {
  const rows = await supabaseAdmin<Existing[]>(
    `nkh_calendar_bookings?property_id=eq.${encodeURIComponent(propertyId)}&room_name=eq.${encodeURIComponent(roomName)}&check_in=lt.${encodeURIComponent(checkOut)}&check_out=gt.${encodeURIComponent(checkIn)}&select=id`
  );
  return rows.some(row => row.id !== ignoredId);
}

function bookingBody(input: Record<string, unknown>, room: Room) {
  return {
    guest_name: String(input.guest_name || "").trim(),
    room_name: room.room_name,
    room_type: room.room_type,
    booking_reference: String(input.booking_reference || "").trim() || null,
    booking_source: String(input.booking_source || "Direct").trim(),
    booking_status: String(input.booking_status || "Confirmed").trim(),
    check_in: String(input.check_in || ""),
    check_out: String(input.check_out || ""),
    phone: String(input.phone || "").trim() || null,
    email: String(input.email || "").trim().toLowerCase() || null,
    adults: Math.max(0, Number(input.adults || 1)),
    children: Math.max(0, Number(input.children || 0)),
    total_amount: input.total_amount === "" || input.total_amount == null ? null : Number(input.total_amount),
    received_amount: input.received_amount === "" || input.received_amount == null ? null : Number(input.received_amount),
    currency_code: String(input.currency_code || "LKR").trim().toUpperCase().slice(0, 3),
    notes: String(input.notes || "").trim() || null,
  };
}

export async function POST(request: NextRequest) {
  try {
    if (!readServerSession(request)) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const input = await request.json() as Record<string, unknown>;
    const propertyId = String(input.property_id || "");
    if (!propertyId || !(await editableProperty(propertyId))) {
      return NextResponse.json({ error: "Turn Google Sheet off before adding bookings in the dashboard." }, { status: 409 });
    }
    const room = await selectedRoom(propertyId, String(input.room_name || ""));
    const checkIn = String(input.check_in || ""), checkOut = String(input.check_out || "");
    if (!room || !String(input.guest_name || "").trim() || !checkIn || !checkOut || checkOut <= checkIn) {
      return NextResponse.json({ error: "Guest, room and valid stay dates are required." }, { status: 400 });
    }
    if (await hasCollision(propertyId, room.room_name, checkIn, checkOut)) {
      return NextResponse.json({ error: "This room already has a booking during the selected dates." }, { status: 409 });
    }
    const sourceKey = `native:${randomUUID()}`;
    const rows = await supabaseAdmin<Record<string, unknown>[]>("nkh_calendar_bookings", {
      method: "POST",
      prefer: "return=representation",
      body: { property_id: propertyId, source_key: sourceKey, booking_group_key: sourceKey, ...bookingBody(input, room) },
    });
    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to add booking." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!readServerSession(request)) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const input = await request.json() as Record<string, unknown>;
    const id = String(input.id || ""), propertyId = String(input.property_id || "");
    if (!id || !propertyId || !(await editableProperty(propertyId))) {
      return NextResponse.json({ error: "This calendar is not editable." }, { status: 409 });
    }
    const room = await selectedRoom(propertyId, String(input.room_name || ""));
    const checkIn = String(input.check_in || ""), checkOut = String(input.check_out || "");
    if (!room || !String(input.guest_name || "").trim() || !checkIn || !checkOut || checkOut <= checkIn) {
      return NextResponse.json({ error: "Guest, room and valid stay dates are required." }, { status: 400 });
    }
    if (await hasCollision(propertyId, room.room_name, checkIn, checkOut, id)) {
      return NextResponse.json({ error: "This room already has a booking during the selected dates." }, { status: 409 });
    }
    const rows = await supabaseAdmin<Record<string, unknown>[]>(
      `nkh_calendar_bookings?id=eq.${encodeURIComponent(id)}&property_id=eq.${encodeURIComponent(propertyId)}`,
      { method: "PATCH", prefer: "return=representation", body: bookingBody(input, room) }
    );
    return NextResponse.json(rows[0] || null);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update booking." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!readServerSession(request)) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const input = await request.json();
    const id = String(input.id || ""), propertyId = String(input.property_id || "");
    if (!id || !propertyId || !(await editableProperty(propertyId))) {
      return NextResponse.json({ error: "This calendar is not editable." }, { status: 409 });
    }
    await supabaseAdmin(
      `nkh_calendar_bookings?id=eq.${encodeURIComponent(id)}&property_id=eq.${encodeURIComponent(propertyId)}`,
      { method: "DELETE", prefer: "return=minimal" }
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete booking." }, { status: 500 });
  }
}
