"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from "react";
import { Check, CheckSquare2, Clock3, MinusSquare, Sparkles, Square, Zap } from "lucide-react";
import { ignoreTasks, updateTaskStatus } from "../../lib/api";

function sourceTone(source: unknown) {
  const value = String(source || "").toLowerCase();
  if (value.includes("whatsapp")) return "source-whatsapp";
  if (value.includes("email")) return "source-email";
  if (value.includes("phone")) return "source-phone";
  if (value.includes("scheduled")) return "source-scheduled";
  return "source-manual";
}

function addedTimeLabel(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";

  const timeZone = "Asia/Colombo";
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  if (day.format(date) === day.format(new Date())) return `Added today · ${time}`;

  const calendarDate = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
  }).format(date);
  return `Added ${calendarDate} · ${time}`;
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
    kind: "done" | "acknowledged";
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
      kind: "done",
      count: eligibleIds.length,
      urgent,
      queueCleared: eligibleIds.length >= openTasks.length,
    });
    window.dispatchEvent(new CustomEvent("nkh-pet-celebrate", {
      detail: {
        message: eligibleIds.length > 1
          ? `Excellent teamwork — ${eligibleIds.length} tasks complete!`
          : "Nice work — another task complete!",
      },
    }));
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

  function acknowledge(ids: string[]) {
    const eligible = shown
      .filter((task: any) => ids.includes(String(task.id)));
    const eligibleIds = eligible
      .map((task: any) => String(task.id));
    if (!eligibleIds.length) return;
    const openTasks = tasks.filter((task: any) => {
      const status = String(task.status || "").toLowerCase();
      return !status.includes("done") && !status.includes("completed") &&
        !status.includes("ignored") && !status.includes("acknowledged");
    });

    // Close the cards immediately. Persistence and learning-filter work
    // continue silently without blocking the task workspace.
    setActionError("");
    setOptimisticAcknowledgedIds(current =>
      Array.from(new Set([...current, ...eligibleIds]))
    );
    setSelectedIds(current => current.filter(id => !eligibleIds.includes(id)));
    onOptimisticClose?.(eligibleIds);
    setCelebration({
      kind: "acknowledged",
      count: eligibleIds.length,
      urgent: false,
      queueCleared: eligibleIds.length >= openTasks.length,
    });
    window.dispatchEvent(new CustomEvent("nkh-pet-celebrate", {
      detail: {
        message: eligibleIds.length > 1
          ? `${eligibleIds.length} items reviewed and acknowledged.`
          : "Reviewed and acknowledged!",
      },
    }));

    void ignoreTasks(eligibleIds, "Reviewed — no further action")
      .then(() => {
        window.setTimeout(() => void onRefresh(), 900);
      })
      .catch(async (reason: any) => {
        setOptimisticAcknowledgedIds(current =>
          current.filter(id => !eligibleIds.includes(id))
        );
        setActionError(reason?.message || "Unable to acknowledge tasks. The task has been restored.");
        await onRefresh();
      });
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
          Acknowledge selected
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
        const academyTask = Boolean(task.academyAssignmentId);
        const checked = selectedIds.includes(id);
        const label = acknowledged ? "Acknowledged" : completed ? "Done" : urgent ? "Urgent" : "Pending";
        const chip = acknowledged ? "amber" : completed ? "green" : urgent ? "red" : "amber";
        const addedTime = addedTimeLabel(task.createdTime);

        return <article className={`shift-task ${sourceTone(task.source)} ${urgent && !closed ? "urgent" : ""} ${checked ? "selected" : ""}`} key={task.id}>
          <button type="button" className="task-select-box" onClick={() => toggleSelected(id)}
            aria-label={`${checked ? "Deselect" : "Select"} task`}>{checked ? <Check size={14}/> : null}</button>
          <div className="task-state"><span className={closed ? "done" : "pending"}/></div>
          <div className="task-main">
            <div><strong>{task.subject || task.type || "Operational task"}</strong>
              <span className={`status-chip ${chip}`}>{label}</span></div>
            <p>{task.property || "General"} · {task.type || task.source || "Manual"}</p>
            {addedTime && <time className="task-added-time" dateTime={String(task.createdTime)}>
              <Clock3 size={12}/>{addedTime}
            </time>}
            <small>{task.notes || "No additional notes"}</small>
          </div>
          <div className="task-owner"><small>OWNER</small><strong>{task.assignedTo || "Unassigned"}</strong></div>
          <div className="task-actions">
            {!closed && academyTask && <button className="academy-task-button" onClick={() => {
              window.sessionStorage.setItem("nkh_academy_assignment_id", String(task.academyAssignmentId));
              window.dispatchEvent(new CustomEvent("nkh-open-academy"));
            }}>Open Academy</button>}
            {!closed && emailTask && <button className="acknowledge-button" disabled={!canUseTasks || busy !== ""} onClick={() => acknowledge([id])}>
              Acknowledge</button>}
            {!closed && <button className="done-button" disabled={!canUseTasks || busy !== ""} onClick={() => markDone([id])}>
              <Check size={15}/>{busy === id ? "Completing…" : "Done"}</button>}
            {acknowledged && <span>✓ Acknowledged</span>}
            {completed && <span>✓ Completed</span>}
          </div>
        </article>;
      })}</div>}
    {celebration && <div className="task-celebration-layer" role="status" aria-live="polite" onClick={() => setCelebration(null)}>
      <div className={`task-celebration ${celebration.kind === "acknowledged" ? "acknowledge-win" : ""} ${celebration.urgent ? "urgent-win" : ""} ${celebration.queueCleared ? "queue-win" : ""}`}>
        <div className="celebration-orbit"><span/><span/><span/></div>
        <div className="celebration-check">{celebration.kind === "acknowledged"
          ? <CheckSquare2 size={39}/>
          : celebration.urgent ? <Zap size={39}/> : <Check size={42}/>}</div>
        <Sparkles className="celebration-spark left" size={23}/>
        <Sparkles className="celebration-spark right" size={18}/>
        <small>{celebration.queueCleared
          ? "QUEUE CLEARED"
          : celebration.kind === "acknowledged" ? "REVIEW COMPLETE"
          : celebration.urgent ? "URGENT WORK RESOLVED" : "TASK COMPLETED"}</small>
        <h2>{celebration.kind === "acknowledged"
          ? celebration.count > 1 ? `${celebration.count} items acknowledged` : "Acknowledged"
          : celebration.count > 1 ? `${celebration.count} tasks completed!` : `Great work, ${staffName}!`}</h2>
        <p>{celebration.queueCleared
          ? "Everything is under control."
          : celebration.kind === "acknowledged"
            ? "Reviewed and safely cleared from your active queue."
            : "Another guest operation handled beautifully."}</p>
      </div>
    </div>}
  </div>;
}
