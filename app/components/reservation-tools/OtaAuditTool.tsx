"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Download, FileSearch, UploadCloud, XCircle } from "lucide-react";

type Property = { id: string; client_code: string; property_name: string };
type Finding = {
  type: "matched" | "missing_dashboard" | "missing_ota" | "difference";
  severity: "ok" | "warning" | "critical";
  ota: null | { reference: string; guestName: string; checkIn: string; checkOut: string; roomCount: number; roomTypes: string[]; status: string };
  dashboard: null | Array<{ guest_name: string; check_in: string; check_out: string; room_name: string; booking_reference?: string }>;
  differences: string[];
  matchScore: number;
};
type Result = { auditId: string; summary: { total: number; matched: number; differences: number; cancellationIssues: number; missingDashboard: number; missingOta: number; from: string; to: string }; findings: Finding[] };
const labels = { matched: "Matched", difference: "Different", missing_dashboard: "Missing in Dashboard", missing_ota: "Missing in OTA" };
function csvValue(value: unknown) { return `"${String(value ?? "").replaceAll("\"", "\"\"")}"`; }

export default function OtaAuditTool() {
  const [properties, setProperties] = useState<Property[]>([]), [propertyId, setPropertyId] = useState("");
  const [otaSource, setOtaSource] = useState("Booking.com"), [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Result | null>(null), [filter, setFilter] = useState<"all" | Finding["type"]>("all");
  const [running, setRunning] = useState(false), [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/reservation-tools/audit", { cache: "no-store" }).then(async response => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load properties.");
      setProperties(payload.properties || []); setPropertyId(payload.properties?.[0]?.id || "");
    }).catch(reason => setError(reason instanceof Error ? reason.message : "Unable to load properties."));
  }, []);
  const visible = useMemo(() => result?.findings.filter(item => filter === "all" || item.type === filter) || [], [filter, result]);

  async function runAudit() {
    if (!propertyId || !file) return setError("Choose a property and upload an OTA file.");
    setRunning(true); setError(""); setResult(null);
    try {
      const body = new FormData();
      body.set("propertyId", propertyId); body.set("otaSource", otaSource); body.set("file", file);
      const response = await fetch("/api/reservation-tools/audit", { method: "POST", body });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Audit failed.");
      setResult(payload);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Audit failed."); }
    finally { setRunning(false); }
  }

  function downloadReport() {
    if (!result) return;
    const header = ["Finding","Severity","Reference","Guest","Check in","Check out","Differences"];
    const rows = result.findings.map(item => [labels[item.type], item.severity, item.ota?.reference || item.dashboard?.[0]?.booking_reference || "", item.ota?.guestName || item.dashboard?.[0]?.guest_name || "", item.ota?.checkIn || item.dashboard?.[0]?.check_in || "", item.ota?.checkOut || item.dashboard?.[0]?.check_out || "", item.differences.join(" | ")]);
    const blob = new Blob([[header, ...rows].map(row => row.map(csvValue).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `NKH-OTA-Audit-${new Date().toISOString().slice(0,10)}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }

  return <section className="reservation-tools">
    <header className="reservation-tools-hero"><div><small>RESERVATION CONTROL</small><h2>OTA booking audit</h2><p>Compare complete OTA reservations against the property calendar—including multi-room and multi-night stays.</p></div>{result && <button className="audit-download" onClick={downloadReport}><Download size={17}/> Download report</button>}</header>
    <div className="audit-setup">
      <label><span>Property</span><select value={propertyId} onChange={event => setPropertyId(event.target.value)}>{properties.map(property => <option value={property.id} key={property.id}>{property.property_name} · {property.client_code}</option>)}</select></label>
      <label><span>OTA source</span><select value={otaSource} onChange={event => setOtaSource(event.target.value)}>{["Booking.com","Agoda","Expedia","Airbnb","Other OTA"].map(value => <option key={value}>{value}</option>)}</select></label>
      <button className={`audit-dropzone ${file ? "ready" : ""}`} type="button" onClick={() => inputRef.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); setFile(event.dataTransfer.files[0] || null); }}>
        <input ref={inputRef} hidden type="file" accept=".pdf,.csv,.xlsx,.xls" onChange={event => setFile(event.target.files?.[0] || null)}/><UploadCloud size={22}/><span>{file ? file.name : "Upload OTA PDF, CSV or Excel"}</span><small>{file ? `${(file.size / 1024).toFixed(0)} KB · ready` : "Click or drop the export here · maximum 20 MB"}</small>
      </button>
      <button className="audit-run" disabled={running || !file || !propertyId} onClick={runAudit}><FileSearch size={18}/>{running ? "Reading and comparing…" : "Run booking audit"}</button>
    </div>
    {error && <div className="audit-error"><XCircle size={18}/>{error}</div>}
    {!result && !running && <div className="audit-empty"><FileSearch/><h3>Ready for the first OTA audit</h3><p>Export a reservation list for one property and date range. The file is read for this audit and is not retained.</p></div>}
    {running && <div className="audit-processing"><i/><h3>Building the reservation groups</h3><p>Reading references, guests, dates, room allocations and statuses, then checking the calendar.</p></div>}
    {result && <div className="audit-results">
      <div className="audit-scorecards audit-scorecards-five">
        <article className="total"><small>OTA RESERVATIONS</small><strong>{result.summary.total}</strong><span>{result.summary.from} → {result.summary.to}</span></article>
        <article className="good"><small>FULLY MATCHED</small><strong>{result.summary.matched}</strong><span>No difference found</span></article>
        <article className="warn"><small>DETAIL DIFFERENCES</small><strong>{result.summary.differences}</strong><span>Dates, rooms or status</span></article>
        <article className="cancel bad"><small>CANCELLATION ALERTS</small><strong>{result.summary.cancellationIssues || 0}</strong><span>Needs immediate verification</span></article>
        <article className="bad"><small>MISSING</small><strong>{result.summary.missingDashboard + result.summary.missingOta}</strong><span>One side only</span></article>
      </div>
      <nav className="audit-filters">{(["all","difference","missing_dashboard","missing_ota","matched"] as const).map(value => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value === "all" ? "All results" : labels[value]}</button>)}</nav>
      <div className="audit-finding-list">{visible.map((item, index) => {
        const guest = item.ota?.guestName || item.dashboard?.[0]?.guest_name || "Unknown guest";
        const reference = item.ota?.reference || item.dashboard?.[0]?.booking_reference || "No reference";
        const stay = `${item.ota?.checkIn || item.dashboard?.[0]?.check_in || "—"} → ${item.ota?.checkOut || item.dashboard?.[0]?.check_out || "—"}`;
        return <article key={`${reference}-${index}`} className={`audit-finding ${item.severity}`}><span className="audit-finding-icon">{item.type === "matched" ? <CheckCircle2/> : <XCircle/>}</span><div className="audit-finding-main"><small>{labels[item.type]}</small><h3>{guest}</h3><p>{reference} · {stay}</p>{item.differences.map(value => <em key={value}>{value}</em>)}</div><div className="audit-allocation"><small>OTA</small><strong>{item.ota ? `${item.ota.roomCount} room${item.ota.roomCount === 1 ? "" : "s"}` : "Not listed"}</strong><span>{item.ota?.roomTypes.join(", ") || "—"}</span></div><div className="audit-allocation"><small>DASHBOARD</small><strong>{item.dashboard ? `${item.dashboard.length} room${item.dashboard.length === 1 ? "" : "s"}` : "Not found"}</strong><span>{item.dashboard?.map(row => row.room_name).join(", ") || "—"}</span></div></article>;
      })}</div>
    </div>}
  </section>;
}
