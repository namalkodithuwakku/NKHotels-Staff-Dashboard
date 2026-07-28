"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from "react";
import { Check, CheckSquare2, MinusSquare, Sparkles, Square, Zap } from "lucide-react";
import { ignoreTasks, updateTaskStatus } from "../../lib/api";

function sourceTone(source: unknown) {
  const value = String(source || "").toLowerCase();
  if (value.includes("whatsapp")) return "source-whatsapp";
  if (value.includes("email")) return "source-email";
  if (value.includes("phone")) return "source-phone";
  if (value.includes("scheduled")) return "source-scheduled";
  return "source-manual";
}

export default function ShiftTasks({ tasks, staffName, canUseTasks, loading, error, onCreate, onRefresh, onOptimisticClose }: any) {
  const [filter, setFilter] = useState("open");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [actionError, setActionError] = useState("");
  const [optimisticDoneIds, setOptimisticDoneIds] = useState<string[]>([]);
  const [optimisticAcknowledgedIds, setOptimisticAcknowledgedIds] = useState<string[]>([]);
  const [celebration, setCelebration] = useState<{
    count: number;
    urgent: boolean;
    queueCleared: boolean;
  } | null>(null);

  useEffect(() => {
    if (!celebration) return;
    const timer = window.setTimeout(() => setCelebration(null), 1450);
    return () => window.clearTimeout(timer);
  }, [celebration]);

  const shown = useMemo(() => tasks.filter((task: any) => {
    const id = String(task.id);
    const status = String(task.status || "").toLowerCase();
    const acknowledged = optimisticAcknowledgedIds.includes(id) ||
      status.includes("ignored") || status.includes("acknowledged");
    const completed = optimisticDoneIds.includes(id) ||
      status.includes("done") || status.includes("completed");
    const closed = acknowledged || completed;
    const filterOk = filter === "all" || (filter === "open" && !closed) || (filter === "done" && closed);
    return filterOk && [task.subject, task.notes, task.property, task.type].join(" ").toLowerCase().includes(search.toLowerCase());
  }), [tasks, filter, search, optimisticDoneIds, optimisticAcknowledgedIds]);

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
    const eligibleIds: string[] = eligible.map((task: any) => String(task.id));
    const openTasks = tasks.filter((task: any) => {
      const status = String(task.status || "").toLowerCase();
      return !status.includes("done") && !status.includes("completed") &&
        !status.includes("ignored") && !status.includes("acknowledged");
    });
    const urgent = eligible.some((task: any) =>
      ["high", "urgent", "critical"].includes(String(task.priority || "").toLowerCase())
    );
    setOptimisticDoneIds(current => Array.from(new Set([...current, ...eligibleIds])));
    setSelectedIds(current => current.filter(id => !eligibleIds.includes(id)));
    onOptimisticClose?.(eligibleIds);
    setCelebration({
      count: eligibleIds.length,
      urgent,
      queueCleared: eligibleIds.length >= openTasks.length,
    });
    try {
      setBusy(ids.length === 1 ? ids[0] : "bulk-done");
      setActionError("");
      const results = await Promise.allSettled(
        eligibleIds.map(id => updateTaskStatus(id, "Done", staffName))
      );
      const failedIds = eligibleIds.filter((_, index) => results[index].status === "rejected");
      if (failedIds.length) {
        setOptimisticDoneIds(current => current.filter(id => !failedIds.includes(id)));
        setActionError(`${failedIds.length} task${failedIds.length === 1 ? "" : "s"} could not be completed.`);
      }
      await onRefresh();
    } catch (reason: any) {
      setOptimisticDoneIds(current => current.filter(id => !eligibleIds.includes(id)));
      setActionError(reason?.message || "Unable to complete tasks.");
    } finally {
      setBusy("");
    }
  }

  async function acknowledge(ids: string[]) {
    if (!ids.length) return;
    setOptimisticAcknowledgedIds(current => Array.from(new Set([...current, ...ids])));
    setSelectedIds(current => current.filter(id => !ids.includes(id)));
    onOptimisticClose?.(ids);
    try {
      setBusy(ids.length === 1 ? ids[0] : "bulk-acknowledge");
      setActionError("");
      await ignoreTasks(ids, "Reviewed — no further action");
      await onRefresh();
    } catch (reason: any) {
      setOptimisticAcknowledgedIds(current => current.filter(id => !ids.includes(id)));
      setActionError(reason?.message || "Unable to acknowledge tasks.");
    } finally {
      setBusy("");
    }
  }

  return <div className="tasks-workspace">
    <div className="workspace-tools">
      <div className="segmented task-view-tabs">{[["open","Open"],["done","Closed"],["all","All"]].map(([key,label]) =>
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
        <button type="button" className="nkh-button nkh-button-acknowledge" onClick={() => acknowledge(selectedIds)} disabled={!canUseTasks || busy !== ""}>
          {busy === "bulk-acknowledge" ? "Acknowledging…" : "Acknowledge selected"}
        </button>
        <button type="button" className="bulk-done nkh-button nkh-button-success" onClick={() => markDone(selectedIds)} disabled={!canUseTasks || busy !== ""}>
          {busy === "bulk-done" ? "Completing…" : "Mark selected done"}
        </button>
      </>}
    </div>

    {(error || actionError) && <p className="workspace-error">{actionError || error}</p>}
    {loading ? <div className="workspace-empty">Loading shift tasks…</div> :
      shown.length === 0 ? <div className="workspace-empty"><strong>No tasks here</strong><p>The queue is clear for this view.</p></div> :
      <div className="task-list">{shown.map((task: any) => {
        const id = String(task.id);
        const status = String(task.status || "").toLowerCase();
        const acknowledged = optimisticAcknowledgedIds.includes(id) ||
          status.includes("ignored") || status.includes("acknowledged");
        const completed = optimisticDoneIds.includes(id) ||
          status.includes("done") || status.includes("completed");
        const closed = acknowledged || completed;
        const urgent = ["high","urgent","critical"].includes(String(task.priority || "").toLowerCase());
        const emailTask = String(task.source || "").toLowerCase().includes("email");
        const checked = selectedIds.includes(id);
        const label = acknowledged ? "Acknowledged" : completed ? "Done" : urgent ? "Urgent" : "Pending";
        const chip = acknowledged ? "amber" : completed ? "green" : urgent ? "red" : "amber";

        return <article className={`shift-task ${sourceTone(task.source)} ${urgent && !closed ? "urgent" : ""} ${checked ? "selected" : ""}`} key={task.id}>
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
            {!closed && emailTask && <button className="acknowledge-button" disabled={!canUseTasks || busy !== ""} onClick={() => acknowledge([id])}>
              {busy === id ? "Saving…" : "Acknowledge"}</button>}
            {!closed && <button className="done-button" disabled={!canUseTasks || busy !== ""} onClick={() => markDone([id])}>
              <Check size={15}/>{busy === id ? "Completing…" : "Done"}</button>}
            {acknowledged && <span>✓ Acknowledged</span>}
            {completed && <span>✓ Completed</span>}
          </div>
        </article>;
      })}</div>}
    {celebration && <div className="task-celebration-layer" role="status" aria-live="polite" onClick={() => setCelebration(null)}>
      <div className={`task-celebration ${celebration.urgent ? "urgent-win" : ""} ${celebration.queueCleared ? "queue-win" : ""}`}>
        <div className="celebration-orbit"><span/><span/><span/></div>
        <div className="celebration-check">{celebration.urgent ? <Zap size={39}/> : <Check size={42}/>}</div>
        <Sparkles className="celebration-spark left" size={23}/>
        <Sparkles className="celebration-spark right" size={18}/>
        <small>{celebration.queueCleared ? "QUEUE CLEARED" : celebration.urgent ? "URGENT WORK RESOLVED" : "TASK COMPLETED"}</small>
        <h2>{celebration.count > 1 ? `${celebration.count} tasks completed!` : `Great work, ${staffName}!`}</h2>
        <p>{celebration.queueCleared ? "Everything is under control." : "Another guest operation handled beautifully."}</p>
      </div>
    </div>}
  </div>;
}
