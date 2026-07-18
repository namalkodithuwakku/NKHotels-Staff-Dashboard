import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { canManageProperties, readServerSession } from "../../../../lib/serverSession";

const defaultPlans = [
  { plan_code: "STANDARD", plan_name: "Standard", color_hex: "#3DA56A", display_order: 10 },
  { plan_code: "LOW", plan_name: "Low Season", color_hex: "#3F82D5", display_order: 20 },
  { plan_code: "HIGH", plan_name: "High Season", color_hex: "#E59A28", display_order: 30 },
  { plan_code: "PEAK", plan_name: "Peak / Event", color_hex: "#D95151", display_order: 40 },
  { plan_code: "FIT", plan_name: "FIT Contract", color_hex: "#8565C4", display_order: 50 },
];

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    if (!readServerSession(request)) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const { id } = await context.params;
    const propertyId = encodeURIComponent(id);
    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");
    const rangeFilters = from && to ? `&start_date=lte.${encodeURIComponent(to)}&end_date=gte.${encodeURIComponent(from)}` : "";
    const [plans, ranges] = await Promise.all([
      supabaseAdmin<unknown[]>(`nkh_rate_plans?property_id=eq.${propertyId}&is_active=eq.true&select=*&order=display_order.asc`),
      supabaseAdmin<unknown[]>(`nkh_rate_calendar_ranges?property_id=eq.${propertyId}&select=*&order=created_at.asc${rangeFilters}`),
    ]);
    return NextResponse.json({ plans, ranges });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load rates." }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    if (!canManageProperties(readServerSession(request))) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const { id } = await context.params;
    const input = await request.json();
    if (input.action === "createDefaults") {
      await supabaseAdmin("nkh_rate_plans?on_conflict=property_id,plan_code", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: defaultPlans.map(plan => ({ ...plan, property_id: id, currency_code: input.currency_code || "LKR" })) });
      return NextResponse.json({ success: true }, { status: 201 });
    }
    if (!input.rate_plan_id || !input.start_date || !input.end_date) return NextResponse.json({ error: "Rate plan and date range are required." }, { status: 400 });
    const data = await supabaseAdmin<unknown[]>("nkh_rate_calendar_ranges", {
      method: "POST", prefer: "return=representation",
      body: { property_id: id, rate_plan_id: input.rate_plan_id, room_type_id: input.room_type_id || null, start_date: input.start_date, end_date: input.end_date, created_by: input.created_by || null, notes: input.notes || null },
    });
    return NextResponse.json(data[0], { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save rates." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!canManageProperties(readServerSession(request))) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const rangeId = request.nextUrl.searchParams.get("rangeId");
    if (!rangeId) return NextResponse.json({ error: "Range ID is required." }, { status: 400 });
    await supabaseAdmin(`nkh_rate_calendar_ranges?id=eq.${encodeURIComponent(rangeId)}`, { method: "DELETE", prefer: "return=minimal" });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete rate range." }, { status: 500 });
  }
}
