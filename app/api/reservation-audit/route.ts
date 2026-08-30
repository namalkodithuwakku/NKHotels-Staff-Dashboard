import { NextRequest, NextResponse } from "next/server";
import { runLiveReservationAudit } from "../../lib/liveReservationAudit";
import { importRecentOtaEmails } from "../../lib/gmailIntegration";
import { readServerSession } from "../../lib/serverSession";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { isSupervisorRequestAuthorized } from "../lib/supervisorAuth";

export const runtime = "nodejs";
export const maxDuration = 60;

type Property = {
  id: string;
  client_code: string;
  property_name: string;
  calendar_sheet_code: string | null;
  calendar_source_mode: "google_sheet" | "supabase" | null;
  client_status: string | null;
};

type Booking = {
  id: string;
  booking_group_key: string | null;
  booking_reference: string | null;
  guest_name: string;
  room_name: string;
  room_type: string | null;
  booking_source: string;
  booking_status: string;
  check_in: string;
  check_out: string;
};

type LookupRequest = {
  action?: "lookup" | "historical";
  property?: string;
  propertyId?: string;
  reservationId?: string;
  event?: "new" | "modified" | "cancelled";
  guestName?: string;
  checkIn?: string;
  checkOut?: string;
  roomCount?: number;
  lookbackDays?: number;
};

function authorized(request: NextRequest) {
  return Boolean(readServerSession(request)) || isSupervisorRequestAuthorized(request);
}

const clean = (value: unknown) => String(value || "").trim();
const referenceKey = (value: unknown) => clean(value).toLowerCase().replace(/[\s-]+/g, "");
const textKey = (value: unknown) => clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
const dateOnly = (value: unknown) => clean(value).slice(0, 10);
const cancelled = (value: unknown) => /cancel|void|reject|no[ -]?show/i.test(clean(value));

function propertyMatches(property: Property, value: string) {
  const wanted = textKey(value);
  return wanted === textKey(property.id)
    || wanted === textKey(property.client_code)
    || wanted === textKey(property.property_name);
}

function groupBookings(rows: Booking[]) {
  const groups = new Map<string, Booking[]>();
  for (const row of rows) {
    const groupKey = clean(row.booking_group_key)
      || `${referenceKey(row.booking_reference)}|${textKey(row.guest_name)}|${dateOnly(row.check_in)}|${dateOnly(row.check_out)}`;
    groups.set(groupKey, [...(groups.get(groupKey) || []), row]);
  }
  return [...groups.values()];
}

function nameMatches(expected: unknown, actual: unknown) {
  const left = textKey(expected);
  const right = textKey(actual);
  return Boolean(left && right && (left === right || left.includes(right) || right.includes(left)));
}

function fallbackScore(body: LookupRequest, rows: Booking[]) {
  const first = rows[0];
  let score = 0;
  if (nameMatches(body.guestName, first.guest_name)) score += 50;
  if (body.checkIn && dateOnly(body.checkIn) === dateOnly(first.check_in)) score += 20;
  if (body.checkOut && dateOnly(body.checkOut) === dateOnly(first.check_out)) score += 20;
  return score;
}

async function lookupReservation(body: LookupRequest) {
  const propertyInput = clean(body.propertyId || body.property);
  const reservationId = clean(body.reservationId);
  const event = body.event || "new";

  if (!propertyInput) {
    return NextResponse.json({ success: false, error: "property or propertyId is required" }, { status: 400 });
  }
  if (!reservationId && !body.guestName && !body.checkIn && !body.checkOut) {
    return NextResponse.json({ success: false, error: "reservationId or secondary reservation evidence is required" }, { status: 400 });
  }

  const properties = await supabaseAdmin<Property[]>(
    "nkh_properties?select=id,client_code,property_name,calendar_sheet_code,calendar_source_mode,client_status&client_status=in.(Active,Onboarding)&order=property_name.asc",
  );
  const property = properties.find(item => propertyMatches(item, propertyInput)) || null;

  if (!property) {
    return NextResponse.json({ success: true, eligible: false, result: "SKIP_PROPERTY", reason: "Property is not an active/onboarding NKH property." });
  }

  const calendarConnected = property.calendar_source_mode === "supabase" || Boolean(clean(property.calendar_sheet_code));
  if (!calendarConnected) {
    return NextResponse.json({
      success: true,
      eligible: false,
      result: "SKIP_PROPERTY",
      property: { id: property.id, clientCode: property.client_code, name: property.property_name },
      reason: "Property does not have a connected NKH reservation calendar.",
    });
  }

  const rows = await supabaseAdmin<Booking[]>(
    `nkh_calendar_bookings?property_id=eq.${encodeURIComponent(property.id)}&select=id,booking_group_key,booking_reference,guest_name,room_name,room_type,booking_source,booking_status,check_in,check_out&order=check_in.asc`,
  );
  const groups = groupBookings(rows);
  const wantedReference = referenceKey(reservationId);

  let matched: Booking[] | null = null;
  let confidence = 0;
  if (wantedReference) {
    matched = groups.find(group => group.some(row => referenceKey(row.booking_reference) === wantedReference)) || null;
    if (matched) confidence = 100;
  }

  if (!matched) {
    for (const group of groups) {
      const score = fallbackScore(body, group);
      if (score > confidence) {
        confidence = score;
        matched = group;
      }
    }
    if (confidence < 50) matched = null;
  }

  const active = matched?.filter(row => !cancelled(row.booking_status)) || [];
  const first = active[0] || matched?.[0] || null;
  let result = "MATCH";
  let needsStaffAction = false;
  const findings: string[] = [];

  if (event === "cancelled") {
    if (active.length) {
      result = "CANCELLATION_STILL_ACTIVE";
      needsStaffAction = true;
      findings.push("Cancellation email received, but the reservation still occupies active calendar inventory.");
    }
  } else if (!active.length) {
    result = "NOT_FOUND";
    needsStaffAction = true;
    findings.push(event === "modified" ? "Modified reservation could not be found on the active calendar." : "New reservation is not on the active calendar.");
  } else if (event === "modified" && first) {
    if (body.checkIn && dateOnly(body.checkIn) !== dateOnly(first.check_in)) findings.push(`Check-in should be ${dateOnly(body.checkIn)}; calendar shows ${dateOnly(first.check_in)}.`);
    if (body.checkOut && dateOnly(body.checkOut) !== dateOnly(first.check_out)) findings.push(`Check-out should be ${dateOnly(body.checkOut)}; calendar shows ${dateOnly(first.check_out)}.`);
    if (body.roomCount && Number(body.roomCount) !== active.length) findings.push(`Room count should be ${body.roomCount}; calendar shows ${active.length}.`);
    if (body.guestName && !nameMatches(body.guestName, first.guest_name)) findings.push(`Guest should be ${body.guestName}; calendar shows ${first.guest_name}.`);
    if (findings.length) {
      result = "MODIFICATION_MISMATCH";
      needsStaffAction = true;
    }
  }

  return NextResponse.json({
    success: true,
    eligible: true,
    result,
    needsStaffAction,
    confidence,
    findings,
    property: { id: property.id, clientCode: property.client_code, name: property.property_name },
    reservationId: reservationId || null,
    calendarBooking: first ? {
      guestName: first.guest_name,
      checkIn: first.check_in,
      checkOut: first.check_out,
      roomCount: active.length,
      rooms: active.map(row => ({ roomName: row.room_name, roomType: row.room_type })),
      source: first.booking_source,
      status: first.booking_status,
      bookingReference: first.booking_reference,
    } : null,
  });
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  try {
    const rows = await supabaseAdmin<Record<string, unknown>[]>(
      "nkh_reservation_audit_events?select=*&order=email_received_at.desc&limit=200",
    );
    return NextResponse.json({ success: true, items: rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to load reservation audit." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json().catch(() => ({}))) as LookupRequest;
    if (body.action === "lookup") return lookupReservation(body);

    const requestedLookback = Number(body.lookbackDays || 7);
    const lookbackDays = [7, 30, 90, 180].includes(requestedLookback) ? requestedLookback : Math.min(180, Math.max(1, requestedLookback || 7));

    let imported = 0;
    let gmailWarning: string | null = null;
    try {
      imported = await importRecentOtaEmails(lookbackDays);
    } catch (error) {
      gmailWarning = error instanceof Error ? error.message : "Recent Gmail refresh failed.";
      console.error("Reservation audit Gmail refresh failed; checking existing inbox copy.", error);
    }
    const result = await runLiveReservationAudit(10, lookbackDays);
    return NextResponse.json({ success: true, imported, gmailWarning, lookbackDays, ...result });
  } catch (error) {
    console.error("Live reservation audit failed.", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Reservation audit failed." }, { status: 500 });
  }
}
