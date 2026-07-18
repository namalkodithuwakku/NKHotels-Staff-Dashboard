"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { WorkspaceView } from "../../dashboards/TeamDashboard";

export default function StaffHome({ staffName, shift, counts, tasks, emails, onOpen }: any) {
  const attention = tasks.filter((task: any) => {
    const status = String(task.status || "").toLowerCase();
    const priority = String(task.priority || "").toLowerCase();
    return !status.includes("done") && ["high", "urgent", "critical"].includes(priority);
  }).slice(0, 4);
  const next = attention[0] || tasks.find((task: any) => !String(task.status || "").toLowerCase().includes("done"));
  const date = new Intl.DateTimeFormat("en", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return <div className="home-workspace">
    <section className="home-welcome">
      <div><small>{date}</small><h2>Good day, {staffName}</h2><p>{shift?.canWork ? `${shift?.shift || "Your shift"} is active. Focus on the next important action.` : `View only · ${shift?.nextShift ? `Next shift: ${shift.nextShift}` : shift?.status || "Off shift"}`}</p></div>
      <button onClick={() => onOpen("tasks" as WorkspaceView)} disabled={!next}>Continue Working <span>→</span></button>
    </section>
    <section className="workload-grid">
      {[["Urgent", counts.urgent, "red"], ["Pending", counts.pending, "amber"], ["Active", counts.active, "blue"], ["Done", counts.done, "green"]].map(([label, value, tone]) => <button key={String(label)} onClick={() => onOpen("tasks")} className={`workload ${tone}`}><small>{label}</small><strong>{value}</strong><span>View work →</span></button>)}
    </section>
    <section className="attention-panel">
      <div className="panel-heading"><div><small>EXCEPTIONS ONLY</small><h3>Needs Attention</h3></div><button onClick={() => onOpen("email")}>{emails.length} emails waiting</button></div>
      {attention.length === 0 ? <div className="calm-empty"><span>✓</span><div><strong>Everything looks calm</strong><p>No urgent exceptions need attention right now.</p></div></div> : attention.map((task: any) => <button className="attention-row" key={task.id} onClick={() => onOpen("tasks")}><span /><div><strong>{task.subject || task.type || "Operational task"}</strong><p>{task.property || "General"} · {task.notes || "Open task details"}</p></div><b>Open →</b></button>)}
    </section>
  </div>;
}
