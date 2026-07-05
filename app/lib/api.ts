import { Task } from "../types/tasks";

export async function fetchTasks(): Promise<Task[]> {
  const response = await fetch("/api/tasks", {
    cache: "no-store",
  });

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Tasks API returned invalid JSON.");
  }

  if (!data.success) {
    throw new Error(data.error || "Failed to load tasks");
  }

  return data.tasks || [];
}

export async function updateTaskStatus(
  taskId: string,
  status: string,
  staffName: string
) {
  const params = new URLSearchParams({
    taskId,
    status,
    staffName,
  });

  const response = await fetch(
    `/api/tasks/update?${params.toString()}`,
    {
      method: "GET",
      cache: "no-store",
    }
  );

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    console.error("Task Update Response:", text);

    throw new Error(
      "Task update API returned invalid JSON.\n\n" +
      text.substring(0, 500)
    );
  }

  if (!data.success) {
    throw new Error(data.error || "Failed to update task");
  }

  return data;
}