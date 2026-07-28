"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { AlertCircle, ArrowRight, Check, Clock3 } from "lucide-react";
import { WorkspaceView } from "../../dashboards/TeamDashboard";

function compact(value: unknown, maximum: number) {
  const text = String(value || "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/_{3,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maximum ? `${text.slice(0, maximum).trim()}…` : text;
}

export default function StaffHome({ staffName, shift, counts, tasks, onOpen }: any) {
  const isClosed = (task: any) => {
    const status = String(task.status || "").toLowerCase();
    return status.includes("done") || status.includes("completed") ||
      status.includes("ignored") || status.includes("acknowledged");
  };

  const attention = tasks.filter((task: any) => {
    const priority = String(task.priority || "").toLowerCase();
    return !isClosed(task) && ["high", "urgent", "critical"].includes(priority);
  }).slice(0, 4);

  const nextTask = attention[0] || tasks.find((task: any) => !isClosed(task));
  const primaryView: WorkspaceView = "tasks";
  const primaryLabel = attention.length ? "Review urgent work" : nextTask ? "Continue working" : "No work pending";
  const date = new Intl.DateTimeFormat("en", {
    weekday: "long", day: "numeric", month: "long"
  }).format(new Date());

  const metrics = [
    { label: "Urgent", value: counts.urgent, tone: "red", detail: "Needs attention" },
    { label: "Pending", value: counts.pending, tone: "amber", detail: "Ready to complete" },
    { label: "In progress", value: counts.active, tone: "blue", detail: "Legacy active work" },
    { label: "Completed", value: counts.done, tone: "green", detail: "Last 24 hours" },
  ];

  return <div className="home-workspace premium-home">
    <section className="home-welcome premium-shift-hero">
      <div className="shift-hero-copy">
        <div className="shift-hero-meta">
          <span>{date}</span>
          {shift?.canWork && <em><i /> On shift</em>}
        </div>
        <h2>Good day, {staffName}</h2>
        <p>{shift?.canWork
          ? <><Clock3 size={14}/><strong>{shift?.shift || "Your shift"}</strong><span>Stay focused on the next important action.</span></>
          : <>View only <span>· {shift?.nextShift ? `Next shift: ${shift.nextShift}` : shift?.status || "Off shift"}</span></>}
        </p>
      </div>
      <button onClick={() => onOpen(primaryView)} disabled={!nextTask}>
        {primaryLabel}<ArrowRight size={16}/>
      </button>
    </section>

    <section className="workload-grid premium-metrics" aria-label="Current workload">
      {metrics.map(metric => <button key={metric.label} onClick={() => onOpen("tasks")} className={`workload ${metric.tone}`}>
        <span className="metric-tone" aria-hidden="true"/>
        <div><small>{metric.label}</small><span>{metric.detail}</span></div>
        <strong>{metric.value}</strong>
      </button>)}
    </section>

    <section className="attention-panel premium-attention">
      <div className="panel-heading">
        <div><small>PRIORITY QUEUE</small><h3>Needs attention</h3></div>
      </div>
      {attention.length > 0 ? attention.map((task: any) => {
        const title = compact(task.subject || task.type || "Operational task", 105);
        const preview = compact(task.notes || "Open task details", 175);
        return <button className="attention-row" key={task.id} onClick={() => onOpen("tasks")}>
          <span><AlertCircle size={15}/></span>
          <div>
            <strong>{title}</strong>
            <p><b>{compact(task.property || "General", 45)}</b><i>·</i>{preview}</p>
          </div>
          <b>View task <ArrowRight size={13}/></b>
        </button>;
      }) : <div className="calm-empty">
        <span><Check size={18}/></span>
        <div><strong>Everything is under control</strong><p>No urgent tasks need attention right now.</p></div>
      </div>}
    </section>
  </div>;
}
