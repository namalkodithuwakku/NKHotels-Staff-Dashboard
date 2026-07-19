import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { isMasterSession, readServerSession } from "../../lib/serverSession";

const fields = "id,display_name,email,phone,whatsapp_number,access_level,employment_status,timezone,color_hex,google_staff_name,created_at,updated_at";
const allowed = ["display_name", "email", "phone", "whatsapp_number", "access_level", "employment_status", "timezone", "color_hex", "google_staff_name"];

function master(request: NextRequest) { return isMasterSession(readServerSession(request)); }

export async function GET(request: NextRequest) {
  try {
    if (!master(request)) return NextResponse.json({ error: "Master access is required." }, { status: 403 });
    return NextResponse.json(await supabaseAdmin<unknown[]>(`nkh_staff?select=${fields}&order=display_name.asc`));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load staff profiles." }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  try {
    if (!master(request)) return NextResponse.json({ error: "Master access is required." }, { status: 403 });
    const input = await request.json();
    const displayName = String(input.display_name || "").trim();
    if (!displayName) return NextResponse.json({ error: "Staff name is required." }, { status: 400 });
    const data = await supabaseAdmin<unknown[]>("nkh_staff", { method: "POST", prefer: "return=representation", body: { display_name: displayName, google_staff_name: String(input.google_staff_name || displayName).trim(), email: input.email || null, phone: input.phone || null, whatsapp_number: input.whatsapp_number || null, access_level: input.access_level || "Team", employment_status: input.employment_status || "Active", timezone: input.timezone || "Asia/Colombo", color_hex: input.color_hex || "#E98A15" } });
    return NextResponse.json(data[0], { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create staff profile." }, { status: 500 }); }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!master(request)) return NextResponse.json({ error: "Master access is required." }, { status: 403 });
    const input = await request.json();
    if (!input.id) return NextResponse.json({ error: "Staff ID is required." }, { status: 400 });
    const update = Object.fromEntries(allowed.filter(name => Object.prototype.hasOwnProperty.call(input, name)).map(name => [name, input[name] === "" ? null : input[name]]));
    const data = await supabaseAdmin<unknown[]>(`nkh_staff?id=eq.${encodeURIComponent(input.id)}`, { method: "PATCH", prefer: "return=representation", body: update });
    return NextResponse.json(data[0]);
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update staff profile." }, { status: 500 }); }
}
