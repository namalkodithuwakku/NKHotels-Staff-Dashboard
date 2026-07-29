"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpenCheck, CalendarDays, Clock3, RefreshCw } from "lucide-react";

type ScheduledItem = {
  id: string;
  date: string;
  type: "Daily" | "Monthly Exam";
  title: string;
  courseName: string;
  staffName: string;
  questionCount: number;
  durationMinutes: number;
  status: string;
  released: boolean;
};

const tabs = ["Today", "Tomorrow", "This Week", "Later", "Monthly Exams"] as const;
type Tab = typeof tabs[number];

function localDate(offset = 0) {
  const value = new Date();
  value.setDate(value.getDate() + offset);
  return value.toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" });
}

function prettyDate(value: string) {
  return new Date(`${value}T12:00:00+05:30`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function ScheduledTasks({ onCreate }: { onCreate: () => void }) {
  const [tab, setTab] = useState<Tab>("Today");
  const [items, setItems] = useState<ScheduledItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/scheduled-tasks", { cache: "no-store" });
      const value = await response.json();
      if (!response.ok || !value.success) throw new Error(value.error || "Unable to load scheduled tasks.");
      setItems(value.items || []);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load scheduled tasks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const today = localDate();
    const tomorrow = localDate(1);
    const weekEnd = localDate(7);
    return items.filter(item => {
      if (tab === "Today") return item.date === today;
      if (tab === "Tomorrow") return item.date === tomorrow;
      if (tab === "This Week") return item.date > tomorrow && item.date <= weekEnd;
      if (tab === "Later") return item.date > weekEnd;
      return item.type === "Monthly Exam";
    });
  }, [items, tab]);

  const examCount = items.filter(item => item.type === "Monthly Exam").length;

  return <div className="scheduled-workspace academy-schedule-workspace">
    <div className="workspace-tools scheduled-toolbar">
      <div className="segmented">{tabs.map(item =>
        <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>
          {item}{item === "Monthly Exams" && examCount > 0 ? ` (${examCount})` : ""}
        </button>
      )}</div>
      <button className="scheduled-refresh" onClick={() => void load()} disabled={loading} title="Refresh schedule">
        <RefreshCw className={loading ? "spinning" : ""}/>
      </button>
      <button className="primary-action" onClick={onCreate}>＋ Create Task</button>
    </div>

    <section className="scheduled-summary">
      <div><CalendarDays/><span><strong>{items.length}</strong>upcoming Academy assignments</span></div>
      <div><BookOpenCheck/><span><strong>{examCount}</strong>monthly exams prepared</span></div>
      <p>Lessons are prepared from the roster and released to Shift Tasks only on the scheduled working day.</p>
    </section>

    {error && <div className="workspace-error">{error}</div>}

    {loading && !items.length ? <div className="workspace-empty scheduled-empty">
      <RefreshCw className="spinning"/><strong>Preparing the schedule…</strong>
    </div> : filtered.length ? <div className="scheduled-card-list">
      {filtered.map(item => <article key={item.id} className={item.type === "Monthly Exam" ? "exam" : ""}>
        <div className="scheduled-date"><small>{item.date === localDate() ? "TODAY" : item.type === "Monthly Exam" ? "EXAM" : "LEARNING"}</small><strong>{prettyDate(item.date)}</strong></div>
        <div className="scheduled-main"><span>{item.type}</span><h3>{item.title}</h3><p>Assigned to <strong>{item.staffName}</strong></p></div>
        <div className="scheduled-details"><span><BookOpenCheck/>{item.questionCount} questions</span><span><Clock3/>{item.durationMinutes} minutes</span></div>
        <b className={item.released ? "released" : ""}>{item.released ? "Released" : "Scheduled"}</b>
      </article>)}
    </div> : <div className="workspace-empty scheduled-empty">
      <span>◷</span><strong>No scheduled work for {tab.toLowerCase()}</strong>
      <p>Academy assignments appear automatically after the roster is prepared.</p>
    </div>}
  </div>;
}
