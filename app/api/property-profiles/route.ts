import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { canManageProperties, readServerSession } from "../../lib/serverSession";
import { getPropertyIdentificationEmails, savePropertyIdentificationEmail } from "../../lib/propertyIdentificationEmail";
import { normalizeGoogleSheetCode } from "../../lib/googleSheetCode";

const fields = "id,client_code,property_name,preferred_language,client_status,package_name,notes,legal_name,description,address_line_1,address_line_2,city,country,timezone,currency_code,check_in_time,check_out_time,total_rooms,website_url,map_url,logo_url,calendar_sheet_code,calendar_source_mode,onboarding_completed_at,created_at,updated_at";

export async function GET(request: NextRequest) {
  try {
    if (!readServerSession(request)) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const [data, emailMap] = await Promise.all([
      supabaseAdmin<Array<{ id: string } & Record<string, unknown>>>(`nkh_properties?select=${fields}&order=property_name.asc`),
      getPropertyIdentificationEmails(),
    ]);
    return NextResponse.json(data.map(property => ({
      ...property,
      task_email: emailMap.get(property.id) || null,
    })));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load properties." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!canManageProperties(readServerSession(request))) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const input = await request.json();
    const clientCode = String(input.client_code || "").trim().toUpperCase();
    const propertyName = String(input.property_name || "").trim();
    if (!/^NKH[0-9]{3,}$/.test(clientCode)) return NextResponse.json({ error: "Client code must use the format NKH006." }, { status: 400 });
    if (!propertyName) return NextResponse.json({ error: "Property name is required." }, { status: 400 });
    const data = await supabaseAdmin<Array<{ id: string } & Record<string, unknown>>>("nkh_properties", {
      method: "POST",
      prefer: "return=representation",
      body: { client_code: clientCode, property_name: propertyName, preferred_language: input.preferred_language || "English", client_status: input.client_status || "Onboarding", city: input.city || null, country: input.country || "Sri Lanka", timezone: input.timezone || "Asia/Colombo", currency_code: input.currency_code || "LKR", calendar_sheet_code: normalizeGoogleSheetCode(input.calendar_sheet_code), calendar_source_mode: input.calendar_source_mode === "supabase" ? "supabase" : "google_sheet" },
    });
    if (Object.prototype.hasOwnProperty.call(input, "task_email")) {
      await savePropertyIdentificationEmail(data[0].id, input.task_email);
    }
    return NextResponse.json({
      ...data[0],
      task_email: String(input.task_email || "").trim().toLowerCase() || null,
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create property." }, { status: 500 });
  }
}
