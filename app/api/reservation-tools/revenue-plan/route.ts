import { NextRequest, NextResponse } from "next/server";
import { readServerSession } from "../../../lib/serverSession";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

type Property = {
  id: string; client_code: string; property_name: string; description?: string | null;
  address_line_1?: string | null; address_line_2?: string | null; city?: string | null;
  country?: string | null; map_url?: string | null; total_rooms?: number | null; currency_code?: string | null;
};
type Booking = { check_in: string; check_out: string; room_name: string; room_type?: string | null; booking_status: string; booking_source: string; total_amount?: number | null; received_amount?: number | null };
type Snapshot = { captured_at: string; daily_inventory: Array<{ date: string; occupiedRooms: number }> };
type RoomType = { id: string; room_name: string; room_code?: string; room_count?: number; room_names?: string[] };

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

function numberValue(row: Record<string, unknown> | undefined, ...keys: string[]) {
  for (const key of keys) {
    const value = Number(row?.[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}
function roundRate(value: number, currency: string) {
  const step = currency.toUpperCase() === "LKR" ? 100 : 1;
  return Math.max(step, Math.round(value / step) * step);
}
function roomTypeForBooking(booking: Booking, roomTypes: RoomType[]) {
  const stated = String(booking.room_type || "").trim().toLowerCase();
  const room = String(booking.room_name || "").trim().toLowerCase();
  return roomTypes.find(type =>
    stated === String(type.room_name || "").trim().toLowerCase()
    || stated === String(type.room_code || "").trim().toLowerCase()
    || (type.room_names || []).some(name => String(name).trim().toLowerCase() === room)
  );
}
function closestSnapshot(snapshots: Snapshot[], days: number) {
  const target = Date.now() - days * 86_400_000;
  return snapshots
    .filter(item => new Date(item.captured_at).getTime() <= Date.now() - 12 * 3_600_000)
    .sort((a, b) => Math.abs(new Date(a.captured_at).getTime() - target) - Math.abs(new Date(b.captured_at).getTime() - target))[0];
}
function groupPeriods(rows: Array<{ date: string; level: string; reason: string }>, accepted: string[]) {
  const matches = rows.filter(row => accepted.includes(row.level));
  const groups: Array<{ from: string; to: string; level: string; reason: string }> = [];
  matches.forEach(row => {
    const previous = groups[groups.length - 1];
    const expected = previous ? localDate(previous.to) : null;
    if (expected) expected.setDate(expected.getDate() + 1);
    if (previous && dateKey(expected!) === row.date && previous.level === row.level) previous.to = row.date;
    else groups.push({ from: row.date, to: row.date, level: row.level, reason: row.reason });
  });
  return groups;
}
function buildRevenueEngine(input: {
  from: string; to: string; property: Property; inventory: number; roomTypes: RoomType[]; bookings: Booking[];
  occupancy: Array<{ date: string; occupiedRooms: number; availableRooms: number; occupancyPercent: number }>;
  ratePlans: Record<string, unknown>[]; ratePrices: Record<string, unknown>[]; rateRanges: Record<string, unknown>[]; snapshots: Snapshot[];
}) {
  const { property, inventory, roomTypes, bookings, occupancy, ratePlans, ratePrices, rateRanges, snapshots } = input;
  const currency = property.currency_code || "LKR";
  const snapshotWindows = [1, 3, 7, 30].map(days => {
    const snapshot = closestSnapshot(snapshots, days);
    const previous = new Map((snapshot?.daily_inventory || []).map(row => [row.date, Number(row.occupiedRooms || 0)]));
    const pickup = snapshot ? occupancy.reduce((sum, row) => sum + Math.max(0, row.occupiedRooms - Number(previous.get(row.date) || 0)), 0) : null;
    return { days, pickup, available: Boolean(snapshot), capturedAt: snapshot?.captured_at || null };
  });
  const pickup7 = snapshotWindows.find(item => item.days === 7 && item.available);
  const dailyPace = pickup7?.pickup === null || pickup7?.pickup === undefined ? 0 : pickup7.pickup / 7;
  const today = localDate(dateKey(new Date()));
  const daily = occupancy.map(row => {
    const stay = localDate(row.date);
    const leadDays = Math.max(0, Math.round((stay.getTime() - today.getTime()) / 86_400_000));
    const paceProjection = Math.min(row.availableRooms, Math.round(dailyPace * Math.min(leadDays, 30) / Math.max(1, occupancy.length)));
    const forecastSold = Math.min(inventory, row.occupiedRooms + paceProjection);
    const forecastOccupancy = inventory ? Math.round(forecastSold / inventory * 100) : 0;
    const level = forecastOccupancy >= 90 ? "Peak" : forecastOccupancy >= 75 ? "High" : forecastOccupancy <= 35 ? "Low" : "Normal";
    return {
      ...row, forecastSold, forecastOccupancy, level,
      confidence: pickup7?.available ? "Medium" : "Low",
      reason: pickup7?.available ? "Current bookings plus measured seven-day pickup pace." : "Current bookings only; pickup history is still being built.",
    };
  });
  const defaultPlan = ratePlans.find(row => /standard|bar|best available/i.test(String(row.plan_name || row.plan_code || ""))) || ratePlans[0];
  const rateSuggestions = roomTypes.flatMap(type => daily.map(day => {
    const range = rateRanges.find(row =>
      String(row.start_date || "") <= day.date && String(row.end_date || "") >= day.date
      && (!row.room_type_id || String(row.room_type_id) === String(type.id))
    );
    const planId = String(range?.rate_plan_id || defaultPlan?.id || "");
    const price = ratePrices.find(row => String(row.rate_plan_id) === planId && String(row.room_type_id) === String(type.id))
      || ratePrices.find(row => String(row.room_type_id) === String(type.id));
    const baseRate = numberValue(range, "override_double_rate", "override_single_rate", "override_triple_rate")
      || numberValue(price, "double_rate", "single_rate", "triple_rate");
    const factor = day.forecastOccupancy >= 90 ? 1.25 : day.forecastOccupancy >= 80 ? 1.15
      : day.forecastOccupancy >= 65 ? 1.08 : day.forecastOccupancy <= 25 ? .85
      : day.forecastOccupancy <= 40 ? .92 : 1;
    return {
      date: day.date, roomTypeId: type.id, roomType: type.room_name, rooms: Number(type.room_count || 0),
      baseRate, suggestedRate: baseRate ? roundRate(baseRate * factor, currency) : 0,
      changePercent: Math.round((factor - 1) * 100), occupancy: day.occupancyPercent,
      forecastOccupancy: day.forecastOccupancy, demandLevel: day.level,
      reason: !baseRate ? "Add a base room rate in the property profile."
        : factor > 1 ? "Demand supports a controlled rate increase."
        : factor < 1 ? "Soft demand supports a tactical offer while protecting rate integrity."
        : "Hold the current rate and monitor pickup.",
    };
  }));
  const otaDaily = daily.map(day => ({
    date: day.date,
    action: day.forecastOccupancy >= 92 ? "Close discounts"
      : day.forecastOccupancy >= 82 ? "Restrict promotions"
      : day.forecastOccupancy <= 30 ? "Open all suitable channels"
      : "Keep open",
    scope: day.forecastOccupancy >= 92 ? "Close mobile/Genius/campaign discounts; keep direct and essential channels."
      : day.forecastOccupancy >= 82 ? "Pause deep discounts and consider minimum-stay controls."
      : day.forecastOccupancy <= 30 ? "Keep OTAs open and activate a controlled visibility offer."
      : "Maintain current OTA distribution.",
    occupancy: day.forecastOccupancy,
    priority: day.forecastOccupancy >= 92 || day.forecastOccupancy <= 30 ? "High" : day.forecastOccupancy >= 82 ? "Medium" : "Watch",
  }));
  const currentDaily = occupancy.map(row => ({ date: row.date, occupiedRooms: row.occupiedRooms, occupancyPercent: row.occupancyPercent }));
  return {
    generatedAt: new Date().toISOString(), currency,
    dataQuality: {
      pickupHistory: snapshots.length ? "Building" : "New",
      rateCoverage: rateSuggestions.length ? Math.round(rateSuggestions.filter(row => row.baseRate > 0).length / rateSuggestions.length * 100) : 0,
      forecastConfidence: pickup7?.available ? "Medium" : "Low",
    },
    pickup: snapshotWindows,
    forecast: daily,
    highDemandPeriods: groupPeriods(daily, ["High", "Peak"]),
    lowDemandPeriods: groupPeriods(daily, ["Low"]),
    rateSuggestions,
    otaActions: otaDaily,
    snapshot: currentDaily,
    totals: {
      occupiedRoomNights: occupancy.reduce((sum, row) => sum + row.occupiedRooms, 0),
      bookedRevenue: bookings.reduce((sum, row) => sum + Number(row.total_amount || 0), 0),
    },
  };
}

export async function GET(request: NextRequest) {
  if (!readServerSession(request)) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const properties = await supabaseAdmin<Property[]>("nkh_properties?select=id,client_code,property_name,city,country,total_rooms&client_status=eq.Active&order=property_name");
  const propertyId = String(request.nextUrl.searchParams.get("propertyId") || "");
  const from = String(request.nextUrl.searchParams.get("from") || "");
  const to = String(request.nextUrl.searchParams.get("to") || "");
  if (propertyId && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to) {
    const [propertyRows, roomTypes, bookings, ratePlans, rateRanges] = await Promise.all([
      supabaseAdmin<Property[]>(`nkh_properties?select=*&id=eq.${encodeURIComponent(propertyId)}&limit=1`),
      supabaseAdmin<Record<string, unknown>[]>(`nkh_room_types?select=*&property_id=eq.${encodeURIComponent(propertyId)}&is_active=eq.true`),
      supabaseAdmin<Booking[]>(`nkh_calendar_bookings?select=check_in,check_out,room_name,room_type,booking_status,booking_source,total_amount,received_amount&property_id=eq.${encodeURIComponent(propertyId)}&check_in=lte.${encodeURIComponent(to)}&check_out=gt.${encodeURIComponent(from)}`),
      supabaseAdmin<Record<string, unknown>[]>(`nkh_rate_plans?select=*&property_id=eq.${encodeURIComponent(propertyId)}`),
      supabaseAdmin<Record<string, unknown>[]>(`nkh_rate_calendar_ranges?select=*&property_id=eq.${encodeURIComponent(propertyId)}&start_date=lte.${encodeURIComponent(to)}&end_date=gte.${encodeURIComponent(from)}`),
    ]);
    const property = propertyRows[0];
    if (!property) return NextResponse.json({ error: "Property not found." }, { status: 404 });
    const planIds = ratePlans.map(row => String(row.id || "")).filter(Boolean);
    const ratePrices = planIds.length
      ? await supabaseAdmin<Record<string, unknown>[]>(`nkh_rate_plan_prices?select=*&rate_plan_id=in.(${planIds.map(encodeURIComponent).join(",")})`)
      : [];
    const inventory = roomTypes.reduce((sum, row) => sum + Number(row.room_count || 0), 0) || Number(property.total_rooms || 0);
    const occupancy = buildOccupancy(from, to, inventory, bookings);
    let snapshots: Snapshot[] = [];
    try {
      snapshots = await supabaseAdmin<Snapshot[]>(`nkh_revenue_snapshots?select=captured_at,daily_inventory&property_id=eq.${encodeURIComponent(propertyId)}&period_start=eq.${encodeURIComponent(from)}&period_end=eq.${encodeURIComponent(to)}&order=captured_at.desc&limit=40`);
    } catch (snapshotError) {
      console.warn("Revenue dashboard pickup history is not available yet.", snapshotError);
    }
    const dashboard = buildRevenueEngine({
      from, to, property, inventory, roomTypes: roomTypes as RoomType[], bookings, occupancy,
      ratePlans, ratePrices, rateRanges, snapshots,
    });
    const latestCapture = snapshots[0]?.captured_at ? new Date(snapshots[0].captured_at).getTime() : 0;
    if (!latestCapture || Date.now() - latestCapture >= 6 * 3_600_000) {
      try {
        await supabaseAdmin("nkh_revenue_snapshots", {
          method: "POST", prefer: "return=minimal",
          body: {
            property_id: propertyId, period_start: from, period_end: to, inventory,
            occupied_room_nights: dashboard.totals.occupiedRoomNights,
            booked_revenue: dashboard.totals.bookedRevenue,
            daily_inventory: dashboard.snapshot,
          },
        });
      } catch (snapshotError) {
        console.warn("Revenue dashboard snapshot could not be saved.", snapshotError);
      }
    }
    return NextResponse.json({
      success: true, properties, property,
      metrics: {
        inventory,
        averageOccupancy: occupancy.length ? Math.round(occupancy.reduce((sum, row) => sum + row.occupancyPercent, 0) / occupancy.length) : 0,
        bookedRevenue: bookings.reduce((sum, row) => sum + Number(row.total_amount || 0), 0),
        currency: property.currency_code || "LKR",
      },
      dashboard,
    });
  }
  return NextResponse.json({ success: true, properties });
}

export async function POST(request: NextRequest) {
  try {
    const session = readServerSession(request);
    if (!session) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
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
    let snapshots: Snapshot[] = [];
    try {
      snapshots = await supabaseAdmin<Snapshot[]>(`nkh_revenue_snapshots?select=captured_at,daily_inventory&property_id=eq.${encodeURIComponent(propertyId)}&period_start=eq.${encodeURIComponent(from)}&period_end=eq.${encodeURIComponent(to)}&order=captured_at.desc&limit=40`);
    } catch (snapshotError) {
      console.warn("Revenue pickup history is not available yet.", snapshotError);
    }
    const revenueEngine = buildRevenueEngine({
      from, to, property, inventory, roomTypes: roomTypes as RoomType[], bookings, occupancy,
      ratePlans, ratePrices, rateRanges, snapshots,
    });
    const context = {
      property, planningPeriod: { from, to, objective }, inventory, roomTypes, occupancy, bookings,
      ratePlans, ratePrices, rateRanges,
      calculatedRevenueSignals: {
        dataQuality: revenueEngine.dataQuality,
        pickup: revenueEngine.pickup,
        forecast: revenueEngine.forecast,
        highDemandPeriods: revenueEngine.highDemandPeriods,
        lowDemandPeriods: revenueEngine.lowDemandPeriods,
        otaActionSummary: revenueEngine.otaActions.filter(item => item.action !== "Keep open"),
      },
    };
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
    try {
      await supabaseAdmin("nkh_revenue_snapshots", {
        method: "POST", prefer: "return=minimal",
        body: {
          property_id: propertyId, period_start: from, period_end: to, inventory,
          occupied_room_nights: revenueEngine.totals.occupiedRoomNights,
          booked_revenue: revenueEngine.totals.bookedRevenue,
          daily_inventory: revenueEngine.snapshot,
        },
      });
    } catch (snapshotError) {
      console.warn("Revenue snapshot could not be saved.", snapshotError);
    }
    return NextResponse.json({ success: true, planId: saved[0]?.id, property: { id: property.id, property_name: property.property_name, city: property.city, country: property.country }, metrics: { inventory, averageOccupancy: occupancy.length ? Math.round(occupancy.reduce((sum, row) => sum + row.occupancyPercent, 0) / occupancy.length) : 0, bookedRevenue: bookings.reduce((sum, row) => sum + Number(row.total_amount || 0), 0), currency: property.currency_code || "LKR" }, revenueEngine, plan });
  } catch (error) {
    console.error("AI revenue plan failed.", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create the revenue plan." }, { status: 500 });
  }
}
