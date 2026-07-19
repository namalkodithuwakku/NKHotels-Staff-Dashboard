import { Task } from "../../types/tasks";

type Props = {
  tasks: Task[];
};

function isDone(task: Task) {
  const s = (task.status || "").toLowerCase();
  return s.includes("done") || s.includes("completed");
}

function isPending(task: Task) {
  return (task.status || "").toLowerCase().includes("pending");
}

function isUrgent(task: Task) {
  return (task.priority || "").toLowerCase() === "high" && !isDone(task);
}

export default function ExecutiveActions({ tasks }: Props) {
  const urgent = tasks.filter(isUrgent);
  const pending = tasks.filter(isPending);
  const completed = tasks.filter(isDone);

  const firstUrgent = urgent[0];
  const firstPending = pending[0];

  let recommendation = "Operations are running normally.";

  if (firstUrgent) {
    recommendation = `Review ${firstUrgent.property} immediately.`;
  } else if (firstPending) {
    recommendation = `Clear pending work at ${firstPending.property}.`;
  }

  return (
    <div className="glass-card">
      <h3>Executive Actions</h3>

      <div className="perf">
        <span>🚨 Immediate Attention</span>
        <strong>{urgent.length}</strong>
      </div>

      <div className="perf">
        <span>🟠 Pending Decisions</span>
        <strong>{pending.length}</strong>
      </div>

      <div className="perf">
        <span>✅ Recently Completed</span>
        <strong>{completed.length}</strong>
      </div>

      <hr style={{ margin: "18px 0", opacity: 0.15 }} />

      <strong style={{ display: "block", marginBottom: 8 }}>
        AI Recommendation
      </strong>

      <div className="ai-note">
        {recommendation}
      </div>
    </div>
  );
}