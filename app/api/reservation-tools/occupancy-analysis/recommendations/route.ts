import { NextRequest, NextResponse } from "next/server";
import { isMasterSession, readServerSession } from "../../../../lib/serverSession";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = {
  type: "object",
  properties: {
    recommendations: {
      type: "array", minItems: 10, maxItems: 10,
      items: {
        type: "object",
        properties: {
          rank: { type: "integer", minimum: 1, maximum: 10 },
          title: { type: "string" }, action: { type: "string" }, reason: { type: "string" },
          impact: { type: "string", enum: ["High","Medium","Low"] },
          timeframe: { type: "string", enum: ["Today","Next 7 days","Next 30 days"] },
        },
        required: ["rank","title","action","reason","impact","timeframe"], additionalProperties: false,
      },
    },
  },
  required: ["recommendations"], additionalProperties: false,
};

function outputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string") return payload.output_text;
  for (const item of (Array.isArray(payload.output) ? payload.output : []) as Array<Record<string, unknown>>) {
    for (const part of (Array.isArray(item.content) ? item.content : []) as Array<Record<string, unknown>>) {
      if (part.type === "output_text" && typeof part.text === "string") return part.text;
    }
  }
  throw new Error("AI returned no readable recommendations.");
}

export async function POST(request: NextRequest) {
  try {
    if (!isMasterSession(readServerSession(request))) return NextResponse.json({ error: "Master access required." }, { status: 403 });
    const input = await request.json(), reportId = String(input.reportId || "");
    if (!/^[0-9a-f-]{36}$/i.test(reportId)) return NextResponse.json({ error: "Invalid occupancy report." }, { status: 400 });
    const rows = await supabaseAdmin<Array<Record<string, any>>>(`nkh_occupancy_reports?select=*&id=eq.${encodeURIComponent(reportId)}&limit=1`);
    const saved = rows[0];
    if (!saved) return NextResponse.json({ error: "Occupancy report not found." }, { status: 404 });
    const key = process.env.OPENAI_API_KEY;
    if (!key) return NextResponse.json({ success: true, recommendations: saved.recommendations, source: "rules" });
    const metrics = saved.metrics || {};
    const context = {
      property: saved.property_snapshot, period: { from: saved.date_from, to: saved.date_to },
      occupancy: metrics.occupancy, soldRoomNights: metrics.soldRoomNights, availableRoomNights: metrics.availableRoomNights,
      blockedRoomNights: metrics.blockedRoomNights, reservations: metrics.reservationGroups, cancellations: metrics.cancelledGroups,
      pending: metrics.pendingReservations, recordedRevenue: metrics.recordedRevenue, currency: metrics.currency,
      adr: metrics.adr, revpar: metrics.revpar, revenueCoverage: metrics.revenueCoverage,
      peakDates: metrics.peakDates, weakDates: metrics.weakDates, roomTypes: metrics.roomTypes,
      sourceMix: metrics.sourceMix, weekdays: metrics.weekdays,
    };
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_OCCUPANCY_MODEL || "gpt-5.4-mini", store: false, reasoning: { effort: "low" },
        input: `You are NKH Dashboard's senior hotel revenue and reservations analyst. Using only the supplied occupancy facts, return exactly 10 ranked, non-repetitive recommendations.
Rank 1 is the most valuable. Be practical for a small boutique hotel reservations and marketing team.
Do not invent events, competitor rates or missing revenue. If revenue coverage is weak, say so.
Balance immediate inventory controls, weak-date demand, peak-date rate protection, room-type performance, source mix, direct bookings, pending reservations and data quality.
Each action must be under 25 words and each reason under 22 words. Return JSON only.
Facts: ${JSON.stringify(context)}`,
        text: { format: { type: "json_schema", name: "occupancy_recommendations", strict: true, schema } },
      }),
    });
    const raw = await response.text();
    let payload: Record<string, unknown>;
    try { payload = JSON.parse(raw) as Record<string, unknown>; } catch { throw new Error("AI returned an unreadable response."); }
    if (!response.ok) throw new Error(String((payload.error as Record<string, unknown> | undefined)?.message || `AI request failed (${response.status}).`));
    const parsed = JSON.parse(outputText(payload));
    const recommendations = parsed.recommendations;
    await supabaseAdmin(`nkh_occupancy_reports?id=eq.${encodeURIComponent(reportId)}`, { method: "PATCH", body: { recommendations, recommendation_source: "ai" } });
    return NextResponse.json({ success: true, recommendations, source: "ai" });
  } catch (error) {
    console.error("Occupancy recommendations failed.", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate AI recommendations." }, { status: 500 });
  }
}
