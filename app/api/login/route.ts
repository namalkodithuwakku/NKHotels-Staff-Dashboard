import { NextResponse } from "next/server";
import { createServerSession, SESSION_COOKIE } from "../../lib/serverSession";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { hashPin, normalizeUsername, validPin, validUsername, verifyPin } from "../../lib/staffCredentials";

const GOOGLE_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbztfBp0WNIPPX3EI1lrIete8-D3epZ35u5f-UUNLgbLkD71JP6J4-uxbgHIGCw5qX7H/exec";
type StaffRow = {
  id: string; display_name: string; access_level: string; employment_status: string;
  phone: string | null; whatsapp_number: string | null; login_username: string | null;
  pin_hash: string | null; login_enabled: boolean; google_staff_name: string | null;
};

function publicStaff(row: StaffRow) {
  return {
    id: row.id,
    name: row.display_name,
    role: row.access_level,
    access: row.access_level,
    phone: row.phone || "",
    whatsapp: row.whatsapp_number || row.phone || "",
    username: row.login_username || "",
  };
}

async function legacyLogin(name: string, pin: string) {
  const url = `${GOOGLE_WEBAPP_URL}?action=staffLogin&name=${encodeURIComponent(name)}&pin=${encodeURIComponent(pin)}`;
  const response = await fetch(url, { cache: "no-store" });
  const text = await response.text();
  try { return JSON.parse(text); } catch { return { success: false }; }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = normalizeUsername(body.username || body.name);
    const pin = String(body.pin || "");
    if (!validUsername(username) || !validPin(pin)) {
      return NextResponse.json({ success: false, error: "Invalid username or PIN." }, { status: 401 });
    }

    let rows = await supabaseAdmin<StaffRow[]>(`nkh_staff?select=id,display_name,access_level,employment_status,phone,whatsapp_number,login_username,pin_hash,login_enabled,google_staff_name&login_username=eq.${encodeURIComponent(username)}&limit=1`);
    let staff = rows[0] || null;

    if (staff?.pin_hash) {
      if (!staff.login_enabled || staff.employment_status !== "Active" || !verifyPin(pin, staff.pin_hash)) {
        return NextResponse.json({ success: false, error: "Invalid username or PIN." }, { status: 401 });
      }
    } else {
      const legacyName = staff?.google_staff_name || staff?.display_name || String(body.name || username).trim();
      const legacy = await legacyLogin(legacyName, pin);
      if (!legacy?.success || !legacy?.staff) {
        return NextResponse.json({ success: false, error: "Invalid username or PIN." }, { status: 401 });
      }
      if (!staff) {
        rows = await supabaseAdmin<StaffRow[]>(`nkh_staff?select=id,display_name,access_level,employment_status,phone,whatsapp_number,login_username,pin_hash,login_enabled,google_staff_name&or=(google_staff_name.eq.${encodeURIComponent(legacy.staff.name)},display_name.eq.${encodeURIComponent(legacy.staff.name)})&limit=1`);
        staff = rows[0] || null;
      }
      if (!staff || !staff.login_enabled || staff.employment_status !== "Active") {
        return NextResponse.json({ success: false, error: "This staff login is not active." }, { status: 403 });
      }
      await supabaseAdmin(`nkh_staff?id=eq.${staff.id}`, { method: "PATCH", prefer: "return=minimal", body: {
        login_username: username, pin_hash: hashPin(pin), pin_updated_at: new Date().toISOString(),
      }});
      staff = { ...staff, login_username: username, pin_hash: "migrated" };
    }

    const staffData = publicStaff(staff);
    await supabaseAdmin(`nkh_staff?id=eq.${staff.id}`, { method: "PATCH", prefer: "return=minimal", body: { last_login_at: new Date().toISOString() } });
    const result = NextResponse.json({ success: true, staff: staffData, authSource: staff.pin_hash === "migrated" ? "Supabase migrated" : "Supabase" });
    result.cookies.set(SESSION_COOKIE, createServerSession(staffData), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 7 * 24 * 60 * 60,
    });
    return result;
  } catch (error) {
    console.error("Staff login failed", error);
    return NextResponse.json({ success: false, error: "Login service is temporarily unavailable." }, { status: 500 });
  }
}
