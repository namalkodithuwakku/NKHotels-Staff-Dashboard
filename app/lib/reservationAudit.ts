export type OtaReservation = {
  reference: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  roomCount: number;
  roomTypes: string[];
  status: string;
  totalAmount: number | null;
  currency: string;
};

export type CalendarBooking = {
  id: string;
  booking_group_key?: string | null;
  booking_reference?: string | null;
  guest_name: string;
  room_name: string;
  room_type?: string | null;
  booking_source: string;
  booking_status: string;
  check_in: string;
  check_out: string;
};

export type AuditFinding = {
  type: "matched" | "missing_dashboard" | "missing_ota" | "difference";
  severity: "ok" | "warning" | "critical";
  ota: OtaReservation | null;
  dashboard: CalendarBooking[] | null;
  differences: string[];
  matchScore: number;
};

const clean = (value: unknown) => String(value || "").trim();
const key = (value: unknown) => clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
const date = (value: unknown) => clean(value).slice(0, 10);
const sourceKey = (value: unknown) => key(value).replace("com", "");
const NAME_TITLES = new Set(["mr", "mrs", "ms", "miss", "dr", "rev", "prof", "sir", "madam", "mstr"]);
const CANCELLATION_WORDS = ["cancel", "cancelled", "canceled", "void", "voided", "no show", "noshow", "rejected"];
const ACTIVE_WORDS = ["confirmed", "active", "booked", "reserved", "modified", "amended", "ok", "valid"];

function statusFamily(value: unknown) {
  const text = clean(value).toLowerCase().replace(/[_-]+/g, " ");
  if (CANCELLATION_WORDS.some(word => text.includes(word))) return "cancelled";
  if (text.includes("pending") || text.includes("request")) return "pending";
  if (ACTIVE_WORDS.some(word => text.includes(word))) return "active";
  return "unknown";
}

function nameTokens(value: unknown) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(token => token && !NAME_TITLES.has(token));
}

function nameMatch(left: unknown, right: unknown) {
  const a = nameTokens(left), b = nameTokens(right);
  if (!a.length || !b.length) return { equivalent: false, score: 0 };
  if (a.join("") === b.join("")) return { equivalent: true, score: 10 };

  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  let matched = 0;
  for (const token of shorter) {
    const found = longer.some(candidate => {
      if (token === candidate) return true;
      if (token.length >= 3 && candidate.startsWith(token)) return true;
      if (candidate.length >= 3 && token.startsWith(candidate)) return true;
      return token.length === 1 && candidate.startsWith(token);
    });
    if (found) matched++;
  }

  const coverage = matched / shorter.length;
  const hasReliableToken = shorter.some(token =>
    token.length >= 3 && longer.some(candidate => candidate === token || candidate.startsWith(token) || token.startsWith(candidate))
  );
  const equivalent = hasReliableToken && (
    coverage === 1 ||
    (shorter.length >= 2 && coverage >= 0.67)
  );
  return { equivalent, score: equivalent ? Math.max(5, Math.round(coverage * 10)) : 0 };
}

function groupBookings(rows: CalendarBooking[]) {
  const groups = new Map<string, CalendarBooking[]>();
  rows.forEach(row => {
    const groupKey = clean(row.booking_group_key)
      || [key(row.booking_reference), key(row.guest_name), date(row.check_in), date(row.check_out)].join("|");
    groups.set(groupKey, [...(groups.get(groupKey) || []), row]);
  });
  return [...groups.values()];
}

function score(ota: OtaReservation, rows: CalendarBooking[]) {
  const first = rows[0];
  const referenceMatch = Boolean(key(ota.reference)) && key(ota.reference) === key(first.booking_reference);
  const guestMatch = nameMatch(ota.guestName, first.guest_name);
  const arrivalMatch = date(ota.checkIn) === date(first.check_in);
  const departureMatch = date(ota.checkOut) === date(first.check_out);
  /*
   * Dates alone are never enough: unrelated guests regularly share the same
   * arrival/departure dates. Require an exact OTA reference, or a meaningful
   * guest-name match supported by at least one stay date.
   */
  if (!referenceMatch && !(guestMatch.equivalent && (arrivalMatch || departureMatch))) return -1;
  let value = 0;
  if (referenceMatch) value += 70;
  if (arrivalMatch) value += 10;
  if (departureMatch) value += 10;
  value += guestMatch.score;
  if (Math.max(1, ota.roomCount) === rows.length) value += 2;
  return value;
}

function compare(ota: OtaReservation, rows: CalendarBooking[]) {
  const first = rows[0];
  const differences: string[] = [];
  if (date(ota.checkIn) !== date(first.check_in)) differences.push(`Check-in: OTA ${ota.checkIn}; Dashboard ${first.check_in}`);
  if (date(ota.checkOut) !== date(first.check_out)) differences.push(`Check-out: OTA ${ota.checkOut}; Dashboard ${first.check_out}`);
  if (Math.max(1, ota.roomCount) !== rows.length) differences.push(`Rooms: OTA ${Math.max(1, ota.roomCount)}; Dashboard ${rows.length}`);
  if (!nameMatch(ota.guestName, first.guest_name).equivalent) differences.push(`Guest: OTA ${ota.guestName}; Dashboard ${first.guest_name}`);
  const otaStatus = statusFamily(ota.status), dashboardStatus = statusFamily(first.booking_status);
  const statusCanBeCompared = otaStatus !== "unknown" && dashboardStatus !== "unknown";
  const cancellationMustBeChecked = otaStatus === "cancelled" || dashboardStatus === "cancelled";
  if ((statusCanBeCompared || cancellationMustBeChecked) && otaStatus !== dashboardStatus) {
    if (otaStatus === "cancelled" && dashboardStatus !== "cancelled") {
      differences.push(`CANCELLATION NOT APPLIED: OTA is ${ota.status}; Dashboard is ${first.booking_status}`);
    } else if (otaStatus !== "cancelled" && dashboardStatus === "cancelled") {
      differences.push(`STATUS CONFLICT: OTA is ${ota.status}; Dashboard is ${first.booking_status}`);
    } else {
      differences.push(`Status: OTA ${ota.status}; Dashboard ${first.booking_status}`);
    }
  }
  const otaTypes = ota.roomTypes.map(key).filter(Boolean);
  const dashboardTypes = rows.map(row => key(row.room_type)).filter(Boolean);
  if (otaTypes.length && !otaTypes.every(type => dashboardTypes.some(candidate => candidate.includes(type) || type.includes(candidate)))) {
    differences.push(`Room type: OTA ${ota.roomTypes.join(", ")}; Dashboard ${rows.map(row => row.room_type || row.room_name).join(", ")}`);
  }
  return differences;
}

export function runReservationAudit(otaRows: OtaReservation[], calendarRows: CalendarBooking[], otaSource: string) {
  const source = sourceKey(otaSource);
  const relevant = calendarRows.filter(row => !source || sourceKey(row.booking_source).includes(source) || source.includes(sourceKey(row.booking_source)));
  const groups = groupBookings(relevant);
  const used = new Set<number>();
  const findings: AuditFinding[] = [];

  otaRows.forEach(ota => {
    let bestIndex = -1, bestScore = -1;
    groups.forEach((rows, index) => {
      if (used.has(index)) return;
      const candidate = score(ota, rows);
      if (candidate > bestScore) { bestScore = candidate; bestIndex = index; }
    });
    if (bestIndex < 0 || bestScore < 20) {
      const cancelled = statusFamily(ota.status) === "cancelled";
      if (cancelled) {
        findings.push({
          type: "matched",
          severity: "ok",
          ota,
          dashboard: null,
          differences: [],
          matchScore: Math.max(0, bestScore),
        });
        return;
      }
      findings.push({
        type: "missing_dashboard",
        severity: "critical",
        ota,
        dashboard: null,
        differences: ["Reservation exists in the OTA list but not in the Dashboard calendar."],
        matchScore: Math.max(0, bestScore),
      });
      return;
    }
    used.add(bestIndex);
    const dashboard = groups[bestIndex];
    const differences = compare(ota, dashboard);
    const cancellationConflict = differences.some(value => value.startsWith("CANCELLATION NOT APPLIED") || value.startsWith("STATUS CONFLICT"));
    findings.push({
      type: differences.length ? "difference" : "matched",
      severity: cancellationConflict ? "critical" : differences.length ? "warning" : "ok",
      ota, dashboard, differences, matchScore: bestScore,
    });
  });

  groups.forEach((dashboard, index) => {
    if (!used.has(index)) findings.push({
      type: "missing_ota", severity: "warning", ota: null, dashboard,
      differences: ["Reservation exists in the Dashboard calendar but not in the uploaded OTA list."], matchScore: 0,
    });
  });
  return findings;
}

export function normalizeExtractedReservation(value: Record<string, unknown>): OtaReservation {
  const roomTypes = Array.isArray(value.roomTypes) ? value.roomTypes.map(clean).filter(Boolean) : [];
  return {
    reference: clean(value.reference),
    guestName: clean(value.guestName),
    checkIn: date(value.checkIn),
    checkOut: date(value.checkOut),
    roomCount: Math.max(1, Number(value.roomCount || roomTypes.length || 1)),
    roomTypes,
    status: clean(value.status || "Confirmed"),
    totalAmount: value.totalAmount === null || value.totalAmount === undefined || value.totalAmount === "" ? null : Number(value.totalAmount),
    currency: clean(value.currency || "LKR").toUpperCase(),
  };
}
