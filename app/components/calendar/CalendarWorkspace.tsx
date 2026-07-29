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
  meal_plan?: string | null; payment_status?: string; children_ages?: number[]; voucher_sent?: boolean;
};
type Payload = { properties: Property[]; property: Property | null; rooms: Room[]; bookings: Booking[]; sync: { last_completed_at?: string; last_status?: string; last_error?: string; rooms_synced?: number; bookings_synced?: number } | null; permissions?: { canDelete?: boolean }; month: string; error?: string };
type BookingDraft = { roomNames: string[]; checkIn: string; checkOut: string; action: "add" | "block" };

const sourceClass: Record<string, string> = {
  "Booking.com": "booking", Expedia: "expedia", Airbnb: "airbnb", Agoda: "agoda",
  "Travel Agent": "agent", Blocked: "blocked", Direct: "direct", FIT: "fit",
};
const DAY = 86_400_000;
const LAST_PROPERTY_KEY = "nkh-calendar-property";
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
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
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [selectedCells, setSelectedCells] = useState<{ room: string; date: string }[]>([]);
  const [movingBooking, setMovingBooking] = useState<Booking | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Booking | null>(null);
  const [rowHeight, setRowHeight] = useState(64);
  const [zoomTouched, setZoomTouched] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(Number(month.slice(0, 4)));
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [backgroundSyncing, setBackgroundSyncing] = useState(false);
  const [propertyReady, setPropertyReady] = useState(false);
  const [error, setError] = useState("");
  const calendarRef = useRef<HTMLElement>(null);
  const monthPickerRef = useRef<HTMLDivElement>(null);
  const selectedPropertyRef = useRef("");
  const activeLoadRef = useRef<AbortController | null>(null);
  const loadSequenceRef = useRef(0);
  const activeViewRef = useRef("");
  const backgroundSyncRef = useRef(new Set<string>());
  const inventorySyncRef = useRef(new Set<string>());
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    const requestedView = `${requestedProperty}|${requestedMonth}|${dateKey(from)}|${dateKey(to)}`;
    if (!requestedProperty || selectedPropertyRef.current !== requestedProperty || activeViewRef.current !== requestedView) return;
    const params = new URLSearchParams({ month: requestedMonth, propertyId: requestedProperty, from: dateKey(from), to: dateKey(to) });
    const response = await fetch(`/api/calendar?${params}`, { cache: "no-store" });
    const payload = await response.json() as Payload;
    if (response.ok && selectedPropertyRef.current === requestedProperty && activeViewRef.current === requestedView && payload.property?.id === requestedProperty) {
      setData(payload);
    }
  }, []);

  const refreshSourceInBackground = useCallback(async (requestedProperty: string, requestedMonth: string, from: Date, to: Date) => {
    if (!requestedProperty || selectedPropertyRef.current !== requestedProperty || backgroundSyncRef.current.has(requestedProperty)) return;
    backgroundSyncRef.current.add(requestedProperty); setBackgroundSyncing(true);
    try {
      const response = await fetch("/api/calendar/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ propertyId: requestedProperty }) });
      if (response.ok && selectedPropertyRef.current === requestedProperty) {
        await reloadCache(requestedProperty, requestedMonth, from, to);
      }
    } catch (reason) { console.error("Background calendar refresh failed.", reason); }
    finally {
      backgroundSyncRef.current.delete(requestedProperty);
      setBackgroundSyncing(backgroundSyncRef.current.size > 0);
    }
  }, [reloadCache]);

  const refreshNativeInventoryInBackground = useCallback(async (requestedProperty: string, requestedMonth: string, from: Date, to: Date) => {
    if (!requestedProperty || selectedPropertyRef.current !== requestedProperty || inventorySyncRef.current.has(requestedProperty)) return;
    inventorySyncRef.current.add(requestedProperty);
    try {
      const response = await fetch("/api/calendar/rooms/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: requestedProperty }),
      });
      if (!response.ok) throw new Error("Room inventory refresh failed.");
      if (selectedPropertyRef.current === requestedProperty) {
        await reloadCache(requestedProperty, requestedMonth, from, to);
      }
    } catch (reason) {
      inventorySyncRef.current.delete(requestedProperty);
      console.error("Background room inventory refresh failed.", reason);
    }
  }, [reloadCache]);

  const load = useCallback(async (requestedProperty = propertyId, requestedMonth = month) => {
    const sequence = ++loadSequenceRef.current;
    activeViewRef.current = `${requestedProperty}|${requestedMonth}|${dateKey(viewStart)}|${dateKey(viewEnd)}`;
    activeLoadRef.current?.abort();
    const controller = new AbortController();
    activeLoadRef.current = controller;
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ month: requestedMonth, from: dateKey(viewStart), to: dateKey(viewEnd) });
      if (requestedProperty) params.set("propertyId", requestedProperty);
      const response = await fetch(`/api/calendar?${params}`, { cache: "no-store", signal: controller.signal });
      const payload = await response.json() as Payload;
      if (controller.signal.aborted || sequence !== loadSequenceRef.current) return;
      if (!response.ok) throw new Error(payload.error || "Unable to load calendar.");
      if (requestedProperty && payload.property?.id !== requestedProperty) {
        window.localStorage.removeItem(LAST_PROPERTY_KEY);
        selectedPropertyRef.current = "";
        setPropertyId("");
        setData({ ...payload, property: null, rooms: [], bookings: [], sync: null });
        return;
      }
      if (selectedPropertyRef.current && payload.property?.id !== selectedPropertyRef.current) return;
      if (!selectedPropertyRef.current && payload.property?.id) {
        selectedPropertyRef.current = payload.property.id;
        window.localStorage.setItem(LAST_PROPERTY_KEY, payload.property.id);
        setPropertyId(payload.property.id);
      }
      setData(payload);
      if (payload.property?.calendar_source_mode === "google_sheet" && payload.property.calendar_sheet_code) {
        void refreshSourceInBackground(payload.property.id, requestedMonth, viewStart, viewEnd);
      } else if (payload.property?.calendar_source_mode === "supabase") {
        void refreshNativeInventoryInBackground(payload.property.id, requestedMonth, viewStart, viewEnd);
      }
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      if (sequence === loadSequenceRef.current) setError(reason instanceof Error ? reason.message : "Unable to load calendar.");
    } finally {
      if (sequence === loadSequenceRef.current) setLoading(false);
    }
  }, [month, propertyId, refreshNativeInventoryInBackground, refreshSourceInBackground, viewStart, viewEnd]);

  useEffect(() => {
    const remembered = window.localStorage.getItem(LAST_PROPERTY_KEY) || "";
    selectedPropertyRef.current = remembered;
    if (remembered) setPropertyId(remembered);
    setPropertyReady(true);
    return () => activeLoadRef.current?.abort();
  }, []);
  useEffect(() => { if (propertyReady) void load(propertyId, month); }, [month, propertyId, propertyReady, load]);
  useEffect(() => {
    const handler = () => setFullscreen(document.fullscreenElement === calendarRef.current);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);
  useEffect(() => {
    const closePicker = (event: PointerEvent) => {
      if (monthPickerRef.current && !monthPickerRef.current.contains(event.target as Node)) setMonthPickerOpen(false);
    };
    document.addEventListener("pointerdown", closePicker);
    return () => document.removeEventListener("pointerdown", closePicker);
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
  useEffect(() => {
    if (zoomTouched) return;
    setRowHeight(roomNames.length <= 15 ? 64 : roomNames.length <= 25 ? 56 : 48);
  }, [roomNames.length, zoomTouched]);

  async function toggleFullscreen() {
    if (!calendarRef.current) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await calendarRef.current.requestFullscreen();
  }
  function chooseMonth(value: string) {
    activeViewRef.current = "";
    setMonth(value); setPickerYear(Number(value.slice(0, 4))); setWeekOffset(0); setMonthPickerOpen(false);
  }
  function chooseProperty(value: string) {
    selectedPropertyRef.current = value;
    activeViewRef.current = "";
    window.localStorage.setItem(LAST_PROPERTY_KEY, value);
    activeLoadRef.current?.abort();
    setPropertyId(value);
    setSelected(null); setEditing(null); setDraft(null); setSelectedCells([]); setMovingBooking(null);
    setData(previous => ({
      ...previous,
      property: previous.properties.find(property => property.id === value) || null,
      rooms: [],
      bookings: [],
      sync: null,
    }));
  }
  function shiftWeek(amount: number) { activeViewRef.current = ""; setWeekOffset(value => value + amount); }
  function goToday() { activeViewRef.current = ""; setMonth(monthValue(today)); setWeekOffset(0); setSelectedCells([]); }
  function datesForRange(start: string, end: string) {
    const result: string[] = [];
    for (let date = localDate(start); date <= localDate(end); date = addDays(date, 1)) result.push(dateKey(date));
    return result;
  }
  function cellOccupied(room: string, date: string) {
    return data.bookings.some(booking => booking.room_name === room && date >= booking.check_in && date < booking.check_out);
  }
  function selectCalendarCell(room: string, date: string) {
    if (!nativeMode || cellOccupied(room, date)) return;
    const sameRoom = selectedCells.filter(cell => cell.room === room);
    if (!sameRoom.length || selectedCells.some(cell => cell.room !== room)) {
      setSelectedCells([{ room, date }]); return;
    }
    const start = sameRoom.map(cell => cell.date).sort()[0], end = date < start ? start : date;
    const first = date < start ? date : start;
    const range = datesForRange(first, end);
    if (range.some(day => cellOccupied(room, day))) { setError("The selected range contains an occupied date."); return; }
    setSelectedCells(range.map(day => ({ room, date: day })));
  }
  function openSelection(action: "add" | "block") {
    if (!selectedCells.length) return;
    const dates = selectedCells.map(cell => cell.date).sort();
    setDraft({ roomNames: [...new Set(selectedCells.map(cell => cell.room))], checkIn: dates[0], checkOut: dateKey(addDays(localDate(dates[dates.length - 1]), 1)), action });
    setEditing("new"); setSelectedCells([]);
  }
  async function moveBooking(booking: Booking, targetRoom: string) {
    if (!data.property || booking.room_name === targetRoom) { setMovingBooking(null); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/calendar/bookings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "move", id: booking.id, property_id: data.property.id, target_room: targetRoom }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to move booking.");
      setMovingBooking(null); setSelected(null);
      await reloadCache(data.property.id, month, viewStart, viewEnd);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to move booking."); }
    finally { setSaving(false); }
  }
  async function cancelBooking(reason: string) {
    if (!data.property || !cancelTarget) return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/calendar/bookings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel", id: cancelTarget.id, property_id: data.property.id, reason }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to cancel booking.");
      setCancelTarget(null); setSelected(null); await reloadCache(data.property.id, month, viewStart, viewEnd);
    } catch (reasonValue) { setError(reasonValue instanceof Error ? reasonValue.message : "Unable to cancel booking."); }
    finally { setSaving(false); }
  }

  async function saveBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data.property) return;
    const form = new FormData(event.currentTarget);
    const values = { ...Object.fromEntries(form), room_names: form.getAll("room_names") };
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/calendar/bookings", {
        method: editing === "new" ? "POST" : "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, action: editing === "new" ? draft?.action || "add" : "edit", property_id: data.property.id, ...(editing !== "new" && editing ? { id: editing.id } : {}) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to save booking.");
      setEditing(null); setDraft(null); setSelected(null);
      await reloadCache(data.property.id, month, viewStart, viewEnd);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save booking."); }
    finally { setSaving(false); }
  }

  async function deleteBooking() {
    if (!data.property || !deleteTarget) return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/calendar/bookings", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ property_id: data.property.id, id: deleteTarget.id }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to delete booking.");
      setDeleteTarget(null); setSelected(null);
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
        <select value={propertyId} onChange={event => chooseProperty(event.target.value)} aria-label="Property">{data.properties.map(property => <option key={property.id} value={property.id}>{property.property_name}</option>)}</select>
        {nativeMode && <button className="calendar-add-booking" onClick={() => { setDraft(null); setEditing("new"); }}><Plus size={16}/> Add booking</button>}
        {!nativeMode && <button className={`calendar-refresh ${backgroundSyncing ? "syncing" : ""}`} onClick={() => void refreshSourceInBackground(propertyId, month, viewStart, viewEnd)} disabled={loading || backgroundSyncing} aria-label="Refresh calendar"><RefreshCw size={17}/></button>}
      </div>
    </header>

    <div className="calendar-navigation">
      <div className="calendar-month-picker" ref={monthPickerRef}>
        <span>Month</span>
        <button type="button" className="calendar-month-trigger" aria-haspopup="dialog" aria-expanded={monthPickerOpen} onClick={() => { setPickerYear(Number(month.slice(0, 4))); setMonthPickerOpen(value => !value); }}>
          <CalendarDays size={16}/><strong>{new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</strong><ChevronRight size={15}/>
        </button>
        {monthPickerOpen && <div className="premium-month-popover" role="dialog" aria-label="Choose calendar month">
          <header><button type="button" onClick={() => setPickerYear(value => value - 1)} aria-label="Previous year"><ChevronLeft size={17}/></button><strong>{pickerYear}</strong><button type="button" onClick={() => setPickerYear(value => value + 1)} aria-label="Next year"><ChevronRight size={17}/></button></header>
          <div>{MONTH_NAMES.map((name, index) => {
            const value = `${pickerYear}-${String(index + 1).padStart(2, "0")}`;
            const active = value === month;
            const current = value === monthValue(today);
            return <button type="button" key={value} className={`${active ? "active" : ""} ${current ? "current" : ""}`} onClick={() => chooseMonth(value)}>{name}</button>;
          })}</div>
          <footer><button type="button" onClick={() => chooseMonth(monthValue(today))}>Go to current month</button></footer>
        </div>}
      </div>
      <div className="calendar-week-skipper"><button onClick={() => shiftWeek(-1)}><ChevronLeft size={17}/> Previous week</button><button className="calendar-today" onClick={goToday}>Today</button><button onClick={() => shiftWeek(1)}>Next week <ChevronRight size={17}/></button></div>
      <div className="calendar-view-tools"><span>Vertical zoom</span><button onClick={() => { setZoomTouched(true); setRowHeight(value => Math.max(19, value - 4)); }} aria-label="Zoom out vertically"><Minus size={16}/></button><b>{Math.round((rowHeight / 64) * 100)}%</b><button onClick={() => { setZoomTouched(true); setRowHeight(value => Math.min(104, value + 4)); }} aria-label="Zoom in vertically"><Plus size={16}/></button><button onClick={() => void toggleFullscreen()} aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}>{fullscreen ? <Minimize2 size={17}/> : <Maximize2 size={17}/>}</button></div>
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
              <button className={`calendar-room ${movingBooking ? "move-target" : ""}`} onClick={() => movingBooking ? void moveBooking(movingBooking, roomName) : undefined} onDragOver={event => { if (movingBooking) event.preventDefault(); }} onDrop={event => { event.preventDefault(); if (movingBooking) void moveBooking(movingBooking, roomName); }}><strong>{roomName}</strong><small>{room?.room_type || rowBookings[0]?.room_type || "Room"}</small></button>
              <div className="calendar-room-days">
                {viewDates.map(date => {
                  const key = dateKey(date), selectedCell = selectedCells.some(cell => cell.room === roomName && cell.date === key);
                  return <button key={key} type="button" aria-label={`${roomName} ${key}`} onClick={() => selectCalendarCell(roomName, key)} onDoubleClick={() => { if (nativeMode && !cellOccupied(roomName, key)) { setDraft({ roomNames: [roomName], checkIn: key, checkOut: dateKey(addDays(localDate(key), 1)), action: "add" }); setEditing("new"); setSelectedCells([]); } }} className={`${key === dateKey(today) ? "today" : ""} ${selectedCell ? "selected" : ""} ${nativeMode && !cellOccupied(roomName, key) ? "selectable" : ""}`}/>;
                })}
                {rowBookings.map(booking => {
                  const bookingStart = localDate(booking.check_in), bookingEnd = localDate(booking.check_out);
                  const start = Math.max(0, daysBetween(viewStart, bookingStart));
                  const end = Math.min(timelineDays, daysBetween(viewStart, bookingEnd));
                  if (end <= 0 || start >= timelineDays) return null;
                  const source = sourceClass[booking.booking_source] || "fit";
                  return <button key={booking.id} draggable={nativeMode} onDragStart={() => setMovingBooking(booking)} onDragEnd={() => setMovingBooking(null)} onPointerDown={event => { if (event.pointerType !== "touch" || !nativeMode) return; longPressRef.current = setTimeout(() => setMovingBooking(booking), 900); }} onPointerUp={() => { if (longPressRef.current) clearTimeout(longPressRef.current); }} onPointerCancel={() => { if (longPressRef.current) clearTimeout(longPressRef.current); }} className={`calendar-booking ${source} ${movingBooking?.id === booking.id ? "moving" : ""}`} style={{ left: `${(start / timelineDays) * 100}%`, width: `${(Math.max(1, end - start) / timelineDays) * 100}%` }} onClick={() => { if (!movingBooking) setSelected(booking); }} title={`${booking.guest_name} · ${booking.check_in} to ${booking.check_out}`}><strong>{booking.guest_name}</strong><small>{booking.booking_source}</small></button>;
                })}
              </div>
            </div>;
          })}
        </div>
      </div>}

    {selectedCells.length > 0 && <div className="calendar-selection-bar"><div><strong>{selectedCells[0].room}</strong><span>{selectedCells.map(cell => cell.date).sort()[0]} → {dateKey(addDays(localDate(selectedCells.map(cell => cell.date).sort().at(-1) || selectedCells[0].date), 1))}</span></div><button onClick={() => setSelectedCells([])}>Clear</button><button className="block-action" onClick={() => openSelection("block")}>Block dates</button><button className="primary-action" onClick={() => openSelection("add")}>Add booking</button></div>}
    {movingBooking && <div className="calendar-move-banner"><strong>Moving {movingBooking.guest_name}</strong><span>Click or tap the destination room name.</span><button onClick={() => setMovingBooking(null)}>Cancel</button></div>}

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
      <div><dt>Child ages</dt><dd>{selected.children_ages?.length ? selected.children_ages.join(", ") : "Not added"}</dd></div>
      <div><dt>Meal plan</dt><dd>{selected.meal_plan || "Not added"}</dd></div>
      <div><dt>Total</dt><dd>{money(selected.total_amount, currency)}</dd></div>
      <div><dt>Received</dt><dd>{money(selected.received_amount, currency)}</dd></div>
      <div><dt>Balance</dt><dd>{money(balance, currency)}</dd></div>
      <div><dt>Payment</dt><dd>{selected.payment_status || "Not paid"}</dd></div>
      <div><dt>Voucher</dt><dd>{selected.voucher_sent ? "Sent" : "Not sent"}</dd></div>
      {selected.created_at && <div><dt>Added</dt><dd>{new Date(selected.created_at).toLocaleString()}</dd></div>}
      {selected.updated_at && <div><dt>Updated</dt><dd>{new Date(selected.updated_at).toLocaleString()}</dd></div>}
    </dl>{selected.notes && <section className="reservation-notes"><small>NOTES</small><p>{selected.notes}</p></section>}{nativeMode ? <><div className="reservation-quick-actions">{selected.phone && <a href={`tel:${selected.phone}`}>Call guest</a>}{selected.phone && <a href={`https://wa.me/${selected.phone.replace(/\D/g,"")}`} target="_blank" rel="noreferrer">WhatsApp</a>}{selected.booking_reference && <button onClick={() => void navigator.clipboard?.writeText(selected.booking_reference || "")}>Copy reference</button>}<button onClick={() => { setMovingBooking(selected); setSelected(null); }}>Move room</button></div><footer className="calendar-booking-actions"><button onClick={() => { setDraft(null); setEditing(selected); }}>Edit booking</button><button className="cancel-action" onClick={() => setCancelTarget(selected)}>Cancel booking</button>{data.permissions?.canDelete && <button className="danger" disabled={saving} onClick={() => setDeleteTarget(selected)}>Delete permanently</button>}</footer></> : <em>{selectedRooms.length > 1 ? `${selectedRooms.length} room allocations · ` : ""}Read-only Sheet view</em>}</article></div>}

    {editing && data.property && <div className="calendar-detail-backdrop"><form className="calendar-booking-form" onSubmit={saveBooking}><button type="button" className="modal-close" onClick={() => { setEditing(null); setDraft(null); }}>×</button><small>SUPABASE CALENDAR</small><h3>{draft?.action === "block" ? "Block room dates" : editing === "new" ? "Add booking" : "Edit booking"}</h3><div className="booking-form-grid"><label>Guest name<input name="guest_name" defaultValue={draft?.action === "block" ? "Blocked" : editing === "new" ? "" : editing.guest_name} required/></label><fieldset className="wide booking-room-selector"><legend>Room allocation</legend>{roomNames.map(room => { const checked = editing === "new" ? Boolean(draft?.roomNames.includes(room)) : selectedRooms.includes(room); return <label key={room}><input name="room_names" type="checkbox" value={room} defaultChecked={checked}/><span>{room}</span></label>; })}</fieldset><label>Check-in<input name="check_in" type="date" defaultValue={editing === "new" ? draft?.checkIn || "" : editing.check_in} required/></label><label>Check-out<input name="check_out" type="date" defaultValue={editing === "new" ? draft?.checkOut || "" : editing.check_out} required/></label><label>Source<select name="booking_source" defaultValue={draft?.action === "block" ? "Blocked" : editing === "new" ? "Direct" : editing.booking_source}>{["Direct","Booking.com","Agoda","Expedia","Airbnb","Travel Agent","FIT","Blocked"].map(value => <option key={value}>{value}</option>)}</select></label><label>Status<select name="booking_status" defaultValue={draft?.action === "block" ? "Blocked" : editing === "new" ? "Confirmed" : editing.booking_status}>{["Confirmed","Pending","Checked In","Checked Out","Blocked"].map(value => <option key={value}>{value}</option>)}</select></label><label>Reference<input name="booking_reference" defaultValue={editing === "new" ? "" : editing.booking_reference || ""}/></label><label>Phone<input name="phone" defaultValue={editing === "new" ? "" : editing.phone || ""}/></label><label>Email<input name="email" type="email" defaultValue={editing === "new" ? "" : editing.email || ""}/></label><label>Adults<input name="adults" type="number" min="0" defaultValue={editing === "new" ? 1 : editing.adults || 1}/></label><label>Children<input name="children" type="number" min="0" defaultValue={editing === "new" ? 0 : editing.children || 0}/></label><label>Children ages<input name="children_ages" defaultValue={editing === "new" ? "" : editing.children_ages?.join(", ") || ""} placeholder="4, 8"/></label><label>Meal plan<input name="meal_plan" defaultValue={editing === "new" ? "" : editing.meal_plan || ""} placeholder="Room only / Breakfast"/></label><label>Total amount<input name="total_amount" type="number" min="0" step="0.01" defaultValue={editing === "new" ? "" : editing.total_amount ?? ""}/></label><label>Received<input name="received_amount" type="number" min="0" step="0.01" defaultValue={editing === "new" ? "" : editing.received_amount ?? ""}/></label><label>Currency<input name="currency_code" maxLength={3} defaultValue={editing === "new" ? data.property.currency_code || "LKR" : editing.currency_code || "LKR"}/></label><label className="voucher-check"><input name="voucher_sent" type="checkbox" defaultChecked={editing !== "new" && editing.voucher_sent}/><span>Voucher sent</span></label><label className="wide">Notes<textarea name="notes" defaultValue={editing === "new" ? "" : editing.notes || ""}/></label></div><footer><button type="button" onClick={() => { setEditing(null); setDraft(null); }}>Cancel</button><button className="primary-action" disabled={saving}>{saving ? "Saving…" : draft?.action === "block" ? "Block dates" : "Save booking"}</button></footer></form></div>}
    {cancelTarget && <div className="calendar-detail-backdrop"><form className="calendar-cancel-form" onSubmit={event => { event.preventDefault(); const reason = String(new FormData(event.currentTarget).get("reason") || ""); void cancelBooking(reason); }}><button type="button" className="modal-close" onClick={() => setCancelTarget(null)}>×</button><small>PRESERVE BOOKING HISTORY</small><h3>Cancel {cancelTarget.guest_name}?</h3><p>The reservation will leave the active calendar, but its history will remain available for reporting and auditing.</p><label>Cancellation reason<textarea name="reason" required placeholder="Guest request, duplicate booking, payment issue…"/></label><footer><button type="button" onClick={() => setCancelTarget(null)}>Keep booking</button><button className="danger" disabled={saving}>{saving ? "Cancelling…" : "Cancel reservation"}</button></footer></form></div>}
    {deleteTarget && <div className="calendar-detail-backdrop"><form className="calendar-cancel-form" onSubmit={event => { event.preventDefault(); void deleteBooking(); }}><button type="button" className="modal-close" onClick={() => setDeleteTarget(null)}>×</button><small>MASTER ACCESS · PERMANENT ACTION</small><h3>Delete {deleteTarget.guest_name} permanently?</h3><p>This removes every room allocation in this reservation group and cannot be undone. Use Cancel reservation instead when history must be preserved.</p><footer><button type="button" onClick={() => setDeleteTarget(null)}>Keep booking</button><button className="danger" disabled={saving}>{saving ? "Deleting…" : "Delete permanently"}</button></footer></form></div>}
  </section>;
}
