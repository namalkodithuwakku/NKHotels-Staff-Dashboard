"use client";

import { useEffect, useState } from "react";
import { fetchTasks } from "../lib/api";
import { Task } from "../types/tasks";

export function useTasks(staffName?: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadTasks() {
    try {
      const data = await fetchTasks();

      const filtered = staffName
        ? data.filter(
            (t) =>
              (t.assignedTo || "").toLowerCase().trim() ===
              staffName.toLowerCase().trim()
          )
        : data;

      setTasks(filtered);
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
  }, [staffName]);

  return { tasks, loading, error, reload: loadTasks };
}