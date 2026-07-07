"use client";

import { useEffect, useState } from "react";
import { fetchTasks } from "../lib/api";
import { Task } from "../types/tasks";

function parseTaskTime(time?: string) {
  if (!time) return 0;

  const direct = new Date(time).getTime();
  if (!Number.isNaN(direct)) return direct;

  const match = time.match(
    /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i
  );

  if (!match) return 0;

  let [, dd, mm, yyyy, hh, min, ampm] = match;
  let hour = Number(hh);

  if (ampm) {
    const ap = ampm.toUpperCase();
    if (ap === "PM" && hour !== 12) hour += 12;
    if (ap === "AM" && hour === 12) hour = 0;
  }

  return new Date(
    Number(yyyy),
    Number(mm) - 1,
    Number(dd),
    hour,
    Number(min)
  ).getTime();
}

function isDone(task: Task) {
  const status = (task.status || "").toLowerCase();
  return status.includes("done") || status.includes("completed");
}

function isActiveTask(task: Task) {
  return !isDone(task);
}

function isAssignedToStaff(task: Task, staffName?: string) {
  if (!staffName) return false;

  return (
    (task.assignedTo || "").toLowerCase().trim() ===
    staffName.toLowerCase().trim()
  );
}

function isDoneWithin24Hours(task: Task) {
  if (!isDone(task)) return false;

  const doneTime = parseTaskTime(task.doneTime);
  if (!doneTime) return false;

  return Date.now() - doneTime <= 24 * 60 * 60 * 1000;
}

function isDoneWithinShift(
  task: Task,
  scheduledStart?: string,
  scheduledEnd?: string
) {
  if (!isDone(task)) return false;

  const doneTime = parseTaskTime(task.doneTime);
  const start = parseTaskTime(scheduledStart);
  const end = parseTaskTime(scheduledEnd);

  if (!doneTime || !start || !end) return false;

  return doneTime >= start && doneTime <= end;
}

export function useTasks(
  staffName?: string,
  canWork?: boolean,
  isMaster?: boolean,
  scheduledStart?: string,
  scheduledEnd?: string
) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadTasks() {
    try {
      const data = await fetchTasks();
      
      const visibleTasks = isMaster
        ? data.filter((task) => isActiveTask(task) || isDoneWithin24Hours(task))
        : data.filter(
            (task) =>
              isAssignedToStaff(task, staffName) &&
              (isActiveTask(task) ||
                isDoneWithinShift(task, scheduledStart, scheduledEnd))
          );

      setTasks(visibleTasks);
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
  }, [staffName, canWork, isMaster, scheduledStart, scheduledEnd]);

  return { tasks, loading, error, reload: loadTasks };
}