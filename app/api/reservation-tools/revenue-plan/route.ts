import { NextRequest, NextResponse } from "next/server";
import { isMasterSession, readServerSession } from "../../../lib/serverSession";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

type Property = {
  id: string; client_code: string; property_name: string; description?: string | null;
  address_line_1?: string | null; address_line_2?: string | null; city?: string | null;
  country?: string | null; map_url?: string | null; total_rooms?: number | null; currency_code?: string | null;
};
type Booking = { check_in: string; check_out: string; room_name: string; room_type?: string | null; booking_status: string; booking_source: string; total_amount?: number | null; received_amount?: number | null };

const planSchema = {
  type: "object",
  properties: {
    destinationSummary: { type: "string" },
    season: { type: "string" },
    demandOutlook: { type: "string" },
    periodSummary: { type: "string" },
    events: { type: "array", items: { type: "object", properties: {
      name: { type: "string" }, dateRange: { type: "string" }, location: { type: "string" },
      impact: { type: "string", enum: ["Low","Medium","High"] }, confidence: { type: "string", enum: ["Low","Medium","High"] },
      evidence: { type: "string" },
    }, required: ["name","dateRange","location","impact","confidence","evidence"], additionalProperties: false } },
    attractions: { type: "array", items: { type: "object", properties: {
      name: { type: "string" }, relevance: { type: "string" }, opportunity: { type: "string" },
    }, required: ["name","relevance","opportunity"], additionalProperties: false } },
    actions: { type: "array", items: { type: "object", properties: {
      dateRange: { type: "string" }, priority: { type: "string", enum: ["Urgent","High","Normal","Watch"] },
      actionType: { type: "string", enum: ["Rate increase","Rate decrease","Hold rate","Promotion","Minimum stay","OTA availability","Direct sales","Package","Monitor"] },
      title: { type: "string" }, reason: { type: "string" }, currentSignal: { type: "string" },
      recommendation: { type: "string" }, successMeasure: { type: "string" },
    }, required: ["dateRange","priority","actionType","title","reason","currentSignal","recommendation","successMeasure"], additionalProperties: false } },
    risks: { type: "array", items: { type: "string" } },
  },
  required: ["destinationSummary","season","demandOutlook","periodSummary","events","attractions","actions","risks"],
  additionalProperties: false,
};

function outputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string") return payload.output_text;
  for (const item of (Array.isArray(payload.output) ? payload.output : []) as Array<Record<string, unknown>>) {
    for (const part of (Array.isArray(item.content) ? item.content : []) as Array<Record<string, unknown>>) {
      if (part.type === "output_text" && typeof part.text === "string") return part.text;
    }
  }
  throw new Error("AI Revenue Planner returned no readable plan.");
}

function parsePlanText(value: string) {
  const cleaned = value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(
      cleaned
        ? `AI returned an incomplete revenue plan: ${cleaned.slice(0, 180)}`
        : "AI returned an empty revenue plan.",
    );
  }
}

async function requestRevenuePlan(key: string, context: Record<string, unknown>, retry = false) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_REVENUE_MODEL || "gpt-5.4-mini",
      store: false,
      reasoning: { effort: "low" },
      tools: retry ? undefined : [{ type: "web_search" }],
      input: `You are the cautious revenue analyst for NKH Dashboard. ${retry ? "Use only the supplied operational context and return the required JSON plan immediately. " : "Research the exact property destination for the requested period. "}Identify verifiable seasonality, public holidays, destination events and attractions that could affect room demand. Use the supplied live property, inventory, occupancy, booking and rate data. Produce specific, achievable actions for the selected period. Never invent an event, rate or competitor fact. Mark uncertain external information with Low confidence. Recommendations are advisory and require Master approval. Do not recommend closing every OTA when occupancy is low. Return only the structured plan requested by the schema. Property data:\n${JSON.stringify(context)}`,
      text: { format: { type: "json_schema", name: "nkh_revenue_plan", strict: true, schema: planSchema } },
    }),
  });
  const raw = await response.text();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(`AI service returned an unreadable response (HTTP ${response.status}). Please try again.`);
  }
  if (!response.ok) {
    const apiError = payload.error as Record<string, unknown> | undefined;
    throw new Error(String(apiError?.message || `AI revenue planning failed (HTTP ${response.status}).`));
  }
  return parsePlanText(outputText(payload));
}

function localDate(value: string) { const [y,m,d] = value.split("-").map(Number); return new Date(y, m - 1, d, 12); }
function dateKey(value: Date) { return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`; }
function buildOccupancy(from: string, to: string, capacity: number, bookings: Booking[]) {
  const rows = [];
  for (let cursor = localDate(from), end = localDate(to); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const day = dateKey(cursor);
    const active = bookings.filter(row => row.check_in <= day && row.check_out > day && !/cancel/i.test(row.booking_status));
    rows.push({ date: day, occupiedRooms: active.length, availableRooms: Math.max(0, capacity - active.length), occupancyPercent: capacity ? Math.round(active.length / capacity * 100) : 0 });
  }
  return rows;
}

export async function GET(request: NextRequest) {
  if (!isMasterSession(readServerSession(request))) return NextResponse.json({ error: "Master access required." }, { status: 403 });
  const properties = await supabaseAdmin<Property[]>("nkh_properties?select=id,client_code,property_name,city,country,total_rooms&client_status=eq.Active&order=property_name");
  return NextResponse.json({ success: true, properties });
}

export async function POST(request: NextRequest) {
  try {
    const session = readServerSession(request);
    if (!isMasterSession(session)) return NextResponse.json({ error: "Master access required." }, { status: 403 });
    const input = await request.json();
    const propertyId = String(input.propertyId || ""), from = String(input.from || ""), to = String(input.to || "");
    const objective = String(input.objective || "Balanced occupancy and revenue");
    if (!propertyId || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
      return NextResponse.json({ error: "Choose a valid property and planning period." }, { status: 400 });
    }
    const duration = Math.round((localDate(to).getTime() - localDate(from).getTime()) / 86_400_000) + 1;
    if (duration > 186) return NextResponse.json({ error: "The maximum planning period is six months." }, { status: 400 });
    const [properties, roomTypes, bookings, ratePlans, rateRanges] = await Promise.all([
      supabaseAdmin<Property[]>(`nkh_properties?select=*&id=eq.${encodeURIComponent(propertyId)}&limit=1`),
      supabaseAdmin<Record<string, unknown>[]>(`nkh_room_types?select=*&property_id=eq.${encodeURIComponent(propertyId)}&is_active=eq.true`),
      supabaseAdmin<Booking[]>(`nkh_calendar_bookings?select=check_in,check_out,room_name,room_type,booking_status,booking_source,total_amount,received_amount&property_id=eq.${encodeURIComponent(propertyId)}&check_in=lte.${encodeURIComponent(to)}&check_out=gt.${encodeURIComponent(from)}`),
      supabaseAdmin<Record<string, unknown>[]>(`nkh_rate_plans?select=*&property_id=eq.${encodeURIComponent(propertyId)}`),
      supabaseAdmin<Record<string, unknown>[]>(`nkh_rate_calendar_ranges?select=*&property_id=eq.${encodeURIComponent(propertyId)}&start_date=lte.${encodeURIComponent(to)}&end_date=gte.${encodeURIComponent(from)}`),
    ]);
    const property = properties[0];
    if (!property) return NextResponse.json({ error: "Property not found." }, { status: 404 });
    const planIds = ratePlans.map(row => String(row.id || "")).filter(Boolean);
    const ratePrices = planIds.length
      ? await supabaseAdmin<Record<string, unknown>[]>(`nkh_rate_plan_prices?select=*&rate_plan_id=in.(${planIds.map(encodeURIComponent).join(",")})`)
      : [];
    const inventory = roomTypes.reduce((sum, row) => sum + Number(row.room_count || 0), 0) || Number(property.total_rooms || 0);
    const occupancy = buildOccupancy(from, to, inventory, bookings);
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is not configured in Vercel.");
    const context = { property, planningPeriod: { from, to, objective }, inventory, roomTypes, occupancy, bookings, ratePlans, ratePrices, rateRanges };
    let plan;
    try {
      plan = await requestRevenuePlan(key, context);
    } catch (firstError) {
      console.warn("Revenue planner structured response failed; retrying once.", firstError);
      plan = await requestRevenuePlan(key, context, true);
    }
    const saved = await supabaseAdmin<Array<{ id: string }>>("nkh_revenue_plans", {
      method: "POST", prefer: "return=representation",
      body: { property_id: propertyId, period_start: from, period_end: to, objective, generated_by: session?.name, inventory_snapshot: { totalRooms: inventory, roomTypes, occupancy }, plan },
    });
    return NextResponse.json({ success: true, planId: saved[0]?.id, property: { id: property.id, property_name: property.property_name, city: property.city, country: property.country }, metrics: { inventory, averageOccupancy: occupancy.length ? Math.round(occupancy.reduce((sum, row) => sum + row.occupancyPercent, 0) / occupancy.length) : 0, bookedRevenue: bookings.reduce((sum, row) => sum + Number(row.total_amount || 0), 0), currency: property.currency_code || "LKR" }, plan });
  } catch (error) {
    console.error("AI revenue plan failed.", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create the revenue plan." }, { status: 500 });
  }
}
