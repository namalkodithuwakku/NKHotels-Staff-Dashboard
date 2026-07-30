import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { canManageProperties, readServerSession } from "../../lib/serverSession";

const fields = "id,property_id,source_property_name,room_name,meal_plan,rack_rate_usd,commission_percent,genius_percent,audience_kind,audience_percent,campaign_kind,campaign_percent,deal_kind,deal_percent,limited_time_percent,room_type_id,needs_review,notes,created_at,updated_at";

export async function GET(request: NextRequest) {
  try {
    if (!readServerSession(request)) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const propertyId = request.nextUrl.searchParams.get("propertyId");
    const filter = propertyId ? `&property_id=eq.${encodeURIComponent(propertyId)}` : "";
    const [properties, rates] = await Promise.all([
      supabaseAdmin<unknown[]>("nkh_properties?select=id,client_code,property_name&client_status=neq.Former&order=property_name.asc"),
      supabaseAdmin<unknown[]>(`nkh_ota_rate_profiles?select=${fields}${filter}&order=source_property_name.asc,room_name.asc,meal_plan.asc`),
    ]);
    return NextResponse.json({ properties, rates });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load OTA rates." }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  try {
    if (!canManageProperties(readServerSession(request))) return NextResponse.json({ error: "Master access is required." }, { status: 403 });
    const input = await request.json();
    if (!input.property_id || !String(input.room_name || "").trim()) return NextResponse.json({ error: "Property and room category are required." }, { status: 400 });
    const data = await supabaseAdmin<unknown[]>("nkh_ota_rate_profiles", { method: "POST", prefer: "return=representation", body: cleanInput(input) });
    return NextResponse.json(data[0], { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create OTA rate." }, { status: 500 }); }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!canManageProperties(readServerSession(request))) return NextResponse.json({ error: "Master access is required." }, { status: 403 });
    const input = await request.json();
    if (!input.id) return NextResponse.json({ error: "Rate profile ID is required." }, { status: 400 });
    const { id, ...values } = input;
    const data = await supabaseAdmin<unknown[]>(`nkh_ota_rate_profiles?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", prefer: "return=representation", body: cleanInput(values) });
    return NextResponse.json(data[0]);
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update OTA rate." }, { status: 500 }); }
}

function cleanInput(input: Record<string, unknown>) {
  const number = (value: unknown) => value === "" || value == null ? 0 : Math.max(0, Number(value) || 0);
  return {
    property_id: input.property_id || null, source_property_name: String(input.source_property_name || "").trim(),
    room_name: String(input.room_name || "").trim(), meal_plan: String(input.meal_plan || "Room Only").trim(),
    rack_rate_usd: number(input.rack_rate_usd), commission_percent: number(input.commission_percent),
    genius_percent: number(input.genius_percent), audience_kind: ["mobile","country"].includes(String(input.audience_kind)) ? input.audience_kind : "mobile",
    audience_percent: number(input.audience_percent), campaign_kind: ["getaway","early_year"].includes(String(input.campaign_kind)) ? input.campaign_kind : "getaway",
    campaign_percent: number(input.campaign_percent), deal_kind: ["basic","last_minute","early_booker"].includes(String(input.deal_kind)) ? input.deal_kind : "basic",
    deal_percent: number(input.deal_percent), limited_time_percent: number(input.limited_time_percent),
    room_type_id: input.room_type_id || null, needs_review: Boolean(input.needs_review), notes: String(input.notes || "").trim() || null,
  };
}
