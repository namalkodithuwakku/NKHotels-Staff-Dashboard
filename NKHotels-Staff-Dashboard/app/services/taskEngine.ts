import { Task } from "../types/tasks";

const DAY_MS = 24 * 60 * 60 * 1000;

function clean(value?: string) {
  return String(value || "").trim().toLowerCase();
}

function isCompletedStatus(status?: string) {
  const value = clean(status);

  return (
    value.includes("done") ||
    value.includes("completed")
  );
}

function isActiveStatus(status?: string) {
  return clean(status).includes("progress");
}

function isWaitingStatus(status?: string) {
  return (
    !isCompletedStatus(status) &&
    !isActiveStatus(status)
  );
}

function isUrgentPriority(priority?: string) {
  const value = clean(priority);

  return (
    value === "high" ||
    value === "urgent" ||
    value === "critical"
  );
}

export function parseTaskTime(time?: string): number {
  if (!time) return 0;

  const direct = new Date(time).getTime();
  if (!Number.isNaN(direct)) return direct;

  const match = String(time).match(
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

function getTaskTimes(task: Task) {
  return [
    parseTaskTime(task.createdTime),
    parseTaskTime((task as any).sentTime),
    parseTaskTime((task as any).acceptedTime),
    parseTaskTime((task as any).startedTime),
    parseTaskTime(task.doneTime),
  ].filter(Boolean);
}

function getSortTime(task: Task) {
  const times = getTaskTimes(task);
  return times.length ? Math.max(...times) : 0;
}

export function sortNewest(tasks: Task[]) {
  return [...tasks].sort((a, b) => getSortTime(b) - getSortTime(a));
}

export function getAssignedTasks(tasks: Task[], staffName?: string) {
  if (!staffName) return [];

  const staff = clean(staffName);

  return tasks.filter((task) => {
    const assigned = clean(task.assignedTo);

    return (
      assigned === staff ||
      assigned.includes(staff) ||
      staff.includes(assigned)
    );
  });
}

export function getDashboardTasks(tasks: Task[]) {
  const now = new Date();

  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 1);
  cutoff.setHours(22, 0, 0, 0);

  return tasks.filter((task) => {
    if (!isCompletedStatus(task.status)) return true;

    const times = getTaskTimes(task);
    return times.some((time) => time >= cutoff.getTime());
  });
}

export function getShiftTasks(
  tasks: Task[],
  scheduledStart?: string,
  scheduledEnd?: string
) {
  const start = parseTaskTime(scheduledStart);
  const end = parseTaskTime(scheduledEnd);

  if (!start || !end) return [];

  return tasks.filter((task) => {
    const times = getTaskTimes(task);

    return times.some((time) => time >= start && time <= end);
  });
}

export function getPendingTasks(tasks: Task[]) {
  return tasks.filter((task) => isWaitingStatus(task.status));
}

export function getActiveTasks(tasks: Task[]) {
  return tasks.filter((task) => isActiveStatus(task.status));
}

export function getCompletedTasks(tasks: Task[]) {
  return tasks.filter((task) => isCompletedStatus(task.status));
}

export function getUrgentTasks(tasks: Task[]) {
  return tasks.filter(
    (task) =>
      isUrgentPriority(task.priority) &&
      isWaitingStatus(task.status)
  );
}

export function getStats(tasks: Task[]) {
  return {
    total: tasks.length,
    urgent: getUrgentTasks(tasks).length,
    pending: getPendingTasks(tasks).length,
    active: getActiveTasks(tasks).length,
    completed: getCompletedTasks(tasks).length,
  };
}

export function getShiftPerformance(tasks: Task[]) {
  const assigned = tasks.length;
  const urgent = getUrgentTasks(tasks).length;
  const pending = getPendingTasks(tasks).length;
  const active = getActiveTasks(tasks).length;
  const completed = getCompletedTasks(tasks).length;

  const completionRate =
    assigned === 0 ? 100 : Math.round((completed / assigned) * 100);

  return {
    assigned,
    urgent,
    pending,
    active,
    completed,
    completionRate,
  };
}
