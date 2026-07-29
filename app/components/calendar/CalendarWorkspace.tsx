"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, RefreshCw, ShieldAlert } from "lucide-react";

type Property = { id: string; client_code: string; property_name: string; calendar_sheet_code: string | null; calendar_source_mode: "google_sheet" | "supabase"; currency_code: string | null };
type Room = { id: string; room_name: string; room_type: string | null; room_status: string; sort_order: number };
type Booking = { id: string; booking_group_key: string | null; guest_name: string; room_name: string; room_type: string | null; booking_source: string; booking_status: string; check_in: string; check_out: string; booking_reference: string | null; phone?: string | null; email?: string | null; adults?: number; children?: number; total_amount?: number | null; received_amount?: number | null; currency_code?: string; notes: string | null };
type Payload = { properties: Property[]; property: Property | null; rooms: Room[]; bookings: Booking[]; sync: { last_completed_at?: string; last_status?: string; last_error?: string; rooms_synced?: number; bookings_synced?: number } | null; month: string; error?: string };

const sourceClass: Record<string, string> = {
  "Booking.com": "booking", Expedia: "expedia", Airbnb: "airbnb",
  Agoda: "agoda", "Travel Agent": "agent", Blocked: "blocked", FIT: "fit",
};
function monthValue(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }
function shiftMonth(value: string, amount: number) { const [y, m] = value.split("-").map(Number); return monthValue(new Date(y, m - 1 + amount, 1)); }
function isoDate(year: number, month: number, day: number) { return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`; }

export default function CalendarWorkspace() {
  const [month, setMonth] = useState(monthValue());
  const [propertyId, setPropertyId] = useState("");
  const [data, setData] = useState<Payload>({ properties: [], property: null, rooms: [], bookings: [], sync: null, month });
  const [selected, setSelected] = useState<Booking | null>(null);
  const [editing, setEditing] = useState<Booking | "new" | null>(null);
  const [modeWarning, setModeWarning] = useState<"google_sheet" | "supabase" | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [backgroundSyncing, setBackgroundSyncing] = useState(false);
  const backgroundSyncRef = useRef(false);
  const [error, setError] = useState("");

  const reloadCache = useCallback(async (requestedProperty: string, requestedMonth: string) => {
    const params = new URLSearchParams({ month: requestedMonth, propertyId: requestedProperty });
    const response = await fetch(`/api/calendar?${params}`, { cache: "no-store" });
    const payload = await response.json() as Payload;
    if (response.ok) setData(payload);
  }, []);

  const refreshSourceInBackground = useCallback(async (requestedProperty: string, requestedMonth: string) => {
    if (!requestedProperty || backgroundSyncRef.current) return;
    backgroundSyncRef.current = true;
    setBackgroundSyncing(true);
    try {
      const response = await fetch("/api/calendar/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: requestedProperty }),
      });
      if (response.ok) await reloadCache(requestedProperty, requestedMonth);
    } catch (reason) {
      console.error("Background calendar refresh failed.", reason);
    } finally {
      backgroundSyncRef.current = false;
      setBackgroundSyncing(false);
    }
  }, [reloadCache]);

  const load = useCallback(async (requestedProperty = propertyId, requestedMonth = month) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ month: requestedMonth });
      if (requestedProperty) params.set("propertyId", requestedProperty);
      const response = await fetch(`/api/calendar?${params}`, { cache: "no-store" });
      const payload = await response.json() as Payload;
      if (!response.ok) throw new Error(payload.error || "Unable to load calendar.");
      setData(payload);
      if (payload.property?.id) setPropertyId(payload.property.id);
      if (payload.property?.calendar_source_mode === "google_sheet" && payload.property.calendar_sheet_code) {
        void refreshSourceInBackground(payload.property.id, requestedMonth);
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load calendar."); }
    finally { setLoading(false); }
  }, [month, propertyId, refreshSourceInBackground]);

  useEffect(() => { void load(propertyId, month); }, [month, propertyId, load]);

  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(year, monthNumber, 0).getDate();
  const today = new Date();
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(year, monthNumber - 1, 1));
  const roomNames = useMemo(() => {
    const known = data.rooms.map(room => room.room_name);
    data.bookings.forEach(booking => { if (!known.includes(booking.room_name)) known.push(booking.room_name); });
    return known;
  }, [data]);
  const bookingCount = useMemo(
    () => new Set(data.bookings.map(booking => booking.booking_group_key || booking.id)).size,
    [data.bookings]
  );
  const selectedRooms = useMemo(
    () => selected
      ? data.bookings
          .filter(booking => (booking.booking_group_key || booking.id) === (selected.booking_group_key || selected.id))
          .map(booking => booking.room_name)
          .filter((room, index, rooms) => rooms.indexOf(room) === index)
      : [],
    [data.bookings, selected]
  );
  const nativeMode = data.property?.calendar_source_mode === "supabase";

  async function changeMode() {
    if (!data.property || !modeWarning) return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/calendar/mode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ propertyId: data.property.id, mode: modeWarning }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to change calendar mode.");
      setModeWarning(null);
      await load(data.property.id, month);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to change calendar mode."); }
    finally { setSaving(false); }
  }

  async function saveBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data.property) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/calendar/bookings", {
        method: editing === "new" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, property_id: data.property.id, ...(editing !== "new" && editing ? { id: editing.id } : {}) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to save booking.");
      setEditing(null); setSelected(null);
      await reloadCache(data.property.id, month);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save booking."); }
    finally { setSaving(false); }
  }

  async function deleteBooking() {
    if (!data.property || !selected) return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/calendar/bookings", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ property_id: data.property.id, id: selected.id }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to delete booking.");
      setSelected(null);
      await reloadCache(data.property.id, month);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to delete booking."); }
    finally { setSaving(false); }
  }

  return <section className="operations-calendar">
    <header className="calendar-toolbar">
      <div><small>LIVE PROPERTY COVERAGE</small><h2>Reservation calendar</h2><p>{nativeMode ? "Live booking calendar managed directly in NKH Dashboard." : "Read-only booking view copied from the property Google Sheet."}</p></div>
      <div className="calendar-controls">
        <select value={propertyId} onChange={event => setPropertyId(event.target.value)} aria-label="Property">
          {data.properties.map(property => <option key={property.id} value={property.id}>{property.property_name}</option>)}
        </select>
        <div className="month-stepper">
          <button onClick={() => setMonth(value => shiftMonth(value, -1))} aria-label="Previous month"><ChevronLeft size={17}/></button>
          <strong>{monthLabel}</strong>
          <button onClick={() => setMonth(value => shiftMonth(value, 1))} aria-label="Next month"><ChevronRight size={17}/></button>
        </div>
        <button className="calendar-today" onClick={() => setMonth(monthValue())}>Today</button>
        {nativeMode && <button className="calendar-add-booking" onClick={() => setEditing("new")}><Plus size={16}/> Add booking</button>}
        {!nativeMode && <button className={`calendar-refresh ${backgroundSyncing ? "syncing" : ""}`} onClick={() => void refreshSourceInBackground(propertyId, month)} disabled={loading || backgroundSyncing} aria-label="Refresh calendar"><RefreshCw size={17}/></button>}
      </div>
    </header>

    {data.property && <div className={`calendar-mode-strip ${nativeMode ? "native" : "sheet"}`}>
      <div><strong>{nativeMode ? "Dashboard calendar" : "Google Sheet calendar"}</strong><span>{nativeMode ? "Bookings can be added, edited and deleted here." : "Sheet sync is ON. Dashboard editing is locked."}</span></div>
      <label className="calendar-source-switch"><span>Google Sheet</span><input type="checkbox" checked={!nativeMode} onChange={event => setModeWarning(event.target.checked ? "google_sheet" : "supabase")}/><i /></label>
    </div>}

    <div className="calendar-status-row">
      <span className={data.sync?.last_status === "Ready" ? "ready" : ""}><i />{backgroundSyncing ? "Checking source in background" : data.sync?.last_status || "Waiting for first sync"}</span>
      <span>{data.sync?.last_completed_at ? `Updated ${new Date(data.sync.last_completed_at).toLocaleString()}` : "No calendar copy received yet"}</span>
      <span>{roomNames.length} rooms · {bookingCount} bookings this month</span>
    </div>

    {error ? <div className="calendar-message error">{error}<button onClick={() => void load()}>Try again</button></div>
      : !nativeMode && !data.property?.calendar_sheet_code ? <div className="calendar-message"><CalendarDays/><h3>Calendar source not connected</h3><p>Add this property’s Google Sheet URL under Properties → Edit overview, or switch Google Sheet off to use the Dashboard calendar.</p></div>
      : !loading && !roomNames.length ? <div className="calendar-message"><CalendarDays/><h3>Waiting for calendar data</h3><p>The Sheet source is saved. Run the read-only calendar sync to prepare the first copy.</p>{data.sync?.last_error && <em>{data.sync.last_error}</em>}</div>
      : <div className={`calendar-board ${loading ? "loading" : ""}`}>
        <div className="calendar-grid" style={{ "--calendar-days": days } as React.CSSProperties}>
          <div className="calendar-corner">Room</div>
          {Array.from({ length: days }, (_, index) => {
            const day = index + 1, date = new Date(year, monthNumber - 1, day);
            const current = today.getFullYear() === year && today.getMonth() + 1 === monthNumber && today.getDate() === day;
            const weekend = date.getDay() === 0 || date.getDay() === 6;
            return <div key={day} className={`calendar-day ${current ? "today" : ""} ${weekend ? "weekend" : ""}`}><strong>{day}</strong><small>{date.toLocaleDateString("en-US", { weekday: "short" })}</small></div>;
          })}
          {roomNames.map((roomName, roomIndex) => {
            const room = data.rooms.find(item => item.room_name === roomName);
            const rowBookings = data.bookings.filter(item => item.room_name === roomName);
            return <div className="calendar-room-row" key={roomName} style={{ gridColumn: `1 / span ${days + 1}`, gridRow: roomIndex + 2 }}>
              <div className="calendar-room"><strong>{roomName}</strong><small>{room?.room_type || rowBookings[0]?.room_type || "Room"}</small></div>
              <div className="calendar-room-days">
                {Array.from({ length: days }, (_, index) => <span key={index} className={today.getFullYear() === year && today.getMonth() + 1 === monthNumber && today.getDate() === index + 1 ? "today" : ""} />)}
                {rowBookings.map(booking => {
                  const start = Math.max(1, new Date(`${booking.check_in}T12:00:00`).getDate());
                  const rawEnd = booking.check_out.startsWith(month) ? new Date(`${booking.check_out}T12:00:00`).getDate() : days + 1;
                  const length = Math.max(1, Math.min(days + 1, rawEnd) - start);
                  const source = sourceClass[booking.booking_source] || "fit";
                  return <button key={booking.id} className={`calendar-booking ${source}`} style={{ left: `${((start - 1) / days) * 100}%`, width: `${(length / days) * 100}%` }} onClick={() => setSelected(booking)} title={`${booking.guest_name} · ${booking.check_in} to ${booking.check_out}`}><strong>{booking.guest_name}</strong><small>{booking.booking_source}</small></button>;
                })}
              </div>
            </div>;
          })}
        </div>
      </div>}

    <div className="calendar-legend">{["Booking.com","Expedia","Airbnb","Agoda","Travel Agent","FIT","Blocked"].map(source => <span key={source}><i className={sourceClass[source]}/>{source}</span>)}</div>
    {selected && <div className="calendar-detail-backdrop" onClick={() => setSelected(null)}><article onClick={event => event.stopPropagation()}><button onClick={() => setSelected(null)}>×</button><small>RESERVATION DETAILS</small><h3>{selected.guest_name}</h3><dl><div><dt>{selectedRooms.length > 1 ? "Rooms" : "Room"}</dt><dd>{selectedRooms.join(", ") || selected.room_name}</dd></div><div><dt>Stay</dt><dd>{selected.check_in} → {selected.check_out}</dd></div><div><dt>Source</dt><dd>{selected.booking_source}</dd></div><div><dt>Status</dt><dd>{selected.booking_status}</dd></div>{selected.booking_reference && <div><dt>Reference</dt><dd>{selected.booking_reference}</dd></div>}{selected.phone && <div><dt>Phone</dt><dd>{selected.phone}</dd></div>}</dl>{selected.notes && <p>{selected.notes}</p>}{nativeMode ? <footer className="calendar-booking-actions"><button onClick={() => setEditing(selected)}>Edit booking</button><button className="danger" disabled={saving} onClick={deleteBooking}>Delete</button></footer> : <em>{selectedRooms.length > 1 ? `${selectedRooms.length} room allocations · ` : ""}Read-only Sheet view</em>}</article></div>}
    {editing && data.property && <div className="calendar-detail-backdrop"><form className="calendar-booking-form" onSubmit={saveBooking}><button type="button" className="modal-close" onClick={() => setEditing(null)}>×</button><small>SUPABASE CALENDAR</small><h3>{editing === "new" ? "Add booking" : "Edit booking"}</h3><div className="booking-form-grid"><label>Guest name<input name="guest_name" defaultValue={editing === "new" ? "" : editing.guest_name} required/></label><label>Room<select name="room_name" defaultValue={editing === "new" ? "" : editing.room_name} required><option value="">Select room</option>{roomNames.map(room => <option key={room}>{room}</option>)}</select></label><label>Check-in<input name="check_in" type="date" defaultValue={editing === "new" ? "" : editing.check_in} required/></label><label>Check-out<input name="check_out" type="date" defaultValue={editing === "new" ? "" : editing.check_out} required/></label><label>Source<select name="booking_source" defaultValue={editing === "new" ? "Direct" : editing.booking_source}>{["Direct","Booking.com","Agoda","Expedia","Airbnb","Travel Agent","FIT","Blocked"].map(value => <option key={value}>{value}</option>)}</select></label><label>Status<select name="booking_status" defaultValue={editing === "new" ? "Confirmed" : editing.booking_status}>{["Confirmed","Pending","Checked In","Checked Out","Cancelled","Blocked"].map(value => <option key={value}>{value}</option>)}</select></label><label>Reference<input name="booking_reference" defaultValue={editing === "new" ? "" : editing.booking_reference || ""}/></label><label>Phone<input name="phone" defaultValue={editing === "new" ? "" : editing.phone || ""}/></label><label>Email<input name="email" type="email" defaultValue={editing === "new" ? "" : editing.email || ""}/></label><label>Adults<input name="adults" type="number" min="0" defaultValue={editing === "new" ? 1 : editing.adults || 1}/></label><label>Children<input name="children" type="number" min="0" defaultValue={editing === "new" ? 0 : editing.children || 0}/></label><label>Total amount<input name="total_amount" type="number" min="0" step="0.01" defaultValue={editing === "new" ? "" : editing.total_amount ?? ""}/></label><label>Received<input name="received_amount" type="number" min="0" step="0.01" defaultValue={editing === "new" ? "" : editing.received_amount ?? ""}/></label><label>Currency<input name="currency_code" maxLength={3} defaultValue={editing === "new" ? data.property.currency_code || "LKR" : editing.currency_code || "LKR"}/></label><label className="wide">Notes<textarea name="notes" defaultValue={editing === "new" ? "" : editing.notes || ""}/></label></div><footer><button type="button" onClick={() => setEditing(null)}>Cancel</button><button className="primary-action" disabled={saving}>{saving ? "Saving…" : "Save booking"}</button></footer></form></div>}
    {modeWarning && <div className="calendar-detail-backdrop"><article className="calendar-mode-warning"><ShieldAlert/><small>CALENDAR SOURCE CHANGE</small><h3>{modeWarning === "supabase" ? "Turn Google Sheet off?" : "Turn Google Sheet on?"}</h3><p>{modeWarning === "supabase" ? "Sharp warning: the current Sheet copy in the dashboard will be replaced. Rooms will be rebuilt from the Room Types and room counts saved in this property profile. Dashboard booking add, edit and delete will then be enabled." : "Sharp warning: Dashboard booking editing will be disabled. The next Google Sheet sync will replace the Supabase calendar copy."}</p><footer><button onClick={() => setModeWarning(null)}>Keep current mode</button><button className="danger" disabled={saving} onClick={changeMode}>{saving ? "Switching…" : "Confirm switch"}</button></footer></article></div>}
  </section>;
}
