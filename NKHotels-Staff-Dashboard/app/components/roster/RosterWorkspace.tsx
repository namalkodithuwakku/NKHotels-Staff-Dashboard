"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Staff = { id: string; display_name: string; color_hex: string };
type Property = { id: string; property_name: string; client_code: string };
type Entry = { id: string; staff_id: string; property_id: string | null; shift_date: string; start_time: string | null; end_time: string | null; status: string; shift_label: string | null; notes: string | null };

const key = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const startOfWeek = (date: Date) => { const copy = new Date(date); const day = copy.getDay(); copy.setDate(copy.getDate() - (day === 0 ? 6 : day - 1)); copy.setHours(12, 0, 0, 0); return copy; };
const timeLabel = (value: string | null) => value ? new Date(`2000-01-01T${value}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> { const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Request failed."); return data as T; }

export default function RosterWorkspace() {
  const [week, setWeek] = useState(startOfWeek(new Date(2026, 6, 18)));
  const [staff, setStaff] = useState<Staff[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [editor, setEditor] = useState<Entry | null | "new">(null);
  const [defaultDate, setDefaultDate] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => { const date = new Date(week); date.setDate(week.getDate() + index); return date; }), [week]);
  const from = key(days[0]), to = key(days[6]);

  const load = useCallback(async () => { try { setError(""); const data = await requestJson<{ staff: Staff[]; properties: Property[]; entries: Entry[] }>(`/api/roster?from=${from}&to=${to}`); setStaff(data.staff); setProperties(data.properties); setEntries(data.entries); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load roster."); } }, [from, to]);
  useEffect(() => { void load(); }, [load]);

  function openNew(date = from) { setDefaultDate(date); setEditor("new"); }
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); const values = Object.fromEntries(new FormData(event.currentTarget)); try { await requestJson("/api/roster", { method: editor === "new" ? "POST" : "PATCH", body: JSON.stringify(editor === "new" ? values : { ...values, id: editor?.id }) }); setEditor(null); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save shift."); } finally { setBusy(false); } }
  async function remove() { if (!editor || editor === "new" || !window.confirm("Delete this roster entry?")) return; setBusy(true); try { await requestJson(`/api/roster?id=${editor.id}`, { method: "DELETE" }); setEditor(null); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to delete shift."); } finally { setBusy(false); } }

  const scheduled = entries.filter(item => item.status === "Scheduled").length;
  const staffFor = (id: string) => staff.find(item => item.id === id);
  const propertyFor = (id: string | null) => properties.find(item => item.id === id);
  const editing = editor && editor !== "new" ? editor : null;
  return <div className="roster-workspace">
    <div className="roster-toolbar"><div><small>TEAM COVERAGE</small><h2>Weekly roster</h2><p>{days[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {days[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p></div><div className="roster-toolbar-actions"><button onClick={() => { const next = new Date(week); next.setDate(next.getDate() - 7); setWeek(next); }}>‹ Previous</button><button onClick={() => setWeek(startOfWeek(new Date(2026, 6, 18)))}>July roster</button><button onClick={() => { const next = new Date(week); next.setDate(next.getDate() + 7); setWeek(next); }}>Next ›</button><button className="primary-action" onClick={() => openNew()}>＋ Add Shift</button></div></div>
    {error && <p className="workspace-error">{error}</p>}
    <div className="roster-summary"><article><small>SCHEDULED SHIFTS</small><strong>{scheduled}</strong></article><article><small>TEAM MEMBERS</small><strong>{staff.length}</strong></article><article><small>DAYS COVERED</small><strong>{new Set(entries.filter(item => item.status === "Scheduled").map(item => item.shift_date)).size}/7</strong></article></div>
    <div className="roster-grid">{days.map(date => { const dateKey = key(date), items = entries.filter(item => item.shift_date === dateKey); return <section className="roster-day" key={dateKey}><header><div><small>{date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}</small><strong>{date.getDate()}</strong></div><button onClick={() => openNew(dateKey)}>＋</button></header><div className="roster-day-entries">{items.length ? items.map(item => { const person = staffFor(item.staff_id), property = propertyFor(item.property_id); return <button className={`roster-entry ${item.status.toLowerCase()}`} key={item.id} style={{ borderLeftColor: person?.color_hex || "#E98A15" }} onClick={() => setEditor(item)}><strong>{person?.display_name || "Staff"}</strong>{item.status === "Scheduled" ? <><span>{timeLabel(item.start_time)} – {timeLabel(item.end_time)}</span><small>{property?.property_name || item.shift_label || "General coverage"}</small></> : <span>{item.status}</span>}</button>; }) : <div className="roster-no-cover"><span>○</span><small>No shifts</small></div>}</div></section>; })}</div>
    {editor && <div className="creator-backdrop"><form className="roster-editor" onSubmit={save}><header><div><small>ROSTER ENTRY</small><h2>{editor === "new" ? "Add shift" : "Edit shift"}</h2></div><button type="button" onClick={() => setEditor(null)}>×</button></header><div className="roster-editor-grid"><label>Person<select name="staff_id" required defaultValue={editing?.staff_id || ""}><option value="" disabled>Select staff</option>{staff.map(item => <option key={item.id} value={item.id}>{item.display_name}</option>)}</select></label><label>Date<input name="shift_date" type="date" required defaultValue={editing?.shift_date || defaultDate} /></label><label>Status<select name="status" defaultValue={editing?.status || "Scheduled"}><option>Scheduled</option><option>Off</option><option>Leave</option></select></label><label>Property<select name="property_id" defaultValue={editing?.property_id || ""}><option value="">General coverage</option>{properties.map(item => <option key={item.id} value={item.id}>{item.property_name}</option>)}</select></label><label>Start<input name="start_time" type="time" defaultValue={editing?.start_time?.slice(0,5) || "06:00"} /></label><label>End<input name="end_time" type="time" defaultValue={editing?.end_time?.slice(0,5) || "14:00"} /></label><label className="wide">Label<input name="shift_label" defaultValue={editing?.shift_label || ""} placeholder="Optional shift name" /></label><label className="wide">Notes<textarea name="notes" defaultValue={editing?.notes || ""} /></label></div><footer>{editing && <button className="danger-action" type="button" disabled={busy} onClick={remove}>Delete</button>}<span /><button type="button" onClick={() => setEditor(null)}>Cancel</button><button className="primary-action" disabled={busy}>{busy ? "Saving…" : "Save shift"}</button></footer></form></div>}
  </div>;
}
