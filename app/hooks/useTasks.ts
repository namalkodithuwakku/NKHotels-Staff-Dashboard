"use client";

import { useEffect, useState } from "react";
import { fetchTasks } from "../lib/api";
import { Task } from "../types/tasks";

export function useTasks(staffName?: string, canWork?: boolean) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadTasks() {
    try {
      const data = await fetchTasks();

      // Everyone sees all tasks returned by API.
      // Action permission is controlled by canWork in Timeline.
      setTasks(data);

      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();

    const timer = setInterval(loadTasks, 20000);

    return () => clearInterval(timer);
  }, [staffName, canWork]);

  return { tasks, loading, error, reload: loadTasks };
}