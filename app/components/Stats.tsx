import { Task } from "../types/tasks";

function isDone(t: Task) {
  return (t.status || "").toLowerCase().includes("done") ||
    (t.status || "").toLowerCase().includes("completed");
}

export default function Stats({ tasks }: { tasks: Task[] }) {
  const urgent = tasks.filter(
    (t) => (t.priority || "").toLowerCase() === "high" && !isDone(t)
  ).length;

  const pending = tasks.filter(
    (t) => (t.status || "").toLowerCase() === "pending"
  ).length;

  const active = tasks.filter((t) =>
    (t.status || "").toLowerCase().includes("progress")
  ).length;

  const done = tasks.filter(isDone).length;

  return (
    <section className="metrics">
      <div className="metric urgent"><span>Urgent</span><strong>{urgent}</strong></div>
      <div className="metric new"><span>Pending</span><strong>{pending}</strong></div>
      <div className="metric active"><span>Active</span><strong>{active}</strong></div>
      <div className="metric done"><span>Done</span><strong>{done}</strong></div>
    </section>
  );
}