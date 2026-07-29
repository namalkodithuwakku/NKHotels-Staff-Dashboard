import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { isMasterSession, readServerSession } from "../../../lib/serverSession";

type RoomType = { id: string; room_code: string; room_name: string; room_count: number; room_names: string[]; display_order: number };

export async function POST(request: NextRequest) {
  try {
    if (!isMasterSession(readServerSession(request))) return NextResponse.json({ error: "Only Master can change the calendar source." }, { status: 403 });
    const input = await request.json();
    const propertyId = String(input.propertyId || "");
    const mode = input.mode === "supabase" ? "supabase" : "google_sheet";
    if (!propertyId) return NextResponse.json({ error: "Property is required." }, { status: 400 });

    if (mode === "supabase") {
      const roomTypes = await supabaseAdmin<RoomType[]>(
        `nkh_room_types?property_id=eq.${encodeURIComponent(propertyId)}&is_active=eq.true&select=id,room_code,room_name,room_count,room_names,display_order&order=display_order.asc`
      );
      const total = roomTypes.reduce((sum, roomType) => sum + Number(roomType.room_count || 0), 0);
      if (!roomTypes.length || total < 1) {
        return NextResponse.json({ error: "Add room types and room counts before switching Google Sheet off." }, { status: 409 });
      }
      await Promise.all([
        supabaseAdmin(`nkh_calendar_bookings?property_id=eq.${encodeURIComponent(propertyId)}`, { method: "DELETE", prefer: "return=minimal" }),
        supabaseAdmin(`nkh_calendar_rooms?property_id=eq.${encodeURIComponent(propertyId)}`, { method: "DELETE", prefer: "return=minimal" }),
      ]);
      const rooms = roomTypes.flatMap(roomType =>
        Array.from({ length: Number(roomType.room_count) }, (_, index) => ({
          property_id: propertyId,
          source_key: `native:${roomType.id}:${index + 1}`,
          room_name: roomType.room_names?.[index] || `${roomType.room_name} ${index + 1}`,
          room_type: roomType.room_name,
          room_type_id: roomType.id,
          room_status: "Available",
          sort_order: Number(roomType.display_order || 0) * 100 + index,
        }))
      );
      await supabaseAdmin("nkh_calendar_rooms", { method: "POST", prefer: "return=minimal", body: rooms });
    }

    const properties = await supabaseAdmin<Record<string, unknown>[]>(
      `nkh_properties?id=eq.${encodeURIComponent(propertyId)}`,
      { method: "PATCH", prefer: "return=representation", body: { calendar_source_mode: mode } }
    );
    return NextResponse.json({ success: true, property: properties[0], mode });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to change calendar mode." }, { status: 500 });
  }
}
