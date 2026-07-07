"use client";

import Sidebar from "../components/Sidebar";
import { StaffSession } from "../hooks/useAuth";
import { useTasks } from "../hooks/useTasks";

import CEOHeader from "./master/CEOHeader";
import CompanyStats from "./master/CompanyStats";
import CompanyActivity from "./master/CompanyActivity";
import CEOBrief from "./master/CEOBrief";

import { Task } from "../types/tasks";

function isDone(task: Task) {
  const status = (task.status || "").toLowerCase();
  return status.includes("done") || status.includes("completed");
}

function isUrgent(task: Task) {
  return (task.priority || "").toLowerCase() === "high" && !isDone(task);
}

function uniqueCount(values: string[]) {
  return new Set(values.map((v) => v.trim()).filter(Boolean)).size;
}

export default function MasterDashboard({
  staff,
  onLogout,
}: {
  staff: StaffSession;
  onLogout: () => void;
}) {
  const { tasks, loading, error, reload } = useTasks(
    staff.name,
    true,
    true
  );

  const properties = uniqueCount(tasks.map((task) => task.property || ""));
  const staffCount = uniqueCount(tasks.map((task) => task.assignedTo || ""));
  const urgent = tasks.filter(isUrgent).length;
  const completed = tasks.filter(isDone).length;

  return (
    <main className="os">
      <Sidebar staff={staff} onLogout={onLogout} shiftActive={true} />

      <section className="main">
        <CEOHeader staff={staff} />

        <CompanyStats
          properties={properties}
          staff={staffCount}
          urgent={urgent}
          completed={completed}
        />

        <section className="workspace">
          <CompanyActivity
            tasks={tasks}
            staffName={staff.name}
            loading={loading}
            error={error}
            onReload={reload}
          />

          <CEOBrief tasks={tasks} />
        </section>
      </section>
    </main>
  );
}