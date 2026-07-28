"use client";
import { useEffect } from "react";
export default function PresenceHeartbeat({ currentView }: { currentView: string }) {
  useEffect(() => {
    let stopped = false;
    async function beat() {
      if (stopped) return;
      try { await fetch("/api/presence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current_view: currentView, visibility_state: document.visibilityState === "visible" ? "Visible" : "Hidden" }), keepalive: true }); } catch {}
    }
    void beat();
    const timer = window.setInterval(beat, 60000);
    const runAlerts = () => { void fetch("/api/notifications/run", { method: "POST" }).catch(() => undefined); };
    runAlerts();
    const alertTimer = window.setInterval(runAlerts, 300000);
    const activity = () => { if (document.visibilityState === "visible") void beat(); };
    document.addEventListener("visibilitychange", activity); window.addEventListener("focus", activity);
    return () => { stopped = true; window.clearInterval(timer); window.clearInterval(alertTimer); document.removeEventListener("visibilitychange", activity); window.removeEventListener("focus", activity); };
  }, [currentView]);
  return null;
}
