"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, ExternalLink, LoaderCircle, Search, ShieldCheck } from "lucide-react";

type Property = { id: string; client_code: string; property_name: string; city?: string | null; country?: string | null; total_rooms?: number | null };
type Competitor = {
  name: string; location: string; propertyType: string; displayedRate: number | null; currency: string;
  mealPlan: string; cancellation: string; reviewScore: number | null; reviewCount: number | null;
  strongestAdvantage: string; weaknessOpportunity: string; rateVerified: boolean;
  confidence: "High" | "Medium" | "Low"; sourceUrl: string;
};
type Report = {
  title: string; executiveSummary: string; marketPosition: string; rateCurrency: string;
  hotelDisplayedRate: number | null; marketAverageRate: number | null;
  recommendedRateMin: number | null; recommendedRateMax: number | null; ratePositionNote: string;
  competitors: Competitor[]; keyFindings: string[];
  swot: { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] };
  actions: Array<{ rank: number; timeframe: string; impact: "High" | "Medium" | "Low"; title: string; action: string; reason: string }>;
  cautions: string[];
};
type Result = {
  reportId: string; property: Property; criteria: { checkIn: string; checkOut: string; adults: number; rooms: number };
  report: Report; sources: Array<{ title: string; url: string }>;
};

function isoDate(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

async function responseData(response: Response) {
  const text = await response.text();
  try { return JSON.parse(text); }
  catch { throw new Error(response.ok ? "The server returned an unreadable response." : `Request failed (${response.status}). Please try again.`); }
}

function money(value: number | null, currency: string) {
  return value === null ? "Not verified" : `${currency || ""} ${Math.round(value).toLocaleString()}`.trim();
}

export default function CompetitorAnalysisTool() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [checkIn, setCheckIn] = useState(isoDate(14));
  const [checkOut, setCheckOut] = useState(isoDate(15));
  const [adults, setAdults] = useState(2);
  const [rooms, setRooms] = useState(1);
  const [competitorCount, setCompetitorCount] = useState(5);
  const [objective, setObjective] = useState("Full market analysis");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    fetch("/api/reservation-tools/competitor-analysis")
      .then(responseData)
      .then(data => {
        if (!data.success) throw new Error(data.error || "Unable to load hotels.");
        setProperties(data.properties || []);
        if (data.properties?.[0]) setPropertyId(data.properties[0].id);
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : "Unable to load hotels."));
  }, []);

  const selectedProperty = useMemo(() => properties.find(property => property.id === propertyId), [properties, propertyId]);

  async function research(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/reservation-tools/competitor-analysis", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, checkIn, checkOut, adults, rooms, competitorCount, objective }),
      });
      const data = await responseData(response);
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to start competitor research.");
      if (!data.reportId) throw new Error("Research started without a report reference.");
      let completed: Result | null = null;
      for (let attempt = 0; attempt < 45; attempt++) {
        await new Promise(resolve => setTimeout(resolve, attempt === 0 ? 1500 : 4000));
        const progressResponse = await fetch(`/api/reservation-tools/competitor-analysis?reportId=${encodeURIComponent(data.reportId)}`, { cache: "no-store" });
        const progress = await responseData(progressResponse);
        if (!progressResponse.ok || !progress.success) throw new Error(progress.error || "Unable to check competitor research progress.");
        if (!progress.pending) { completed = progress as Result; break; }
      }
      if (!completed) throw new Error("Research is still processing. Please try again shortly.");
      setResult(completed);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to complete competitor research.");
    } finally { setLoading(false); }
  }

  return <div className="competitor-tool">
    <header className="competitor-intro">
      <div><small>LIVE MARKET INTELLIGENCE</small><h3>Competitor Analysis</h3><p>Find genuinely comparable hotels, validate public rates and turn the evidence into a short action plan.</p></div>
      <span><ShieldCheck size={18}/> Master only</span>
    </header>

    <form className="competitor-controls" onSubmit={research}>
      <label className="wide">Hotel<select value={propertyId} onChange={event => setPropertyId(event.target.value)} required>
        {properties.map(property => <option key={property.id} value={property.id}>{property.property_name} · {property.city || property.client_code}</option>)}
      </select></label>
      <label>Check-in<input type="date" value={checkIn} min={isoDate(0)} onChange={event => setCheckIn(event.target.value)} required/></label>
      <label>Check-out<input type="date" value={checkOut} min={checkIn} onChange={event => setCheckOut(event.target.value)} required/></label>
      <label>Adults<input type="number" min="1" max="20" value={adults} onChange={event => setAdults(Number(event.target.value))}/></label>
      <label>Rooms<input type="number" min="1" max="10" value={rooms} onChange={event => setRooms(Number(event.target.value))}/></label>
      <label>Competitors<select value={competitorCount} onChange={event => setCompetitorCount(Number(event.target.value))}>
        {[3, 5, 6, 8, 10].map(value => <option key={value} value={value}>{value}</option>)}
      </select></label>
      <label className="wide">Objective<select value={objective} onChange={event => setObjective(event.target.value)}>
        <option>Full market analysis</option><option>Improve occupancy</option><option>Protect average rate</option><option>Position against premium competitors</option><option>Find value competitors</option>
      </select></label>
      <button className="competitor-research" disabled={loading || !propertyId}>{loading ? <><LoaderCircle className="spin" size={19}/> Researching live market…</> : <><Search size={19}/> Research competitors</>}</button>
    </form>

    {selectedProperty && !result && !loading && <div className="competitor-ready"><Search size={30}/><h3>Ready to examine {selectedProperty.property_name}</h3><p>The report will use exact stay criteria, comparable properties and publicly verifiable evidence.</p></div>}
    {loading && <div className="competitor-loading"><LoaderCircle className="spin" size={34}/><h3>Building your market snapshot</h3><p>Checking comparable hotels, public rates, review signals and positioning. This normally takes under a minute.</p></div>}
    {error && <div className="competitor-error"><AlertTriangle size={19}/><span>{error}</span></div>}

    {result && <section className="competitor-report">
      <div className="competitor-report-head">
        <div><small>MARKET SNAPSHOT</small><h3>{result.report.title}</h3><p>{result.property.property_name} · {result.criteria.checkIn} to {result.criteria.checkOut} · {result.criteria.adults} guests · {result.criteria.rooms} room(s)</p></div>
        <a className="competitor-pdf" href={`/api/reservation-tools/competitor-analysis/pdf?reportId=${encodeURIComponent(result.reportId)}`}><Download size={18}/> Download 1–2 page PDF</a>
      </div>
      <div className="competitor-kpis">
        <article><small>MARKET POSITION</small><strong>{result.report.marketPosition}</strong><p>{result.report.ratePositionNote}</p></article>
        <article><small>MARKET AVERAGE</small><strong>{money(result.report.marketAverageRate, result.report.rateCurrency)}</strong><p>Verified public rates only</p></article>
        <article><small>RECOMMENDED RANGE</small><strong>{result.report.recommendedRateMin === null ? "Evidence limited" : `${money(result.report.recommendedRateMin, result.report.rateCurrency)}–${Math.round(result.report.recommendedRateMax || result.report.recommendedRateMin).toLocaleString()}`}</strong><p>Advisory starting range</p></article>
      </div>
      <article className="competitor-summary"><h4>Executive summary</h4><p>{result.report.executiveSummary}</p></article>

      <div className="competitor-table-wrap"><table className="competitor-table"><thead><tr><th>Comparable hotel</th><th>Public rate</th><th>Review</th><th>What makes it strong</th><th>Opportunity</th><th>Evidence</th></tr></thead><tbody>
        {result.report.competitors.map((competitor, index) => <tr key={`${competitor.name}-${index}`}>
          <td><strong>{competitor.name}</strong><small>{competitor.location} · {competitor.propertyType}</small></td>
          <td><strong>{money(competitor.displayedRate, competitor.currency || result.report.rateCurrency)}</strong><small>{competitor.mealPlan || "Meal plan unknown"} · {competitor.cancellation || "Terms unknown"}</small></td>
          <td>{competitor.reviewScore === null ? "Not verified" : <><strong>{competitor.reviewScore}</strong><small>{competitor.reviewCount ? `${competitor.reviewCount.toLocaleString()} reviews` : "Count unavailable"}</small></>}</td>
          <td>{competitor.strongestAdvantage}</td><td>{competitor.weaknessOpportunity}</td>
          <td><span className={competitor.rateVerified ? "verified" : "unverified"}>{competitor.rateVerified ? <CheckCircle2 size={14}/> : <AlertTriangle size={14}/>} {competitor.rateVerified ? "Rate verified" : competitor.confidence}</span>{competitor.sourceUrl && <a href={competitor.sourceUrl} target="_blank" rel="noreferrer">Open source <ExternalLink size={13}/></a>}</td>
        </tr>)}
      </tbody></table></div>

      <div className="competitor-insights">
        <article><h4>Three decisions that matter</h4><ol>{result.report.keyFindings.map(item => <li key={item}>{item}</li>)}</ol></article>
        <article><h4>Top 10 recommendations</h4>{result.report.actions.slice().sort((a, b) => (a.rank || 99) - (b.rank || 99)).map((action, index) => <div className="competitor-action" key={`${action.rank}-${action.title}`}>
          <b className="competitor-rank">{action.rank || index + 1}</b><span>{action.timeframe}</span><div><strong>{action.title}<em className={`impact-${String(action.impact || "Medium").toLowerCase()}`}>{action.impact || "Medium"} impact</em></strong><p>{action.action}</p><small>{action.reason}</small></div>
        </div>)}</article>
      </div>
      <div className="competitor-swot">
        {(["strengths","weaknesses","opportunities","threats"] as const).map(key => <article key={key}><h4>{key}</h4><ul>{result.report.swot[key].map(item => <li key={item}>{item}</li>)}</ul></article>)}
      </div>
      {(result.report.cautions.length > 0 || result.sources.length > 0) && <footer className="competitor-evidence">
        <div><h4>Research cautions</h4><ul>{result.report.cautions.map(item => <li key={item}>{item}</li>)}</ul></div>
        <div><h4>Sources</h4>{result.sources.slice(0, 10).map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}<ExternalLink size={12}/></a>)}</div>
      </footer>}
    </section>}
  </div>;
}
