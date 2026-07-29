import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { isMasterSession, readServerSession } from "../../../lib/serverSession";

type Property = { calendar_source_mode: string };
type Room = { id: string; room_name: string; room_type: string | null };
type Existing = { id: string; booking_group_key: string | null; room_name: string; check_in: string; check_out: string; booking_status: string };

async function editableProperty(propertyId: string) {
  const rows = await supabaseAdmin<Property[]>(`nkh_properties?id=eq.${encodeURIComponent(propertyId)}&select=calendar_source_mode&limit=1`);
  return rows[0]?.calendar_source_mode === "supabase";
}
async function propertyRooms(propertyId: string) {
  return supabaseAdmin<Room[]>(`nkh_calendar_rooms?property_id=eq.${encodeURIComponent(propertyId)}&select=id,room_name,room_type`);
}
function requestedRoomNames(input: Record<string, unknown>) {
  const supplied = Array.isArray(input.room_names) ? input.room_names : [input.room_name];
  return supplied.map(value => String(value || "").trim()).filter((value, index, values) => value && values.indexOf(value) === index);
}
async function overlapping(propertyId: string, checkIn: string, checkOut: string) {
  return supabaseAdmin<Existing[]>(
    `nkh_calendar_bookings?property_id=eq.${encodeURIComponent(propertyId)}&booking_status=neq.Cancelled&check_in=lt.${encodeURIComponent(checkOut)}&check_out=gt.${encodeURIComponent(checkIn)}&select=id,booking_group_key,room_name,check_in,check_out,booking_status`
  );
}
function paymentStatus(total: unknown, received: unknown) {
  const amount = Number(total || 0), paid = Number(received || 0);
  if (!amount || paid <= 0) return "Not paid";
  if (paid >= amount) return "Fully paid";
  return "Partially paid";
}
function childrenAges(value: unknown) {
  const supplied = Array.isArray(value) ? value : String(value || "").split(",");
  return supplied.map(item => Number(String(item).trim())).filter(age => Number.isInteger(age) && age >= 0 && age <= 17);
}
function bookingBody(input: Record<string, unknown>, room: Room, staffName: string) {
  return {
    guest_name: String(input.guest_name || "").trim(),
    room_name: room.room_name, room_type: room.room_type,
    booking_reference: String(input.booking_reference || "").trim() || null,
    booking_source: String(input.booking_source || "Direct").trim(),
    booking_status: String(input.booking_status || "Confirmed").trim(),
    check_in: String(input.check_in || ""), check_out: String(input.check_out || ""),
    phone: String(input.phone || "").trim() || null,
    email: String(input.email || "").trim().toLowerCase() || null,
    adults: Math.max(0, Number(input.adults || 1)), children: Math.max(0, Number(input.children || 0)),
    children_ages: childrenAges(input.children_ages), meal_plan: String(input.meal_plan || "").trim() || null,
    total_amount: input.total_amount === "" || input.total_amount == null ? null : Number(input.total_amount),
    received_amount: input.received_amount === "" || input.received_amount == null ? null : Number(input.received_amount),
    payment_status: paymentStatus(input.total_amount, input.received_amount),
    voucher_sent: input.voucher_sent === true || input.voucher_sent === "true" || input.voucher_sent === "on",
    currency_code: String(input.currency_code || "LKR").trim().toUpperCase().slice(0, 3),
    notes: String(input.notes || "").trim() || null, updated_by: staffName, updated_at: new Date().toISOString(),
  };
}
async function recordEvent(propertyId: string, groupKey: string, bookingId: string | null, type: string, staffName: string, details: Record<string, unknown> = {}) {
  await supabaseAdmin("nkh_calendar_booking_events", { method: "POST", prefer: "return=minimal", body: { property_id: propertyId, booking_group_key: groupKey, booking_id: bookingId, event_type: type, performed_by: staffName, details } });
}

export async function POST(request: NextRequest) {
  try {
    const session = readServerSession(request);
    if (!session) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const input = await request.json() as Record<string, unknown>;
    const propertyId = String(input.property_id || ""), names = requestedRoomNames(input);
    const checkIn = String(input.check_in || ""), checkOut = String(input.check_out || "");
    const isBlock = input.action === "block";
    if (!propertyId || !(await editableProperty(propertyId))) return NextResponse.json({ error: "Turn Google Sheet off before adding bookings." }, { status: 409 });
    if (!names.length || (!isBlock && !String(input.guest_name || "").trim()) || !checkIn || !checkOut || checkOut <= checkIn) return NextResponse.json({ error: "Guest, rooms and valid stay dates are required." }, { status: 400 });
    const allRooms = await propertyRooms(propertyId), selected = names.map(name => allRooms.find(room => room.room_name === name)).filter(Boolean) as Room[];
    if (selected.length !== names.length) return NextResponse.json({ error: "One or more selected rooms no longer exist." }, { status: 400 });
    const collisions = await overlapping(propertyId, checkIn, checkOut);
    const unavailable = selected.filter(room => collisions.some(item => item.room_name === room.room_name));
    if (unavailable.length) return NextResponse.json({ error: `Unavailable: ${unavailable.map(room => room.room_name).join(", ")}` }, { status: 409 });
    const groupKey = `native:${randomUUID()}`, now = new Date().toISOString();
    const rows = selected.map(room => {
      const sourceKey = `native:${randomUUID()}`;
      return { property_id: propertyId, source_key: sourceKey, booking_group_key: groupKey, created_by: session.name, created_at: now, ...bookingBody({ ...input, guest_name: isBlock ? "Blocked" : input.guest_name, booking_source: isBlock ? "Blocked" : input.booking_source, booking_status: isBlock ? "Blocked" : input.booking_status }, room, session.name) };
    });
    const created = await supabaseAdmin<Record<string, unknown>[]>("nkh_calendar_bookings", { method: "POST", prefer: "return=representation", body: rows });
    await recordEvent(propertyId, groupKey, String(created[0]?.id || "") || null, isBlock ? "Blocked" : "Created", session.name, { rooms: names, checkIn, checkOut });
    return NextResponse.json({ success: true, booking: created[0], allocations: created }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to add booking." }, { status: 500 }); }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = readServerSession(request);
    if (!session) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const input = await request.json() as Record<string, unknown>;
    const id = String(input.id || ""), propertyId = String(input.property_id || "");
    if (!id || !propertyId || !(await editableProperty(propertyId))) return NextResponse.json({ error: "This calendar is not editable." }, { status: 409 });
    const originalRows = await supabaseAdmin<Existing[]>(`nkh_calendar_bookings?id=eq.${encodeURIComponent(id)}&property_id=eq.${encodeURIComponent(propertyId)}&select=id,booking_group_key,room_name,check_in,check_out,booking_status`);
    const original = originalRows[0];
    if (!original) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    const groupKey = original.booking_group_key || original.id;
    const group = await supabaseAdmin<Existing[]>(`nkh_calendar_bookings?property_id=eq.${encodeURIComponent(propertyId)}&or=(booking_group_key.eq.${encodeURIComponent(groupKey)},id.eq.${encodeURIComponent(id)})&select=id,booking_group_key,room_name,check_in,check_out,booking_status`);

    if (input.action === "cancel") {
      const reason = String(input.reason || "").trim() || "Cancelled by staff";
      await supabaseAdmin(
        `nkh_calendar_bookings?property_id=eq.${encodeURIComponent(propertyId)}&or=(booking_group_key.eq.${encodeURIComponent(groupKey)},id.eq.${encodeURIComponent(id)})`,
        { method: "PATCH", prefer: "return=minimal", body: { booking_status: "Cancelled", cancelled_at: new Date().toISOString(), cancelled_by: session.name, cancellation_reason: reason, updated_by: session.name, updated_at: new Date().toISOString() } }
      );
      await recordEvent(propertyId, groupKey, id, "Cancelled", session.name, { reason });
      return NextResponse.json({ success: true, status: "Cancelled" });
    }

    if (input.action === "move") {
      const targetName = String(input.target_room || ""), allRooms = await propertyRooms(propertyId);
      const target = allRooms.find(room => room.room_name === targetName);
      if (!target) return NextResponse.json({ error: "Target room was not found." }, { status: 400 });
      const collisions = await overlapping(propertyId, original.check_in, original.check_out);
      if (collisions.some(item => item.room_name === targetName && !group.some(member => member.id === item.id))) return NextResponse.json({ error: `${targetName} is unavailable for these dates.` }, { status: 409 });
      const rows = await supabaseAdmin<Record<string, unknown>[]>(`nkh_calendar_bookings?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", prefer: "return=representation", body: { room_name: target.room_name, room_type: target.room_type, updated_by: session.name, updated_at: new Date().toISOString() } });
      await recordEvent(propertyId, groupKey, id, "Room moved", session.name, { from: original.room_name, to: target.room_name });
      return NextResponse.json(rows[0]);
    }

    const names = requestedRoomNames(input), checkIn = String(input.check_in || ""), checkOut = String(input.check_out || "");
    if (!names.length || !String(input.guest_name || "").trim() || !checkIn || !checkOut || checkOut <= checkIn) return NextResponse.json({ error: "Guest, rooms and valid dates are required." }, { status: 400 });
    const allRooms = await propertyRooms(propertyId), selected = names.map(name => allRooms.find(room => room.room_name === name)).filter(Boolean) as Room[];
    if (selected.length !== names.length) return NextResponse.json({ error: "One or more selected rooms no longer exist." }, { status: 400 });
    const collisions = await overlapping(propertyId, checkIn, checkOut);
    const groupIds = new Set(group.map(item => item.id));
    const unavailable = selected.filter(room => collisions.some(item => item.room_name === room.room_name && !groupIds.has(item.id)));
    if (unavailable.length) return NextResponse.json({ error: `Unavailable: ${unavailable.map(room => room.room_name).join(", ")}` }, { status: 409 });

    const existingByRoom = new Map(group.map(item => [item.room_name, item]));
    const keepIds: string[] = [], results: Record<string, unknown>[] = [];
    for (const room of selected) {
      const existing = existingByRoom.get(room.room_name);
      if (existing) {
        keepIds.push(existing.id);
        const updated = await supabaseAdmin<Record<string, unknown>[]>(`nkh_calendar_bookings?id=eq.${encodeURIComponent(existing.id)}`, { method: "PATCH", prefer: "return=representation", body: bookingBody(input, room, session.name) });
        if (updated[0]) results.push(updated[0]);
      } else {
        const created = await supabaseAdmin<Record<string, unknown>[]>("nkh_calendar_bookings", { method: "POST", prefer: "return=representation", body: { property_id: propertyId, source_key: `native:${randomUUID()}`, booking_group_key: groupKey, created_by: session.name, ...bookingBody(input, room, session.name) } });
        if (created[0]) { results.push(created[0]); keepIds.push(String(created[0].id)); }
      }
    }
    for (const member of group) if (!keepIds.includes(member.id)) await supabaseAdmin(`nkh_calendar_bookings?id=eq.${encodeURIComponent(member.id)}`, { method: "DELETE", prefer: "return=minimal" });
    await recordEvent(propertyId, groupKey, id, "Updated", session.name, { rooms: names, checkIn, checkOut });
    return NextResponse.json({ success: true, booking: results[0], allocations: results });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update booking." }, { status: 500 }); }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = readServerSession(request);
    if (!isMasterSession(session)) return NextResponse.json({ error: "Only Master can permanently delete a booking." }, { status: 403 });
    const input = await request.json();
    const id = String(input.id || ""), propertyId = String(input.property_id || "");
    if (!id || !propertyId || !(await editableProperty(propertyId))) return NextResponse.json({ error: "This calendar is not editable." }, { status: 409 });
    const rows = await supabaseAdmin<Existing[]>(`nkh_calendar_bookings?id=eq.${encodeURIComponent(id)}&property_id=eq.${encodeURIComponent(propertyId)}&select=id,booking_group_key,room_name,check_in,check_out,booking_status`);
    const groupKey = rows[0]?.booking_group_key || id;
    await recordEvent(propertyId, groupKey, id, "Permanently deleted", session!.name);
    await supabaseAdmin(
      `nkh_calendar_bookings?property_id=eq.${encodeURIComponent(propertyId)}&or=(booking_group_key.eq.${encodeURIComponent(groupKey)},id.eq.${encodeURIComponent(id)})`,
      { method: "DELETE", prefer: "return=minimal" }
    );
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete booking." }, { status: 500 }); }
}
