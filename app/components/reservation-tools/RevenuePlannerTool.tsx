"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarRange, MapPin, Sparkles, TriangleAlert } from "lucide-react";

type Property = { id: string; client_code: string; property_name: string; city?: string; country?: string; total_rooms?: number };
type Plan = {
  destinationSummary: string; season: string; demandOutlook: string; periodSummary: string;
  events: Array<{ name: string; dateRange: string; location: string; impact: string; confidence: string; evidence: string }>;
  attractions: Array<{ name: string; relevance: string; opportunity: string }>;
  actions: Array<{ dateRange: string; priority: string; actionType: string; title: string; reason: string; currentSignal: string; recommendation: string; successMeasure: string }>;
  risks: string[];
};
type Result = { planId: string; property: { property_name: string; city?: string; country?: string }; metrics: { inventory: number; averageOccupancy: number; bookedRevenue: number; currency: string }; plan: Plan };

function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
function futureDate(days: number) { const value = new Date(); value.setDate(value.getDate() + days); return dateKey(value); }
async function responsePayload(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); }
  catch {
    return {
      error: response.ok
        ? "The planner returned an unreadable response. Please try again."
        : `The planner service is temporarily unavailable (HTTP ${response.status}).`,
    };
  }
}

export default function RevenuePlannerTool() {
  const [properties, setProperties] = useState<Property[]>([]), [propertyId, setPropertyId] = useState("");
  const [from, setFrom] = useState(dateKey(new Date())), [to, setTo] = useState(futureDate(30));
  const [objective, setObjective] = useState("Balanced occupancy and revenue");
  const [result, setResult] = useState<Result | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/reservation-tools/revenue-plan", { cache: "no-store" }).then(async response => {
      const payload = await responsePayload(response);
      if (!response.ok) throw new Error(payload.error || "Unable to load properties.");
      setProperties(payload.properties || []); setPropertyId(payload.properties?.[0]?.id || "");
    }).catch(reason => setError(reason instanceof Error ? reason.message : "Unable to load properties."));
  }, []);
  const property = useMemo(() => properties.find(item => item.id === propertyId), [properties, propertyId]);

  async function generate() {
    if (!propertyId || !from || !to) return setError("Choose a property and planning period.");
    setLoading(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/reservation-tools/revenue-plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, from, to, objective }),
      });
      const payload = await responsePayload(response);
      if (!response.ok) throw new Error(payload.error || "Unable to generate the plan.");
      setResult(payload);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to generate the plan."); }
    finally { setLoading(false); }
  }

  return <section className="revenue-planner">
    <header className="revenue-planner-hero"><div><small>AI REVENUE INTELLIGENCE</small><h2>Destination-aware revenue plan</h2><p>Combine live occupancy and rates with location, season, events and attractions for one actionable period plan.</p></div><Sparkles size={34}/></header>
    <div className="revenue-plan-controls">
      <label><span>Property</span><select value={propertyId} onChange={event => setPropertyId(event.target.value)}>{properties.map(item => <option key={item.id} value={item.id}>{item.property_name} · {item.client_code}</option>)}</select></label>
      <label><span>From</span><input type="date" value={from} onChange={event => setFrom(event.target.value)}/></label>
      <label><span>To</span><input type="date" value={to} min={from} onChange={event => setTo(event.target.value)}/></label>
      <label><span>Objective</span><select value={objective} onChange={event => setObjective(event.target.value)}>{["Balanced occupancy and revenue","Maximise revenue","Build occupancy","Last-minute pickup","Protect rate integrity"].map(value => <option key={value}>{value}</option>)}</select></label>
      <button onClick={generate} disabled={loading || !propertyId}><Sparkles size={18}/>{loading ? "Researching destination…" : "Generate AI plan"}</button>
    </div>
    {property && <div className="revenue-property-context"><MapPin size={16}/><span>{property.property_name} · {[property.city, property.country].filter(Boolean).join(", ") || "Location profile incomplete"} · {property.total_rooms || "—"} rooms</span></div>}
    {error && <div className="audit-error"><TriangleAlert size={18}/>{error}</div>}
    {!result && !loading && <div className="revenue-empty"><BarChart3/><h3>Create an actionable revenue plan</h3><p>The planner will examine occupancy, booking pace, rate setup, destination seasonality, public holidays, verifiable events and nearby demand generators.</p><em>AI recommendations remain advisory until approved by Master.</em></div>}
    {loading && <div className="audit-processing"><i/><h3>Researching demand and building actions</h3><p>Checking the selected period against property performance and live destination signals.</p></div>}
    {result && <div className="revenue-plan-results">
      <div className="revenue-overview-row">
        <div className="revenue-metrics"><article><small>ROOMS</small><strong>{result.metrics.inventory}</strong><span>Property inventory</span></article><article><small>AVERAGE OCCUPANCY</small><strong>{result.metrics.averageOccupancy}%</strong><span>Selected period</span></article><article><small>BOOKED REVENUE</small><strong>{new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(result.metrics.bookedRevenue)}</strong><span>{result.metrics.currency}</span></article></div>
        <section className="revenue-season-card"><div><small>SEASON & DEMAND</small><span>AI destination signal</span></div><h3>{result.plan.season}</h3><p>{result.plan.demandOutlook}</p></section>
      </div>
      <section className="revenue-summary"><div className="revenue-summary-label"><Sparkles size={17}/><small>AI PERIOD SUMMARY</small></div><h3>{result.plan.periodSummary}</h3><p>{result.plan.destinationSummary}</p></section>
      <div className="revenue-evidence-grid"><section><header><CalendarRange size={18}/><h3>Events and demand signals</h3></header>{result.plan.events.length ? result.plan.events.map(event => <article key={`${event.name}-${event.dateRange}`}><div><strong>{event.name}</strong><span>{event.dateRange} · {event.location}</span></div><b className={event.impact.toLowerCase()}>{event.impact} impact</b><p>{event.evidence}</p><small>{event.confidence} confidence</small></article>) : <p>No verifiable major events found for this period.</p>}</section><section><header><MapPin size={18}/><h3>Attraction opportunities</h3></header>{result.plan.attractions.map(item => <article key={item.name}><strong>{item.name}</strong><span>{item.relevance}</span><p>{item.opportunity}</p></article>)}</section></div>
      <section className="revenue-actions"><header><div><small>ACTIONABLE PLAN</small><h3>{result.plan.actions.length} recommended actions</h3></div><span>Master approval required</span></header>{result.plan.actions.map((action, index) => <article key={`${action.title}-${index}`} className={`priority-${action.priority.toLowerCase()}`}><div className="revenue-action-number">{index + 1}</div><div className="revenue-action-body"><small>{action.dateRange} · {action.actionType}</small><h3>{action.title}</h3><p>{action.reason}</p><dl><div><dt>Current signal</dt><dd>{action.currentSignal}</dd></div><div><dt>Recommended action</dt><dd>{action.recommendation}</dd></div><div><dt>Measure success</dt><dd>{action.successMeasure}</dd></div></dl></div><span className="revenue-priority">{action.priority}</span></article>)}</section>
      {result.plan.risks.length > 0 && <section className="revenue-risks"><h3><TriangleAlert size={18}/> Risks and cautions</h3>{result.plan.risks.map(item => <p key={item}>{item}</p>)}</section>}
    </div>}
  </section>;
}
