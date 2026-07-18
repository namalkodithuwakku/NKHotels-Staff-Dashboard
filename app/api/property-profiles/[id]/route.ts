import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { canManageProperties, readServerSession } from "../../../lib/serverSession";

const allowed = ["property_name", "legal_name", "preferred_language", "client_status", "package_name", "notes", "description", "address_line_1", "address_line_2", "city", "country", "timezone", "currency_code", "check_in_time", "check_out_time", "total_rooms", "website_url", "map_url", "logo_url"];

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    if (!canManageProperties(readServerSession(request))) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const { id } = await context.params;
    const input = await request.json();
    const update = Object.fromEntries(allowed.filter(key => Object.prototype.hasOwnProperty.call(input, key)).map(key => [key, input[key] === "" ? null : input[key]]));
    if (!Object.keys(update).length) return NextResponse.json({ error: "No supported fields were supplied." }, { status: 400 });
    const data = await supabaseAdmin<unknown[]>(`nkh_properties?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", prefer: "return=representation", body: update });
    if (!data.length) return NextResponse.json({ error: "Property not found." }, { status: 404 });
    return NextResponse.json(data[0]);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update property." }, { status: 500 });
  }
}
