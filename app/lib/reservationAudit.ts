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
  let value = 0;
  if (key(ota.reference) && key(ota.reference) === key(first.booking_reference)) value += 70;
  if (date(ota.checkIn) === date(first.check_in)) value += 10;
  if (date(ota.checkOut) === date(first.check_out)) value += 10;
  if (key(ota.guestName) === key(first.guest_name)) value += 8;
  else if (key(first.guest_name).includes(key(ota.guestName)) || key(ota.guestName).includes(key(first.guest_name))) value += 5;
  if (Math.max(1, ota.roomCount) === rows.length) value += 2;
  return value;
}

function compare(ota: OtaReservation, rows: CalendarBooking[]) {
  const first = rows[0];
  const differences: string[] = [];
  if (date(ota.checkIn) !== date(first.check_in)) differences.push(`Check-in: OTA ${ota.checkIn}; Dashboard ${first.check_in}`);
  if (date(ota.checkOut) !== date(first.check_out)) differences.push(`Check-out: OTA ${ota.checkOut}; Dashboard ${first.check_out}`);
  if (Math.max(1, ota.roomCount) !== rows.length) differences.push(`Rooms: OTA ${Math.max(1, ota.roomCount)}; Dashboard ${rows.length}`);
  if (key(ota.guestName) !== key(first.guest_name)) differences.push(`Guest: OTA ${ota.guestName}; Dashboard ${first.guest_name}`);
  if (key(ota.status) && key(ota.status) !== key(first.booking_status)) differences.push(`Status: OTA ${ota.status}; Dashboard ${first.booking_status}`);
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
      findings.push({ type: "missing_dashboard", severity: "critical", ota, dashboard: null, differences: ["Reservation exists in the OTA list but not in the Dashboard calendar."], matchScore: Math.max(0, bestScore) });
      return;
    }
    used.add(bestIndex);
    const dashboard = groups[bestIndex];
    const differences = compare(ota, dashboard);
    findings.push({
      type: differences.length ? "difference" : "matched",
      severity: differences.length ? "warning" : "ok",
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
