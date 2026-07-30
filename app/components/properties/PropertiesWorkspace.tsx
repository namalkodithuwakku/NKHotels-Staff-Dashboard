"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import ContactManager from "../contacts/ContactManager";
import OtaRateProfileManager from "./OtaRateProfileManager";

type Property = { id: string; client_code: string; property_name: string; preferred_language: string; client_status: string; task_email?: string | null; calendar_sheet_code?: string | null; calendar_source_mode?: "google_sheet" | "supabase"; package_name?: string | null; notes?: string | null; legal_name?: string | null; description?: string | null; address_line_1?: string | null; address_line_2?: string | null; city?: string | null; country?: string | null; timezone?: string | null; currency_code?: string | null; check_in_time?: string | null; check_out_time?: string | null; total_rooms?: number | null; website_url?: string | null; map_url?: string | null; logo_url?: string | null };
type RoomType = { id: string; room_code: string; room_name: string; description: string | null; room_count: number; room_names: string[]; max_adults: number; max_children: number; max_occupancy: number; bed_configuration: string | null; is_active: boolean };
type RatePlan = { id: string; plan_name: string; color_hex: string; currency_code: string; minimum_stay: number };
type RateRange = { id: string; rate_plan_id: string; start_date: string; end_date: string };
type ProfileTab = "overview" | "contacts" | "rooms" | "ota" | "rates" | "policies" | "faq";

function displayLocation(value?: string | null) {
  const clean = String(value || "").trim();
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : "";
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Request failed.");
  return payload as T;
}

function RateCalendar({ property }: { property: Property }) {
  const now = new Date();
  const [month, setMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [plans, setPlans] = useState<RatePlan[]>([]);
  const [ranges, setRanges] = useState<RateRange[]>([]);
  const [planId, setPlanId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const firstDay = dateKey(new Date(month.getFullYear(), month.getMonth(), 1));
  const lastDay = dateKey(new Date(month.getFullYear(), month.getMonth() + 1, 0));

  const load = useCallback(async () => {
    try {
      setError("");
      const data = await jsonRequest<{ plans: RatePlan[]; ranges: RateRange[] }>(`/api/property-profiles/${property.id}/rates?from=${firstDay}&to=${lastDay}`);
      setPlans(data.plans); setRanges(data.ranges); setPlanId(current => current || data.plans[0]?.id || "");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load rates."); }
  }, [property.id, firstDay, lastDay]);

  useEffect(() => { void load(); }, [load]);

  const cells = useMemo(() => {
    const year = month.getFullYear(), monthIndex = month.getMonth();
    return [...Array.from({ length: new Date(year, monthIndex, 1).getDay() }, () => null), ...Array.from({ length: new Date(year, monthIndex + 1, 0).getDate() }, (_, index) => new Date(year, monthIndex, index + 1))];
  }, [month]);

  function chooseDate(date: Date) {
    const key = dateKey(date);
    if (!start || end) { setStart(key); setEnd(""); }
    else if (key < start) { setStart(key); setEnd(start); }
    else setEnd(key);
  }

  async function createDefaults() {
    setBusy(true); setError("");
    try { await jsonRequest(`/api/property-profiles/${property.id}/rates`, { method: "POST", body: JSON.stringify({ action: "createDefaults", currency_code: property.currency_code || "LKR" }) }); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to create rate plans."); }
    finally { setBusy(false); }
  }

  async function applyRange() {
    if (!planId || !start || !end) return;
    setBusy(true); setError("");
    try { await jsonRequest(`/api/property-profiles/${property.id}/rates`, { method: "POST", body: JSON.stringify({ rate_plan_id: planId, start_date: start, end_date: end }) }); setStart(""); setEnd(""); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save rate range."); }
    finally { setBusy(false); }
  }

  return <div className="rate-calendar-shell">
    {error && <p className="workspace-error">{error}</p>}
    {!plans.length ? <div className="workspace-empty"><strong>No rate plans yet</strong><p>Create the standard colour-coded plans for this property.</p><button className="primary-action" disabled={busy} onClick={createDefaults}>{busy ? "Creating…" : "Create default rate plans"}</button></div> : <>
      <div className="rate-plan-bar"><div><small>RATE PLANS</small><strong>Choose a plan, then select a date range</strong></div><div className="rate-plan-list">{plans.map(plan => <button key={plan.id} className={planId === plan.id ? "active" : ""} onClick={() => setPlanId(plan.id)}><i style={{ background: plan.color_hex }} />{plan.plan_name}<small>{plan.currency_code}</small></button>)}</div></div>
      <div className="rate-range-tools"><label>From<input type="date" value={start} onChange={event => setStart(event.target.value)} /></label><label>To<input type="date" value={end} onChange={event => setEnd(event.target.value)} /></label><button className="primary-action" onClick={applyRange} disabled={busy || !start || !end}>{busy ? "Saving…" : "Apply rate plan"}</button><button onClick={() => { setStart(""); setEnd(""); }}>Clear selection</button></div>
      <div className="calendar-heading"><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button><h3>{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h3><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button></div>
      <div className="rate-calendar weekdays">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => <b key={day}>{day}</b>)}</div>
      <div className="rate-calendar">{cells.map((date, index) => {
        if (!date) return <span className="empty-day" key={`empty-${index}`} />;
        const key = dateKey(date), range = [...ranges].reverse().find(item => key >= item.start_date && key <= item.end_date), plan = plans.find(item => item.id === range?.rate_plan_id);
        const selected = key === start || key === end || Boolean(start && end && key > start && key < end);
        return <button key={key} className={selected ? "selected" : ""} onClick={() => chooseDate(date)} title={range ? `${range.start_date} to ${range.end_date}` : "Set rate"}><strong>{date.getDate()}</strong>{plan ? <span style={{ background: plan.color_hex }}><b>{plan.plan_name}</b><small>{plan.currency_code}</small></span> : <em>Set rate</em>}</button>;
      })}</div>
      <p className="local-data-note">Saved to Supabase. If ranges overlap, the most recently created range is displayed.</p>
    </>}
  </div>;
}

function RoomTypesManager({ property }: { property: Property }) {
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [editing, setEditing] = useState<RoomType | "new" | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { setRooms(await jsonRequest<RoomType[]>(`/api/property-profiles/${property.id}/room-types`)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load room types."); }
  }, [property.id]);
  useEffect(() => { void load(); }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget));
      await jsonRequest(`/api/property-profiles/${property.id}/room-types`, {
        method: editing === "new" ? "POST" : "PATCH",
        body: JSON.stringify({ ...values, ...(editing !== "new" && editing ? { id: editing.id } : {}) }),
      });
      setEditing(null); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save room type."); }
    finally { setBusy(false); }
  }
  async function remove(room: RoomType) {
    setBusy(true); setError("");
    try {
      await jsonRequest(`/api/property-profiles/${property.id}/room-types?roomTypeId=${encodeURIComponent(room.id)}`, { method: "DELETE" });
      setEditing(null); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to delete room type."); }
    finally { setBusy(false); }
  }
  const roomTotal = rooms.filter(room => room.is_active).reduce((sum, room) => sum + Number(room.room_count || 0), 0);
  return <div className="room-type-workspace">
    <header><div><small>ROOM INVENTORY</small><h3>{roomTotal} rooms across {rooms.length} types</h3><p>These counts build the Dashboard calendar when Google Sheet is switched off.</p></div><button className="primary-action" onClick={() => setEditing("new")}>＋ Add room type</button></header>
    {error && <p className="workspace-error">{error}</p>}
    <div className="room-type-cards">{rooms.map(room => <article key={room.id}><div><small>{room.room_code}</small><h3>{room.room_name}</h3><p>{room.bed_configuration || "Bed setup not added"} · Up to {room.max_occupancy} guests</p>{room.room_names?.length > 0 && <p className="physical-room-names">{room.room_names.join(" · ")}</p>}</div><strong>{room.room_count}<small> rooms</small></strong><button onClick={() => setEditing(room)}>Edit</button></article>)}</div>
    {!rooms.length && <div className="workspace-empty room-type-empty"><strong>No room types yet</strong><p>Add every sellable room type, room count and individual room names before using the Supabase calendar.</p><button className="primary-action" onClick={() => setEditing("new")}>＋ Add first room type</button></div>}
    {editing && <div className="calendar-detail-backdrop"><form className="room-type-form" onSubmit={save}><button type="button" className="modal-close" onClick={() => setEditing(null)}>×</button><small>PROPERTY INVENTORY</small><h3>{editing === "new" ? "Add room type" : `Edit ${editing.room_name}`}</h3><div><label>Room type name<input name="room_name" defaultValue={editing === "new" ? "" : editing.room_name} placeholder="Deluxe Double" required/></label><label>Short code<input name="room_code" defaultValue={editing === "new" ? "" : editing.room_code} placeholder="DLX" required/></label><label>Number of rooms<input name="room_count" type="number" min="1" defaultValue={editing === "new" ? 1 : editing.room_count} required/></label><label>Maximum occupancy<input name="max_occupancy" type="number" min="1" defaultValue={editing === "new" ? 2 : editing.max_occupancy}/></label><label>Maximum adults<input name="max_adults" type="number" min="0" defaultValue={editing === "new" ? 2 : editing.max_adults}/></label><label>Maximum children<input name="max_children" type="number" min="0" defaultValue={editing === "new" ? 0 : editing.max_children}/></label><label className="wide room-names-field">Individual room names / numbers<textarea name="room_names" defaultValue={editing === "new" ? "" : (editing.room_names || []).join("\n")} placeholder={"101\n102\n103"}/><small>Enter one room per line. The number of names must match “Number of rooms”. Leave blank only if automatic names are acceptable.</small></label><label className="wide">Bed configuration<input name="bed_configuration" defaultValue={editing === "new" ? "" : editing.bed_configuration || ""} placeholder="1 king bed"/></label><label className="wide">Description<textarea name="description" defaultValue={editing === "new" ? "" : editing.description || ""}/></label></div><footer>{editing !== "new" && <button type="button" className="danger" disabled={busy} onClick={() => void remove(editing)}>Delete type</button>}<span/><button type="button" onClick={() => setEditing(null)}>Cancel</button><button className="primary-action" disabled={busy}>{busy ? "Saving…" : "Save room type"}</button></footer></form></div>}
  </div>;
}

export default function PropertiesWorkspace({ access }: { access: string }) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [tab, setTab] = useState<ProfileTab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [calendarModeWarning, setCalendarModeWarning] = useState<"google_sheet" | "supabase" | null>(null);
  const [calendarModeBusy, setCalendarModeBusy] = useState(false);
  const [propertySearch, setPropertySearch] = useState("");
  const property = properties.find(item => item.id === selectedId) || properties[0];
  const visibleProperties = useMemo(() => {
    const query = propertySearch.trim().toLowerCase();
    if (!query) return properties;
    return properties.filter(item =>
      [item.property_name, item.client_code, item.city, item.country]
        .some(value => String(value || "").toLowerCase().includes(query))
    );
  }, [properties, propertySearch]);
  const canManage = Boolean(access);
  const master = access.toLowerCase() === "master";
  const tabs: Array<{ id: ProfileTab; label: string }> = [{ id: "overview", label: "Overview" }, { id: "contacts", label: "Contacts" }, { id: "rooms", label: "Room Types" }, { id: "ota", label: "OTA Rates" }, { id: "rates", label: "Rates Calendar" }, { id: "policies", label: "Policies" }, { id: "faq", label: "FAQ" }];

  const load = useCallback(async () => {
    try { setError(""); const data = await jsonRequest<Property[]>("/api/property-profiles"); setProperties(data); setSelectedId(current => current || data[0]?.id || ""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load properties."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function createProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setError("");
    try { const created = await jsonRequest<Property>("/api/property-profiles", { method: "POST", body: JSON.stringify(Object.fromEntries(form)) }); setCreating(false); await load(); setSelectedId(created.id); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to create property."); }
  }

  async function saveProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!property) return; const form = new FormData(event.currentTarget); setError("");
    try { await jsonRequest(`/api/property-profiles/${property.id}`, { method: "PATCH", body: JSON.stringify(Object.fromEntries(form)) }); setEditing(false); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update property."); }
  }

  async function changeCalendarMode() {
    if (!property || !calendarModeWarning || !master) return;
    setCalendarModeBusy(true); setError("");
    try {
      await jsonRequest("/api/calendar/mode", {
        method: "POST",
        body: JSON.stringify({ propertyId: property.id, mode: calendarModeWarning }),
      });
      setCalendarModeWarning(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to change calendar mode.");
    } finally {
      setCalendarModeBusy(false);
    }
  }

  if (loading) return <div className="workspace-empty">Loading properties…</div>;
  return <div className="properties-workspace">
    <div className="property-toolbar"><div><small>PROPERTY DIRECTORY</small><h2>Client profiles</h2><p>One source for contacts, rooms, rates, policies and approved answers.</p></div>{canManage && <button className="primary-action" onClick={() => setCreating(true)}>＋ Add Property</button>}</div>
    {error && <p className="workspace-error">{error}</p>}
    {creating && <div className="inline-property-form"><form onSubmit={createProperty}><h3>Add property</h3><label>Client code<input name="client_code" required placeholder="NKH007" pattern="NKH[0-9]{3,}" /></label><label>Property name<input name="property_name" required /></label><label>City<input name="city" /></label><label>Status<select name="client_status" defaultValue="Onboarding"><option>Onboarding</option><option>Lead</option><option>Active</option></select></label><label className="wide property-task-email">Reservations / task identification email<input name="task_email" type="email" placeholder="reservations@hotel.com" /><small>Emails received for this address will automatically create tasks under this property.</small></label><label className="wide property-sheet-code">Google Calendar Sheet code or URL<input name="calendar_sheet_code" placeholder="Paste the Google Sheet URL or spreadsheet code" /><small>The profile safely stores only the spreadsheet identifier. Calendar data will be connected read-only in the next step.</small></label><footer><button type="button" onClick={() => setCreating(false)}>Cancel</button><button className="primary-action">Create property</button></footer></form></div>}
    {!property ? <div className="workspace-empty"><strong>No properties found</strong><p>Add the first property profile to begin.</p></div> : <div className="property-layout"><aside className="property-list"><input aria-label="Search properties" placeholder="Search properties" value={propertySearch} onChange={event => setPropertySearch(event.target.value)} />{visibleProperties.map(item => <button key={item.id} className={selectedId === item.id ? "active" : ""} onClick={() => { setSelectedId(item.id); setEditing(false); }}><span>{item.client_code.replace(/^NKH/i, "")}</span><div><strong>{item.property_name}</strong><small>{displayLocation(item.city || item.country) || "Location pending"} · {item.total_rooms ?? "—"} rooms</small></div><em>{item.client_status}</em></button>)}{!visibleProperties.length && <p className="property-search-empty">No matching properties</p>}</aside><section className="property-profile">
      <header><div className="property-avatar">{property.client_code}</div><div><small>{property.client_status.toUpperCase()}</small><h2>{property.property_name}</h2><p>{displayLocation(property.city || property.country) || "Location pending"} · Property code {property.client_code}</p></div>{canManage && tab === "overview" && <button onClick={() => setEditing(value => !value)}>{editing ? "Close editor" : "Edit overview"}</button>}</header>
      <nav className="profile-tabs">{tabs.map(item => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => { setTab(item.id); setEditing(false); }}>{item.label}</button>)}</nav>
      <div className="profile-content">{editing && tab === "overview" ? <form className="property-edit-grid" onSubmit={saveProperty}><label>Property name<input name="property_name" defaultValue={property.property_name} required /></label><label>Status<select name="client_status" defaultValue={property.client_status}>{["Active", "Lead", "Onboarding", "Former", "Inactive"].map(value => <option key={value}>{value}</option>)}</select></label><label className="wide property-task-email">Reservations / task identification email<input name="task_email" type="email" defaultValue={property.task_email || ""} placeholder="reservations@hotel.com" /><small>The email-to-task engine matches incoming recipient addresses to this property.</small></label><label className="wide property-sheet-code">Google Calendar Sheet code or URL<input name="calendar_sheet_code" defaultValue={property.calendar_sheet_code || ""} placeholder="Paste the complete Google Sheet URL or spreadsheet code" /><small>You may paste the complete URL. The dashboard automatically extracts and stores only its spreadsheet code.</small></label><label>Legal name<input name="legal_name" defaultValue={property.legal_name || ""} /></label><label>Package<input name="package_name" defaultValue={property.package_name || ""} /></label><label>City<input name="city" defaultValue={property.city || ""} /></label><label>Country<input name="country" defaultValue={property.country || "Sri Lanka"} /></label><label>Currency<input name="currency_code" defaultValue={property.currency_code || "LKR"} maxLength={3} /></label><label>Total rooms<input name="total_rooms" type="number" min="0" defaultValue={property.total_rooms ?? ""} /></label><label>Check-in<input name="check_in_time" type="time" defaultValue={property.check_in_time?.slice(0, 5) || ""} /></label><label>Check-out<input name="check_out_time" type="time" defaultValue={property.check_out_time?.slice(0, 5) || ""} /></label><label className="wide">Description<textarea name="description" defaultValue={property.description || ""} /></label><label className="wide">Notes<textarea name="notes" defaultValue={property.notes || ""} /></label><footer><button type="button" onClick={() => setEditing(false)}>Cancel</button><button className="primary-action">Save overview</button></footer></form> : tab === "contacts" ? <ContactManager variant="embedded" master={master} propertyId={property.id} propertyName={property.property_name} /> : tab === "rooms" ? <RoomTypesManager property={property}/> : tab === "ota" ? <OtaRateProfileManager propertyId={property.id} propertyName={property.property_name} master={master}/> : tab === "rates" ? <RateCalendar property={property} /> : tab === "overview" ? <div className="profile-card-grid"><article><small>LOCATION</small><h3>{displayLocation(property.city) || "Not added"}</h3><p>{displayLocation(property.country) || "Sri Lanka"}</p><p>{property.timezone || "Asia/Colombo"}</p></article><article><small>INVENTORY</small><h3>{property.total_rooms ?? "—"} rooms</h3><p>Room types and occupancy rules attach to this profile.</p></article><article className="property-email-card"><small>TASK IDENTIFICATION EMAIL</small><h3>{property.task_email || "Not added"}</h3><p>{property.task_email ? "Incoming emails to this address are matched to this property." : "Add the reservations email in Edit overview to identify email-created tasks."}</p></article><article className={`property-sheet-card property-calendar-control ${property.calendar_source_mode === "supabase" ? "native" : "sheet"}`}><div><small>CALENDAR SOURCE · MASTER CONTROL</small><h3>{property.calendar_source_mode === "supabase" ? "Dashboard calendar" : "Google Sheet calendar"}</h3><p>{property.calendar_source_mode === "supabase" ? "Bookings are managed directly in Supabase." : property.calendar_sheet_code ? `Read-only sync · Sheet ending ${property.calendar_sheet_code.slice(-8)}` : "Google Sheet mode is on, but no Sheet URL is saved."}</p></div>{master ? <label className="calendar-source-switch"><span>Google Sheet</span><input type="checkbox" checked={property.calendar_source_mode !== "supabase"} onChange={event => setCalendarModeWarning(event.target.checked ? "google_sheet" : "supabase")}/><i /></label> : <span className="master-only-note">Master only</span>}</article><article><small>OPERATIONS</small><h3>{property.client_status}</h3><p>{property.package_name || "Package not assigned"}</p></article><article><small>KNOWLEDGE</small><h3>Approved information</h3><p>Policies and guest-facing FAQ answers stay attached to this profile.</p></article></div> : <div className="workspace-empty"><strong>{tabs.find(item => item.id === tab)?.label}</strong><p>This database section will be connected in the next profile checkpoint.</p></div>}</div>
    </section></div>}
    {calendarModeWarning && property && master && <div className="calendar-detail-backdrop"><article className="calendar-mode-warning"><div className="calendar-warning-icon">!</div><small>MASTER CALENDAR CONTROL</small><h3>{calendarModeWarning === "supabase" ? "Turn Google Sheet off?" : "Turn Google Sheet on?"}</h3><p>{calendarModeWarning === "supabase" ? "Sharp warning: the current Google Sheet calendar copy will be replaced. Rooms will be rebuilt from Room Types, room counts and room names. Booking add, edit and delete will be enabled in the Dashboard calendar." : "Sharp warning: Dashboard booking editing will be disabled. The next Google Sheet sync will replace the Supabase calendar copy."}</p><footer><button onClick={() => setCalendarModeWarning(null)}>Keep current mode</button><button className="danger" disabled={calendarModeBusy} onClick={changeCalendarMode}>{calendarModeBusy ? "Switching…" : "Confirm switch"}</button></footer></article></div>}
  </div>;
}
