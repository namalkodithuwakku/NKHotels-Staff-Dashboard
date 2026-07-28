import { maskPhone, sendDialogSms } from "./dialogSms";
import { supabaseAdmin } from "./supabaseAdmin";

type Settings = { staff_alerts_enabled: boolean; master_alerts_enabled: boolean; whatsapp_wait_minutes: number; task_wait_minutes: number; cooldown_minutes: number; offline_after_minutes: number };
type Staff = { id: string; display_name: string; phone: string | null; whatsapp_number: string | null; access_level: string };
type Shift = { staff_id: string; start_time: string | null; end_time: string | null; status: string };

function colomboParts() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const value = (type: string) => parts.find(part => part.type === type)?.value || "";
  return { date: `${value("year")}-${value("month")}-${value("day")}`, minutes: Number(value("hour")) * 60 + Number(value("minute")) };
}
function clock(value: string | null) {
  if (!value) return -1;
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}
function activeShift(shift: Shift, minute: number) {
  if (shift.status !== "Scheduled") return false;
  const start = clock(shift.start_time), end = clock(shift.end_time);
  if (start < 0 || end < 0) return false;
  return end >= start ? minute >= start && minute <= end : minute >= start || minute <= end;
}
async function deliver(type: string, staff: Staff, message: string, snapshot: Record<string, number>, cooldown: number, fixedDedupeKey?: string) {
  const phone = staff.phone || staff.whatsapp_number;
  if (!phone) return { status: "skipped", name: staff.display_name, reason: "Phone missing" };
  const bucket = Math.floor(Date.now() / (cooldown * 60000));
  const key = fixedDedupeKey || `${type}:${staff.id}:${bucket}`;
  let row: Array<{ id: string }>;
  try {
    row = await supabaseAdmin<Array<{ id: string }>>("nkh_operational_alerts", { method: "POST", prefer: "return=representation", body: { alert_type: type, recipient_staff_id: staff.id, recipient_name: staff.display_name, phone_masked: maskPhone(phone), message, snapshot, dedupe_key: key } });
  } catch (error) {
    if (String(error).includes("duplicate key")) return { status: "skipped", name: staff.display_name, reason: "Cooldown active" };
    throw error;
  }
  try {
    const provider = await sendDialogSms(phone, message);
    await supabaseAdmin(`nkh_operational_alerts?id=eq.${row[0].id}`, { method: "PATCH", prefer: "return=minimal", body: { delivery_status: "Sent", provider_response: provider, sent_at: new Date().toISOString() } });
    return { status: "sent", name: staff.display_name };
  } catch (error) {
    await supabaseAdmin(`nkh_operational_alerts?id=eq.${row[0].id}`, { method: "PATCH", prefer: "return=minimal", body: { delivery_status: "Failed", error_message: String(error) } });
    return { status: "failed", name: staff.display_name, reason: String(error) };
  }
}

export async function runOperationalAlerts() {
  const settings = (await supabaseAdmin<Settings[]>("nkh_alert_settings?id=eq.primary&select=*"))[0];
  if (!settings) throw new Error("Operational alert settings are missing.");
  const { date, minutes } = colomboParts();
  const taskCutoff = new Date(Date.now() - settings.task_wait_minutes * 60000).toISOString();
  const waCutoff = new Date(Date.now() - settings.whatsapp_wait_minutes * 60000).toISOString();
  const [staff, shifts, pendingTasks, longTasks, whatsapp] = await Promise.all([
    supabaseAdmin<Staff[]>("nkh_staff?select=id,display_name,phone,whatsapp_number,access_level&employment_status=eq.Active"),
    supabaseAdmin<Shift[]>(`nkh_roster_entries?select=staff_id,start_time,end_time,status&shift_date=eq.${date}&status=eq.Scheduled`),
    supabaseAdmin<Array<{ id: string }>>("nkh_tasks?select=id&status=in.(Pending,Open)"),
    supabaseAdmin<Array<{ id: string }>>(`nkh_tasks?select=id&status=in.(Pending,Open)&created_at=lt.${encodeURIComponent(taskCutoff)}`),
    supabaseAdmin<Array<{ id: string; unread_count: number }>>(`wa_conversations?select=id,unread_count&unread_count=gt.0&last_message_at=lt.${encodeURIComponent(waCutoff)}`),
  ]);
  const snapshot = { pendingTasks: pendingTasks.length, longTasks: longTasks.length, waitingWhatsapp: whatsapp.reduce((sum, item) => sum + Number(item.unread_count || 0), 0) };
  const results: unknown[] = [];
  const onShiftIds = new Set(shifts.filter(shift => activeShift(shift, minutes)).map(shift => shift.staff_id));
  const workAlertRequired = snapshot.longTasks > 0;
  if (settings.staff_alerts_enabled && workAlertRequired) {
    for (const member of staff.filter(item => onShiftIds.has(item.id) && item.access_level !== "Master")) {
      const message = `NKH Action Required | ${snapshot.longTasks} task${snapshot.longTasks === 1 ? "" : "s"} waiting over ${settings.task_wait_minutes} min. Please attend now.`;
      results.push(await deliver("StaffSummary", member, message, snapshot, settings.cooldown_minutes));
    }
  }
  if (settings.master_alerts_enabled && workAlertRequired) {
    const onShiftNames = staff.filter(item => onShiftIds.has(item.id) && item.access_level !== "Master").map(item => item.display_name).join(", ") || "No staff";
    const message = `NKH Master Overview | ${snapshot.longTasks} delayed tasks | On shift: ${onShiftNames}. Hourly operational alert.`;
    const masterRecipients = staff.filter(item => item.access_level === "Master" || item.display_name.trim().toLowerCase() === "namal");
    for (const member of masterRecipients) {
      results.push(await deliver("MasterSummary", member, message, snapshot, settings.cooldown_minutes));
    }
  }

  const shiftStartWindow = shifts.filter(shift => {
    if (shift.status !== "Scheduled") return false;
    const start = clock(shift.start_time);
    if (start < 0) return false;
    const elapsed = (minutes - start + 1440) % 1440;
    return elapsed >= 0 && elapsed <= 10;
  });
  const masterRecipients = staff.filter(item => item.access_level === "Master" || item.display_name.trim().toLowerCase() === "namal");
  for (const shift of shiftStartWindow) {
    const member = staff.find(item => item.id === shift.staff_id);
    if (!member) continue;
    const startLabel = String(shift.start_time || "").slice(0, 5);
    if (settings.staff_alerts_enabled && member.access_level !== "Master") {
      results.push(await deliver("ShiftStart", member, `NKH Shift Start | Your ${startLabel} shift is now active. Please open NKH Dashboard and review pending work.`, snapshot, settings.cooldown_minutes, `ShiftStart:${date}:${member.id}:${startLabel}`));
    }
    if (settings.master_alerts_enabled) {
      for (const master of masterRecipients) {
        results.push(await deliver("MasterShiftStart", master, `NKH Shift Update | ${member.display_name}'s ${startLabel} shift has started.`, snapshot, settings.cooldown_minutes, `MasterShiftStart:${date}:${member.id}:${startLabel}:${master.id}`));
      }
    }
  }
  return { success: true, snapshot, onShift: [...onShiftIds], results };
}
