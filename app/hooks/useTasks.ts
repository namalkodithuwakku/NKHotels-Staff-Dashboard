"use client";

import { useEffect, useState } from "react";
import { fetchTasks } from "../lib/api";

import {
  getAssignedTasks,
  getDashboardTasks,
  getShiftPerformance,
  getShiftTasks,
  getStats,
  sortNewest,
} from "../services/taskEngine";

import { Task } from "../types/tasks";

export function useTasks(
  staffName?: string,
  canWork?: boolean,
  isMaster?: boolean,
  currentShift?: string,
  scheduledStart?: string,
  scheduledEnd?: string
) {
  const [last24Tasks, setLast24Tasks] = useState<Task[]>([]);
  const [shiftTasks, setShiftTasks] = useState<Task[]>([]);

  const [stats, setStats] = useState({
    total: 0,
    urgent: 0,
    pending: 0,
    active: 0,
    completed: 0,
  });

  const [performance, setPerformance] = useState({
    assigned: 0,
    urgent: 0,
    pending: 0,
    active: 0,
    completed: 0,
    completionRate: 100,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadTasks() {
    try {
      setLoading(true);

      const allTasks = await fetchTasks();

      // -----------------------------
      // MASTER
      // -----------------------------

      if (isMaster) {
        const recent = sortNewest(
          getDashboardTasks(allTasks)
        );

        setLast24Tasks(recent);
        setShiftTasks(recent);

        setStats(getStats(recent));
        setPerformance(getShiftPerformance(recent));

        setError("");
        return;
      }

      // -----------------------------
      // TEAM
      // -----------------------------

// Personal tasks (used only for performance)
const assigned = getAssignedTasks(
  allTasks,
  staffName
);

// Timeline = entire team's last 24 hours
const recent = sortNewest(
  getDashboardTasks(allTasks)
);

// Performance = logged-in staff's current shift
const shift = sortNewest(
  getShiftTasks(
    assigned,
    scheduledStart,
    scheduledEnd
  )
);

      setLast24Tasks(recent);
      setShiftTasks(shift);

      setStats(getStats(recent));
      setPerformance(getShiftPerformance(shift));

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
  }, [
    staffName,
    canWork,
    isMaster,
    currentShift,
    scheduledStart,
    scheduledEnd,
  ]);

  return {
    last24Tasks,
    shiftTasks,
    stats,
    performance,
    loading,
    error,
    reload: loadTasks,
  };
}