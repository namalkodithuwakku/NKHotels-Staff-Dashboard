import { Task } from "../../types/tasks";

type PropertySummary = {
  name: string;
  total: number;
  pending: number;
  urgent: number;
  completed: number;
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

export default function PropertyHealth({ tasks }: { tasks: Task[] }) {
  const map = new Map<string, PropertySummary>();

  tasks.forEach((task) => {
    const property = (task.property || "Unknown").trim();

    if (!map.has(property)) {
      map.set(property, {
        name: property,
        total: 0,
        pending: 0,
        urgent: 0,
        completed: 0,
      });
    }

    const item = map.get(property)!;

    item.total++;

    if (isPending(task)) item.pending++;
    if (isUrgent(task)) item.urgent++;
    if (isDone(task)) item.completed++;
  });

  const list = Array.from(map.values()).sort(
    (a, b) => b.urgent - a.urgent || b.pending - a.pending
  );

  return (
    <div className="glass-card">
      <h3>Property Health</h3>

      {list.map((property) => {
        let color = "green";
        let label = "Healthy";

        if (property.urgent > 0) {
          color = "red";
          label = `${property.urgent} Urgent`;
        } else if (property.pending > 0) {
          color = "blue";
          label = `${property.pending} Pending`;
        }

        return (
          <div className="perf" key={property.name}>
            <span>
              {property.name}
              <br />
              <small>{property.total} tasks</small>
            </span>

            <strong className={color}>{label}</strong>
          </div>
        );
      })}

      {list.length === 0 && (
        <div className="brief-item blue">
          No property activity found.
        </div>
      )}
    </div>
  );
}