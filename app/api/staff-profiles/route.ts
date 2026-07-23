import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { isMasterSession, readServerSession } from "../../lib/serverSession";
import { hashPin, normalizeUsername, validPin, validUsername } from "../../lib/staffCredentials";

const fields = "id,display_name,email,phone,whatsapp_number,access_level,employment_status,timezone,color_hex,google_staff_name,login_username,login_enabled,pin_hash,pin_updated_at,last_login_at,created_at,updated_at";
const allowed = ["display_name", "email", "phone", "whatsapp_number", "access_level", "employment_status", "timezone", "color_hex", "google_staff_name", "login_username", "login_enabled"];

function master(request: NextRequest) { return isMasterSession(readServerSession(request)); }

export async function GET(request: NextRequest) {
  try {
    if (!master(request)) return NextResponse.json({ error: "Master access is required." }, { status: 403 });
    const rows = await supabaseAdmin<Array<Record<string, unknown>>>(`nkh_staff?select=${fields}&order=display_name.asc`);
    return NextResponse.json(rows.map(({ pin_hash, ...row }) => ({ ...row, has_pin: Boolean(pin_hash) })));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load staff profiles." }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  try {
    if (!master(request)) return NextResponse.json({ error: "Master access is required." }, { status: 403 });
    const input = await request.json();
    const displayName = String(input.display_name || "").trim();
    const username = normalizeUsername(input.login_username);
    const pin = String(input.pin || "");
    if (!displayName) return NextResponse.json({ error: "Staff name is required." }, { status: 400 });
    if (!validUsername(username)) return NextResponse.json({ error: "Username must start with a capital letter and contain 3–40 letters, numbers, dots, dashes or underscores." }, { status: 400 });
    if (!validPin(pin)) return NextResponse.json({ error: "PIN must contain 4–12 numbers." }, { status: 400 });
    const data = await supabaseAdmin<Array<Record<string, unknown>>>("nkh_staff", { method: "POST", prefer: "return=representation", body: { display_name: displayName, google_staff_name: String(input.google_staff_name || displayName).trim(), login_username: username, pin_hash: hashPin(pin), pin_updated_at: new Date().toISOString(), login_enabled: input.login_enabled !== false, email: input.email || null, phone: input.phone || null, whatsapp_number: input.whatsapp_number || null, access_level: input.access_level || "Team", employment_status: input.employment_status || "Active", timezone: input.timezone || "Asia/Colombo", color_hex: input.color_hex || "#E98A15" } });
    const { pin_hash, ...created } = data[0] || {};
    return NextResponse.json({ ...created, has_pin: Boolean(pin_hash) }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create staff profile." }, { status: 500 }); }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!master(request)) return NextResponse.json({ error: "Master access is required." }, { status: 403 });
    const input = await request.json();
    if (!input.id) return NextResponse.json({ error: "Staff ID is required." }, { status: 400 });
    const update = Object.fromEntries(allowed.filter(name => Object.prototype.hasOwnProperty.call(input, name)).map(name => [name, input[name] === "" ? null : input[name]]));
    if (Object.prototype.hasOwnProperty.call(update, "login_username")) {
      update.login_username = normalizeUsername(update.login_username);
      if (!validUsername(String(update.login_username))) return NextResponse.json({ error: "Username must start with a capital letter and contain 3–40 letters, numbers, dots, dashes or underscores." }, { status: 400 });
    }
    const pin = String(input.pin || "");
    if (pin) {
      if (!validPin(pin)) return NextResponse.json({ error: "PIN must contain 4–12 numbers." }, { status: 400 });
      update.pin_hash = hashPin(pin);
      update.pin_updated_at = new Date().toISOString();
    }
    const data = await supabaseAdmin<Array<Record<string, unknown>>>(`nkh_staff?id=eq.${encodeURIComponent(input.id)}`, { method: "PATCH", prefer: "return=representation", body: update });
    const { pin_hash, ...saved } = data[0] || {};
    return NextResponse.json({ ...saved, has_pin: Boolean(pin_hash) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update staff profile." }, { status: 500 }); }
}
