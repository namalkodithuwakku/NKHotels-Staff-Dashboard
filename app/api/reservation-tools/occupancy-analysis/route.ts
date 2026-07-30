import { NextRequest, NextResponse } from "next/server";
import { isMasterSession, readServerSession } from "../../../lib/serverSession";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const runtime = "nodejs";

type Property = { id: string; client_code: string; property_name: string; city?: string | null; country?: string | null; currency_code?: string | null; total_rooms?: number | null };
type Room = { id: string; room_name: string; room_type: string | null; room_status?: string | null };
type Booking = {
  id: string; booking_group_key: string | null; room_name: string; room_type: string | null; booking_source: string;
  booking_status: string; check_in: string; check_out: string; total_amount: number | null; currency_code: string | null;
};

const DAY = 86_400_000;
function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value); }
function utc(value: string) { return new Date(`${value}T00:00:00Z`); }
function iso(date: Date) { return date.toISOString().slice(0, 10); }
function days(from: string, to: string) {
  const list: string[] = [];
  for (let cursor = utc(from); cursor < utc(to); cursor = new Date(cursor.getTime() + DAY)) list.push(iso(cursor));
  return list;
}
function covers(booking: Booking, date: string) { return booking.check_in <= date && booking.check_out > date; }
function round(value: number, places = 1) { const factor = 10 ** places; return Math.round(value * factor) / factor; }
function sourceName(value: string) { return value?.trim() || "Unknown"; }
function isBlocked(booking: Booking) { return booking.booking_status === "Blocked" || booking.booking_source === "Blocked"; }
function isSold(booking: Booking) { return !isBlocked(booking) && !["Cancelled","Pending"].includes(booking.booking_status); }

function ruleRecommendations(metrics: Record<string, any>) {
  const weak = metrics.weakDates?.[0], peak = metrics.peakDates?.[0], topSource = metrics.sourceMix?.[0], weakestType = [...(metrics.roomTypes || [])].sort((a, b) => a.occupancy - b.occupancy)[0];
  const recommendations = [
    ["Protect weak dates", weak ? `Create a fenced offer for ${weak.date}, currently ${weak.occupancy}% occupied.` : "Create targeted offers for the lowest-occupancy dates.", "Weak dates need focused demand rather than a blanket discount.", "High", "Today"],
    ["Review peak-date pricing", peak ? `Check whether rates can increase on ${peak.date}, currently ${peak.occupancy}% occupied.` : "Review pricing on the strongest dates.", "High occupancy can support stronger rates and restrictions.", "High", "Today"],
    ["Strengthen the weakest room type", weakestType ? `Improve pricing and merchandising for ${weakestType.roomType} at ${weakestType.occupancy}% occupancy.` : "Review room-type performance and presentation.", "Room-type gaps can hide behind the property average.", "High", "Next 7 days"],
    ["Use the strongest channel carefully", topSource ? `Protect visibility on ${topSource.source}, contributing ${topSource.share}% of sold room nights.` : "Review booking-source contribution.", "The leading source should be protected without creating excessive dependency.", "Medium", "Next 7 days"],
    ["Build direct-booking share", "Give direct enquiries a clear value-add rather than an uncontrolled public discount.", "A healthier source mix protects margin and guest relationships.", "High", "Next 30 days"],
    ["Correct weekday gaps", `Focus campaigns on ${metrics.weakestWeekday?.weekday || "the weakest weekday"} occupancy.`, "Weekday targeting is more efficient than discounting the full period.", "Medium", "Next 7 days"],
    ["Audit blocked inventory", `Review ${metrics.blockedRoomNights || 0} blocked room nights and release any unnecessary holds.`, "Unnecessary blocks reduce sellable capacity and distort occupancy.", "Medium", "Today"],
    ["Improve revenue data coverage", metrics.revenueCoverage < 80 ? `Record booking values consistently; current revenue coverage is ${metrics.revenueCoverage}%.` : "Continue maintaining complete booking values.", "Reliable ADR and RevPAR decisions require complete amounts.", "High", "Today"],
    ["Control pending reservations", `Review ${metrics.pendingReservations || 0} pending reservation groups and confirm or release them.`, "Unresolved bookings create uncertain availability and forecast risk.", "Medium", "Today"],
    ["Set a weekly occupancy rhythm", "Review the next 30, 60 and 90 days every week and record actions by need date.", "Regular forward-looking reviews prevent last-minute reactive discounting.", "High", "Next 30 days"],
  ];
  return recommendations.map((item, index) => ({ rank: index + 1, title: item[0], action: item[1], reason: item[2], impact: item[3], timeframe: item[4] }));
}

export async function GET(request: NextRequest) {
  try {
    if (!isMasterSession(readServerSession(request))) return NextResponse.json({ error: "Master access required." }, { status: 403 });
    const properties = await supabaseAdmin<Property[]>("nkh_properties?select=id,client_code,property_name,city,country,currency_code,total_rooms&client_status=in.(Active,Onboarding)&order=property_name.asc");
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
    const propertyId = String(input.propertyId || ""), from = String(input.from || ""), to = String(input.to || "");
    if (!propertyId || !validDate(from) || !validDate(to) || from > to) return NextResponse.json({ error: "Select a property and valid analysis dates." }, { status: 400 });
    const endExclusive = iso(new Date(utc(to).getTime() + DAY));
    const periodDays = Math.round((utc(endExclusive).getTime() - utc(from).getTime()) / DAY);
    if (periodDays < 1 || periodDays > 366) return NextResponse.json({ error: "Choose a period between 1 and 366 nights." }, { status: 400 });
    const [properties, rooms, bookings] = await Promise.all([
      supabaseAdmin<Property[]>(`nkh_properties?select=id,client_code,property_name,city,country,currency_code,total_rooms&id=eq.${encodeURIComponent(propertyId)}&limit=1`),
      supabaseAdmin<Room[]>(`nkh_calendar_rooms?select=id,room_name,room_type,room_status&property_id=eq.${encodeURIComponent(propertyId)}&order=sort_order.asc`),
      supabaseAdmin<Booking[]>(`nkh_calendar_bookings?select=id,booking_group_key,room_name,room_type,booking_source,booking_status,check_in,check_out,total_amount,currency_code&property_id=eq.${encodeURIComponent(propertyId)}&check_in=lt.${encodeURIComponent(endExclusive)}&check_out=gt.${encodeURIComponent(from)}`),
    ]);
    const property = properties[0];
    if (!property) return NextResponse.json({ error: "Property not found." }, { status: 404 });
    if (!rooms.length) return NextResponse.json({ error: "No calendar rooms are available for this property." }, { status: 400 });

    const dateList = days(from, endExclusive), inventory = rooms.length;
    const daily = dateList.map(date => {
      const dayBookings = bookings.filter(booking => covers(booking, date));
      const blockedRooms = new Set(dayBookings.filter(isBlocked).map(item => item.room_name)).size;
      const soldRooms = new Set(dayBookings.filter(isSold).map(item => item.room_name)).size;
      const available = Math.max(0, inventory - blockedRooms);
      return { date, sold: soldRooms, blocked: blockedRooms, available, occupancy: available ? round(soldRooms / available * 100) : 0 };
    });
    const availableRoomNights = daily.reduce((sum, item) => sum + item.available, 0);
    const soldRoomNights = daily.reduce((sum, item) => sum + item.sold, 0);
    const blockedRoomNights = daily.reduce((sum, item) => sum + item.blocked, 0);

    const activeBookings = bookings.filter(isSold);
    const groupMap = new Map<string, Booking[]>();
    activeBookings.forEach(booking => {
      const key = booking.booking_group_key || booking.id;
      groupMap.set(key, [...(groupMap.get(key) || []), booking]);
    });
    let recordedRevenue = 0, coveredSoldNights = 0;
    groupMap.forEach(group => {
      const first = group[0], totalNights = Math.max(1, Math.round((utc(first.check_out).getTime() - utc(first.check_in).getTime()) / DAY));
      const overlapStart = first.check_in > from ? first.check_in : from, overlapEnd = first.check_out < endExclusive ? first.check_out : endExclusive;
      const overlapNights = Math.max(0, Math.round((utc(overlapEnd).getTime() - utc(overlapStart).getTime()) / DAY));
      const allocations = new Set(group.map(item => item.room_name)).size;
      if (first.total_amount != null && Number.isFinite(Number(first.total_amount))) {
        recordedRevenue += Number(first.total_amount) * overlapNights / totalNights;
        coveredSoldNights += overlapNights * allocations;
      }
    });

    const sourceTotals = new Map<string, number>(), roomTypeTotals = new Map<string, { sold: number; available: number }>();
    dateList.forEach(date => {
      const onDate = activeBookings.filter(booking => covers(booking, date));
      onDate.forEach(booking => sourceTotals.set(sourceName(booking.booking_source), (sourceTotals.get(sourceName(booking.booking_source)) || 0) + 1));
      rooms.forEach(room => {
        const type = room.room_type || "Unassigned", entry = roomTypeTotals.get(type) || { sold: 0, available: 0 };
        const blocked = bookings.some(booking => covers(booking, date) && booking.room_name === room.room_name && isBlocked(booking));
        const sold = onDate.some(booking => booking.room_name === room.room_name);
        if (!blocked) entry.available++; if (sold) entry.sold++;
        roomTypeTotals.set(type, entry);
      });
    });
    const weekdayMap = new Map<string, { sold: number; available: number }>();
    daily.forEach(item => {
      const weekday = utc(item.date).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
      const entry = weekdayMap.get(weekday) || { sold: 0, available: 0 };
      entry.sold += item.sold; entry.available += item.available; weekdayMap.set(weekday, entry);
    });
    const occupancy = availableRoomNights ? round(soldRoomNights / availableRoomNights * 100) : 0;
    const sourceMix = [...sourceTotals].map(([source, roomNights]) => ({ source, roomNights, share: soldRoomNights ? round(roomNights / soldRoomNights * 100) : 0 })).sort((a, b) => b.roomNights - a.roomNights);
    const roomTypes = [...roomTypeTotals].map(([roomType, value]) => ({ roomType, sold: value.sold, available: value.available, occupancy: value.available ? round(value.sold / value.available * 100) : 0 })).sort((a, b) => b.occupancy - a.occupancy);
    const weekdays = [...weekdayMap].map(([weekday, value]) => ({ weekday, occupancy: value.available ? round(value.sold / value.available * 100) : 0, ...value })).sort((a, b) => b.occupancy - a.occupancy);
    const reservationGroups = new Set(bookings.filter(booking => !isBlocked(booking) && booking.booking_status !== "Cancelled").map(booking => booking.booking_group_key || booking.id)).size;
    const cancelledGroups = new Set(bookings.filter(booking => booking.booking_status === "Cancelled").map(booking => booking.booking_group_key || booking.id)).size;
    const pendingReservations = new Set(bookings.filter(booking => booking.booking_status === "Pending").map(booking => booking.booking_group_key || booking.id)).size;
    const metrics: Record<string, any> = {
      inventory, nights: periodDays, occupancy, soldRoomNights, availableRoomNights, blockedRoomNights,
      reservationGroups, cancelledGroups, pendingReservations,
      recordedRevenue: round(recordedRevenue, 2), currency: property.currency_code || bookings.find(item => item.currency_code)?.currency_code || "LKR",
      adr: soldRoomNights ? round(recordedRevenue / soldRoomNights, 2) : 0,
      revpar: availableRoomNights ? round(recordedRevenue / availableRoomNights, 2) : 0,
      revenueCoverage: soldRoomNights ? round(Math.min(100, coveredSoldNights / soldRoomNights * 100)) : 0,
      daily, sourceMix, roomTypes, weekdays,
      peakDates: [...daily].sort((a, b) => b.occupancy - a.occupancy).slice(0, 5),
      weakDates: [...daily].filter(item => item.date >= iso(new Date())).sort((a, b) => a.occupancy - b.occupancy).slice(0, 5),
      strongestWeekday: weekdays[0] || null, weakestWeekday: weekdays[weekdays.length - 1] || null,
    };
    const recommendations = ruleRecommendations(metrics);
    const saved = await supabaseAdmin<Array<{ id: string }>>("nkh_occupancy_reports", {
      method: "POST", prefer: "return=representation",
      body: { property_id: propertyId, date_from: from, date_to: to, property_snapshot: property, metrics, recommendations, generated_by: session?.name },
    });
    return NextResponse.json({ success: true, reportId: saved[0]?.id, property, from, to, metrics, recommendations });
  } catch (error) {
    console.error("Occupancy analysis failed.", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to analyze occupancy." }, { status: 500 });
  }
}
