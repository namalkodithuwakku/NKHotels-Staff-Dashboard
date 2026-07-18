"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
import { updateTaskStatus } from "../../lib/api";

export default function ShiftTasks({ tasks, staffName, canUseTasks, loading, error, onCreate, onRefresh }: any) {
  const [filter, setFilter] = useState("open");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const shown = useMemo(() => tasks.filter((task: any) => {
    const status = String(task.status || "").toLowerCase();
    const done = status.includes("done") || status.includes("completed");
    const active = status.includes("progress");
    const filterOk = filter === "all" || (filter === "open" && !done) || (filter === "active" && active) || (filter === "done" && done);
    return filterOk && [task.subject, task.notes, task.property, task.type].join(" ").toLowerCase().includes(search.toLowerCase());
  }), [tasks, filter, search]);
  async function change(id: string, status: string) {
    try { setBusy(id); await updateTaskStatus(id, status, staffName); await onRefresh(); } finally { setBusy(""); }
  }
  return <div className="tasks-workspace">
    <div className="workspace-tools"><div className="segmented">{[["open","Open"],["active","In Progress"],["done","Done"],["all","All"]].map(([key,label]) => <button className={filter === key ? "active" : ""} key={key} onClick={() => setFilter(key)}>{label}</button>)}</div><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks or properties"/><button className="primary-action" onClick={onCreate}>＋ Create Task</button></div>
    {error && <p className="workspace-error">{error}</p>}
    {loading ? <div className="workspace-empty">Loading shift tasks…</div> : shown.length === 0 ? <div className="workspace-empty"><strong>No tasks here</strong><p>The queue is clear for this view.</p></div> : <div className="task-list">{shown.map((task: any) => {
      const status = String(task.status || "").toLowerCase(); const done = status.includes("done") || status.includes("completed"); const active = status.includes("progress"); const urgent = ["high","urgent","critical"].includes(String(task.priority || "").toLowerCase());
      return <article className={`shift-task ${urgent ? "urgent" : ""}`} key={task.id}><div className="task-state"><span className={done ? "done" : active ? "active" : "pending"}/></div><div className="task-main"><div><strong>{task.subject || task.type || "Operational task"}</strong><span className={`status-chip ${done ? "green" : active ? "blue" : urgent ? "red" : "amber"}`}>{done ? "Done" : active ? "In Progress" : urgent ? "Urgent" : "Pending"}</span></div><p>{task.property || "General"} · {task.type || task.source || "Manual"}</p><small>{task.notes || "No additional notes"}</small></div><div className="task-owner"><small>OWNER</small><strong>{task.assignedTo || "Unassigned"}</strong></div><div className="task-actions">{!done && !active && <button disabled={!canUseTasks || busy === task.id} onClick={() => change(task.id, "In Progress")}>Start</button>}{active && <button className="done-button" disabled={!canUseTasks || busy === task.id} onClick={() => change(task.id, "Done")}>Mark Done</button>}{done && <span>✓ Completed</span>}</div></article>})}</div>}
  </div>;
}
