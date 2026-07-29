import { supabaseAdmin } from "./supabaseAdmin";

type PropertyMode = { calendar_source_mode: string };
type RoomType = {
  id: string;
  room_name: string;
  room_count: number;
  room_names: string[] | null;
  display_order: number;
};
type CalendarRoom = {
  id: string;
  source_key: string;
  room_name: string;
  room_type: string | null;
  room_type_id: string | null;
};
type ActiveBooking = { room_name: string };

export async function syncSupabaseCalendarRooms(propertyId: string) {
  const properties = await supabaseAdmin<PropertyMode[]>(
    `nkh_properties?id=eq.${encodeURIComponent(propertyId)}&select=calendar_source_mode&limit=1`
  );
  if (properties[0]?.calendar_source_mode !== "supabase") {
    return { synced: false, reason: "Google Sheet mode is active", created: 0, updated: 0, removed: 0, retained: [] as string[] };
  }

  const [roomTypes, existingRooms, activeBookings] = await Promise.all([
    supabaseAdmin<RoomType[]>(
      `nkh_room_types?property_id=eq.${encodeURIComponent(propertyId)}&is_active=eq.true&select=id,room_name,room_count,room_names,display_order&order=display_order.asc,room_name.asc`
    ),
    supabaseAdmin<CalendarRoom[]>(
      `nkh_calendar_rooms?property_id=eq.${encodeURIComponent(propertyId)}&select=id,source_key,room_name,room_type,room_type_id`
    ),
    supabaseAdmin<ActiveBooking[]>(
      `nkh_calendar_bookings?property_id=eq.${encodeURIComponent(propertyId)}&booking_status=neq.Cancelled&select=room_name`
    ),
  ]);

  const desired = roomTypes.flatMap(roomType =>
    Array.from({ length: Math.max(0, Number(roomType.room_count || 0)) }, (_, index) => ({
      property_id: propertyId,
      source_key: `native:${roomType.id}:${index + 1}`,
      room_name: roomType.room_names?.[index]?.trim() || `${roomType.room_name} ${index + 1}`,
      room_type: roomType.room_name,
      room_type_id: roomType.id,
      sort_order: Number(roomType.display_order || 0) * 100 + index,
    }))
  );

  const duplicateNames = desired
    .map(room => room.room_name.toLowerCase())
    .filter((name, index, names) => names.indexOf(name) !== index);
  if (duplicateNames.length) {
    throw new Error("Individual room names must be unique across this property.");
  }

  const existingBySource = new Map(existingRooms.map(room => [room.source_key, room]));
  const activeRoomNames = new Set(activeBookings.map(booking => booking.room_name));
  let created = 0;
  let updated = 0;

  for (const room of desired) {
    const existing = existingBySource.get(room.source_key);
    if (!existing) {
      await supabaseAdmin("nkh_calendar_rooms", {
        method: "POST",
        prefer: "return=minimal",
        body: { ...room, room_status: "Available" },
      });
      created++;
      continue;
    }

    if (existing.room_name !== room.room_name && activeRoomNames.has(existing.room_name)) {
      await supabaseAdmin(
        `nkh_calendar_bookings?property_id=eq.${encodeURIComponent(propertyId)}&room_name=eq.${encodeURIComponent(existing.room_name)}&booking_status=neq.Cancelled`,
        { method: "PATCH", prefer: "return=minimal", body: { room_name: room.room_name, room_type: room.room_type, updated_at: new Date().toISOString() } }
      );
    }
    await supabaseAdmin(`nkh_calendar_rooms?id=eq.${encodeURIComponent(existing.id)}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: {
        room_name: room.room_name,
        room_type: room.room_type,
        room_type_id: room.room_type_id,
        sort_order: room.sort_order,
        updated_at: new Date().toISOString(),
      },
    });
    updated++;
  }

  const desiredKeys = new Set(desired.map(room => room.source_key));
  const obsolete = existingRooms.filter(room => room.source_key.startsWith("native:") && !desiredKeys.has(room.source_key));
  const retained: string[] = [];
  let removed = 0;
  for (const room of obsolete) {
    if (activeRoomNames.has(room.room_name)) {
      retained.push(room.room_name);
      await supabaseAdmin(`nkh_calendar_rooms?id=eq.${encodeURIComponent(room.id)}`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: { room_status: "Not Available", updated_at: new Date().toISOString() },
      });
    } else {
      await supabaseAdmin(`nkh_calendar_rooms?id=eq.${encodeURIComponent(room.id)}`, {
        method: "DELETE",
        prefer: "return=minimal",
      });
      removed++;
    }
  }

  return { synced: true, created, updated, removed, retained };
}
