import { NextRequest, NextResponse } from "next/server";
import { isMasterSession, readServerSession } from "../../../lib/serverSession";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { CalendarBooking, normalizeExtractedReservation, OtaReservation, runReservationAudit } from "../../../lib/reservationAudit";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = {
  type: "object",
  properties: {
    reservations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          reference: { type: "string" }, guestName: { type: "string" },
          checkIn: { type: "string" }, checkOut: { type: "string" },
          roomCount: { type: "integer" }, roomTypes: { type: "array", items: { type: "string" } },
          status: { type: "string" }, totalAmount: { type: ["number", "null"] }, currency: { type: "string" },
        },
        required: ["reference","guestName","checkIn","checkOut","roomCount","roomTypes","status","totalAmount","currency"],
        additionalProperties: false,
      },
    },
  },
  required: ["reservations"],
  additionalProperties: false,
};

function outputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string") return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output as Array<Record<string, unknown>>) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content as Array<Record<string, unknown>>) if (part.type === "output_text" && typeof part.text === "string") return part.text;
  }
  throw new Error("The document extractor returned no readable result.");
}

async function extract(file: File, otaSource: string): Promise<OtaReservation[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured in Vercel.");
  const mime = file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "text/csv");
  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_OTA_AUDIT_MODEL || "gpt-5.6-luna",
      store: false,
      input: [{
        role: "user",
        content: [
          { type: "input_file", filename: file.name, file_data: `data:${mime};base64,${base64}`, detail: mime === "application/pdf" ? "low" : undefined },
          { type: "input_text", text: `Extract every ${otaSource} hotel reservation, including confirmed, modified, cancelled/canceled, rejected, no-show and pending reservations. One result must represent the complete reservation, even when it contains multiple rooms or nights. Use ISO YYYY-MM-DD dates. Preserve the OTA confirmation/reference exactly. roomCount is the total number of rooms; roomTypes lists each booked type. Set status to the operational state clearly stated in the file—especially Cancellation/Cancelled—and never infer Confirmed when the document says cancelled. Do not invent missing information.` },
        ],
      }],
      text: { format: { type: "json_schema", name: "ota_reservations", strict: true, schema } },
    }),
  });
  const payload = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(`OTA document reading failed: ${JSON.stringify(payload).slice(0, 500)}`);
  const parsed = JSON.parse(outputText(payload)) as { reservations: Array<Record<string, unknown>> };
  return parsed.reservations.map(normalizeExtractedReservation).filter(row => row.guestName && row.checkIn && row.checkOut);
}

export async function GET(request: NextRequest) {
  if (!isMasterSession(readServerSession(request))) return NextResponse.json({ error: "Master access required." }, { status: 403 });
  const properties = await supabaseAdmin<Array<{ id: string; client_code: string; property_name: string }>>("nkh_properties?select=id,client_code,property_name&client_status=eq.Active&order=property_name");
  return NextResponse.json({ success: true, properties });
}

export async function POST(request: NextRequest) {
  try {
    const session = readServerSession(request);
    if (!isMasterSession(session)) return NextResponse.json({ error: "Master access required." }, { status: 403 });
    const form = await request.formData();
    const propertyId = String(form.get("propertyId") || "");
    const otaSource = String(form.get("otaSource") || "");
    const file = form.get("file");
    if (!propertyId || !otaSource || !(file instanceof File)) return NextResponse.json({ error: "Property, OTA and file are required." }, { status: 400 });
    if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "Maximum file size is 20 MB." }, { status: 400 });
    if (!/\.(pdf|csv|xlsx|xls)$/i.test(file.name)) return NextResponse.json({ error: "Upload a PDF, CSV, XLS or XLSX file." }, { status: 400 });

    const otaRows = await extract(file, otaSource);
    if (!otaRows.length) return NextResponse.json({ error: "No reservations were found in this file." }, { status: 422 });
    const from = otaRows.map(row => row.checkIn).sort()[0];
    const to = otaRows.map(row => row.checkOut).sort().at(-1);
    const bookings = await supabaseAdmin<CalendarBooking[]>(
      `nkh_calendar_bookings?select=*&property_id=eq.${encodeURIComponent(propertyId)}&check_in=lt.${encodeURIComponent(to || from)}&check_out=gt.${encodeURIComponent(from)}`,
    );
    const findings = runReservationAudit(otaRows, bookings, otaSource);
    const summary = {
      total: otaRows.length,
      matched: findings.filter(item => item.type === "matched").length,
      differences: findings.filter(item => item.type === "difference").length,
      cancellationIssues: findings.filter(item => item.differences.some(value =>
        value.startsWith("CANCELLATION NOT APPLIED") ||
        value.startsWith("STATUS CONFLICT") ||
        value.startsWith("OTA cancellation found")
      )).length,
      missingDashboard: findings.filter(item => item.type === "missing_dashboard").length,
      missingOta: findings.filter(item => item.type === "missing_ota").length,
      from, to,
    };
    const audits = await supabaseAdmin<Array<{ id: string }>>("nkh_reservation_audits", {
      method: "POST", prefer: "return=representation",
      body: { property_id: propertyId, ota_source: otaSource, file_name: file.name, file_type: file.type || file.name.split(".").pop(), status: "Completed", imported_count: otaRows.length, dashboard_count: bookings.length, matched_count: summary.matched, difference_count: findings.length - summary.matched, created_by: session?.name, completed_at: new Date().toISOString(), summary },
    });
    const auditId = audits[0]?.id;
    if (auditId && findings.length) await supabaseAdmin("nkh_reservation_audit_items", {
      method: "POST", prefer: "return=minimal",
      body: findings.map(item => ({ audit_id: auditId, property_id: propertyId, finding_type: item.type, severity: item.severity, match_score: item.matchScore, ota_reference: item.ota?.reference || null, guest_name: item.ota?.guestName || item.dashboard?.[0]?.guest_name || "", check_in: item.ota?.checkIn || item.dashboard?.[0]?.check_in, check_out: item.ota?.checkOut || item.dashboard?.[0]?.check_out, differences: item.differences, ota_data: item.ota || {}, dashboard_data: item.dashboard || [] })),
    });
    return NextResponse.json({ success: true, auditId, summary, findings });
  } catch (error) {
    console.error("Reservation audit failed.", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Reservation audit failed." }, { status: 500 });
  }
}
