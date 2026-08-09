"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, BellRing, Bot, CheckCircle2, ChevronLeft, ChevronRight, Clock3, ListChecks, X } from "lucide-react";
import AISupervisorManualRunButton from "./AISupervisorManualRunButton";

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
  const property = task.property || "the correct property";
  const reference = task.bookingId ? `booking ${task.bookingId}` : "the booking/reference";
  const has = (...terms: string[]) => terms.some(term => text.includes(term));

  if (has("cancel", "cancellation", "cancelled", "canceled")) {
    return [
      `Verify ${reference} and confirm the cancellation belongs to ${property}.`,
      "Check the reservation calendar and mark/remove the cancelled stay correctly.",
      "Restore room inventory on affected OTA/channel dates if the cancellation released availability.",
      "Record what was updated, then mark the task Done only after the calendar and OTA are consistent.",
    ];
  }

  if (has("modify", "modification", "amend", "date change", "change booking")) {
    return [
      `Open ${reference} and compare the old details with the requested new details.`,
      "Update stay dates, room type, occupancy or other changed fields in the hotel calendar.",
      "Check availability and OTA/channel inventory for the revised dates before confirming the change.",
      "Confirm the modification to the guest/OTA if required and record the final result in the task.",
    ];
  }

  if (has("payment", "deposit", "advance", "bank slip", "payment slip", "paid")) {
    return [
      `Verify the payment evidence against ${reference} for ${property}.`,
      "Check the amount, payment reference/date and whether it satisfies the required advance or balance.",
      "Update the booking payment status and confirm the reservation only if the payment is valid.",
      "Record the verified amount/status and notify the guest or hotel if confirmation is required.",
    ];
  }

  if (has("room block", "block room", "blocked room", "inventory block")) {
    return [
      `Confirm the exact room(s), dates and reason for the block at ${property}.`,
      "Block those dates in the operational calendar without changing unrelated bookings.",
      "Reduce/close OTA inventory for the same dates if the blocked room was previously sellable.",
      "Verify the block is visible in the calendar and channels, then record completion.",
    ];
  }

  if (has("guest message", "guest request", "guest", "message", "whatsapp")) {
    return [
      `Read the full guest request for ${property} and identify the exact answer or action needed.`,
      `Check ${reference} and the hotel details before replying so the response is accurate.`,
      "Contact the guest through the correct channel and coordinate with the hotel if operational confirmation is needed.",
      "Record the response/outcome in the task and mark Done only when the guest request has been handled.",
    ];
  }

  if (has("new booking", "new reservation", "reservation confirmed", "booking confirmation")) {
    return [
      `Verify ${reference}, guest/stay dates and property name against the source message.`,
      `Confirm the booking exists in the ${property} calendar with the correct room allocation.`,
      "Check room type, adults/children, meal plan, payment status and any special request that needs hotel action.",
      "If anything is missing, correct/escalate it; otherwise record verification and mark the task Done.",
    ];
  }

  if (has("booking info", "booking information", "reservation info", "booking details")) {
    return [
      `Open ${reference} for ${property} and identify exactly which booking information is missing or needs checking.`,
      "Verify the details against the OTA/email/calendar before making any operational decision.",
      "Update or communicate the required information to the correct staff/hotel/guest.",
      "Record the confirmed information and close the task only when no further follow-up is required.",
    ];
  }

  if (has("ota issue", "channel issue", "inventory", "channel manager", "overbooking", "availability")) {
    return [
      `Open the affected OTA/channel for ${property} and identify the exact inventory or booking problem.`,
      "Compare OTA availability with the Staff Dashboard calendar for the same dates and room type.",
      "Make the minimum required inventory/channel correction and avoid changing unrelated dates or room types.",
      "Reload/recheck the OTA to confirm the correction is live, then record what was changed.",
    ];
  }

  if (has("rate update", "rate change", "yield", "pricing", "rate")) {
    return [
      `Check ${property} occupancy, current selling rate and the dates/room type mentioned in the task.`,
      "Confirm the exact new rate or pricing action before changing any channel.",
      "Apply the rate only to the intended dates/room types and verify it on the OTA/channel afterwards.",
      "Record the old/new rate and affected dates so the change can be audited later.",
    ];
  }

  if (has("promotion", "promo", "offer", "discount")) {
    return [
      `Confirm the promotion objective, stay/booking dates, room types and channels for ${property}.`,
      "Check that the discount/rate conditions will not conflict with existing offers or minimum-rate rules.",
      "Create/update the promotion on the intended OTA/channel and verify the guest-facing result.",
      "Record the promotion name, dates and channels activated before completing the task.",
    ];
  }

  if (has("inquiry", "enquiry", "quotation", "quote", "proposal")) {
    return [
      `Read the inquiry and identify dates, rooms, guest/company needs and any deadline for ${property}.`,
      "Check availability and the correct approved rate/package before preparing the response.",
      "Send a clear quotation/reply through the requested channel and include only confirmed information.",
      "Record the response and follow-up requirement; keep the task open if the customer still needs action from us.",
    ];
  }

  if (has("complaint", "problem", "unhappy", "refund", "issue with stay")) {
    return [
      `Review the complaint and ${reference} to understand the guest impact and urgency.`,
      `Contact the responsible person at ${property} and verify the facts before promising a solution.`,
      "Agree and communicate the corrective action, escalation or approved compensation where applicable.",
      "Record the resolution and guest response; close only when the issue has been properly handed over or resolved.",
    ];
  }

  if (has("supplier", "vendor", "invoice", "purchase", "maintenance")) {
    return [
      `Identify the supplier/vendor request and the responsible property or department.`,
      "Verify the amount/item/service and whether approval or hotel confirmation is required.",
      "Contact the responsible staff/vendor and complete the required operational follow-up.",
      "Record the outcome, approval/reference and any next deadline before closing the task.",
    ];
  }

  if (has("booking", "reservation")) {
    return [
      `Verify ${reference} and make sure it belongs to ${property}.`,
      "Check the calendar for correct stay dates, room allocation and booking status.",
      "Review payment status and any guest/special request requiring action.",
      "Complete the required correction/follow-up, record the result, and then mark the task Done.",
    ];
  }

  return [
    `Read the task summary and confirm the exact expected outcome for ${property}.`,
    "Verify the relevant booking, message, calendar or operational record before taking action.",
    "Complete only the required action and avoid changing unrelated hotel data.",
    "Record what was completed and any follow-up needed before marking the task Done.",
  ];
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

          <AISupervisorManualRunButton />

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
                <ol>{steps.map((step, index) => <li key={`${index}-${step}`}><span>{index + 1}</span><p>{step}</p></li>)}</ol>
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
