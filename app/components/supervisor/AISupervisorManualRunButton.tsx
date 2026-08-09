"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";

export default function AISupervisorManualRunButton() {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);

  async function runNow() {
    if (running) return;
    setRunning(true);
    setMessage("Scanning recent emails…");
    setOk(null);
    try {
      const response = await fetch("/api/supervisor/run", { method: "POST", cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(payload?.error || `Run failed (${response.status})`));

      const scanned = Number(payload?.scanned || 0);
      const actionable = Number(payload?.actionable || 0);
      const created = Number(payload?.created || 0);
      const duplicates = Number(payload?.duplicates || 0);
      const failed = Number(payload?.failed || 0);
      setOk(failed === 0);
      setMessage(`Scanned ${scanned} · Actionable ${actionable} · Created ${created} · Existing ${duplicates}${failed ? ` · Failed ${failed}` : ""}`);
    } catch (error) {
      setOk(false);
      setMessage(error instanceof Error ? error.message : "Manual run failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="ai-supervisor-manual-run">
      <button type="button" className="ai-supervisor-next" onClick={runNow} disabled={running}>
        <RefreshCw size={16} className={running ? "ai-supervisor-spin" : ""} />
        {running ? "Running…" : "Run supervisor now"}
      </button>
      {message && <small data-state={ok === null ? "running" : ok ? "ok" : "error"}>{message}</small>}
    </div>
  );
}
