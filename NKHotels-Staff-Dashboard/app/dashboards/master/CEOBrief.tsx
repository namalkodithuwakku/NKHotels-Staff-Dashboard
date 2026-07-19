import ExecutiveActions from "./ExecutiveActions";
import PropertyHealth from "./PropertyHealth";
import TeamOperations from "./TeamOperations";
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

  const pending = tasks.filter((task) =>
    (task.status || "").toLowerCase().includes("pending")
  );

  const completed = tasks.filter(isDone);

  const topTask = urgent[0] || pending[0];

  const statusText =
    urgent.length > 0
      ? `${urgent.length} urgent task${urgent.length > 1 ? "s" : ""} need attention.`
      : pending.length > 0
      ? `${pending.length} pending task${pending.length > 1 ? "s" : ""} remaining.`
      : "Company operations are running normally.";

  const recommendation = topTask
    ? `Check ${topTask.property || "the selected property"} first.`
    : "No immediate action required.";

  return (
    <aside className="right">
      <div className="glass-card ai ai-strong">
        <span className="assistant-badge">AI CEO Brief</span>

        <h3>Today's Operations</h3>

        <p className="big">{statusText}</p>

        <div className="brief-grid">
          <div className="brief-item red">
            {urgent.length} Urgent
          </div>

          <div className="brief-item blue">
            {pending.length} Pending
          </div>

          <div className="brief-item green">
            {completed.length} Completed
          </div>
        </div>

        <div className="ai-note">
          {recommendation}
        </div>
      </div>

      <ExecutiveActions tasks={tasks} />

      <PropertyHealth tasks={tasks} />

      <TeamOperations tasks={tasks} />
    </aside>
  );
}