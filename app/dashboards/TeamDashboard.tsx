"use client";

import { useMemo, useState } from "react";
import { createTask } from "../lib/api";

import Sidebar from "../components/Sidebar";
import Stats from "../components/Stats";
import Timeline from "../components/Timeline";
import AIPanel from "../components/AIPanel";
import LiveClock from "../components/LiveClock";

import { useTasks } from "../hooks/useTasks";
import { useShift } from "../hooks/useShift";
import { StaffSession } from "../hooks/useAuth";

const quickActions = [
  "Phone Call",
  "WhatsApp Request",
  "Calendar Update",
  "Room Close",
  "Rate Update",
  "Booking",
  "Guest Message",
  "OTA Issue",
  "Other",
];

function statusMatch(status: string, filter: string) {
  const s = status.toLowerCase();
  if (filter === "all") return true;
  if (filter === "pending") return s.includes("pending");
  if (filter === "progress") return s.includes("progress");
  if (filter === "done") return s.includes("done") || s.includes("completed");
  return true;
}

function getTaskTimeValue(createdTime?: string) {
  if (!createdTime) return 0;
  const direct = new Date(createdTime).getTime();
  if (!Number.isNaN(direct)) return direct;

  const match = createdTime.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (!match) return 0;

  const [, dd, mm, yyyy, hh, min] = match;
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min)).getTime();
}

export default function TeamDashboard({
  staff,
  onLogout,
}: {
  staff: StaffSession;
  onLogout: () => void;
}) {
  const { shift } = useShift(staff.name);
  const canWork = shift?.canWork === true;

  const { tasks, loading, error, reload } = useTasks(
    staff.name,
    canWork,
    false,
    shift?.scheduledStart,
    shift?.scheduledEnd
  );

  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickType, setQuickType] = useState("WhatsApp Request");
  const [quickProperty, setQuickProperty] = useState("");
  const [quickNote, setQuickNote] = useState("");

  const shiftStatus = shift?.status || "Checking";
  const nextShift = shift?.nextShift || "";

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((task) => {
        const text = [
          task.id,
          task.status,
          task.type,
          task.source,
          task.property,
          task.bookingId,
          task.subject,
          task.notes,
        ]
          .join(" ")
          .toLowerCase();

        const searchOk = text.includes(search.toLowerCase());
        const statusOk =
          filter === "urgent"
            ? (task.priority || "").toLowerCase() === "high"
            : statusMatch(task.status || "", filter);

        return searchOk && statusOk;
      })
      .sort((a, b) => getTaskTimeValue(b.createdTime) - getTaskTimeValue(a.createdTime));
  }, [tasks, filter, search]);

  function createQuickTask() {
    alert("Quick Action UI is ready. Backend save will be connected next.");
  }

  return (
    <main className="os">
      <Sidebar staff={staff} onLogout={onLogout} shiftActive={canWork} />

      <section className="main">
        <header className="hero polished-hero">
          <div>
            <p>N K Hotel OS</p>
            <h1>OPERATIONS DASHBOARD</h1>
            <span className="sub">
              {canWork
                ? `Good Day, ${staff.name} · ${shift?.shift || "Active Shift"} • Running Normally`
                : nextShift
                ? `Good Day, ${staff.name} · View Only • Next Shift: ${nextShift}`
                : `Good Day, ${staff.name} · View Only • ${shiftStatus}`}
            </span>
          </div>

          <div className="top-actions">
            <LiveClock />
            <div className={canWork ? "live-pill" : "live-pill ended"}>
              <span></span>
              {canWork ? "Shift Active" : "View Only"}
            </div>
          </div>
        </header>

        <Stats tasks={tasks} />

        <section className="workspace">
          <div className="queue">
            <div className="section-head">
              <div>
                <h2>Live Operations</h2>
                <p>
                  {loading
                    ? "Loading..."
                    : `${filteredTasks.length} of ${tasks.length} tasks shown`}
                </p>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button className="ghost" onClick={() => setQuickOpen(true)}>
                  ⚡ Quick Action
                </button>
                <button className="ghost" onClick={reload}>
                  Refresh
                </button>
              </div>
            </div>

            <div className="premium-toolbar compact-toolbar">
              <div className="premium-tabs">
                {[
                  ["all", "All"],
                  ["urgent", "Urgent"],
                  ["pending", "Pending"],
                  ["progress", "Active"],
                  ["done", "Done"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    className={filter === key ? "premium-tab active" : "premium-tab"}
                    onClick={() => setFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="premium-search-wrap compact-search">
                <span>Search</span>
                <input
                  className="premium-search"
                  placeholder="Property, guest, booking..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {error && <div className="brief-item red">{error}</div>}

            {!loading && filteredTasks.length === 0 && (
              <div className="brief-item blue">No matching tasks found.</div>
            )}

            <div className="timeline-scroll">
              <Timeline
                tasks={filteredTasks}
                staffName={staff.name}
                onChanged={reload}
                canWork={canWork}
              />
            </div>
          </div>

          <AIPanel tasks={filteredTasks} shiftActive={canWork} shift={shift} />
        </section>
      </section>

      {quickOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(10px)",
            display: "grid",
            placeItems: "center",
            zIndex: 999,
            padding: 20,
          }}
        >
          <div className="glass-card" style={{ width: "min(560px, 100%)" }}>
            <div className="section-head">
              <div>
                <h2>Quick Action</h2>
                <p>Create a task in a few seconds.</p>
              </div>
              <button className="ghost" onClick={() => setQuickOpen(false)}>
                Close
              </button>
            </div>

            <div className="brief-grid" style={{ marginTop: 14 }}>
              {quickActions.map((item) => (
                <button
                  key={item}
                  className={
                    quickType === item ? "brief-item blue" : "brief-item"
                  }
                  onClick={() => setQuickType(item)}
                  style={{ cursor: "pointer", textAlign: "left" }}
                >
                  {item}
                </button>
              ))}
            </div>

            <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
              <input
                className="premium-search"
                placeholder="Property name"
                value={quickProperty}
                onChange={(e) => setQuickProperty(e.target.value)}
              />

              <input
                className="premium-search"
                placeholder="Short note, example: Close Deluxe room tomorrow"
                value={quickNote}
                onChange={(e) => setQuickNote(e.target.value)}
              />

              <button
                className="ghost"
                onClick={createQuickTask}
                disabled={!quickProperty.trim()}
              >
                Create {quickType}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}