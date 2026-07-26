"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
import { Check, CheckSquare2, MinusSquare, Square } from "lucide-react";
import { updateTaskStatus } from "../../lib/api";

export default function ShiftTasks({ tasks, staffName, canUseTasks, loading, error, onCreate, onRefresh }: any) {
  const [filter, setFilter] = useState("open");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [actionError, setActionError] = useState("");
  const shown = useMemo(() => tasks.filter((task: any) => {
    const status = String(task.status || "").toLowerCase();
    const done = status.includes("done") || status.includes("completed");
    const active = status.includes("progress");
    const filterOk = filter === "all" || (filter === "open" && !done) || (filter === "active" && active) || (filter === "done" && done);
    return filterOk && [task.subject, task.notes, task.property, task.type].join(" ").toLowerCase().includes(search.toLowerCase());
  }), [tasks, filter, search]);
  const visibleIds = shown.map((task: any) => String(task.id));
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id: string) => selectedIds.includes(id));
  const someVisibleSelected = visibleIds.some((id: string) => selectedIds.includes(id));

  function toggleSelected(id: string) {
    setSelectedIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  }

  function toggleAllVisible() {
    setSelectedIds(current => allVisibleSelected
      ? current.filter(id => !visibleIds.includes(id))
      : Array.from(new Set([...current, ...visibleIds])));
  }

  async function change(id: string, status: string) {
    try {
      setBusy(id);
      setActionError("");
      await updateTaskStatus(id, status, staffName);
      await onRefresh();
    } catch (error: any) {
      setActionError(error?.message || "Unable to update the task.");
    } finally { setBusy(""); }
  }

  async function bulkChange(status: "In Progress" | "Done") {
    const eligible = shown.filter((task: any) => {
      if (!selectedIds.includes(String(task.id))) return false;
      const current = String(task.status || "").toLowerCase();
      const done = current.includes("done") || current.includes("completed");
      const active = current.includes("progress");
      return status === "In Progress" ? !done && !active : !done;
    });
    if (!eligible.length) {
      setActionError(status === "In Progress" ? "Select pending tasks to start." : "Select pending or in-progress tasks to complete.");
      return;
    }
    if (!window.confirm(`${status === "Done" ? "Mark" : "Start"} ${eligible.length} selected task${eligible.length === 1 ? "" : "s"}${status === "Done" ? " as done" : ""}?`)) return;
    const completed: string[] = [];
    let failures = 0;
    try {
      setBusy(status === "Done" ? "bulk-done" : "bulk-start");
      setActionError("");
      for (const task of eligible) {
        try {
          await updateTaskStatus(String(task.id), status, staffName);
          completed.push(String(task.id));
        } catch {
          failures += 1;
        }
      }
      setSelectedIds(current => current.filter(id => !completed.includes(id)));
      await onRefresh();
      if (failures) setActionError(`${failures} task${failures === 1 ? "" : "s"} could not be updated and remain selected.`);
    } finally {
      setBusy("");
    }
  }

  return <div className="tasks-workspace">
    <div className="workspace-tools"><div className="segmented">{[["open","Open"],["active","In Progress"],["done","Done"],["all","All"]].map(([key,label]) => <button className={filter === key ? "active" : ""} key={key} onClick={() => setFilter(key)}>{label}</button>)}</div><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks or properties"/><button className="primary-action" onClick={onCreate}>＋ Create Task</button></div>
    <div className="task-bulk-toolbar">
      <button type="button" onClick={toggleAllVisible} disabled={!visibleIds.length || busy !== ""}>
        {allVisibleSelected ? <CheckSquare2 size={16}/> : someVisibleSelected ? <MinusSquare size={16}/> : <Square size={16}/>} Select visible
      </button>
      <span>{selectedIds.length ? `${selectedIds.length} selected` : "Select tasks for a bulk update"}</span>
      {selectedIds.length > 0 && <><button type="button" onClick={() => setSelectedIds([])} disabled={busy !== ""}>Clear</button><button type="button" className="bulk-start" onClick={() => bulkChange("In Progress")} disabled={!canUseTasks || busy !== ""}>{busy === "bulk-start" ? "Starting…" : "Start selected"}</button><button type="button" className="bulk-done" onClick={() => bulkChange("Done")} disabled={!canUseTasks || busy !== ""}>{busy === "bulk-done" ? "Completing…" : "Mark selected done"}</button></>}
    </div>
    {(error || actionError) && <p className="workspace-error">{actionError || error}</p>}
    {loading ? <div className="workspace-empty">Loading shift tasks…</div> : shown.length === 0 ? <div className="workspace-empty"><strong>No tasks here</strong><p>The queue is clear for this view.</p></div> : <div className="task-list">{shown.map((task: any) => {
      const status = String(task.status || "").toLowerCase(); const done = status.includes("done") || status.includes("completed"); const active = status.includes("progress"); const urgent = ["high","urgent","critical"].includes(String(task.priority || "").toLowerCase());
      const id = String(task.id); const checked = selectedIds.includes(id);
      return <article className={`shift-task ${urgent ? "urgent" : ""} ${checked ? "selected" : ""}`} key={task.id}><button type="button" className="task-select-box" onClick={() => toggleSelected(id)} aria-label={`${checked ? "Deselect" : "Select"} task`}>{checked ? <Check size={14}/> : null}</button><div className="task-state"><span className={done ? "done" : active ? "active" : "pending"}/></div><div className="task-main"><div><strong>{task.subject || task.type || "Operational task"}</strong><span className={`status-chip ${done ? "green" : active ? "blue" : urgent ? "red" : "amber"}`}>{done ? "Done" : active ? "In Progress" : urgent ? "Urgent" : "Pending"}</span></div><p>{task.property || "General"} · {task.type || task.source || "Manual"}</p><small>{task.notes || "No additional notes"}</small></div><div className="task-owner"><small>OWNER</small><strong>{task.assignedTo || "Unassigned"}</strong></div><div className="task-actions">{!done && !active && <button disabled={!canUseTasks || busy === task.id} onClick={() => change(task.id, "In Progress")}>Start</button>}{active && <button className="done-button" disabled={!canUseTasks || busy === task.id} onClick={() => change(task.id, "Done")}>Mark Done</button>}{done && <span>✓ Completed</span>}</div></article>})}</div>}
  </div>;
}
