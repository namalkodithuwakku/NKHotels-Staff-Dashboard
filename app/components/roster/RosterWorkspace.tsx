"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

type Staff = { id: string; display_name: string; color_hex: string };
type Property = { id: string; property_name: string; client_code: string };
type Entry = { id: string; staff_id: string; property_id: string | null; shift_date: string; start_time: string | null; end_time: string | null; status: string; shift_label: string | null; notes: string | null };

const key = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const startOfWeek = (date: Date) => { const copy = new Date(date); const day = copy.getDay(); copy.setDate(copy.getDate() - (day === 0 ? 6 : day - 1)); copy.setHours(12, 0, 0, 0); return copy; };
const timeLabel = (value: string | null) => value ? new Date(`2000-01-01T${value}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> { const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Request failed."); return data as T; }

export default function RosterWorkspace() {
  const [week, setWeek] = useState(() => {
    const today = new Date();
    return startOfWeek(today);
  });
  const [now, setNow] = useState(() => new Date());
  const [view, setView] = useState<"week" | "month">("week");
  const [staff, setStaff] = useState<Staff[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [editor, setEditor] = useState<Entry | null | "new">(null);
  const [defaultDate, setDefaultDate] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [editorStatus, setEditorStatus] = useState("Scheduled");
  const [applyMode, setApplyMode] = useState("single");
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const todayRowRef = useRef<HTMLElement | null>(null);
  const setTodayRow = (node: HTMLElement | null) => { todayRowRef.current = node; };
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => { const date = new Date(week); date.setDate(week.getDate() + index); return date; }), [week]);
  const monthDays = useMemo(() => {
    const count = new Date(week.getFullYear(), week.getMonth() + 1, 0).getDate();
    return Array.from({ length: count }, (_, index) => new Date(week.getFullYear(), week.getMonth(), index + 1, 12));
  }, [week]);
  const rangeDays = view === "week" ? days : monthDays;
  const from = key(rangeDays[0]), to = key(rangeDays[rangeDays.length - 1]);
  const todayKey = key(now);

  const load = useCallback(async () => { try { setError(""); const data = await requestJson<{ staff: Staff[]; properties: Property[]; entries: Entry[] }>(`/api/roster?from=${from}&to=${to}`); setStaff(data.staff); setProperties(data.properties); setEntries(data.entries); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load roster."); } }, [from, to]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      todayRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [view, from, to]);

  function openNew(date = from) {
    const weekday = new Date(`${date}T12:00:00`).getDay();
    setDefaultDate(date); setEditorStatus("Scheduled"); setApplyMode("single"); setRepeatDays([weekday]); setEditor("new");
  }
  function openEdit(entry: Entry) {
    const weekday = new Date(`${entry.shift_date}T12:00:00`).getDay();
    setEditorStatus(entry.status); setApplyMode("single"); setRepeatDays([weekday]); setEditor(entry);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const payload = {
      ...values,
      status: editorStatus,
      apply_mode: applyMode,
      repeat_weekdays: repeatDays,
      ...(editor === "new" ? {} : {
        id: editor?.id,
        original_status: editor?.status,
        original_start_time: editor?.start_time,
      }),
    };
    try {
      const result = await requestJson<{ created?: number; updated?: number; skipped?: number }>("/api/roster", { method: editor === "new" ? "POST" : "PATCH", body: JSON.stringify(payload) });
      const changed = Number(result.created || 0) + Number(result.updated || 0);
      setNotice(applyMode === "single" ? "Roster entry saved." : `${changed} monthly roster entries applied${result.skipped ? ` · ${result.skipped} duplicates skipped` : ""}.`);
      setEditor(null); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save shift."); }
    finally { setBusy(false); }
  }
  async function remove() { if (!editor || editor === "new" || !window.confirm("Delete this roster entry?")) return; setBusy(true); try { await requestJson(`/api/roster?id=${editor.id}`, { method: "DELETE" }); setEditor(null); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to delete shift."); } finally { setBusy(false); } }

  const scheduled = entries.filter(item => item.status === "Scheduled").length;
  const isActiveNow = (entry: Entry) => {
    if (entry.status !== "Scheduled" || entry.shift_date !== todayKey || !entry.start_time || !entry.end_time) return false;
    const minutes = now.getHours() * 60 + now.getMinutes();
    const [startHour, startMinute] = entry.start_time.split(":").map(Number);
    const [endHour, endMinute] = entry.end_time.split(":").map(Number);
    const start = startHour * 60 + startMinute, end = endHour * 60 + endMinute;
    return end >= start ? minutes >= start && minutes < end : minutes >= start || minutes < end;
  };
  const staffFor = (id: string) => staff.find(item => item.id === id);
  const propertyFor = (id: string | null) => properties.find(item => item.id === id);
  const editing = editor && editor !== "new" ? editor : null;
  const move = (direction: number) => {
    const next = new Date(week);
    if (view === "month") next.setMonth(next.getMonth() + direction, 1);
    else next.setDate(next.getDate() + direction * 7);
    setWeek(view === "month" ? next : startOfWeek(next));
  };
  const goToday = () => {
    const today = new Date();
    setNow(today);
    setWeek(view === "month"
      ? new Date(today.getFullYear(), today.getMonth(), 1, 12)
      : startOfWeek(today));
  };
  const periodLabel = view === "month"
    ? week.toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : `${days[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return <div className="roster-workspace">
    <div className="roster-toolbar"><div><small>TEAM COVERAGE</small><h2>{view === "week" ? "Weekly roster" : "Monthly roster"}</h2><p>{periodLabel}</p></div><div className="roster-toolbar-actions"><div className="roster-view-toggle"><button className={view === "week" ? "active" : ""} onClick={() => { setView("week"); setWeek(startOfWeek(now)); }}>Week</button><button className={view === "month" ? "active" : ""} onClick={() => { setView("month"); setWeek(new Date(now.getFullYear(), now.getMonth(), 1, 12)); }}>Vertical month</button></div><button onClick={() => move(-1)}>‹ Previous</button><button className="roster-today-button" onClick={goToday}>● Today</button><button onClick={() => move(1)}>Next ›</button><button className="primary-action" onClick={() => openNew(todayKey)}>＋ Add Shift</button></div></div>
    {error && <p className="workspace-error">{error}</p>}
    {notice && <div className="roster-notice">✓ {notice}</div>}
    <div className="roster-summary"><article><small>SCHEDULED SHIFTS</small><strong>{scheduled}</strong></article><article><small>TEAM MEMBERS</small><strong>{staff.length}</strong></article><article><small>DAYS COVERED</small><strong>{new Set(entries.filter(item => item.status === "Scheduled").map(item => item.shift_date)).size}/{rangeDays.length}</strong></article></div>
    {view === "week" ? <div className="roster-grid">{days.map(date => { const dateKey = key(date), items = entries.filter(item => item.shift_date === dateKey); return <section ref={dateKey === todayKey ? setTodayRow : undefined} className={`roster-day ${dateKey === todayKey ? "today" : ""}`} key={dateKey}><header><div><small>{dateKey === todayKey ? "TODAY" : date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}</small><strong>{date.getDate()}</strong></div><button onClick={() => openNew(dateKey)}>＋</button></header><div className="roster-day-entries">{items.length ? items.map(item => { const person = staffFor(item.staff_id), property = propertyFor(item.property_id); return <button className={`roster-entry ${item.status.toLowerCase()} ${isActiveNow(item) ? "active-now" : ""}`} key={item.id} style={{ borderLeftColor: person?.color_hex || "#E98A15" }} onClick={() => openEdit(item)}><strong>{person?.display_name || "Staff"}{isActiveNow(item) && <em>NOW</em>}</strong>{item.status === "Scheduled" ? <><span>{timeLabel(item.start_time)} – {timeLabel(item.end_time)}</span><small>{property?.property_name || item.shift_label || "General coverage"}</small></> : <span>{item.status}</span>}</button>; }) : <div className="roster-no-cover"><span>○</span><small>No shifts</small></div>}</div></section>; })}</div> :
      <div className="roster-vertical" style={{ "--roster-staff-count": staff.length } as CSSProperties}><div className="roster-vertical-head"><span>Date</span>{staff.map(person => <strong key={person.id}>{person.display_name}</strong>)}</div>{monthDays.map(date => { const dateKey = key(date); return <div ref={dateKey === todayKey ? setTodayRow : undefined} className={`roster-vertical-row ${dateKey === todayKey ? "today" : ""}`} key={dateKey}><button className="roster-vertical-date" onClick={() => openNew(dateKey)}><b>{date.getDate()}</b><span>{dateKey === todayKey ? "Today" : weekdays[date.getDay()]}</span></button>{staff.map(person => { const items = entries.filter(item => item.shift_date === dateKey && item.staff_id === person.id); return <div className="roster-vertical-cell" key={person.id}>{items.length ? items.map(item => <button key={item.id} className={`${item.status.toLowerCase()} ${isActiveNow(item) ? "active-now" : ""}`} onClick={() => openEdit(item)}>{item.status === "Scheduled" ? <><strong>{timeLabel(item.start_time)}–{timeLabel(item.end_time)}{isActiveNow(item) && <em>NOW</em>}</strong><small>{propertyFor(item.property_id)?.property_name || item.shift_label || "Coverage"}</small></> : <strong>{item.status}</strong>}</button>) : <button className="empty" onClick={() => openNew(dateKey)}>＋</button>}</div>; })}</div>; })}</div>}
    {editor && <div className="creator-backdrop"><form className="roster-editor" onSubmit={save}><header><div><small>ROSTER ENTRY</small><h2>{editor === "new" ? "Add shift" : "Edit shift"}</h2></div><button type="button" onClick={() => setEditor(null)}>×</button></header><div className="roster-editor-grid"><label>Person<select name="staff_id" required defaultValue={editing?.staff_id || ""}><option value="" disabled>Select staff</option>{staff.map(item => <option key={item.id} value={item.id}>{item.display_name}</option>)}</select></label><label>Date<input name="shift_date" type="date" required defaultValue={editing?.shift_date || defaultDate} /></label><label>Status<select value={editorStatus} onChange={event => setEditorStatus(event.target.value)}><option>Scheduled</option><option>Off</option><option>Leave</option></select></label>{editorStatus === "Scheduled" && <><label>Property<select name="property_id" defaultValue={editing?.property_id || ""}><option value="">General coverage</option>{properties.map(item => <option key={item.id} value={item.id}>{item.property_name}</option>)}</select></label><label>Start<input name="start_time" type="time" defaultValue={editing?.start_time?.slice(0,5) || "06:00"} required /></label><label>End<input name="end_time" type="time" defaultValue={editing?.end_time?.slice(0,5) || "14:00"} required /></label></>}<label className="wide">Label<input name="shift_label" defaultValue={editing?.shift_label || ""} placeholder={editorStatus === "Off" ? "Weekly off" : editorStatus === "Leave" ? "Annual / medical leave" : "Optional shift name"} /></label><label className="wide">Notes<textarea name="notes" defaultValue={editing?.notes || ""} /></label><div className="roster-repeat wide"><label>Apply to<select value={applyMode} onChange={event => setApplyMode(event.target.value)}><option value="single">This date only</option><option value="remaining_month">Selected weekdays from this date to month end</option><option value="full_month">Selected weekdays for the full month</option></select></label>{applyMode !== "single" && <><div className="roster-repeat-presets"><span>Repeat on</span><button type="button" onClick={() => setRepeatDays([1,2,3,4,5])}>Weekdays</button><button type="button" onClick={() => setRepeatDays([0,1,2,3,4,5,6])}>Every day</button><button type="button" onClick={() => setRepeatDays([])}>Clear</button></div><div className="roster-weekdays">{weekdays.map((day, index) => <button type="button" className={repeatDays.includes(index) ? "active" : ""} onClick={() => setRepeatDays(current => current.includes(index) ? current.filter(value => value !== index) : [...current, index])} key={day}>{day}</button>)}</div><p>{editorStatus === "Off" ? "This will set the selected weekdays as Off without shift times." : "Existing matching shift patterns will be updated; unrelated second shifts remain unchanged."}</p></>}</div></div><footer>{editing && <button className="danger-action" type="button" disabled={busy} onClick={remove}>Delete</button>}<span /><button type="button" onClick={() => setEditor(null)}>Cancel</button><button className="primary-action" disabled={busy || (applyMode !== "single" && repeatDays.length === 0)}>{busy ? "Saving…" : applyMode === "single" ? "Save shift" : "Apply to month"}</button></footer></form></div>}
  </div>;
}
