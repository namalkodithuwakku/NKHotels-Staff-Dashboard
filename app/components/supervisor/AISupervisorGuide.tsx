"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, BellRing, Bot, CheckCircle2, ChevronLeft, ChevronRight, Clock3, ListChecks, X } from "lucide-react";

type TaskLike = {
  id?: string | number;
  status?: string;
  priority?: string;
  type?: string;
  taskType?: string;
  source?: string;
  property?: string;
  bookingId?: string;
  subject?: string;
  notes?: string;
  assignedTo?: string;
  createdTime?: string;
};

function isClosed(task: TaskLike) {
  const status = String(task.status || "").toLowerCase();
  return ["done", "completed", "ignored", "acknowledged", "cancelled", "canceled"].some(value => status.includes(value));
}

function rank(task: TaskLike) {
  const priority = String(task.priority || "").toLowerCase();
  if (priority === "critical") return 4;
  if (priority === "urgent") return 3;
  if (priority === "high") return 2;
  return 1;
}

function ageHours(task: TaskLike) {
  const timestamp = new Date(String(task.createdTime || "")).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, (Date.now() - timestamp) / 3600000);
}

function cleanOperationalSummary(value: unknown) {
  const raw = String(value || "")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\bwww\.\S+/gi, " ")
    .replace(/[#*_`>|]+/g, " ")
    .replace(/\b(?:utm_[a-z_]+|product_id|from_instant_email|source|email_id|campaign)[=:]\S+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!raw) return "";
  const useful = raw
    .split(/(?<=[.!?])\s+/)
    .map(part => part.trim())
    .filter(Boolean)
    .filter(part => !/^https?:/i.test(part))
    .slice(0, 3)
    .join(" ");

  if (useful.length <= 240) return useful;
  return `${useful.slice(0, 237).trimEnd()}…`;
}

function guidance(task: TaskLike) {
  const text = [task.subject, task.type, task.taskType, task.notes, task.source].join(" ").toLowerCase();
  if (text.includes("cancel")) return ["Confirm the cancellation reference.", "Update the hotel calendar.", "Restore OTA inventory if required."];
  if (text.includes("guest") || text.includes("message")) return ["Read the guest request and identify the action needed.", "Contact the guest or hotel if required.", "Record the outcome and update the task status."];
  if (text.includes("booking") || text.includes("reservation")) return ["Verify the booking reference and guest details.", "Confirm it is in the correct hotel calendar.", "Check arrival, room type and special requests."];
  if (text.includes("ota") || text.includes("inventory") || text.includes("channel")) return ["Check the affected OTA/channel.", "Compare inventory with the hotel calendar.", "Make the update and verify it online."];
  if (text.includes("rate") || text.includes("yield")) return ["Check occupancy and current selling rate.", "Confirm the required rate action.", "Verify the OTA after updating."];
  return ["Identify the required outcome.", "Complete the action for the correct property.", "Add a completion note and update the status."];
}

export default function AISupervisorGuide({
  staffName,
  tasks,
  onOpenTasks,
  compact = false,
}: {
  staffName: string;
  tasks: TaskLike[];
  onOpenTasks?: () => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [dismissedTaskId, setDismissedTaskId] = useState("");
  const [taskIndex, setTaskIndex] = useState(0);
  const firstAutoOpen = useRef(false);

  const openTasks = useMemo(() => tasks.filter(task => !isClosed(task)), [tasks]);
  const sortedTasks = useMemo(() => [...openTasks].sort((a, b) => {
    const priorityDifference = rank(b) - rank(a);
    if (priorityDifference) return priorityDifference;
    return ageHours(b) - ageHours(a);
  }), [openTasks]);

  useEffect(() => {
    if (!sortedTasks.length) setTaskIndex(0);
    else if (taskIndex > sortedTasks.length - 1) setTaskIndex(sortedTasks.length - 1);
  }, [sortedTasks.length, taskIndex]);

  const focusTask = sortedTasks[taskIndex] || null;
  const urgentCount = useMemo(
    () => openTasks.filter(task => ["critical", "urgent", "high"].includes(String(task.priority || "").toLowerCase())).length,
    [openTasks]
  );
  const overdueCount = useMemo(() => openTasks.filter(task => ageHours(task) >= 6).length, [openTasks]);
  const focusId = String(focusTask?.id || "");

  useEffect(() => {
    if (!focusTask || firstAutoOpen.current) return;
    const priority = String(focusTask.priority || "").toLowerCase();
    if (!["critical", "urgent"].includes(priority) && ageHours(focusTask) < 6) return;
    if (focusId && focusId === dismissedTaskId) return;
    firstAutoOpen.current = true;
    const timer = window.setTimeout(() => setOpen(true), 900);
    return () => window.clearTimeout(timer);
  }, [focusTask, focusId, dismissedTaskId]);

  const steps = focusTask ? guidance(focusTask) : [];
  const summary = focusTask ? cleanOperationalSummary(focusTask.notes) : "";

  function dismiss() {
    if (focusId) setDismissedTaskId(focusId);
    setOpen(false);
  }

  function nextTask() {
    if (!sortedTasks.length) return;
    setTaskIndex(index => (index + 1) % sortedTasks.length);
  }

  function previousTask() {
    if (!sortedTasks.length) return;
    setTaskIndex(index => (index - 1 + sortedTasks.length) % sortedTasks.length);
  }

  return (
    <div className={`ai-supervisor-guide ${compact ? "compact" : ""} ${open ? "open" : ""}`}>
      {!open && (
        <button className="ai-supervisor-launcher" type="button" onClick={() => setOpen(true)} aria-label="Open AI Supervisor">
          <span className="ai-supervisor-avatar"><Bot size={20} /></span>
          <span className="ai-supervisor-launcher-copy">
            <strong>AI Supervisor</strong>
            <small>{urgentCount ? `${urgentCount} priority item${urgentCount === 1 ? "" : "s"}` : "Online"}</small>
          </span>
          {(urgentCount > 0 || overdueCount > 0) && <b>{urgentCount || overdueCount}</b>}
        </button>
      )}

      {open && (
        <section className="ai-supervisor-panel ai-supervisor-panel-clean" role="dialog" aria-label="AI Supervisor guidance">
          <header>
            <div className="ai-supervisor-heading">
              <span className="ai-supervisor-avatar"><Bot size={20} /></span>
              <div><small>NKH OPERATIONS</small><h3>AI Supervisor</h3></div>
            </div>
            <button type="button" onClick={dismiss} aria-label="Close AI Supervisor"><X size={18} /></button>
          </header>

          {focusTask ? (
            <>
              <div className="ai-supervisor-queuebar">
                <span>Task {taskIndex + 1} of {sortedTasks.length}</span>
                <div>
                  <button type="button" onClick={previousTask} disabled={sortedTasks.length < 2} aria-label="Previous task"><ChevronLeft size={17} /></button>
                  <button type="button" onClick={nextTask} disabled={sortedTasks.length < 2}>Next task <ChevronRight size={16} /></button>
                </div>
              </div>

              <article className={`ai-supervisor-focus priority-${String(focusTask.priority || "normal").toLowerCase()}`}>
                <div className="ai-supervisor-focus-top">
                  <span><BellRing size={14} /> {String(focusTask.priority || "Normal")} priority</span>
                  {ageHours(focusTask) >= 6 && <em><Clock3 size={13} /> {Math.floor(ageHours(focusTask))}h open</em>}
                </div>
                <h4>{focusTask.subject || focusTask.type || "Operational task"}</h4>
                <div className="ai-supervisor-task-meta">
                  <span>{focusTask.property || "General operations"}</span>
                  {focusTask.bookingId && <b>Ref {focusTask.bookingId}</b>}
                </div>
                {summary && <p className="ai-supervisor-task-summary">{summary}</p>}
              </article>

              <div className="ai-supervisor-steps">
                <strong><ListChecks size={15} /> Action checklist</strong>
                <ol>{steps.map((step, index) => <li key={step}><span>{index + 1}</span><p>{step}</p></li>)}</ol>
              </div>

              <div className="ai-supervisor-summary-row">
                <span><AlertTriangle size={14} /> {urgentCount} priority</span>
                <span><Clock3 size={14} /> {overdueCount} overdue</span>
                <span><CheckCircle2 size={14} /> {openTasks.length} open</span>
              </div>

              <div className="ai-supervisor-actions">
                <button className="ai-supervisor-primary" type="button" onClick={() => { setOpen(false); onOpenTasks?.(); }}>
                  Open task <ChevronRight size={17} />
                </button>
                {sortedTasks.length > 1 && (
                  <button className="ai-supervisor-next" type="button" onClick={nextTask}>
                    Next task <ChevronRight size={17} />
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="ai-supervisor-clear"><CheckCircle2 size={24} /><strong>Queue under control</strong><p>No open task needs immediate guidance.</p></div>
          )}
        </section>
      )}
    </div>
  );
}
