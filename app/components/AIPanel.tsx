import { Task } from "../types/tasks";

type ShiftStats = {
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

type Performance = {
  assigned: number;
  urgent: number;
  pending: number;
  active: number;
  completed: number;
  completionRate: number;
};

function isDone(task: Task) {
  const status = (task.status || "").toLowerCase();
  return status.includes("done") || status.includes("completed");
}

export default function AIPanel({
  tasks,
  shiftTasks,
  performance,
  shiftActive,
  shift,
}: {
  tasks: Task[];
  shiftTasks: Task[];
  performance: Performance;
  shiftActive: boolean;
  shift?: ShiftInfo | null;
}) {
  const pending = tasks.filter(
    (task) => (task.status || "").toLowerCase() === "pending"
  );

  const active = tasks.filter((task) =>
    (task.status || "").toLowerCase().includes("progress")
  );

  const done = tasks.filter(isDone);

  const urgent = tasks.filter(
    (task) => (task.priority || "").toLowerCase() === "high" && !isDone(task)
  );

  const top = urgent[0] || pending[0] || active[0];
  const stats = shift?.stats || {};
  const rate = performance.completionRate;

  return (
    <aside className="right">
      <div className="glass-card ai ai-strong">
        <span className="assistant-badge">AI Assistant</span>

        <h3>{shiftActive ? "Live priority briefing" : "Shift summary"}</h3>

        <p className="big">
          {top
            ? `${top.property} should be checked first.`
            : "No urgent task needs attention right now."}
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
          <div>
            <i style={{ width: `${rate}%` }}></i>
          </div>
        </div>

        <div className="perf">
          <span>Shift Tasks</span>
          <strong>{performance.assigned}</strong>
        </div>

        <div className="perf">
          <span>Completed</span>
          <strong>{performance.completed}</strong>
        </div>

        <div className="perf">
          <span>Pending</span>
          <strong>{performance.pending}</strong>
        </div>

        <div className="perf">
          <span>In Progress</span>
          <strong>{performance.active}</strong>
        </div>

        <div className="perf">
          <span>Urgent</span>
          <strong>{performance.urgent}</strong>
        </div>

        <div className="perf">
          <span>Visible Tasks</span>
          <strong>{tasks.length}</strong>
        </div>

        <div className="perf">
          <span>Current Shift Items</span>
          <strong>{shiftTasks.length}</strong>
        </div>

        <div className="perf">
          <span>Grace Allowance</span>
          <strong>{stats.graceAllowanceMin || 0} min</strong>
        </div>

        <div className="perf">
          <span>Grace Used</span>
          <strong>{stats.graceUsedMin || 0} min</strong>
        </div>

        <div className="perf">
          <span>On-Time Rate</span>
          <strong>{stats.onTimeRate || 0}%</strong>
        </div>
      </div>
    </aside>
  );
}