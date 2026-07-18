"use client";

import { useMemo, useState } from "react";

type ProfileTab = "overview" | "contacts" | "rooms" | "rates" | "policies" | "faq";

const properties = [
  { id: "lake-view", name: "Lake View Hotel", code: "LVH", location: "Colombo", email: "reservations@example.com", phone: "+94 11 000 0000", rooms: 24, status: "Active" },
  { id: "hill-house", name: "Hill House", code: "HHL", location: "Kandy", email: "stay@example.com", phone: "+94 81 000 0000", rooms: 12, status: "Onboarding" },
];

const ratePlans = [
  { id: "standard", name: "Standard", color: "#3da56a", amount: "USD 82" },
  { id: "low", name: "Low Season", color: "#3f82d5", amount: "USD 68" },
  { id: "high", name: "High Season", color: "#e59a28", amount: "USD 105" },
  { id: "peak", name: "Peak / Event", color: "#d95151", amount: "USD 135" },
  { id: "fit", name: "FIT Contract", color: "#8565c4", amount: "USD 74" },
];

function RateCalendar() {
  const today = new Date();
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [planId, setPlanId] = useState(ratePlans[0].id);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [painted, setPainted] = useState<Record<string, string>>({});
  const cells = useMemo(() => {
    const year = month.getFullYear(), monthIndex = month.getMonth();
    const leading = new Date(year, monthIndex, 1).getDay();
    const days = new Date(year, monthIndex + 1, 0).getDate();
    return [...Array.from({ length: leading }, () => null), ...Array.from({ length: days }, (_, index) => new Date(year, monthIndex, index + 1))];
  }, [month]);
  const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  function applyRange() {
    if (!start || !end || start > end) return;
    const next = { ...painted }, cursor = new Date(`${start}T12:00:00`), last = new Date(`${end}T12:00:00`);
    while (cursor <= last) { next[dateKey(cursor)] = planId; cursor.setDate(cursor.getDate() + 1); }
    setPainted(next);
  }

  function chooseDate(date: Date) {
    const key = dateKey(date);
    if (!start || end) { setStart(key); setEnd(""); }
    else if (key < start) { setStart(key); setEnd(start); }
    else setEnd(key);
  }

  return <div className="rate-calendar-shell">
    <div className="rate-plan-bar"><div><small>RATE PLANS</small><strong>Choose a plan, then select a date range</strong></div><div className="rate-plan-list">
      {ratePlans.map(plan => <button key={plan.id} className={planId === plan.id ? "active" : ""} onClick={() => setPlanId(plan.id)}><i style={{ background: plan.color }} />{plan.name}<small>{plan.amount}</small></button>)}
    </div></div>
    <div className="rate-range-tools">
      <label>From<input type="date" value={start} onChange={event => setStart(event.target.value)} /></label>
      <label>To<input type="date" value={end} onChange={event => setEnd(event.target.value)} /></label>
      <button className="primary-action" onClick={applyRange} disabled={!start || !end}>Apply rate plan</button>
      <button onClick={() => { setStart(""); setEnd(""); }}>Clear selection</button>
    </div>
    <div className="calendar-heading"><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button><h3>{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h3><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button></div>
    <div className="rate-calendar weekdays">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => <b key={day}>{day}</b>)}</div>
    <div className="rate-calendar">{cells.map((date, index) => {
      if (!date) return <span className="empty-day" key={`empty-${index}`} />;
      const key = dateKey(date), plan = ratePlans.find(item => item.id === painted[key]);
      const selected = key === start || key === end || Boolean(start && end && key > start && key < end);
      return <button key={key} className={selected ? "selected" : ""} onClick={() => chooseDate(date)}><strong>{date.getDate()}</strong>{plan ? <span style={{ background: plan.color }}><b>{plan.name}</b><small>{plan.amount}</small></span> : <em>Set rate</em>}</button>;
    })}</div>
    <p className="local-data-note">Preview mode: calendar changes are kept in this browser session until Supabase persistence is connected.</p>
  </div>;
}

export default function PropertiesWorkspace() {
  const [selectedId, setSelectedId] = useState(properties[0].id);
  const [tab, setTab] = useState<ProfileTab>("overview");
  const property = properties.find(item => item.id === selectedId) || properties[0];
  const tabs: Array<{ id: ProfileTab; label: string }> = [{ id: "overview", label: "Overview" }, { id: "contacts", label: "Contacts" }, { id: "rooms", label: "Room Types" }, { id: "rates", label: "Rates Calendar" }, { id: "policies", label: "Policies" }, { id: "faq", label: "FAQ" }];
  return <div className="properties-workspace">
    <div className="property-toolbar"><div><small>PROPERTY DIRECTORY</small><h2>Client profiles</h2><p>One source for contacts, rooms, rates, policies and approved answers.</p></div><button className="primary-action">＋ Add Property</button></div>
    <div className="property-layout"><aside className="property-list"><input aria-label="Search properties" placeholder="Search properties" />
      {properties.map(item => <button key={item.id} className={selectedId === item.id ? "active" : ""} onClick={() => setSelectedId(item.id)}><span>{item.code.slice(0, 1)}</span><div><strong>{item.name}</strong><small>{item.location} · {item.rooms} rooms</small></div><em>{item.status}</em></button>)}
    </aside><section className="property-profile">
      <header><div className="property-avatar">{property.code}</div><div><small>{property.status.toUpperCase()}</small><h2>{property.name}</h2><p>{property.location} · Property code {property.code}</p></div><button>Edit profile</button></header>
      <nav className="profile-tabs">{tabs.map(item => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>{item.label}</button>)}</nav>
      <div className="profile-content">{tab === "rates" ? <RateCalendar /> : tab === "overview" ? <div className="profile-card-grid">
        <article><small>CONTACT</small><h3>Reservations</h3><p>{property.email}</p><p>{property.phone}</p></article><article><small>INVENTORY</small><h3>{property.rooms} rooms</h3><p>Room types and occupancy rules will live here.</p></article><article><small>OPERATIONS</small><h3>Active profile</h3><p>Tasks, messages and calendars connect through this property.</p></article><article><small>KNOWLEDGE</small><h3>Approved information</h3><p>Policies and guest-facing FAQ answers stay attached to this profile.</p></article>
      </div> : <div className="workspace-empty"><strong>{tabs.find(item => item.id === tab)?.label}</strong><p>This profile section is ready for its Supabase fields.</p></div>}</div>
    </section></div>
  </div>;
}
