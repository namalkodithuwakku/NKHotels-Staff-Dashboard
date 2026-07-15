"use client";

import { useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import Timeline from "../components/Timeline";
import LiveClock from "../components/LiveClock";
import Login from "../components/Login";
import { useAuth } from "../hooks/useAuth";
import { useTasks } from "../hooks/useTasks";
import { Task } from "../types/tasks";

function isDone(task: Task) {
  const status = (task.status || "").toLowerCase();
  return status.includes("done") || status.includes("completed");
}

function isUrgent(task: Task) {
  return (task.priority || "").toLowerCase() === "high" && !isDone(task);
}

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

export default function CompanyTaskCenterPage() {
  const { staff, ready, login, logout } = useAuth();

  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const access = String(staff?.access || "").trim().toLowerCase();
  const isMaster = access === "master";
  const isSupervisor = access === "supervisor";
  const hasAccess = isMaster || isSupervisor;

  const { last24Tasks, loading, error, reload } = useTasks(
    staff?.name,
    true,
    hasAccess
  );

  const filteredTasks = useMemo(() => {
    return last24Tasks
      .filter((task) => {
        const text = [
          task.id,
          task.status,
          task.type,
          task.source,
          task.property,
          task.bookingId,
          task.assignedTo,
          task.subject,
          task.notes,
        ]
          .join(" ")
          .toLowerCase();

        const searchOk = text.includes(search.toLowerCase());

        const statusOk =
          filter === "urgent"
            ? isUrgent(task)
            : statusMatch(task.status || "", filter);

        return searchOk && statusOk;
      })
      .sort(
        (a, b) =>
          getTaskTimeValue(b.createdTime) - getTaskTimeValue(a.createdTime)
      );
  }, [last24Tasks, filter, search]);

  if (!ready) return null;
  if (!staff) return <Login onLogin={login} />;

  if (!hasAccess) {
    return (
      <main className="os">
        <Sidebar staff={staff} onLogout={logout} shiftActive={false} />

        <section className="main">
          <header className="hero polished-hero">
            <div>
              <p>N K Hotel OS</p>
              <h1>Access Restricted</h1>
              <span className="sub">
                Company Task Center is available for Master and Supervisor access only.
              </span>
            </div>

            <div className="top-actions">
              <LiveClock />
              <div className="live-pill ended">
                <span></span>
                Team Access
              </div>
            </div>
          </header>
        </section>
      </main>
    );
  }

  return (
    <main className="os">
      <Sidebar staff={staff} onLogout={logout} shiftActive={true} />

      <section className="main">
        <header className="hero polished-hero">
          <div>
            <p>N K Hotel OS</p>
            <h1>Company Task Center</h1>
            <span className="sub">
              Manage company-wide operational tasks, assignments, and follow-ups.
            </span>
          </div>

          <div className="top-actions">
            <LiveClock />
            <div className="live-pill">
              <span></span>
              {isMaster ? "Master Access" : "Supervisor Access"}
            </div>
          </div>
        </header>

        <section className="metrics">
          <div className="metric urgent">
            <span>🚨 Urgent</span>
            <strong>{last24Tasks.filter(isUrgent).length}</strong>
          </div>

          <div className="metric new">
            <span>📋 Pending</span>
            <strong>
              {
                last24Tasks.filter((task) =>
                  (task.status || "").toLowerCase().includes("pending")
                ).length
              }
            </strong>
          </div>

          <div className="metric active">
            <span>🔵 Active</span>
            <strong>
              {
                last24Tasks.filter((task) =>
                  (task.status || "").toLowerCase().includes("progress")
                ).length
              }
            </strong>
          </div>

          <div className="metric done">
            <span>✅ Completed</span>
            <strong>{last24Tasks.filter(isDone).length}</strong>
          </div>
        </section>

        <section className="workspace">
          <div className="queue" style={{ width: "100%" }}>
            <div className="section-head">
              <div>
                <h2>All Company Tasks</h2>
                <p>
                  {loading
                    ? "Loading..."
                    : `${filteredTasks.length} of ${last24Tasks.length} tasks shown`}
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
                  placeholder="Property, staff, booking, note..."
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
                canWork={true}
              />
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}