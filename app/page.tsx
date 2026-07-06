"use client";

import { useMemo, useState } from "react";
import Sidebar from "./components/Sidebar";
import Stats from "./components/Stats";
import Timeline from "./components/Timeline";
import AIPanel from "./components/AIPanel";
import LiveClock from "./components/LiveClock";
import Login from "./components/Login";
import { useTasks } from "./hooks/useTasks";
import { useAuth } from "./hooks/useAuth";
import { useShift } from "./hooks/useShift";

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

  const match = createdTime.match(
    /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/
  );

  if (!match) return 0;

  const [, dd, mm, yyyy, hh, min] = match;

  return new Date(
    Number(yyyy),
    Number(mm) - 1,
    Number(dd),
    Number(hh),
    Number(min)
  ).getTime();
}

export default function Home() {
  const { staff, ready, login, logout } = useAuth();

  const { shift } = useShift(staff?.name);
  const canWork = shift?.canWork === true;

  const { tasks, loading, error, reload } = useTasks(staff?.name, canWork);

  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

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
      .sort(
        (a, b) =>
          getTaskTimeValue(b.createdTime) - getTaskTimeValue(a.createdTime)
      );
  }, [tasks, filter, search]);

  if (!ready) return null;
  if (!staff) return <Login onLogin={login} />;

  return (
    <main className="os">
      <Sidebar staff={staff} onLogout={logout} shiftActive={canWork} />

      <section className="main">
        <header className="hero polished-hero">
          <div>
            <p>Good Day, {staff.name}</p>
            <h1>{canWork ? "Today’s tasks are live." : "View your work status."}</h1>
            <span className="sub">
              {canWork
                ? `You are on shift · ${shift?.shift || ""}`
                : nextShift
                ? `Current status: ${shiftStatus} · Next shift: ${nextShift}`
                : `Current status: ${shiftStatus}`}
            </span>
          </div>

          <div className="top-actions">
            <LiveClock />
            <div className={canWork ? "live-pill" : "live-pill ended"}>
              <span></span>
              {canWork ? "Shift ON" : shiftStatus}
            </div>
          </div>
        </header>

        <Stats tasks={tasks} />

        <section className="workspace">
          <div className="queue">
            <div className="section-head">
              <div>
                <h2>Task Timeline</h2>
                <p>
                  {loading
                    ? "Loading..."
                    : `${filteredTasks.length} of ${tasks.length} tasks shown`}
                </p>
              </div>

              <button className="ghost" onClick={reload}>
                Refresh
              </button>
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
                  placeholder="Property, booking ID..."
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
    </main>
  );
}