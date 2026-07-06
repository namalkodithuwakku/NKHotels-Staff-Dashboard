import { Task } from "../types/tasks";

type ShiftStats = {
  assigned?: number;
  started?: number;
  completed?: number;
  pending?: number;
  completionRate?: number;

  graceAllowanceMin?: number;
  graceUsedMin?: number;
  overdueTasks?: number;
  avgOverdueMin?: number;
  maxOverdueMin?: number;
  onTimeRate?: number;
};

type ShiftInfo = {
  stats?: ShiftStats;
};

function isDone(t: Task) {
  const s = (t.status || "").toLowerCase();
  return s.includes("done") || s.includes("completed");
}

export default function AIPanel({
  tasks,
  shiftActive,
  shift,
}: {
  tasks: Task[];
  shiftActive: boolean;
  shift?: ShiftInfo | null;
}) {
  const pending = tasks.filter(t => (t.status || "").toLowerCase() === "pending");
  const active = tasks.filter(t => (t.status || "").toLowerCase().includes("progress"));
  const done = tasks.filter(isDone);
  const urgent = tasks.filter(t => (t.priority || "").toLowerCase() === "high" && !isDone(t));

  const total = tasks.length;
  const rate = total ? Math.round((done.length / total) * 100) : 0;
  const top = urgent[0] || pending[0] || active[0];

  const stats = shift?.stats || {};

  return (
    <aside className="right">
      <div className="glass-card ai ai-strong">
        <span className="assistant-badge">AI Assistant</span>
        <h3>{shiftActive ? "Live priority briefing" : "Shift ended summary"}</h3>

        <p className="big">
          {top
            ? `${top.property} should be checked first.`
            : "All visible tasks are under control."}
        </p>

        <div className="brief-grid">
          <div className="brief-item red">{urgent.length} urgent</div>
          <div className="brief-item blue">{active.length} active</div>
          <div className="brief-item green">{done.length} completed</div>
        </div>

        <div className="ai-note">
          {shiftActive
            ? "Recommended order: urgent guest messages, cancellations, new bookings, then scheduled work."
            : "Review unfinished tasks before handover. Pending items should be transferred or escalated."}
        </div>
      </div>

      <div className="glass-card">
        <h3>Shift Performance</h3>

        <div className="score">
          <strong>{rate}%</strong>
          <span>Completion rate</span>
          <div><i style={{ width: `${rate}%` }}></i></div>
        </div>

        <div className="perf"><span>Total Tasks</span><strong>{total}</strong></div>
        <div className="perf"><span>Completed</span><strong>{done.length}</strong></div>
        <div className="perf"><span>Pending</span><strong>{pending.length}</strong></div>
        <div className="perf"><span>In Progress</span><strong>{active.length}</strong></div>

        <div className="perf"><span>Grace Allowance</span><strong>{stats.graceAllowanceMin || 0} min</strong></div>
        <div className="perf"><span>Grace Used</span><strong>{stats.graceUsedMin || 0} min</strong></div>
        <div className="perf"><span>On-Time Rate</span><strong>{stats.onTimeRate || 0}%</strong></div>
        <div className="perf"><span>Overdue Tasks</span><strong>{stats.overdueTasks || 0}</strong></div>
        <div className="perf"><span>Avg Overdue</span><strong>{stats.avgOverdueMin || 0} min</strong></div>
        <div className="perf"><span>Max Overdue</span><strong>{stats.maxOverdueMin || 0} min</strong></div>
      </div>
    </aside>
  );
}