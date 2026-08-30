"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, History, MailCheck, RefreshCw, SearchX } from "lucide-react";

type AuditItem = {
  id: string; property_name: string | null; ota_source: string | null;
  event_type: "New Booking" | "Modified Booking" | "Cancelled Booking";
  booking_reference: string | null; email_received_at: string; due_at: string;
  audit_status: "Waiting" | "Verified" | "Needs Staff Action" | "Unable to Match";
  severity: "Normal" | "High" | "Urgent"; match_confidence: number; findings: string[];
};

type HistoryDays = 7 | 30 | 90 | 180 | 365;

const historyOptions: Array<{ days: HistoryDays; label: string }> = [
  { days: 7, label: "7 Days" },
  { days: 30, label: "30 Days" },
  { days: 90, label: "3 Months" },
  { days: 180, label: "6 Months" },
  { days: 365, label: "1 Year" },
];

const statusLabel: Record<AuditItem["audit_status"], string> = {
  Waiting: "Waiting for staff", Verified: "Verified", "Needs Staff Action": "Urgent action", "Unable to Match": "Check manually",
};

export default function LiveReservationAuditTool() {
  const [items, setItems] = useState<AuditItem[]>([]), [loading, setLoading] = useState(true), [running, setRunning] = useState(false);
  const [historicalRunning, setHistoricalRunning] = useState(false), [historyDays, setHistoryDays] = useState<HistoryDays>(30);
  const [error, setError] = useState(""), [filter, setFilter] = useState<"attention" | "all" | AuditItem["audit_status"]>("all");
  const [runSummary, setRunSummary] = useState("");
  const [runStage, setRunStage] = useState("");
  const busy = running || historicalRunning;

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/reservation-audit", { cache: "no-store" }), payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load reservation audit.");
      setItems(payload.items || []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load reservation audit."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function runAudit() {
    setRunning(true); setError(""); setRunSummary(""); setRunStage("Connecting to Gmail and importing recent OTA emails…");
    try {
      const response = await fetch("/api/reservation-audit", { method: "POST" }), payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Reservation audit failed.");
      const summary = `${payload.imported || 0} recent OTA emails imported · ${payload.emailsScanned || 0} inbox emails scanned · ${payload.reservationEmailsFound || 0} reservation events found${payload.gmailWarning ? ` · Gmail warning: ${payload.gmailWarning}` : ""}`;
      setRunSummary(summary);
      setRunStage("");
      await load();
      window.alert(`Reservation audit completed\n\n${summary}`);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Reservation audit failed.";
      setError(message); setRunStage("");
      window.alert(`Reservation audit could not run\n\n${message}`);
    }
    finally { setRunning(false); setRunStage(""); }
  }

  async function runHistoricalAudit() {
    setHistoricalRunning(true); setError(""); setRunSummary("");
    const selected = historyOptions.find(option => option.days === historyDays)?.label || `${historyDays} Days`;
    const totals = { scanned: 0, candidates: 0, imported: 0, audited: 0, verified: 0, attention: 0, unable: 0, skipped: 0 };
    let pageToken: string | null = null;
    let batches = 0;

    try {
      do {
        setRunStage(`Historical audit · ${selected} · ${totals.scanned} Gmail messages checked so far…`);
        const historyResponse = await fetch("/api/reservation-audit/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ days: historyDays, pageToken }),
        });
        const payload = await historyResponse.json();
        if (!historyResponse.ok) throw new Error(payload.error || "Historical reservation audit failed.");

        totals.scanned += Number(payload.scanned || 0);
        totals.candidates += Number(payload.candidates || 0);
        totals.imported += Number(payload.imported || 0);
        totals.audited += Number(payload.audited || 0);
        totals.verified += Number(payload.verified || 0);
        totals.attention += Number(payload.attention || 0);
        totals.unable += Number(payload.unable || 0);
        totals.skipped += Number(payload.skipped || 0);
        pageToken = payload.nextPageToken || null;
        batches += 1;
      } while (pageToken && batches < 200);

      if (pageToken) throw new Error("Historical audit reached its safety batch limit before Gmail finished. Run the same period again to continue checking already imported messages.");

      const summary = `${selected} historical audit complete · ${totals.scanned} Gmail messages scanned · ${totals.candidates} reservation emails found · ${totals.imported} newly imported · ${totals.audited} calendar checks · ${totals.verified} verified · ${totals.attention} need attention${totals.unable ? ` · ${totals.unable} manual checks` : ""}`;
      setRunSummary(summary);
      setRunStage("");
      await load();
      window.alert(`Historical reservation audit completed\n\n${summary}`);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Historical reservation audit failed.";
      setError(message); setRunStage("");
      window.alert(`Historical reservation audit could not complete\n\n${message}`);
    }
    finally { setHistoricalRunning(false); setRunStage(""); }
  }

  const counts = useMemo(() => ({
    waiting: items.filter(item => item.audit_status === "Waiting").length,
    verified: items.filter(item => item.audit_status === "Verified").length,
    urgent: items.filter(item => item.audit_status === "Needs Staff Action").length,
    unable: items.filter(item => item.audit_status === "Unable to Match").length,
  }), [items]);
  const visible = useMemo(() => items.filter(item => filter === "all" || (filter === "attention" ? ["Needs Staff Action", "Unable to Match"].includes(item.audit_status) : item.audit_status === filter)), [filter, items]);

  function calendarResult(item: AuditItem) {
    if (item.audit_status === "Waiting") return "Waiting for calendar update";
    if (item.audit_status === "Unable to Match") return "Manual calendar check required";
    if (item.audit_status === "Needs Staff Action") {
      if (item.event_type === "New Booking") return "Not marked on calendar";
      if (item.event_type === "Modified Booking") return "Modification not updated";
      return "Cancellation still on calendar";
    }
    if (item.event_type === "New Booking") return "Marked on calendar";
    if (item.event_type === "Modified Booking") return "Modification updated";
    return "Cancellation removed";
  }

  return <section className="reservation-tools live-reservation-audit">
    <header className="reservation-tools-hero"><div><small>EMAIL + CALENDAR CONTROL</small><h2>Reservation audit</h2><p>Shows detected OTA reservation emails and confirms whether the matching connected NKH calendar action is complete.</p></div><button className="audit-download" onClick={runAudit} disabled={busy}><RefreshCw size={17} className={running ? "audit-rotating" : ""}/>{running ? "Checking…" : "Run live audit"}</button></header>

    <div style={{ margin: "16px 0 18px", padding: 18, border: "1px solid #eadcc7", borderRadius: 18, background: "#fffaf3" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ minWidth: 240 }}><small style={{ display: "block", fontWeight: 800, letterSpacing: ".08em", color: "#9a5b09", marginBottom: 5 }}>HISTORICAL EMAIL AUDIT</small><strong style={{ display: "block", fontSize: 18 }}>Check reservation history up to one year</strong><span style={{ display: "block", marginTop: 5, color: "#6c6257", fontSize: 14 }}>Manual deep check. Gmail is processed in small batches and only properties with a connected NKH calendar are audited.</span></div>
        <button className="audit-download" onClick={runHistoricalAudit} disabled={busy}><History size={17}/>{historicalRunning ? "Checking history…" : "Run historical audit"}</button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        {historyOptions.map(option => <button key={option.days} type="button" disabled={busy} onClick={() => setHistoryDays(option.days)} style={{ border: historyDays === option.days ? "1px solid #d47a0b" : "1px solid #ded7ce", background: historyDays === option.days ? "#fff0d8" : "#fff", color: historyDays === option.days ? "#8b4d00" : "#4d463f", borderRadius: 999, padding: "9px 14px", fontWeight: 750, cursor: busy ? "not-allowed" : "pointer" }}>{option.label}</button>)}
      </div>
    </div>

    {error && <div className="audit-error"><AlertTriangle size={18}/>{error}</div>}
    {runStage && <div className="audit-error" style={{ borderColor: "#f0b35b", background: "#fff8ec", color: "#74430b" }}><RefreshCw size={18} className="audit-rotating"/><strong>{runStage}</strong></div>}
    {runSummary && <div className="audit-error" style={{ borderColor: "#9ccfc2", background: "#effaf7", color: "#165b4d" }}><MailCheck size={18}/>{runSummary}</div>}
    <div className="audit-scorecards"><article className="warn"><small>WAITING</small><strong>{counts.waiting}</strong><span>Inside grace period</span></article><article className="good"><small>VERIFIED</small><strong>{counts.verified}</strong><span>Calendar is correct</span></article><article className="bad"><small>URGENT ISSUES</small><strong>{counts.urgent}</strong><span>Calendar not updated</span></article><article><small>MANUAL CHECK</small><strong>{counts.unable}</strong><span>Match needs confirmation</span></article></div>
    <nav className="audit-filters">{(["attention","Waiting","Verified","Needs Staff Action","Unable to Match","all"] as const).map(value => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value === "attention" ? "Needs attention" : value === "all" ? "All emails" : statusLabel[value]}</button>)}</nav>
    {loading ? <div className="audit-processing"><i/><h3>Loading reservation checks</h3></div> : !visible.length ? <div className="audit-empty"><MailCheck/><h3>No reservation emails found</h3><p>Run the live audit or choose a historical period above.</p></div> : <div className="live-audit-list">{visible.map(item => { const Icon = item.audit_status === "Verified" ? CheckCircle2 : item.audit_status === "Waiting" ? Clock3 : item.audit_status === "Unable to Match" ? SearchX : AlertTriangle; return <article key={item.id} className={`live-audit-item ${item.audit_status.toLowerCase().replaceAll(" ", "-")}`}><i><Icon size={20}/></i><div><small>{item.event_type} · {item.ota_source || "OTA email"}</small><h3>{item.property_name || "Property not identified"}</h3><p>{item.booking_reference ? `Booking ${item.booking_reference}` : "No confirmation number detected"} · Email {new Date(item.email_received_at).toLocaleString()}</p></div><strong>{calendarResult(item)}</strong><ul>{(item.findings || []).map(finding => <li key={finding}>{finding}</li>)}</ul></article>; })}</div>}
  </section>;
}
