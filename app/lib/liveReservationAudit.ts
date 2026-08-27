import { supabaseAdmin } from "./supabaseAdmin";

type ReservationExpectation = {
  guestName?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  roomCount?: number | null;
  roomTypes?: string[];
};

type EmailRow = {
  id: string;
  gmail_message_id: string;
  received_at: string;
  property_id: string | null;
  property_name_snapshot: string | null;
  booking_id: string | null;
  event_type: string;
  category: string | null;
  subject: string | null;
  body_text: string | null;
  source_metadata: { reservation?: ReservationExpectation } | null;
};

type AuditRow = {
  id: string;
  email_inbox_id: string;
  property_id: string | null;
  event_type: string;
  booking_reference: string | null;
  expected_data: ReservationExpectation;
  due_at: string;
};

type Booking = {
  id: string;
  booking_group_key: string | null;
  booking_reference: string | null;
  guest_name: string;
  room_name: string;
  room_type: string | null;
  booking_status: string;
  check_in: string;
  check_out: string;
};

const relevantEvents = ["New Booking", "Modified Booking", "Cancelled Booking"];
const clean = (value: unknown) => String(value || "").trim();
const key = (value: unknown) => clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
const date = (value: unknown) => clean(value).slice(0, 10);
const cancelled = (value: unknown) => /cancel|void|reject|no[ -]?show/i.test(clean(value));

function reservationEvent(email: EmailRow) {
  if (relevantEvents.includes(email.event_type)) return email.event_type;
  const subject = clean(email.subject).toLowerCase();
  if (/\b(cancelled|canceled|cancellation)\b/.test(subject)) return "Cancelled Booking";
  if (/\b(modified|modification|amended|amendment|changed|updated)\b/.test(subject) && /\b(booking|reservation)\b/.test(subject)) return "Modified Booking";
  if (/\b(new booking|booking confirmation|booking confirmed|reservation confirmed|confirmed reservation)\b/.test(subject)) return "New Booking";
  return null;
}

function nameMatches(left: unknown, right: unknown) {
  const a = key(left), b = key(right);
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

function groupBookings(rows: Booking[]) {
  const groups = new Map<string, Booking[]>();
  for (const row of rows) {
    const group = clean(row.booking_group_key) || [key(row.booking_reference), key(row.guest_name), date(row.check_in), date(row.check_out)].join("|");
    groups.set(group, [...(groups.get(group) || []), row]);
  }
  return [...groups.values()];
}

function candidateScore(audit: AuditRow, rows: Booking[]) {
  const first = rows[0];
  const expected = audit.expected_data || {};
  const referenceMatch = Boolean(key(audit.booking_reference)) && key(audit.booking_reference) === key(first.booking_reference);
  if (referenceMatch) return 100;
  let score = 0;
  if (nameMatches(expected.guestName, first.guest_name)) score += 50;
  if (expected.checkIn && date(expected.checkIn) === date(first.check_in)) score += 20;
  if (expected.checkOut && date(expected.checkOut) === date(first.check_out)) score += 20;
  if (!referenceMatch && score < 50) return -1;
  return score;
}

function evaluate(audit: AuditRow, group: Booking[] | null, confidence: number) {
  const expected = audit.expected_data || {};
  const active = group?.filter(row => !cancelled(row.booking_status)) || [];
  const findings: string[] = [];

  if (audit.event_type === "Cancelled Booking") {
    if (!active.length) return { status: "Verified", severity: "Normal", findings: ["Cancellation is removed from active calendar inventory."] };
    return { status: "Needs Staff Action", severity: "Urgent", findings: ["Cancellation email received, but the reservation still occupies the calendar."] };
  }

  if (!group?.length || !active.length) {
    return {
      status: "Needs Staff Action",
      severity: "Urgent",
      findings: [audit.event_type === "New Booking" ? "New reservation is not on the calendar." : "Modified reservation could not be found on the active calendar."],
    };
  }

  const first = active[0];
  if (audit.event_type === "Modified Booking") {
    if (expected.checkIn && date(expected.checkIn) !== date(first.check_in)) findings.push(`Check-in should be ${date(expected.checkIn)}; calendar shows ${date(first.check_in)}.`);
    if (expected.checkOut && date(expected.checkOut) !== date(first.check_out)) findings.push(`Check-out should be ${date(expected.checkOut)}; calendar shows ${date(first.check_out)}.`);
    if (expected.roomCount && Number(expected.roomCount) !== active.length) findings.push(`Room count should be ${expected.roomCount}; calendar shows ${active.length}.`);
    if (expected.guestName && !nameMatches(expected.guestName, first.guest_name)) findings.push(`Guest should be ${expected.guestName}; calendar shows ${first.guest_name}.`);
    if (findings.length) return { status: "Needs Staff Action", severity: "Urgent", findings };
  }

  return {
    status: "Verified",
    severity: "Normal",
    findings: [audit.event_type === "New Booking" ? "New reservation is present on the calendar." : confidence < 100 ? "Modified reservation matched using guest and stay details." : "Modified reservation details are updated on the calendar."],
  };
}

export async function runLiveReservationAudit(graceMinutes = 10) {
  const emails = await supabaseAdmin<EmailRow[]>(
    `nkh_email_inbox?select=id,gmail_message_id,received_at,property_id,property_name_snapshot,booking_id,event_type,category,subject,body_text,source_metadata&received_at=gte.${encodeURIComponent(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())}&order=received_at.asc&limit=1000`,
  );

  let queued = 0;
  for (const email of emails) {
    const eventType = reservationEvent(email);
    if (!eventType) continue;
    const expected = email.source_metadata?.reservation || {};
    await supabaseAdmin("nkh_reservation_audit_events", {
      method: "POST",
      prefer: "resolution=ignore-duplicates,return=minimal",
      body: {
        email_inbox_id: email.id,
        gmail_message_id: email.gmail_message_id,
        property_id: email.property_id,
        property_name: email.property_name_snapshot,
        ota_source: email.category,
        event_type: eventType,
        booking_reference: email.booking_id,
        email_received_at: email.received_at,
        due_at: new Date(new Date(email.received_at).getTime() + graceMinutes * 60_000).toISOString(),
        expected_data: expected,
      },
    });
    queued++;
  }

  const due = await supabaseAdmin<AuditRow[]>(
    `nkh_reservation_audit_events?select=id,email_inbox_id,property_id,event_type,booking_reference,expected_data,due_at&audit_status=in.(Waiting,Needs%20Staff%20Action,Unable%20to%20Match)&due_at=lte.${encodeURIComponent(new Date().toISOString())}&order=due_at.asc&limit=200`,
  );
  let verified = 0, attention = 0, unable = 0;

  for (const audit of due) {
    if (!audit.property_id) {
      await supabaseAdmin(`nkh_reservation_audit_events?id=eq.${audit.id}`, { method: "PATCH", prefer: "return=minimal", body: {
        audit_status: "Unable to Match", severity: "High", findings: ["The property could not be identified from the OTA email."], last_checked_at: new Date().toISOString(),
      }});
      unable++;
      continue;
    }
    const identity = audit.expected_data || {};
    if (audit.event_type === "Cancelled Booking" && !audit.booking_reference && !identity.guestName && !identity.checkIn && !identity.checkOut) {
      await supabaseAdmin(`nkh_reservation_audit_events?id=eq.${audit.id}`, { method: "PATCH", prefer: "return=minimal", body: {
        audit_status: "Unable to Match", severity: "High", findings: ["The cancellation email does not contain enough reservation details for a safe calendar match."], last_checked_at: new Date().toISOString(),
      }});
      unable++;
      continue;
    }
    const expected = identity;
    const from = expected.checkIn ? `&check_in=lte.${encodeURIComponent(date(expected.checkIn))}` : "";
    const to = expected.checkOut ? `&check_out=gte.${encodeURIComponent(date(expected.checkOut))}` : "";
    const bookings = await supabaseAdmin<Booking[]>(
      `nkh_calendar_bookings?select=id,booking_group_key,booking_reference,guest_name,room_name,room_type,booking_status,check_in,check_out&property_id=eq.${encodeURIComponent(audit.property_id)}${from}${to}&order=check_in.asc`,
    );
    const groups = groupBookings(bookings);
    let best: Booking[] | null = null, confidence = -1;
    for (const group of groups) {
      const score = candidateScore(audit, group);
      if (score > confidence) { confidence = score; best = group; }
    }
    if (confidence < 50) best = null;
    const result = evaluate(audit, best, Math.max(0, confidence));
    await supabaseAdmin(`nkh_reservation_audit_events?id=eq.${audit.id}`, { method: "PATCH", prefer: "return=minimal", body: {
      audit_status: result.status,
      severity: result.severity,
      match_confidence: Math.max(0, confidence),
      matched_booking_ids: best?.map(row => row.id) || [],
      findings: result.findings,
      last_checked_at: new Date().toISOString(),
      verified_at: result.status === "Verified" ? new Date().toISOString() : null,
    }});
    if (result.status === "Verified") verified++; else attention++;
  }
  return { emailsScanned: emails.length, reservationEmailsFound: queued, queued, checked: due.length, verified, attention, unable };
}
