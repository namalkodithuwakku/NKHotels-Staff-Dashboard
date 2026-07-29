import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { canManageProperties, readServerSession } from "../../../../lib/serverSession";
import { syncSupabaseCalendarRooms } from "../../../../lib/calendarRoomInventory";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    if (!readServerSession(request)) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const { id } = await context.params;
    const rows = await supabaseAdmin<Record<string, unknown>[]>(
      `nkh_room_types?property_id=eq.${encodeURIComponent(id)}&select=*&order=display_order.asc,room_name.asc`
    );
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load room types." }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    if (!canManageProperties(readServerSession(request))) return NextResponse.json({ error: "Access denied." }, { status: 403 });
    const { id } = await context.params;
    const input = await request.json();
    const roomName = String(input.room_name || "").trim();
    const roomCode = String(input.room_code || roomName).trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
    const roomNames = String(input.room_names || "").split(/\r?\n|,/).map(value => value.trim()).filter(Boolean);
    const roomCount = Math.max(0, Number(input.room_count || roomNames.length || 0));
    if (!roomName || !roomCode || roomCount < 1) return NextResponse.json({ error: "Room name and a room count of at least 1 are required." }, { status: 400 });
    if (roomNames.length && roomNames.length !== roomCount) {
      return NextResponse.json({ error: `Enter exactly ${roomCount} individual room names, one per line.` }, { status: 400 });
    }
    const rows = await supabaseAdmin<Record<string, unknown>[]>("nkh_room_types", {
      method: "POST",
      prefer: "return=representation",
      body: {
        property_id: id,
        room_code: roomCode,
        room_name: roomName,
        description: String(input.description || "").trim() || null,
        room_count: roomCount,
        room_names: roomNames,
        max_adults: Math.max(0, Number(input.max_adults || 2)),
        max_children: Math.max(0, Number(input.max_children || 0)),
        max_occupancy: Math.max(1, Number(input.max_occupancy || 2)),
        bed_configuration: String(input.bed_configuration || "").trim() || null,
        display_order: Number(input.display_order || 0),
      },
    });
    const calendarSync = await syncSupabaseCalendarRooms(id);
    return NextResponse.json({ roomType: rows[0], calendarSync }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to add room type." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    if (!canManageProperties(readServerSession(request))) return NextResponse.json({ error: "Access denied." }, { status: 403 });
    const { id } = await context.params;
    const input = await request.json();
    const roomTypeId = String(input.id || "");
    if (!roomTypeId) return NextResponse.json({ error: "Room type is required." }, { status: 400 });
    const allowed = ["room_code", "room_name", "description", "room_count", "max_adults", "max_children", "max_occupancy", "bed_configuration", "display_order", "is_active"];
    const body = Object.fromEntries(allowed.filter(key => Object.prototype.hasOwnProperty.call(input, key)).map(key => [key, input[key] === "" ? null : input[key]]));
    if (Object.prototype.hasOwnProperty.call(body, "room_code")) {
      body.room_code = String(body.room_code || "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
    }
    if (Object.prototype.hasOwnProperty.call(input, "room_names")) {
      const roomNames = String(input.room_names || "").split(/\r?\n|,/).map(value => value.trim()).filter(Boolean);
      const roomCount = Math.max(0, Number(input.room_count || roomNames.length || 0));
      if (roomNames.length && roomNames.length !== roomCount) {
        return NextResponse.json({ error: `Enter exactly ${roomCount} individual room names, one per line.` }, { status: 400 });
      }
      body.room_names = roomNames;
    }
    const rows = await supabaseAdmin<Record<string, unknown>[]>(
      `nkh_room_types?id=eq.${encodeURIComponent(roomTypeId)}&property_id=eq.${encodeURIComponent(id)}`,
      { method: "PATCH", prefer: "return=representation", body }
    );
    const calendarSync = await syncSupabaseCalendarRooms(id);
    return NextResponse.json({ roomType: rows[0] || null, calendarSync });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update room type." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    if (!canManageProperties(readServerSession(request))) return NextResponse.json({ error: "Access denied." }, { status: 403 });
    const { id } = await context.params;
    const roomTypeId = String(request.nextUrl.searchParams.get("roomTypeId") || "");
    if (!roomTypeId) return NextResponse.json({ error: "Room type is required." }, { status: 400 });
    await supabaseAdmin(
      `nkh_room_types?id=eq.${encodeURIComponent(roomTypeId)}&property_id=eq.${encodeURIComponent(id)}`,
      { method: "DELETE", prefer: "return=minimal" }
    );
    const calendarSync = await syncSupabaseCalendarRooms(id);
    return NextResponse.json({ success: true, calendarSync });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete room type." }, { status: 500 });
  }
}
