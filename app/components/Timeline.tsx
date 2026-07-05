import { useState } from "react";
import { Task } from "../types/tasks";
import { updateTaskStatus } from "../lib/api";

function shortId(id: string) {
  return id ? id.slice(-4).toUpperCase() : "-";
}

function normalizedStatus(task: Task) {
  const status = (task.status || "").toLowerCase();

  if (status.includes("done") || status.includes("completed")) return "completed";
  if (status.includes("progress")) return "progress";
  if (status.includes("waiting")) return "waiting";
  if (status.includes("escalated")) return "escalated";
  if ((task.priority || "").toLowerCase() === "high") return "urgent";

  return "pending";
}

function statusLabel(status: string) {
  if (status === "completed") return "✓ Completed";
  if (status === "progress") return "In Progress";
  if (status === "waiting") return "Waiting";
  if (status === "escalated") return "Escalated";
  if (status === "urgent") return "Urgent";
  return "Pending";
}

function taskColor(status: string) {
  if (status === "completed") return "green";
  if (status === "progress") return "blue";
  if (status === "waiting") return "purple";
  if (status === "escalated") return "red";
  if (status === "urgent") return "red";
  return "amber";
}

function taskTime(task: Task) {
  const raw = task.createdTime || "";
  const match = raw.match(/\d{2}\/\d{2}\/\d{4}\s+(\d{2}:\d{2})/);
  return match ? match[1] : "--:--";
}

export default function Timeline({
  tasks,
  staffName,
  onChanged,
  canWork,
}: {
  tasks: Task[];
  staffName: string;
  onChanged: () => void;
  canWork: boolean;
}) {
  const [updatingId, setUpdatingId] = useState("");
  const [completedNow, setCompletedNow] = useState<string[]>([]);

  async function changeStatus(taskId: string, status: string) {
    if (!canWork) return;

    try {
      setUpdatingId(taskId);

      if (status === "Done") {
        setCompletedNow((prev) => [...prev, taskId]);
      }

      await updateTaskStatus(taskId, status, staffName);

      setTimeout(() => {
        onChanged();
        setUpdatingId("");
      }, status === "Done" ? 900 : 300);
    } catch (err: any) {
      alert(err.message || "Failed to update task");
      setUpdatingId("");
      setCompletedNow((prev) => prev.filter((id) => id !== taskId));
    }
  }

  return (
    <div className="timeline">
      {!canWork && (
        <div className="view-only-banner">
          View only — task actions are enabled only during your roster shift.
        </div>
      )}

      {tasks.map((task) => {
        const temporaryCompleted = completedNow.includes(task.id);
        const status = temporaryCompleted ? "completed" : normalizedStatus(task);
        const color = taskColor(status);
        const isUpdating = updatingId === task.id;
        const isCompleted = status === "completed";

        return (
          <article
            className={`task ${color} ${isCompleted ? "task-completed" : ""} ${
              !canWork ? "task-view-only" : ""
            }`}
            key={task.id}
          >
            <div className="time-block">
              <span>{taskTime(task)}</span>
              <i></i>
            </div>

            <div className="task-content">
              <div className="task-main">
                <div>
                  <div className="task-title">
                    <span className={`status-dot ${color}`}></span>
                    <strong>{task.type || task.event || "Task"}</strong>
                    <em className={`status-badge ${color}`}>{statusLabel(status)}</em>
                  </div>

                  <div className="task-meta">
                    <span>{task.property}</span>
                    <span>{task.source}</span>
                    <span>{task.assignedTo || "Unassigned"}</span>
                    <span>{task.subject || task.notes || "-"}</span>
                  </div>
                </div>

                <div className="task-actions">
                  <span className="task-id">#{shortId(task.id)}</span>

                  {isCompleted ? (
                    <div className="completed-chip">
                      <span>✓</span>
                      Completed
                    </div>
                  ) : (
                    <div>
                      {status !== "progress" && (
                        <button
                          disabled={isUpdating || !canWork}
                          onClick={() => changeStatus(task.id, "In Progress")}
                        >
                          {isUpdating ? "..." : "Start"}
                        </button>
                      )}

                      <button
                        disabled={isUpdating || !canWork}
                        className="complete"
                        onClick={() => changeStatus(task.id, "Done")}
                      >
                        {isUpdating ? "..." : "Done"}
                      </button>

                      <button disabled={!canWork} className="more">
                        •••
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}