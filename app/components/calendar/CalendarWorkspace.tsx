"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Maximize2, Minimize2, Minus, Plus, RefreshCw } from "lucide-react";

type Property = { id: string; client_code: string; property_name: string; calendar_sheet_code: string | null; calendar_source_mode: "google_sheet" | "supabase"; currency_code: string | null };
type Room = { id: string; room_name: string; room_type: string | null; room_status: string; sort_order: number };
type Booking = {
  id: string; booking_group_key: string | null; guest_name: string; room_name: string; room_type: string | null;
  booking_source: string; booking_status: string; check_in: string; check_out: string; booking_reference: string | null;
  phone?: string | null; email?: string | null; adults?: number; children?: number; total_amount?: number | null;
  received_amount?: number | null; currency_code?: string; notes: string | null; created_at?: string; updated_at?: string;
};
type Payload = { properties: Property[]; property: Property | null; rooms: Room[]; bookings: Booking[]; sync: { last_completed_at?: string; last_status?: string; last_error?: string; rooms_synced?: number; bookings_synced?: number } | null; month: string; error?: string };

const sourceClass: Record<string, string> = {
  "Booking.com": "booking", Expedia: "expedia", Airbnb: "airbnb", Agoda: "agoda",
  "Travel Agent": "agent", Blocked: "blocked", Direct: "direct", FIT: "fit",
};
const DAY = 86_400_000;
function monthValue(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }
function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function localDate(value: string) { const [year, month, day] = value.split("-").map(Number); return new Date(year, month - 1, day, 12); }
function addDays(date: Date, amount: number) { const next = new Date(date); next.setDate(next.getDate() + amount); return next; }
function daysBetween(from: Date, to: Date) { return Math.round((Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) - Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) / DAY); }
function money(value: number | null | undefined, currency = "LKR") {
  return value == null ? "Not added" : new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

export default function CalendarWorkspace() {
  const [month, setMonth] = useState(monthValue());
  const [weekOffset, setWeekOffset] = useState(0);
  const [propertyId, setPropertyId] = useState("");
  const [data, setData] = useState<Payload>({ properties: [], property: null, rooms: [], bookings: [], sync: null, month });
  const [selected, setSelected] = useState<Booking | null>(null);
  const [editing, setEditing] = useState<Booking | "new" | null>(null);
  const [rowHeight, setRowHeight] = useState(64);
  const [fullscreen, setFullscreen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [backgroundSyncing, setBackgroundSyncing] = useState(false);
  const [error, setError] = useState("");
  const calendarRef = useRef<HTMLElement>(null);
  const backgroundSyncRef = useRef(false);
  const today = useMemo(() => new Date(), []);
  const currentMonth = month === monthValue(today);
  const timelineDays = 42;
  const viewStart = useMemo(() => {
    const base = currentMonth ? addDays(today, -21) : localDate(`${month}-01`);
    return addDays(base, weekOffset * 7);
  }, [currentMonth, month, today, weekOffset]);
  const viewEnd = useMemo(() => addDays(viewStart, timelineDays), [viewStart]);
  const viewDates = useMemo(() => Array.from({ length: timelineDays }, (_, index) => addDays(viewStart, index)), [viewStart]);

  const reloadCache = useCallback(async (requestedProperty: string, requestedMonth: string, from: Date, to: Date) => {
    const params = new URLSearchParams({ month: requestedMonth, propertyId: requestedProperty, from: dateKey(from), to: dateKey(to) });
    const response = await fetch(`/api/calendar?${params}`, { cache: "no-store" });
    const payload = await response.json() as Payload;
    if (response.ok) setData(payload);
  }, []);

  const refreshSourceInBackground = useCallback(async (requestedProperty: string, requestedMonth: string, from: Date, to: Date) => {
    if (!requestedProperty || backgroundSyncRef.current) return;
    backgroundSyncRef.current = true; setBackgroundSyncing(true);
    try {
      const response = await fetch("/api/calendar/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ propertyId: requestedProperty }) });
      if (response.ok) await reloadCache(requestedProperty, requestedMonth, from, to);
    } catch (reason) { console.error("Background calendar refresh failed.", reason); }
    finally { backgroundSyncRef.current = false; setBackgroundSyncing(false); }
  }, [reloadCache]);

  const load = useCallback(async (requestedProperty = propertyId, requestedMonth = month) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ month: requestedMonth, from: dateKey(viewStart), to: dateKey(viewEnd) });
      if (requestedProperty) params.set("propertyId", requestedProperty);
      const response = await fetch(`/api/calendar?${params}`, { cache: "no-store" });
      const payload = await response.json() as Payload;
      if (!response.ok) throw new Error(payload.error || "Unable to load calendar.");
      setData(payload);
      if (payload.property?.id) setPropertyId(payload.property.id);
      if (payload.property?.calendar_source_mode === "google_sheet" && payload.property.calendar_sheet_code) {
        void refreshSourceInBackground(payload.property.id, requestedMonth, viewStart, viewEnd);
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load calendar."); }
    finally { setLoading(false); }
  }, [month, propertyId, refreshSourceInBackground, viewStart, viewEnd]);

  useEffect(() => { void load(propertyId, month); }, [month, propertyId, load]);
  useEffect(() => {
    const handler = () => setFullscreen(document.fullscreenElement === calendarRef.current);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const roomNames = useMemo(() => {
    const known = data.rooms.map(room => room.room_name);
    data.bookings.forEach(booking => { if (!known.includes(booking.room_name)) known.push(booking.room_name); });
    return known;
  }, [data]);
  const bookingCount = useMemo(() => new Set(data.bookings.map(booking => booking.booking_group_key || booking.id)).size, [data.bookings]);
  const selectedRooms = useMemo(() => selected ? data.bookings
    .filter(booking => (booking.booking_group_key || booking.id) === (selected.booking_group_key || selected.id))
    .map(booking => booking.room_name).filter((room, index, rooms) => rooms.indexOf(room) === index) : [], [data.bookings, selected]);
  const nativeMode = data.property?.calendar_source_mode === "supabase";

  async function toggleFullscreen() {
    if (!calendarRef.current) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await calendarRef.current.requestFullscreen();
  }
  function chooseMonth(value: string) { setMonth(value); setWeekOffset(0); }
  function goToday() { setMonth(monthValue(today)); setWeekOffset(0); }

  async function saveBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data.property) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/calendar/bookings", {
        method: editing === "new" ? "POST" : "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, property_id: data.property.id, ...(editing !== "new" && editing ? { id: editing.id } : {}) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to save booking.");
      setEditing(null); setSelected(null);
      await reloadCache(data.property.id, month, viewStart, viewEnd);
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
      await reloadCache(data.property.id, month, viewStart, viewEnd);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to delete booking."); }
    finally { setSaving(false); }
  }

  const currency = selected?.currency_code || data.property?.currency_code || "LKR";
  const received = Number(selected?.received_amount || 0);
  const balance = selected?.total_amount == null ? null : Number(selected.total_amount) - received;
  const nights = selected ? Math.max(1, daysBetween(localDate(selected.check_in), localDate(selected.check_out))) : 0;

  return <section ref={calendarRef} className={`operations-calendar ${fullscreen ? "calendar-fullscreen" : ""}`}>
    <header className="calendar-toolbar">
      <div><small>LIVE PROPERTY COVERAGE</small><h2>Reservation calendar</h2><p>{nativeMode ? "Live booking calendar managed directly in NKH Dashboard." : "Read-only booking view copied from the property Google Sheet."}</p></div>
      <div className="calendar-controls">
        <select value={propertyId} onChange={event => setPropertyId(event.target.value)} aria-label="Property">{data.properties.map(property => <option key={property.id} value={property.id}>{property.property_name}</option>)}</select>
        {nativeMode && <button className="calendar-add-booking" onClick={() => setEditing("new")}><Plus size={16}/> Add booking</button>}
        {!nativeMode && <button className={`calendar-refresh ${backgroundSyncing ? "syncing" : ""}`} onClick={() => void refreshSourceInBackground(propertyId, month, viewStart, viewEnd)} disabled={loading || backgroundSyncing} aria-label="Refresh calendar"><RefreshCw size={17}/></button>}
      </div>
    </header>

    <div className="calendar-navigation">
      <label className="calendar-month-picker"><span>Month</span><input type="month" value={month} onChange={event => chooseMonth(event.target.value)}/></label>
      <div className="calendar-week-skipper"><button onClick={() => setWeekOffset(value => value - 1)}><ChevronLeft size={17}/> Previous week</button><button className="calendar-today" onClick={goToday}>Today</button><button onClick={() => setWeekOffset(value => value + 1)}>Next week <ChevronRight size={17}/></button></div>
      <div className="calendar-view-tools"><span>Vertical zoom</span><button onClick={() => setRowHeight(value => Math.max(46, value - 8))} aria-label="Zoom out vertically"><Minus size={16}/></button><b>{Math.round((rowHeight / 64) * 100)}%</b><button onClick={() => setRowHeight(value => Math.min(104, value + 8))} aria-label="Zoom in vertically"><Plus size={16}/></button><button onClick={() => void toggleFullscreen()} aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}>{fullscreen ? <Minimize2 size={17}/> : <Maximize2 size={17}/>}</button></div>
    </div>

    <div className="calendar-status-row">
      <span className={data.sync?.last_status === "Ready" || nativeMode ? "ready" : ""}><i />{nativeMode ? "Dashboard calendar active" : backgroundSyncing ? "Checking source in background" : data.sync?.last_status || "Waiting for first sync"}</span>
      <span>{nativeMode ? "Live Supabase data" : data.sync?.last_completed_at ? `Updated ${new Date(data.sync.last_completed_at).toLocaleString()}` : "No calendar copy received yet"}</span>
      <span>{roomNames.length} rooms · {bookingCount} bookings in view</span>
    </div>

    {error ? <div className="calendar-message error">{error}<button onClick={() => void load()}>Try again</button></div>
      : !nativeMode && !data.property?.calendar_sheet_code ? <div className="calendar-message"><CalendarDays/><h3>Calendar source not connected</h3><p>Add this property’s Google Sheet URL under Properties → Edit overview.</p></div>
      : !loading && !roomNames.length ? <div className="calendar-message"><CalendarDays/><h3>No room inventory yet</h3><p>Add room types, room counts and room names under Properties → Room Types.</p>{data.sync?.last_error && <em>{data.sync.last_error}</em>}</div>
      : <div className={`calendar-board ${loading ? "loading" : ""}`}>
        <div className="calendar-grid" style={{ "--calendar-days": timelineDays, "--calendar-row-height": `${rowHeight}px` } as React.CSSProperties}>
          <div className="calendar-corner">Room</div>
          {viewDates.map(date => {
            const current = dateKey(date) === dateKey(today), weekend = date.getDay() === 0 || date.getDay() === 6;
            const first = date.getDate() === 1 || dateKey(date) === dateKey(viewStart);
            return <div key={dateKey(date)} className={`calendar-day ${current ? "today" : ""} ${weekend ? "weekend" : ""}`} title={date.toLocaleDateString()}>{first && <em>{date.toLocaleDateString("en-US", { month: "short" })}</em>}<strong>{date.getDate()}</strong><small>{date.toLocaleDateString("en-US", { weekday: "short" })}</small></div>;
          })}
          {roomNames.map((roomName, roomIndex) => {
            const room = data.rooms.find(item => item.room_name === roomName);
            const rowBookings = data.bookings.filter(item => item.room_name === roomName);
            return <div className="calendar-room-row" key={roomName} style={{ gridColumn: `1 / span ${timelineDays + 1}`, gridRow: roomIndex + 2 }}>
              <div className="calendar-room"><strong>{roomName}</strong><small>{room?.room_type || rowBookings[0]?.room_type || "Room"}</small></div>
              <div className="calendar-room-days">
                {viewDates.map(date => <span key={dateKey(date)} className={dateKey(date) === dateKey(today) ? "today" : ""}/>)}
                {rowBookings.map(booking => {
                  const bookingStart = localDate(booking.check_in), bookingEnd = localDate(booking.check_out);
                  const start = Math.max(0, daysBetween(viewStart, bookingStart));
                  const end = Math.min(timelineDays, daysBetween(viewStart, bookingEnd));
                  if (end <= 0 || start >= timelineDays) return null;
                  const source = sourceClass[booking.booking_source] || "fit";
                  return <button key={booking.id} className={`calendar-booking ${source}`} style={{ left: `${(start / timelineDays) * 100}%`, width: `${(Math.max(1, end - start) / timelineDays) * 100}%` }} onClick={() => setSelected(booking)} title={`${booking.guest_name} · ${booking.check_in} to ${booking.check_out}`}><strong>{booking.guest_name}</strong><small>{booking.booking_source}</small></button>;
                })}
              </div>
            </div>;
          })}
        </div>
      </div>}

    <div className="calendar-legend">{["Booking.com","Expedia","Airbnb","Agoda","Travel Agent","Direct","FIT","Blocked"].map(source => <span key={source}><i className={sourceClass[source]}/>{source}</span>)}</div>

    {selected && <div className="calendar-detail-backdrop" onClick={() => setSelected(null)}><article className="reservation-detail-card" onClick={event => event.stopPropagation()}><button onClick={() => setSelected(null)}>×</button><small>RESERVATION DETAILS</small><h3>{selected.guest_name}</h3><dl>
      <div><dt>{selectedRooms.length > 1 ? "Rooms" : "Room"}</dt><dd>{selectedRooms.join(", ") || selected.room_name}</dd></div>
      <div><dt>Room type</dt><dd>{selected.room_type || "Not added"}</dd></div>
      <div><dt>Stay</dt><dd>{selected.check_in} → {selected.check_out}</dd></div>
      <div><dt>Nights</dt><dd>{nights}</dd></div>
      <div><dt>Source</dt><dd>{selected.booking_source}</dd></div>
      <div><dt>Status</dt><dd>{selected.booking_status}</dd></div>
      <div><dt>Reference</dt><dd>{selected.booking_reference || "Not added"}</dd></div>
      <div><dt>Phone</dt><dd>{selected.phone || "Not added"}</dd></div>
      <div><dt>Email</dt><dd>{selected.email || "Not added"}</dd></div>
      <div><dt>Guests</dt><dd>{selected.adults ?? 1} adults · {selected.children ?? 0} children</dd></div>
      <div><dt>Total</dt><dd>{money(selected.total_amount, currency)}</dd></div>
      <div><dt>Received</dt><dd>{money(selected.received_amount, currency)}</dd></div>
      <div><dt>Balance</dt><dd>{money(balance, currency)}</dd></div>
      {selected.created_at && <div><dt>Added</dt><dd>{new Date(selected.created_at).toLocaleString()}</dd></div>}
      {selected.updated_at && <div><dt>Updated</dt><dd>{new Date(selected.updated_at).toLocaleString()}</dd></div>}
    </dl>{selected.notes && <section className="reservation-notes"><small>NOTES</small><p>{selected.notes}</p></section>}{nativeMode ? <footer className="calendar-booking-actions"><button onClick={() => setEditing(selected)}>Edit booking</button><button className="danger" disabled={saving} onClick={deleteBooking}>Delete</button></footer> : <em>{selectedRooms.length > 1 ? `${selectedRooms.length} room allocations · ` : ""}Read-only Sheet view</em>}</article></div>}

    {editing && data.property && <div className="calendar-detail-backdrop"><form className="calendar-booking-form" onSubmit={saveBooking}><button type="button" className="modal-close" onClick={() => setEditing(null)}>×</button><small>SUPABASE CALENDAR</small><h3>{editing === "new" ? "Add booking" : "Edit booking"}</h3><div className="booking-form-grid"><label>Guest name<input name="guest_name" defaultValue={editing === "new" ? "" : editing.guest_name} required/></label><label>Room<select name="room_name" defaultValue={editing === "new" ? "" : editing.room_name} required><option value="">Select room</option>{roomNames.map(room => <option key={room}>{room}</option>)}</select></label><label>Check-in<input name="check_in" type="date" defaultValue={editing === "new" ? "" : editing.check_in} required/></label><label>Check-out<input name="check_out" type="date" defaultValue={editing === "new" ? "" : editing.check_out} required/></label><label>Source<select name="booking_source" defaultValue={editing === "new" ? "Direct" : editing.booking_source}>{["Direct","Booking.com","Agoda","Expedia","Airbnb","Travel Agent","FIT","Blocked"].map(value => <option key={value}>{value}</option>)}</select></label><label>Status<select name="booking_status" defaultValue={editing === "new" ? "Confirmed" : editing.booking_status}>{["Confirmed","Pending","Checked In","Checked Out","Cancelled","Blocked"].map(value => <option key={value}>{value}</option>)}</select></label><label>Reference<input name="booking_reference" defaultValue={editing === "new" ? "" : editing.booking_reference || ""}/></label><label>Phone<input name="phone" defaultValue={editing === "new" ? "" : editing.phone || ""}/></label><label>Email<input name="email" type="email" defaultValue={editing === "new" ? "" : editing.email || ""}/></label><label>Adults<input name="adults" type="number" min="0" defaultValue={editing === "new" ? 1 : editing.adults || 1}/></label><label>Children<input name="children" type="number" min="0" defaultValue={editing === "new" ? 0 : editing.children || 0}/></label><label>Total amount<input name="total_amount" type="number" min="0" step="0.01" defaultValue={editing === "new" ? "" : editing.total_amount ?? ""}/></label><label>Received<input name="received_amount" type="number" min="0" step="0.01" defaultValue={editing === "new" ? "" : editing.received_amount ?? ""}/></label><label>Currency<input name="currency_code" maxLength={3} defaultValue={editing === "new" ? data.property.currency_code || "LKR" : editing.currency_code || "LKR"}/></label><label className="wide">Notes<textarea name="notes" defaultValue={editing === "new" ? "" : editing.notes || ""}/></label></div><footer><button type="button" onClick={() => setEditing(null)}>Cancel</button><button className="primary-action" disabled={saving}>{saving ? "Saving…" : "Save booking"}</button></footer></form></div>}
  </section>;
}
