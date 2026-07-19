"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { AlertCircle, ArrowRight, Check, Clock3, Mail } from "lucide-react";
import { WorkspaceView } from "../../dashboards/TeamDashboard";

export default function StaffHome({ staffName, shift, counts, tasks, emails, onOpen }: any) {
  const attention = tasks.filter((task: any) => {
    const status = String(task.status || "").toLowerCase();
    const priority = String(task.priority || "").toLowerCase();
    return !status.includes("done") && ["high", "urgent", "critical"].includes(priority);
  }).slice(0, 4);

  const nextTask = attention[0] || tasks.find((task: any) => !String(task.status || "").toLowerCase().includes("done"));
  const hasEmails = emails.length > 0;
  const primaryView: WorkspaceView = nextTask ? "tasks" : hasEmails ? "email" : "tasks";
  const primaryLabel = attention.length ? "Review urgent work" : nextTask ? "Continue working" : hasEmails ? "Review email inbox" : "No work pending";
  const date = new Intl.DateTimeFormat("en", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  const metrics = [
    { label: "Urgent", value: counts.urgent, tone: "red", detail: "Needs attention" },
    { label: "Pending", value: counts.pending, tone: "amber", detail: "Ready to start" },
    { label: "In progress", value: counts.active, tone: "blue", detail: "Being handled" },
    { label: "Completed", value: counts.done, tone: "green", detail: "Last 24 hours" },
  ];

  return <div className="home-workspace premium-home">
    <section className="home-welcome premium-shift-hero">
      <div className="shift-hero-copy">
        <div className="shift-hero-meta"><span>{date}</span>{shift?.canWork && <em><i /> On shift</em>}</div>
        <h2>Good day, {staffName}</h2>
        <p>{shift?.canWork ? <><Clock3 size={14} /> <strong>{shift?.shift || "Your shift"}</strong><span>Stay focused on the next important action.</span></> : <>View only <span>· {shift?.nextShift ? `Next shift: ${shift.nextShift}` : shift?.status || "Off shift"}</span></>}</p>
      </div>
      <button onClick={() => onOpen(primaryView)} disabled={!nextTask && !hasEmails}>{primaryLabel}<ArrowRight size={16} /></button>
    </section>

    <section className="workload-grid premium-metrics" aria-label="Current workload">
      {metrics.map(metric => <button key={metric.label} onClick={() => onOpen("tasks")} className={`workload ${metric.tone}`}>
        <span className="metric-tone" aria-hidden="true" />
        <div><small>{metric.label}</small><span>{metric.detail}</span></div>
        <strong>{metric.value}</strong>
      </button>)}
    </section>

    <section className="attention-panel premium-attention">
      <div className="panel-heading">
        <div><small>PRIORITY QUEUE</small><h3>Needs attention</h3></div>
        {hasEmails && <button onClick={() => onOpen("email")}><Mail size={14} />{emails.length} emails waiting<ArrowRight size={13} /></button>}
      </div>
      {attention.length > 0 ? attention.map((task: any) => <button className="attention-row" key={task.id} onClick={() => onOpen("tasks")}><span><AlertCircle size={15} /></span><div><strong>{task.subject || task.type || "Operational task"}</strong><p>{task.property || "General"} · {task.notes || "Open task details"}</p></div><b>Open <ArrowRight size={13} /></b></button>)
        : hasEmails ? <button className="attention-row email-attention" onClick={() => onOpen("email")}><span><Mail size={15} /></span><div><strong>{emails.length} emails awaiting review</strong><p>The task queue is calm. Review the operations inbox when ready.</p></div><b>Review <ArrowRight size={13} /></b></button>
        : <div className="calm-empty"><span><Check size={18} /></span><div><strong>Everything is under control</strong><p>No urgent tasks or unread operational emails need attention.</p></div></div>}
    </section>
  </div>;
}
