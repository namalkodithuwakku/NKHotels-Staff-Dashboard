import { Task } from "../../types/tasks";

function isDone(task: Task) {
  const status = (task.status || "").toLowerCase();
  return status.includes("done") || status.includes("completed");
}

function isUrgent(task: Task) {
  return (task.priority || "").toLowerCase() === "high" && !isDone(task);
}

type Props = {
  tasks: Task[];
};

export default function CEOBrief({ tasks }: Props) {
  const urgent = tasks.filter(isUrgent);
  const pending = tasks.filter(
    (task) => (task.status || "").toLowerCase() === "pending"
  );
  const completed = tasks.filter(isDone);

  const topTask = urgent[0] || pending[0];

  const statusText =
    urgent.length > 0
      ? `${urgent.length} urgent task${urgent.length > 1 ? "s" : ""} need attention.`
      : pending.length > 0
      ? `${pending.length} pending task${pending.length > 1 ? "s" : ""} remaining.`
      : "Company operations are under control.";

  const recommendation = topTask
    ? `Check ${topTask.property || "the selected property"} first.`
    : "No immediate action required.";

  return (
    <aside className="right">
      <div className="glass-card ai ai-strong">
        <span className="assistant-badge">AI CEO Brief</span>

        <h3>Today’s Operations</h3>

        <p className="big">{statusText}</p>

        <div className="brief-grid">
          <div className="brief-item red">{urgent.length} urgent</div>
          <div className="brief-item blue">{pending.length} pending</div>
          <div className="brief-item green">{completed.length} completed</div>
        </div>

        <div className="ai-note">{recommendation}</div>
      </div>

      <div className="glass-card">
        <h3>Company Snapshot</h3>

        <div className="perf">
          <span>Total Visible Tasks</span>
          <strong>{tasks.length}</strong>
        </div>

        <div className="perf">
          <span>Urgent</span>
          <strong>{urgent.length}</strong>
        </div>

        <div className="perf">
          <span>Pending</span>
          <strong>{pending.length}</strong>
        </div>

        <div className="perf">
          <span>Completed</span>
          <strong>{completed.length}</strong>
        </div>
      </div>

      <div className="glass-card">
        <h3>Coming Next</h3>

        <div className="perf">
          <span>Staff Performance</span>
          <strong>Soon</strong>
        </div>

        <div className="perf">
          <span>Property Health</span>
          <strong>Soon</strong>
        </div>

        <div className="perf">
          <span>Weekly Report</span>
          <strong>Soon</strong>
        </div>
      </div>
    </aside>
  );
}