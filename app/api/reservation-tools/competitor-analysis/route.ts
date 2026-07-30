import { NextRequest, NextResponse } from "next/server";
import { isMasterSession, readServerSession } from "../../../lib/serverSession";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

type Property = {
  id: string; client_code: string; property_name: string; description?: string | null;
  address_line_1?: string | null; city?: string | null; country?: string | null;
  website_url?: string | null; map_url?: string | null; total_rooms?: number | null;
  currency_code?: string | null; check_in_time?: string | null; check_out_time?: string | null;
};

const reportSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    executiveSummary: { type: "string" },
    marketPosition: { type: "string", enum: ["Budget","Value","Upper value","Premium","Unclear"] },
    rateCurrency: { type: "string" },
    hotelDisplayedRate: { type: ["number","null"] },
    marketAverageRate: { type: ["number","null"] },
    recommendedRateMin: { type: ["number","null"] },
    recommendedRateMax: { type: ["number","null"] },
    ratePositionNote: { type: "string" },
    competitors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" }, location: { type: "string" }, propertyType: { type: "string" },
          displayedRate: { type: ["number","null"] }, currency: { type: "string" },
          mealPlan: { type: "string" }, cancellation: { type: "string" },
          reviewScore: { type: ["number","null"] }, reviewCount: { type: ["number","null"] },
          strongestAdvantage: { type: "string" }, weaknessOpportunity: { type: "string" },
          rateVerified: { type: "boolean" }, confidence: { type: "string", enum: ["High","Medium","Low"] },
          sourceUrl: { type: "string" },
        },
        required: ["name","location","propertyType","displayedRate","currency","mealPlan","cancellation","reviewScore","reviewCount","strongestAdvantage","weaknessOpportunity","rateVerified","confidence","sourceUrl"],
        additionalProperties: false,
      },
    },
    keyFindings: { type: "array", items: { type: "string" } },
    swot: {
      type: "object",
      properties: {
        strengths: { type: "array", items: { type: "string" } },
        weaknesses: { type: "array", items: { type: "string" } },
        opportunities: { type: "array", items: { type: "string" } },
        threats: { type: "array", items: { type: "string" } },
      },
      required: ["strengths","weaknesses","opportunities","threats"], additionalProperties: false,
    },
    actions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          timeframe: { type: "string", enum: ["Today","Next 7 days","Next 30 days"] },
          title: { type: "string" }, action: { type: "string" }, reason: { type: "string" },
        },
        required: ["timeframe","title","action","reason"], additionalProperties: false,
      },
    },
    cautions: { type: "array", items: { type: "string" } },
  },
  required: ["title","executiveSummary","marketPosition","rateCurrency","hotelDisplayedRate","marketAverageRate","recommendedRateMin","recommendedRateMax","ratePositionNote","competitors","keyFindings","swot","actions","cautions"],
  additionalProperties: false,
};

function outputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string") return payload.output_text;
  for (const item of (Array.isArray(payload.output) ? payload.output : []) as Array<Record<string, unknown>>) {
    for (const part of (Array.isArray(item.content) ? item.content : []) as Array<Record<string, unknown>>) {
      if (part.type === "output_text" && typeof part.text === "string") return part.text;
    }
  }
  throw new Error("Competitor research returned no readable report.");
}

function outputSources(payload: Record<string, unknown>) {
  const found = new Map<string, { title: string; url: string }>();
  for (const item of (Array.isArray(payload.output) ? payload.output : []) as Array<Record<string, unknown>>) {
    for (const part of (Array.isArray(item.content) ? item.content : []) as Array<Record<string, unknown>>) {
      for (const annotation of (Array.isArray(part.annotations) ? part.annotations : []) as Array<Record<string, unknown>>) {
        const url = String(annotation.url || "");
        if (url.startsWith("http")) found.set(url, { title: String(annotation.title || "Research source"), url });
      }
    }
  }
  return [...found.values()].slice(0, 20);
}

function parseReport(text: string) {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(clean); }
  catch { throw new Error("AI returned an incomplete competitor report. Please run the research again."); }
}

async function createResearch(key: string, context: Record<string, unknown>) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_COMPETITOR_MODEL || "gpt-5.4-mini",
      store: false,
      reasoning: { effort: "medium" },
      tools: [{ type: "web_search" }],
      input: `You are the evidence-led competitor analyst for NKH Dashboard. Research genuinely comparable accommodation competitors around the supplied hotel and city for the exact stay criteria.

Selection rules:
- Prefer similar property type, location, guest segment, room standard and public price range.
- Research the requested number of competitors only.
- Use public hotel/OTA pages, official property websites, maps/review sources and reputable travel sources.
- A displayed rate is valid only when it clearly relates to the supplied check-in, check-out, adults and rooms. Otherwise use null and rateVerified=false.
- Never convert a "from" price, old cached price, member-only price or undated snippet into a verified rate.
- Do not invent distances, facilities, review scores, review counts, cancellation conditions, meal plans, prices or URLs.
- Use sourceUrl="" when no direct supporting page is available and set Low confidence.
- Keep the writing concise enough for a two-page management PDF: executive summary under 80 words; exactly 3 key findings; SWOT maximum 3 short items per quadrant; 4-6 actions total.
- Recommendations are advisory. Explain important rate limitations in cautions.
- Return only JSON matching the schema.

Research context:
${JSON.stringify(context)}`,
      text: { format: { type: "json_schema", name: "nkh_competitor_report", strict: true, schema: reportSchema } },
    }),
  });
  const raw = await response.text();
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(raw) as Record<string, unknown>; }
  catch { throw new Error(`Research service returned an unreadable response (HTTP ${response.status}).`); }
  if (!response.ok) {
    const detail = payload.error as Record<string, unknown> | undefined;
    throw new Error(String(detail?.message || `Competitor research failed (HTTP ${response.status}).`));
  }
  return { report: parseReport(outputText(payload)), sources: outputSources(payload) };
}

export async function GET(request: NextRequest) {
  try {
    if (!isMasterSession(readServerSession(request))) return NextResponse.json({ error: "Master access required." }, { status: 403 });
    const properties = await supabaseAdmin<Property[]>("nkh_properties?select=id,client_code,property_name,city,country,total_rooms&client_status=eq.Active&order=property_name");
    return NextResponse.json({ success: true, properties });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load properties." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = readServerSession(request);
    if (!isMasterSession(session)) return NextResponse.json({ error: "Master access required." }, { status: 403 });
    const input = await request.json();
    const propertyId = String(input.propertyId || ""), checkIn = String(input.checkIn || ""), checkOut = String(input.checkOut || "");
    const adults = Math.min(20, Math.max(1, Number(input.adults) || 2));
    const rooms = Math.min(10, Math.max(1, Number(input.rooms) || 1));
    const competitorCount = Math.min(10, Math.max(3, Number(input.competitorCount) || 5));
    const objective = String(input.objective || "Full market analysis").slice(0, 120);
    if (!propertyId || !/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut) || checkIn >= checkOut) {
      return NextResponse.json({ error: "Choose a hotel and valid future stay dates." }, { status: 400 });
    }
    const [properties, roomTypes, otaRates] = await Promise.all([
      supabaseAdmin<Property[]>(`nkh_properties?select=*&id=eq.${encodeURIComponent(propertyId)}&limit=1`),
      supabaseAdmin<Record<string, unknown>[]>(`nkh_room_types?select=room_name,room_count,max_occupancy,bed_configuration,amenities&property_id=eq.${encodeURIComponent(propertyId)}&is_active=eq.true`),
      supabaseAdmin<Record<string, unknown>[]>(`nkh_ota_rate_profiles?select=room_name,meal_plan,rack_rate_usd,genius_percent,audience_kind,audience_percent,campaign_kind,campaign_percent,deal_kind,deal_percent&property_id=eq.${encodeURIComponent(propertyId)}`),
    ]);
    const property = properties[0];
    if (!property) return NextResponse.json({ error: "Property not found." }, { status: 404 });
    if (!property.city && !property.address_line_1) return NextResponse.json({ error: "Add the hotel city or address before researching competitors." }, { status: 400 });
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is not configured in Vercel.");
    const criteria = { checkIn, checkOut, adults, rooms, competitorCount, objective };
    const { report, sources } = await createResearch(key, { property, roomTypes, otaRates, criteria });
    const saved = await supabaseAdmin<Array<{ id: string }>>("nkh_competitor_reports", {
      method: "POST", prefer: "return=representation",
      body: { property_id: propertyId, check_in: checkIn, check_out: checkOut, adults, rooms, competitor_count: competitorCount, objective, property_snapshot: { property, roomTypes, otaRates }, report, sources, generated_by: session?.name },
    });
    return NextResponse.json({ success: true, reportId: saved[0]?.id, property, criteria, report, sources });
  } catch (error) {
    console.error("Competitor analysis failed.", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to complete competitor research." }, { status: 500 });
  }
}

