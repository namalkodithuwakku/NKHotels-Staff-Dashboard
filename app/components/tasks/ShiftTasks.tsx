"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
import { Check, CheckSquare2, MinusSquare, Square } from "lucide-react";
import { ignoreTasks, updateTaskStatus } from "../../lib/api";

export default function ShiftTasks({ tasks, staffName, canUseTasks, loading, error, onCreate, onRefresh }: any) {
  const [filter, setFilter] = useState("open");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [actionError, setActionError] = useState("");

  const shown = useMemo(() => tasks.filter((task: any) => {
    const status = String(task.status || "").toLowerCase();
    const acknowledged = status.includes("ignored") || status.includes("acknowledged");
    const completed = status.includes("done") || status.includes("completed");
    const closed = acknowledged || completed;
    const filterOk = filter === "all" || (filter === "open" && !closed) || (filter === "done" && closed);
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

  async function markDone(ids: string[]) {
    const eligible = shown.filter((task: any) => {
      if (!ids.includes(String(task.id))) return false;
      const status = String(task.status || "").toLowerCase();
      return !status.includes("done") && !status.includes("completed") &&
        !status.includes("ignored") && !status.includes("acknowledged");
    });
    if (!eligible.length) {
      setActionError("Select open tasks to complete.");
      return;
    }
    if (!window.confirm(`Mark ${eligible.length} task${eligible.length === 1 ? "" : "s"} as done?`)) return;

    const completed: string[] = [];
    let failures = 0;
    try {
      setBusy(ids.length === 1 ? ids[0] : "bulk-done");
      setActionError("");
      for (const task of eligible) {
        try {
          await updateTaskStatus(String(task.id), "Done", staffName);
          completed.push(String(task.id));
        } catch {
          failures++;
        }
      }
      setSelectedIds(current => current.filter(id => !completed.includes(id)));
      await onRefresh();
      if (failures) setActionError(`${failures} task${failures === 1 ? "" : "s"} could not be completed.`);
    } finally {
      setBusy("");
    }
  }

  async function acknowledge(ids: string[]) {
    if (!ids.length) return;
    const note = window.prompt(
      "Add an acknowledgement note (optional). Similar email patterns are learned after three acknowledgements.",
      "Reviewed — no further action"
    );
    if (note === null) return;
    try {
      setBusy(ids.length === 1 ? ids[0] : "bulk-acknowledge");
      setActionError("");
      await ignoreTasks(ids, note || "Reviewed — no further action");
      setSelectedIds(current => current.filter(id => !ids.includes(id)));
      await onRefresh();
    } catch (reason: any) {
      setActionError(reason?.message || "Unable to acknowledge tasks.");
    } finally {
      setBusy("");
    }
  }

  return <div className="tasks-workspace">
    <div className="workspace-tools">
      <div className="segmented">{[["open","Open"],["done","Closed"],["all","All"]].map(([key,label]) =>
        <button className={filter === key ? "active" : ""} key={key} onClick={() => setFilter(key)}>{label}</button>)}
      </div>
      <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search tasks or properties"/>
      <button className="primary-action" onClick={onCreate}>＋ Create Task</button>
    </div>

    <div className="task-bulk-toolbar">
      <button type="button" onClick={toggleAllVisible} disabled={!visibleIds.length || busy !== ""}>
        {allVisibleSelected ? <CheckSquare2 size={16}/> : someVisibleSelected ? <MinusSquare size={16}/> : <Square size={16}/>} Select visible
      </button>
      <span>{selectedIds.length ? `${selectedIds.length} selected` : "Select tasks for a bulk update"}</span>
      {selectedIds.length > 0 && <>
        <button type="button" onClick={() => setSelectedIds([])} disabled={busy !== ""}>Clear</button>
        <button type="button" onClick={() => acknowledge(selectedIds)} disabled={!canUseTasks || busy !== ""}>
          {busy === "bulk-acknowledge" ? "Acknowledging…" : "Acknowledge selected"}
        </button>
        <button type="button" className="bulk-done" onClick={() => markDone(selectedIds)} disabled={!canUseTasks || busy !== ""}>
          {busy === "bulk-done" ? "Completing…" : "Mark selected done"}
        </button>
      </>}
    </div>

    {(error || actionError) && <p className="workspace-error">{actionError || error}</p>}
    {loading ? <div className="workspace-empty">Loading shift tasks…</div> :
      shown.length === 0 ? <div className="workspace-empty"><strong>No tasks here</strong><p>The queue is clear for this view.</p></div> :
      <div className="task-list">{shown.map((task: any) => {
        const status = String(task.status || "").toLowerCase();
        const acknowledged = status.includes("ignored") || status.includes("acknowledged");
        const completed = status.includes("done") || status.includes("completed");
        const closed = acknowledged || completed;
        const urgent = ["high","urgent","critical"].includes(String(task.priority || "").toLowerCase());
        const emailTask = String(task.source || "").toLowerCase().includes("email");
        const id = String(task.id);
        const checked = selectedIds.includes(id);
        const label = acknowledged ? "Acknowledged" : completed ? "Done" : urgent ? "Urgent" : "Pending";
        const chip = acknowledged ? "amber" : completed ? "green" : urgent ? "red" : "amber";

        return <article className={`shift-task ${urgent && !closed ? "urgent" : ""} ${checked ? "selected" : ""}`} key={task.id}>
          <button type="button" className="task-select-box" onClick={() => toggleSelected(id)}
            aria-label={`${checked ? "Deselect" : "Select"} task`}>{checked ? <Check size={14}/> : null}</button>
          <div className="task-state"><span className={closed ? "done" : "pending"}/></div>
          <div className="task-main">
            <div><strong>{task.subject || task.type || "Operational task"}</strong>
              <span className={`status-chip ${chip}`}>{label}</span></div>
            <p>{task.property || "General"} · {task.type || task.source || "Manual"}</p>
            <small>{task.notes || "No additional notes"}</small>
          </div>
          <div className="task-owner"><small>OWNER</small><strong>{task.assignedTo || "Unassigned"}</strong></div>
          <div className="task-actions">
            {!closed && emailTask && <button disabled={!canUseTasks || busy !== ""} onClick={() => acknowledge([id])}>
              {busy === id ? "Saving…" : "Acknowledge"}</button>}
            {!closed && <button className="done-button" disabled={!canUseTasks || busy !== ""} onClick={() => markDone([id])}>
              {busy === id ? "Completing…" : "Done"}</button>}
            {acknowledged && <span>✓ Acknowledged</span>}
            {completed && <span>✓ Completed</span>}
          </div>
        </article>;
      })}</div>}
  </div>;
}
