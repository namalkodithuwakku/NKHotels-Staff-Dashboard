"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Property = { id: string; client_code: string; property_name: string; preferred_language: string; client_status: string; package_name?: string | null; notes?: string | null; legal_name?: string | null; description?: string | null; address_line_1?: string | null; address_line_2?: string | null; city?: string | null; country?: string | null; timezone?: string | null; currency_code?: string | null; check_in_time?: string | null; check_out_time?: string | null; total_rooms?: number | null; website_url?: string | null; map_url?: string | null; logo_url?: string | null };
type RatePlan = { id: string; plan_name: string; color_hex: string; currency_code: string; minimum_stay: number };
type RateRange = { id: string; rate_plan_id: string; start_date: string; end_date: string };
type ProfileTab = "overview" | "contacts" | "rooms" | "rates" | "policies" | "faq";

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

export default function PropertiesWorkspace({ access }: { access: string }) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [tab, setTab] = useState<ProfileTab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const property = properties.find(item => item.id === selectedId) || properties[0];
  const canManage = Boolean(access);
  const tabs: Array<{ id: ProfileTab; label: string }> = [{ id: "overview", label: "Overview" }, { id: "contacts", label: "Contacts" }, { id: "rooms", label: "Room Types" }, { id: "rates", label: "Rates Calendar" }, { id: "policies", label: "Policies" }, { id: "faq", label: "FAQ" }];

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

  if (loading) return <div className="workspace-empty">Loading properties…</div>;
  return <div className="properties-workspace">
    <div className="property-toolbar"><div><small>PROPERTY DIRECTORY</small><h2>Client profiles</h2><p>One source for contacts, rooms, rates, policies and approved answers.</p></div>{canManage && <button className="primary-action" onClick={() => setCreating(true)}>＋ Add Property</button>}</div>
    {error && <p className="workspace-error">{error}</p>}
    {creating && <div className="inline-property-form"><form onSubmit={createProperty}><h3>Add property</h3><label>Client code<input name="client_code" required placeholder="NKH007" pattern="NKH[0-9]{3,}" /></label><label>Property name<input name="property_name" required /></label><label>City<input name="city" /></label><label>Status<select name="client_status" defaultValue="Onboarding"><option>Onboarding</option><option>Lead</option><option>Active</option></select></label><footer><button type="button" onClick={() => setCreating(false)}>Cancel</button><button className="primary-action">Create property</button></footer></form></div>}
    {!property ? <div className="workspace-empty"><strong>No properties found</strong><p>Add the first property profile to begin.</p></div> : <div className="property-layout"><aside className="property-list"><input aria-label="Search properties" placeholder="Search properties" />{properties.map(item => <button key={item.id} className={selectedId === item.id ? "active" : ""} onClick={() => setSelectedId(item.id)}><span>{item.client_code.slice(-1)}</span><div><strong>{item.property_name}</strong><small>{item.city || item.country || "Location pending"} · {item.total_rooms ?? "—"} rooms</small></div><em>{item.client_status}</em></button>)}</aside><section className="property-profile">
      <header><div className="property-avatar">{property.client_code}</div><div><small>{property.client_status.toUpperCase()}</small><h2>{property.property_name}</h2><p>{property.city || property.country || "Location pending"} · Property code {property.client_code}</p></div>{canManage && <button onClick={() => setEditing(value => !value)}>{editing ? "Close editor" : "Edit profile"}</button>}</header>
      <nav className="profile-tabs">{tabs.map(item => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>{item.label}</button>)}</nav>
      <div className="profile-content">{editing ? <form className="property-edit-grid" onSubmit={saveProperty}><label>Property name<input name="property_name" defaultValue={property.property_name} required /></label><label>Status<select name="client_status" defaultValue={property.client_status}>{["Active", "Lead", "Onboarding", "Former", "Inactive"].map(value => <option key={value}>{value}</option>)}</select></label><label>Legal name<input name="legal_name" defaultValue={property.legal_name || ""} /></label><label>Package<input name="package_name" defaultValue={property.package_name || ""} /></label><label>City<input name="city" defaultValue={property.city || ""} /></label><label>Country<input name="country" defaultValue={property.country || "Sri Lanka"} /></label><label>Currency<input name="currency_code" defaultValue={property.currency_code || "LKR"} maxLength={3} /></label><label>Total rooms<input name="total_rooms" type="number" min="0" defaultValue={property.total_rooms ?? ""} /></label><label>Check-in<input name="check_in_time" type="time" defaultValue={property.check_in_time?.slice(0, 5) || ""} /></label><label>Check-out<input name="check_out_time" type="time" defaultValue={property.check_out_time?.slice(0, 5) || ""} /></label><label className="wide">Description<textarea name="description" defaultValue={property.description || ""} /></label><label className="wide">Notes<textarea name="notes" defaultValue={property.notes || ""} /></label><footer><button type="button" onClick={() => setEditing(false)}>Cancel</button><button className="primary-action">Save profile</button></footer></form> : tab === "rates" ? <RateCalendar property={property} /> : tab === "overview" ? <div className="profile-card-grid"><article><small>LOCATION</small><h3>{property.city || "Not added"}</h3><p>{property.country || "Sri Lanka"}</p><p>{property.timezone || "Asia/Colombo"}</p></article><article><small>INVENTORY</small><h3>{property.total_rooms ?? "—"} rooms</h3><p>Room types and occupancy rules attach to this profile.</p></article><article><small>OPERATIONS</small><h3>{property.client_status}</h3><p>{property.package_name || "Package not assigned"}</p></article><article><small>KNOWLEDGE</small><h3>Approved information</h3><p>Policies and guest-facing FAQ answers stay attached to this profile.</p></article></div> : <div className="workspace-empty"><strong>{tabs.find(item => item.id === tab)?.label}</strong><p>This database section will be connected in the next profile checkpoint.</p></div>}</div>
    </section></div>}
  </div>;
}
