import { NextRequest, NextResponse } from "next/server";
import { readServerSession } from "../../lib/serverSession";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

type StaffRow = {
  id: string;
  display_name: string;
};

type RosterEntry = {
  id: string;
  staff_id: string;
  shift_date: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
  shift_label: string | null;
  staff?: StaffRow | null;
};

const TIME_ZONE = "Asia/Colombo";

function colomboParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(part => part.type === type)?.value || "";
  const date = `${value("year")}-${value("month")}-${value("day")}`;
  const minutes = Number(value("hour")) * 60 + Number(value("minute"));
  return { date, minutes };
}

function timeMinutes(value?: string | null) {
  if (!value) return -1;
  const [hour, minute] = value.slice(0, 5).split(":").map(Number);
  return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : -1;
}

function activeNow(entry: RosterEntry, date: string, minutes: number) {
  if (
    entry.status !== "Scheduled" ||
    entry.shift_date !== date ||
    !entry.start_time ||
    !entry.end_time
  ) return false;
  const start = timeMinutes(entry.start_time);
  const end = timeMinutes(entry.end_time);
  if (start < 0 || end < 0) return false;
  return end >= start
    ? minutes >= start && minutes < end
    : minutes >= start || minutes < end;
}

function displayTime(value?: string | null) {
  if (!value) return "";
  return new Date(`2000-01-01T${value}`).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function timestamp(date: string, time?: string | null, nextDay = false) {
  if (!time) return "";
  let targetDate = date;
  if (nextDay) {
    const cursor = new Date(`${date}T12:00:00Z`);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    targetDate = cursor.toISOString().slice(0, 10);
  }
  return `${targetDate}T${time.slice(0, 8)}+05:30`;
}

function shiftLabel(entry?: RosterEntry | null) {
  if (!entry) return "";
  if (entry.status !== "Scheduled") return entry.status;
  return entry.shift_label ||
    `${displayTime(entry.start_time)} – ${displayTime(entry.end_time)}`;
}

export async function GET(request: NextRequest) {
  try {
    const session = readServerSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Please sign in again." },
        { status: 401 },
      );
    }

    const requestedStaff = String(
      request.nextUrl.searchParams.get("staff") || session.name,
    ).trim();
    const { date, minutes } = colomboParts();

    const staffRows = await supabaseAdmin<StaffRow[]>(
      `nkh_staff?select=id,display_name&or=(display_name.eq.${encodeURIComponent(requestedStaff)},google_staff_name.eq.${encodeURIComponent(requestedStaff)})&employment_status=eq.Active&limit=1`,
    );
    const staff = staffRows[0];
    if (!staff) {
      return NextResponse.json({
        success: true,
        shift: {
          staff: requestedStaff,
          status: "Not scheduled",
          active: false,
          canWork: false,
          shift: "",
          scheduledStart: "",
          scheduledEnd: "",
          nextShift: "",
          activeStaffName: "",
        },
      });
    }

    const [todayEntries, upcoming] = await Promise.all([
      supabaseAdmin<RosterEntry[]>(
        `nkh_roster_entries?select=id,staff_id,shift_date,start_time,end_time,status,shift_label,staff:nkh_staff(id,display_name)&shift_date=eq.${date}&status=neq.Cancelled&order=start_time.asc.nullslast`,
      ),
      supabaseAdmin<RosterEntry[]>(
        `nkh_roster_entries?select=id,staff_id,shift_date,start_time,end_time,status,shift_label&staff_id=eq.${staff.id}&shift_date=gte.${date}&status=eq.Scheduled&order=shift_date.asc,start_time.asc&limit=31`,
      ),
    ]);

    const activeEntries = todayEntries.filter(entry =>
      activeNow(entry, date, minutes)
    );
    const mine = activeEntries.find(entry => entry.staff_id === staff.id) || null;
    const todayMine = todayEntries.filter(entry => entry.staff_id === staff.id);
    const next = upcoming.find(entry => {
      if (entry.shift_date > date) return true;
      return timeMinutes(entry.start_time) > minutes;
    }) || null;
    const currentOrToday = mine || todayMine.find(entry => entry.status !== "Cancelled") || null;
    const overnight = Boolean(
      mine &&
      timeMinutes(mine.end_time) < timeMinutes(mine.start_time),
    );

    return NextResponse.json({
      success: true,
      source: "Supabase roster",
      shift: {
        staff: staff.display_name,
        status: mine ? "Active" : currentOrToday?.status || "Not scheduled",
        active: Boolean(mine),
        canWork: Boolean(mine),
        shift: shiftLabel(mine || currentOrToday),
        scheduledStart: mine
          ? timestamp(mine.shift_date, mine.start_time)
          : "",
        scheduledEnd: mine
          ? timestamp(mine.shift_date, mine.end_time, overnight)
          : "",
        nextShift: next
          ? `${new Date(`${next.shift_date}T12:00:00`).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })} · ${shiftLabel(next)}`
          : "",
        activeStaffName: activeEntries
          .map(entry => entry.staff?.display_name)
          .filter(Boolean)
          .join(", "),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error
          ? error.message
          : "Failed to load shift.",
      },
      { status: 500 },
    );
  }
}
