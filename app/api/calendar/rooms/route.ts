import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { readServerSession } from "../../../lib/serverSession";

const allowedStatuses = ["Available", "Ready", "Occupied", "Dirty", "Cleaning", "Not Available", "Maintenance"];

export async function PATCH(request: NextRequest) {
  try {
    const session = readServerSession(request);
    if (!session) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const input = await request.json();
    const propertyId = String(input.property_id || ""), roomId = String(input.id || "");
    const status = String(input.room_status || "");
    if (!propertyId || !roomId || !allowedStatuses.includes(status)) {
      return NextResponse.json({ error: "Room and a valid status are required." }, { status: 400 });
    }
    const properties = await supabaseAdmin<Array<{ calendar_source_mode: string }>>(
      `nkh_properties?id=eq.${encodeURIComponent(propertyId)}&select=calendar_source_mode&limit=1`
    );
    if (properties[0]?.calendar_source_mode !== "supabase") {
      return NextResponse.json({ error: "Room status is editable only in Dashboard calendar mode." }, { status: 409 });
    }
    const rows = await supabaseAdmin<Record<string, unknown>[]>(
      `nkh_calendar_rooms?id=eq.${encodeURIComponent(roomId)}&property_id=eq.${encodeURIComponent(propertyId)}`,
      { method: "PATCH", prefer: "return=representation", body: { room_status: status, updated_at: new Date().toISOString() } }
    );
    return NextResponse.json(rows[0] || null);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update room status." }, { status: 500 });
  }
}
