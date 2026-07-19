"use client";

import { useMemo, useState } from "react";
import Timeline from "../../components/Timeline";
import { Task } from "../../types/tasks";

function isUrgent(task: Task) {
  const status = (task.status || "").toLowerCase();
  const done = status.includes("done") || status.includes("completed");

  return (task.priority || "").toLowerCase() === "high" && !done;
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

export default function CompanyActivity({
  tasks,
  staffName,
  loading,
  error,
  onReload,
}: {
  tasks: Task[];
  staffName: string;
  loading: boolean;
  error: string;
  onReload: () => void;
}) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

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
  }, [tasks, filter, search]);

  return (
    <div className="queue">
      <div className="section-head">
        <div>
          <h2>Company Activity</h2>
          <p>
            {loading
              ? "Loading..."
              : `${filteredTasks.length} of ${tasks.length} tasks shown`}
          </p>
        </div>

        <button className="ghost" onClick={onReload}>
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
            placeholder="Property, staff, booking..."
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
          staffName={staffName}
          onChanged={onReload}
          canWork={true}
        />
      </div>
    </div>
  );
}