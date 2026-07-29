import { NextRequest, NextResponse } from "next/server";
import { syncSupabaseCalendarRooms } from "../../../../lib/calendarRoomInventory";
import { readServerSession } from "../../../../lib/serverSession";

export async function POST(request: NextRequest) {
  try {
    if (!readServerSession(request)) {
      return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    }
    const input = await request.json();
    const propertyId = String(input.propertyId || "");
    if (!propertyId) return NextResponse.json({ error: "Property is required." }, { status: 400 });
    return NextResponse.json({ success: true, ...(await syncSupabaseCalendarRooms(propertyId)) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to refresh calendar rooms." },
      { status: 500 }
    );
  }
}
