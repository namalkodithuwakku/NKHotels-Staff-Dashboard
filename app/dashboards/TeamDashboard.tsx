"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from "react";
import { StaffSession } from "../hooks/useAuth";
import { useShift } from "../hooks/useShift";
import { useSuperMode } from "../hooks/useSuperMode";
import { useTasks } from "../hooks/useTasks";
import { fetchInboxNotificationCounts } from "../lib/api";
import OperationsStatusTabs from "../components/status/OperationsStatusTabs";
import StaffHome from "../components/home/StaffHome";
import ShiftTasks from "../components/tasks/ShiftTasks";
import WhatsAppInbox from "../components/whatsapp/WhatsAppInbox";
import SmsCenter from "../components/sms/SmsCenter";
import ScheduledTasks from "../components/scheduled/ScheduledTasks";
import TaskCreatorModal from "../components/tasks/TaskCreatorModal";
import PropertiesWorkspace from "../components/properties/PropertiesWorkspace";
import ComingSoonWorkspace from "../components/shared/ComingSoonWorkspace";
import RosterWorkspace from "../components/roster/RosterWorkspace";
import MobileWorkspaceMenu from "../components/mobile/MobileWorkspaceMenu";
import TeamBreakWorkspace from "../components/team-break/TeamBreakWorkspace";
import NikoPet from "../components/pet/NikoPet";
import CalendarWorkspace from "../components/calendar/CalendarWorkspace";
import OccupancyInventoryWorkspace from "../components/occupancy/OccupancyInventoryWorkspace";
import RevenueManagerWorkspace from "../components/revenue/RevenueManagerWorkspace";

export type WorkspaceView = "home" | "tasks" | "whatsapp" | "sms" | "scheduled" | "properties" | "roster" | "calendar" | "occupancy" | "revenue-manager" | "faq" | "team-break";

const nav: Array<{ key: WorkspaceView; label: string; short: string }> = [
  { key: "home", label: "Home", short: "Home" },
  { key: "tasks", label: "Shift Tasks", short: "Tasks" },
  { key: "whatsapp", label: "WhatsApp Inbox", short: "WhatsApp" },
  { key: "sms", label: "SMS Inbox", short: "SMS" },
  { key: "scheduled", label: "Scheduled Tasks", short: "Scheduled" },
  { key: "properties", label: "Properties", short: "Properties" },
  { key: "roster", label: "Roster", short: "Roster" },
  { key: "calendar", label: "Calendars", short: "Calendar" },
  { key: "occupancy", label: "Occupancy", short: "Inventory" },
  { key: "revenue-manager", label: "Revenue Manager", short: "Revenue" },
  { key: "faq", label: "Hotel FAQ", short: "FAQ" },
  { key: "team-break", label: "NKH Academy", short: "Academy" },
];

export default function TeamDashboard({ staff, onLogout }: { staff: StaffSession; onLogout: () => void }) {
  const availableNav = nav.filter(item =>
    item.key === "whatsapp" ? staff.canAccessWhatsApp === true :
    item.key === "sms" ? staff.canAccessSms === true :
    true
  );
  const { shift } = useShift(staff.name);
  const canWork = shift?.canWork === true;
  const superMode = useSuperMode({
    staffName: staff.name,
    staffPhone: (staff as any).phone || (staff as any).whatsapp || "",
    shiftActive: canWork,
  });
  const canUseTasks = superMode.canUseTasks;
  const { last24Tasks, loading, error, reload, closeTasksOptimistically } = useTasks(
    staff.name,
    canUseTasks,
    false,
    shift?.shift,
    shift?.scheduledStart,
    shift?.scheduledEnd
  );
  const [view, setView] = useState<WorkspaceView>("home");
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [channelCounts, setChannelCounts] = useState({ tasks: 0, whatsapp: 0, sms: 0 });

  async function refreshAll() {
    await Promise.all([
      reload(),
      fetchInboxNotificationCounts().then(setChannelCounts).catch(err =>
        console.error("Task notification refresh failed.", err)
      ),
    ]);
  }

  useEffect(() => {
    async function loadNotificationCounts() {
      try {
        setChannelCounts(await fetchInboxNotificationCounts());
      } catch (err) {
        console.error("Notification count refresh failed.", err);
      }
    }

    void loadNotificationCounts();
    const timer = window.setInterval(loadNotificationCounts, 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const openAcademy = () => setView("team-break");
    window.addEventListener("nkh-open-academy", openAcademy);
    return () => window.removeEventListener("nkh-open-academy", openAcademy);
  }, []);

  const counts = useMemo(() => {
    let urgent = 0, pending = 0, active = 0, done = 0;
    last24Tasks.forEach((task: any) => {
      const status = String(task.status || "").trim().toLowerCase();
      const priority = String(task.priority || "").toLowerCase();
      const closed = ["done", "completed", "ignored", "acknowledged", "cancelled", "canceled"]
        .some(value => status.includes(value));
      if (closed) done++;
      else if (status.includes("progress")) active++;
      else {
        pending++;
        if (["high", "urgent", "critical"].includes(priority)) urgent++;
      }
    });
    return { urgent, pending, active, done };
  }, [last24Tasks]);

  const notificationCounts: Partial<Record<WorkspaceView, number>> = {
    tasks: counts.pending + counts.active,
    whatsapp: channelCounts.whatsapp,
    sms: channelCounts.sms,
  };

  const activeShiftStaffName = canWork
    ? staff.name
    : String((shift as any)?.activeStaffName || (shift as any)?.onShiftStaffName || "");

  return (
    <main className={`staff-os ${view === "team-break" ? "academy-focus-mode" : ""}`}>
      <aside className="staff-rail">
        <div className="staff-brand"><span>NKH</span><strong><em>Dashboard</em></strong></div>
        <nav aria-label="Main workspace">
          {availableNav.map(item => (
            <button key={item.key} className={view === item.key ? "active" : ""} onClick={() => setView(item.key)}>
              <span className={`nav-mark nav-${item.key}`} />{item.label}
              {Boolean(notificationCounts[item.key]) && <b>{notificationCounts[item.key]}</b>}
            </button>
          ))}
        </nav>
        <div className="staff-user">
          <span>{staff.name.slice(0, 1).toUpperCase()}</span>
          <div><strong>{staff.name}</strong><small>{staff.access || "Team"}</small></div>
          <button onClick={onLogout} title="Log out">↗</button>
        </div>
      </aside>

      <section className="staff-stage">
        <header className="staff-topbar">
          <div>
            <small>NKH OPERATIONS WORKSPACE</small>
            <h1>{availableNav.find(item => item.key === view)?.label}</h1>
          </div>
          <OperationsStatusTabs
            currentStaffName={staff.name}
            currentUserOnShift={canWork}
            activeShiftStaffName={activeShiftStaffName}
            superActive={superMode.status.active}
            superIsMine={superMode.isMine}
            superStaffName={superMode.status.staffName}
            superRemainingLabel={superMode.remainingLabel}
            loading={superMode.loading}
            actionLoading={superMode.actionLoading}
            onStartSuper={() => void superMode.start()}
            onExtendSuper={() => void superMode.extend()}
            onEndSuper={() => void superMode.end("Ended by staff")}
          />
        </header>

        <div className="staff-content">
          {view === "home" && <StaffHome staffName={staff.name} shift={shift} counts={counts} tasks={last24Tasks} onOpen={setView} />}
          {view === "tasks" && <ShiftTasks tasks={last24Tasks} staffName={staff.name} canUseTasks={canUseTasks} loading={loading} error={error} onCreate={() => setCreatorOpen(true)} onRefresh={refreshAll} onOptimisticClose={closeTasksOptimistically} />}
          {view === "whatsapp" && <WhatsAppInbox staff={staff} onCreate={() => setCreatorOpen(true)} />}
          {view === "scheduled" && <ScheduledTasks onCreate={() => setCreatorOpen(true)} />}
          {view === "properties" && <PropertiesWorkspace access={staff.access} />}
          {view === "sms" && <SmsCenter staff={staff} />}
          {view === "roster" && <RosterWorkspace />}
          {view === "calendar" && <CalendarWorkspace />}
          {view === "occupancy" && <OccupancyInventoryWorkspace />}
          {view === "revenue-manager" && <RevenueManagerWorkspace />}
          {view === "faq" && <ComingSoonWorkspace title="Hotel FAQ" description="Search approved answers across every active property profile." />}
          {view === "team-break" && <TeamBreakWorkspace staffName={staff.name} />}
        </div>
      </section>

      <MobileWorkspaceMenu items={availableNav} primaryKeys={["home", "tasks", "whatsapp", "roster"].filter(key => availableNav.some(item => item.key === key))} activeKey={view} counts={notificationCounts} onSelect={key => setView(key as WorkspaceView)} onLogout={onLogout} />

      <button className="staff-fab" onClick={() => setCreatorOpen(true)} aria-label="Create task">＋</button>
      <TaskCreatorModal open={creatorOpen} onClose={() => setCreatorOpen(false)} staff={staff} shift={shift} onCreated={refreshAll} />
      <NikoPet staffName={staff.name} compact={view === "tasks" || view === "whatsapp" || view === "sms" || view === "occupancy" || view === "revenue-manager"} />
    </main>
  );
}
