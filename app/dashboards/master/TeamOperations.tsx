import { Task } from "../../types/tasks";

type StaffSummary = {
  name: string;
  total: number;
  pending: number;
  active: number;
  completed: number;
  urgent: number;
};

function isDone(task: Task) {
  const status = (task.status || "").toLowerCase();
  return status.includes("done") || status.includes("completed");
}

function isProgress(task: Task) {
  return (task.status || "").toLowerCase().includes("progress");
}

function isPending(task: Task) {
  return (task.status || "").toLowerCase().includes("pending");
}

function isUrgent(task: Task) {
  return (task.priority || "").toLowerCase() === "high" && !isDone(task);
}

function getPerformanceLabel(staff: StaffSummary) {
  if (staff.urgent > 0) return "Needs Attention";
  if (staff.pending === 0 && staff.active === 0 && staff.completed > 0) return "Excellent";
  if (staff.pending <= 2) return "Good";
  return "Busy";
}

export default function TeamOperations({ tasks }: { tasks: Task[] }) {
  const staffMap = new Map<string, StaffSummary>();

  tasks.forEach((task) => {
    const name = (task.assignedTo || "Unassigned").trim();

    if (!staffMap.has(name)) {
      staffMap.set(name, {
        name,
        total: 0,
        pending: 0,
        active: 0,
        completed: 0,
        urgent: 0,
      });
    }

    const staff = staffMap.get(name)!;

    staff.total++;

    if (isPending(task)) staff.pending++;
    if (isProgress(task)) staff.active++;
    if (isDone(task)) staff.completed++;
    if (isUrgent(task)) staff.urgent++;
  });

  const staffList = Array.from(staffMap.values()).sort(
    (a, b) => b.urgent - a.urgent || b.pending - a.pending || b.completed - a.completed
  );

  return (
    <div className="glass-card">
      <h3>Team Operations</h3>

      {staffList.length === 0 && (
        <div className="brief-item blue">No staff activity found.</div>
      )}

      {staffList.map((staff) => {
        const label = getPerformanceLabel(staff);

        return (
          <div className="perf" key={staff.name}>
            <span>
              {staff.name}
              <br />
              <small>
                {staff.pending} pending · {staff.active} active · {staff.urgent} urgent
              </small>
            </span>

            <strong>{label}</strong>
          </div>
        );
      })}
    </div>
  );
}