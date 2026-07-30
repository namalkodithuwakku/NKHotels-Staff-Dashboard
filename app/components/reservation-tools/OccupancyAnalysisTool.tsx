"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, BedDouble, CalendarRange, Download, LoaderCircle, Sparkles, TrendingUp } from "lucide-react";

type Property = { id: string; client_code: string; property_name: string; city?: string | null; currency_code?: string | null };
type Recommendation = { rank: number; title: string; action: string; reason: string; impact: string; timeframe: string };
type Metrics = {
  inventory: number; nights: number; occupancy: number; soldRoomNights: number; availableRoomNights: number; blockedRoomNights: number;
  reservationGroups: number; cancelledGroups: number; pendingReservations: number; recordedRevenue: number; currency: string;
  adr: number; revpar: number; revenueCoverage: number;
  daily: Array<{ date: string; sold: number; blocked: number; available: number; occupancy: number }>;
  sourceMix: Array<{ source: string; roomNights: number; share: number }>;
  roomTypes: Array<{ roomType: string; sold: number; available: number; occupancy: number }>;
  weekdays: Array<{ weekday: string; occupancy: number; sold: number; available: number }>;
  peakDates: Array<{ date: string; occupancy: number }>; weakDates: Array<{ date: string; occupancy: number }>;
};
type Result = { reportId: string; property: Property; from: string; to: string; metrics: Metrics; recommendations: Recommendation[] };

function date(offset = 0) { const value = new Date(); value.setDate(value.getDate() + offset); return value.toISOString().slice(0, 10); }
async function json(response: Response) {
  const text = await response.text();
  try { return JSON.parse(text); } catch { throw new Error(response.ok ? "The server returned an unreadable response." : `Request failed (${response.status}).`); }
}
function amount(value: number, currency: string) { return `${currency} ${Math.round(value).toLocaleString()}`; }
function shortDate(value: string) { return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }); }

export default function OccupancyAnalysisTool() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [from, setFrom] = useState(date(0)), [to, setTo] = useState(date(30));
  const [loading, setLoading] = useState(false), [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState(""), [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    fetch("/api/reservation-tools/occupancy-analysis").then(json).then(data => {
      if (!data.success) throw new Error(data.error || "Unable to load properties.");
      setProperties(data.properties || []); if (data.properties?.[0]) setPropertyId(data.properties[0].id);
    }).catch(reason => setError(reason instanceof Error ? reason.message : "Unable to load properties."));
  }, []);

  async function getAI(report: Result) {
    setAiLoading(true);
    try {
      const response = await fetch("/api/reservation-tools/occupancy-analysis/recommendations", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reportId: report.reportId }),
      });
      const data = await json(response);
      if (response.ok && data.success) setResult(current => current ? { ...current, recommendations: data.recommendations } : current);
    } catch { /* Rule-based recommendations remain available. */ }
    finally { setAiLoading(false); }
  }

  async function analyze(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/reservation-tools/occupancy-analysis", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ propertyId, from, to }),
      });
      const data = await json(response);
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to analyze occupancy.");
      setResult(data); void getAI(data);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to analyze occupancy."); }
    finally { setLoading(false); }
  }

  const chartDays = useMemo(() => {
    if (!result) return [];
    const step = Math.max(1, Math.ceil(result.metrics.daily.length / 46));
    return result.metrics.daily.filter((_, index) => index % step === 0 || index === result.metrics.daily.length - 1);
  }, [result]);

  return <div className="occupancy-tool">
    <header className="occupancy-intro"><div><small>PERFORMANCE INTELLIGENCE</small><h3>Occupancy Analysis</h3><p>Turn live calendar activity into clear room, source, weekday and revenue decisions.</p></div><span><BarChart3 size={18}/> Master analysis</span></header>
    <form className="occupancy-controls" onSubmit={analyze}>
      <label>Property<select value={propertyId} onChange={event => setPropertyId(event.target.value)}>{properties.map(property => <option value={property.id} key={property.id}>{property.property_name} · {property.city || property.client_code}</option>)}</select></label>
      <label>From<input type="date" value={from} onChange={event => setFrom(event.target.value)}/></label>
      <label>To<input type="date" value={to} min={from} onChange={event => setTo(event.target.value)}/></label>
      <button disabled={loading || !propertyId}>{loading ? <><LoaderCircle className="spin" size={18}/> Analyzing…</> : <><TrendingUp size={18}/> Analyze occupancy</>}</button>
    </form>
    {error && <div className="occupancy-error">{error}</div>}
    {!result && !loading && <div className="occupancy-empty"><CalendarRange size={34}/><h3>Choose a period to see the real occupancy picture</h3><p>Start with the next 30 days, then compare a month or full season.</p></div>}

    {result && <section className="occupancy-report">
      <header className="occupancy-report-head"><div><small>ANALYSIS READY</small><h3>{result.property.property_name}</h3><p>{shortDate(result.from)}–{shortDate(result.to)} · {result.metrics.nights} stay dates · {result.metrics.inventory} rooms</p></div><a href={`/api/reservation-tools/occupancy-analysis/pdf?reportId=${encodeURIComponent(result.reportId)}`}><Download size={17}/> Download PDF</a></header>
      <div className="occupancy-kpis">
        <article className="main"><small>OCCUPANCY</small><strong>{result.metrics.occupancy}%</strong><div><i style={{ width: `${Math.min(100, result.metrics.occupancy)}%` }}/></div><p>{result.metrics.soldRoomNights} sold of {result.metrics.availableRoomNights} available room nights</p></article>
        <article><BedDouble/><small>SOLD ROOM NIGHTS</small><strong>{result.metrics.soldRoomNights}</strong><p>{result.metrics.blockedRoomNights} blocked nights excluded</p></article>
        <article><CalendarRange/><small>RESERVATIONS</small><strong>{result.metrics.reservationGroups}</strong><p>{result.metrics.pendingReservations} pending · {result.metrics.cancelledGroups} cancelled</p></article>
        <article><TrendingUp/><small>RECORDED REVENUE</small><strong>{amount(result.metrics.recordedRevenue, result.metrics.currency)}</strong><p>{result.metrics.revenueCoverage}% value coverage</p></article>
        <article><BarChart3/><small>ADR / REVPAR</small><strong>{amount(result.metrics.adr, result.metrics.currency)}</strong><p>RevPAR {amount(result.metrics.revpar, result.metrics.currency)}</p></article>
      </div>

      <article className="occupancy-chart-card"><header><div><small>DAILY TREND</small><h4>Occupancy by stay date</h4></div><span>Blocked rooms removed from available inventory</span></header><div className="occupancy-chart">
        {chartDays.map(item => <div className="occupancy-bar-column" key={item.date} title={`${item.date}: ${item.occupancy}% · ${item.sold}/${item.available}`}>
          <strong>{item.occupancy}%</strong><div><i className={item.occupancy >= 80 ? "high" : item.occupancy >= 50 ? "medium" : "low"} style={{ height: `${Math.max(3, item.occupancy)}%` }}/></div><small>{shortDate(item.date)}</small>
        </div>)}
      </div></article>

      <div className="occupancy-breakdown">
        <article><header><h4>Room types</h4><span>Performance</span></header>{result.metrics.roomTypes.map(item => <div className="occupancy-row" key={item.roomType}><div><strong>{item.roomType}</strong><small>{item.sold}/{item.available} room nights</small></div><b>{item.occupancy}%</b><span><i style={{ width: `${item.occupancy}%` }}/></span></div>)}</article>
        <article><header><h4>Booking sources</h4><span>Sold room nights</span></header>{result.metrics.sourceMix.length ? result.metrics.sourceMix.map(item => <div className="occupancy-source" key={item.source}><div><strong>{item.source}</strong><small>{item.roomNights} room nights</small></div><b>{item.share}%</b></div>) : <p className="occupancy-no-data">No occupied bookings in this period.</p>}</article>
        <article><header><h4>Weekday pattern</h4><span>Average occupancy</span></header>{result.metrics.weekdays.map(item => <div className="occupancy-source" key={item.weekday}><div><strong>{item.weekday}</strong><small>{item.sold}/{item.available} room nights</small></div><b>{item.occupancy}%</b></div>)}</article>
      </div>

      <div className="occupancy-dates"><article><h4>Peak dates</h4>{result.metrics.peakDates.map(item => <span key={item.date}><b>{shortDate(item.date)}</b>{item.occupancy}%</span>)}</article><article><h4>Weak upcoming dates</h4>{result.metrics.weakDates.map(item => <span key={item.date}><b>{shortDate(item.date)}</b>{item.occupancy}%</span>)}</article></div>

      <article className="occupancy-actions"><header><div><small>PRIORITY PLAN</small><h4>Top 10 recommendations</h4></div><span className={aiLoading ? "loading" : ""}><Sparkles size={15}/>{aiLoading ? "Improving with AI…" : "AI reviewed"}</span></header>
        <div>{result.recommendations.map((item, index) => <article key={`${item.rank}-${item.title}`}><b>{item.rank || index + 1}</b><div><h5>{item.title}<em className={`impact-${item.impact.toLowerCase()}`}>{item.impact}</em></h5><p>{item.action}</p><small>{item.timeframe} · {item.reason}</small></div></article>)}</div>
      </article>
    </section>}
  </div>;
}
