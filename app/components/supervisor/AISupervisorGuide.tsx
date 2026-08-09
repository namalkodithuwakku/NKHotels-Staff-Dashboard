"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, BellRing, Bot, CheckCircle2, ChevronRight, Clock3, ListChecks, X } from "lucide-react";

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

  if (useful.length <= 260) return useful;
  return `${useful.slice(0, 257).trimEnd()}…`;
}

function guidance(task: TaskLike) {
  const text = [task.subject, task.type, task.taskType, task.notes, task.source].join(" ").toLowerCase();
  if (text.includes("cancel")) {
    return ["Confirm the cancellation reference.", "Update the booking in the hotel calendar.", "Restore inventory / OTA availability if required."];
  }
  if (text.includes("booking") || text.includes("reservation")) {
    return ["Verify the booking reference and guest details.", "Confirm the booking is in the correct hotel calendar.", "Check arrival, room type and special requests, then complete the task."];
  }
  if (text.includes("guest") || text.includes("message")) {
    return ["Read the guest request and identify exactly what they need.", "Confirm the hotel can fulfil the request.", "Record the outcome and complete the task after the guest/hotel is updated."];
  }
  if (text.includes("ota") || text.includes("inventory") || text.includes("channel")) {
    return ["Check the affected OTA/channel.", "Compare inventory with the hotel calendar.", "Make the required update and verify it is reflected online."];
  }
  if (text.includes("rate") || text.includes("yield")) {
    return ["Check occupancy and the current selling rate.", "Confirm the requested rate action.", "Verify the OTA/channel after the update before marking Done."];
  }
  return ["Identify the exact expected outcome.", "Complete the action for the correct property.", "Add any important completion note and mark the task Done."];
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
  const firstAutoOpen = useRef(false);

  const openTasks = useMemo(() => tasks.filter(task => !isClosed(task)), [tasks]);
  const focusTask = useMemo(() => {
    return [...openTasks].sort((a, b) => {
      const priorityDifference = rank(b) - rank(a);
      if (priorityDifference) return priorityDifference;
      return ageHours(b) - ageHours(a);
    })[0] || null;
  }, [openTasks]);

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
        <section className="ai-supervisor-panel" role="dialog" aria-label="AI Supervisor guidance">
          <header>
            <div className="ai-supervisor-heading">
              <span className="ai-supervisor-avatar"><Bot size={21} /></span>
              <div><small>NKH OPERATIONS</small><h3>AI Supervisor</h3></div>
            </div>
            <button type="button" onClick={dismiss} aria-label="Close AI Supervisor"><X size={18} /></button>
          </header>

          <div className="ai-supervisor-intro">
            <strong>Hi {staffName}, this needs your attention.</strong>
            <p>{focusTask ? "Handle this item first, then update its task status." : "Your active queue is clear. I’ll alert you when something needs attention."}</p>
          </div>

          {focusTask ? (
            <>
              <article className={`ai-supervisor-focus priority-${String(focusTask.priority || "normal").toLowerCase()}`}>
                <div className="ai-supervisor-focus-top">
                  <span><BellRing size={16} /> {String(focusTask.priority || "Normal")} priority</span>
                  {ageHours(focusTask) >= 6 && <em><Clock3 size={14} /> {Math.floor(ageHours(focusTask))}h open</em>}
                </div>
                <h4>{focusTask.subject || focusTask.type || "Operational task"}</h4>
                <div className="ai-supervisor-task-meta">
                  <span>{focusTask.property || "General operations"}</span>
                  {focusTask.bookingId && <b>Ref {focusTask.bookingId}</b>}
                </div>
                {summary && <p className="ai-supervisor-task-summary">{summary}</p>}
              </article>

              <div className="ai-supervisor-steps">
                <strong><ListChecks size={16} /> What to do now</strong>
                <ol>{steps.map((step, index) => <li key={step}><span>{index + 1}</span><p>{step}</p></li>)}</ol>
              </div>

              <div className="ai-supervisor-summary-row">
                <span><AlertTriangle size={15} /> {urgentCount} priority</span>
                <span><Clock3 size={15} /> {overdueCount} overdue</span>
                <span><CheckCircle2 size={15} /> {openTasks.length} open</span>
              </div>

              <button className="ai-supervisor-primary" type="button" onClick={() => { setOpen(false); onOpenTasks?.(); }}>
                Open task <ChevronRight size={17} />
              </button>
            </>
          ) : (
            <div className="ai-supervisor-clear"><CheckCircle2 size={24} /><strong>Queue under control</strong><p>No open task needs immediate guidance.</p></div>
          )}
        </section>
      )}
    </div>
  );
}
