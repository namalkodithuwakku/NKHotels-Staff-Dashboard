"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import { StaffSession } from "../hooks/useAuth";
import { useShift } from "../hooks/useShift";
import { useSuperMode } from "../hooks/useSuperMode";
import { useTasks } from "../hooks/useTasks";
import { fetchEmailReaderItems, fetchInboxNotificationCounts, refreshGmailInbox } from "../lib/api";
import OperationsStatusTabs from "../components/status/OperationsStatusTabs";
import StaffHome from "../components/home/StaffHome";
import ShiftTasks from "../components/tasks/ShiftTasks";
import EmailInbox from "../components/inbox/EmailInbox";
import WhatsAppInbox from "../components/whatsapp/WhatsAppInbox";
import ScheduledTasks from "../components/scheduled/ScheduledTasks";
import TaskCreatorModal from "../components/tasks/TaskCreatorModal";
import PropertiesWorkspace from "../components/properties/PropertiesWorkspace";
import ComingSoonWorkspace from "../components/shared/ComingSoonWorkspace";
import RosterWorkspace from "../components/roster/RosterWorkspace";

export type WorkspaceView = "home" | "tasks" | "email" | "whatsapp" | "sms" | "scheduled" | "properties" | "roster" | "calendar" | "faq";

const nav: Array<{ key: WorkspaceView; label: string; short: string }> = [
  { key: "home", label: "Home", short: "Home" },
  { key: "tasks", label: "Shift Tasks", short: "Tasks" },
  { key: "email", label: "Email Inbox", short: "Email" },
  { key: "whatsapp", label: "WhatsApp Inbox", short: "WhatsApp" },
  { key: "sms", label: "SMS Inbox", short: "SMS" },
  { key: "scheduled", label: "Scheduled Tasks", short: "Scheduled" },
  { key: "properties", label: "Properties", short: "Properties" },
  { key: "roster", label: "Roster", short: "Roster" },
  { key: "calendar", label: "Calendars", short: "Calendar" },
  { key: "faq", label: "Hotel FAQ", short: "FAQ" },
];

export default function TeamDashboard({ staff, onLogout }: { staff: StaffSession; onLogout: () => void }) {
  const { shift } = useShift(staff.name);
  const canWork = shift?.canWork === true;
  const superMode = useSuperMode({
    staffName: staff.name,
    staffPhone: (staff as any).phone || (staff as any).whatsapp || "",
    shiftActive: canWork,
  });
  const canUseTasks = superMode.canUseTasks;
  const { last24Tasks, loading, error, reload } = useTasks(
    staff.name,
    canUseTasks,
    false,
    shift?.shift,
    shift?.scheduledStart,
    shift?.scheduledEnd
  );
  const [view, setView] = useState<WorkspaceView>("home");
  const [emails, setEmails] = useState<any[]>([]);
  const [emailError, setEmailError] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [channelCounts, setChannelCounts] = useState({ whatsapp: 0, sms: 0 });

  async function loadEmails() {
    try {
      setEmailLoading(true);
      setEmailError("");
      setEmails(await fetchEmailReaderItems());
    } catch (err: any) {
      setEmailError(err?.message || "Unable to load the email inbox.");
    } finally { setEmailLoading(false); }
  }

  async function refreshAll() {
    await Promise.all([reload(), loadEmails()]);
  }

  useEffect(() => {
    if (!["home", "email"].includes(view)) return;
    void loadEmails();
    const inboxTimer = window.setInterval(loadEmails, 60000);

    async function syncGmail() {
      try {
        await refreshGmailInbox();
        await loadEmails();
      } catch (err) {
        console.error("Automatic Gmail refresh failed.", err);
      }
    }

    void syncGmail();
    const gmailTimer = window.setInterval(syncGmail, 120000);

    return () => {
      window.clearInterval(inboxTimer);
      window.clearInterval(gmailTimer);
    };
  }, [view]);

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

  const counts = useMemo(() => {
    let urgent = 0, pending = 0, active = 0, done = 0;
    last24Tasks.forEach((task: any) => {
      const status = String(task.status || "").toLowerCase();
      const priority = String(task.priority || "").toLowerCase();
      if (status.includes("done") || status.includes("completed")) done++;
      else if (status.includes("progress")) active++;
      else {
        pending++;
        if (["high", "urgent", "critical"].includes(priority)) urgent++;
      }
    });
    return { urgent, pending, active, done };
  }, [last24Tasks]);

  const notificationCounts: Partial<Record<WorkspaceView, number>> = {
    tasks: counts.pending,
    email: emails.length,
    whatsapp: channelCounts.whatsapp,
    sms: channelCounts.sms,
  };

  const activeShiftStaffName = canWork
    ? staff.name
    : String((shift as any)?.activeStaffName || (shift as any)?.onShiftStaffName || "");

  return (
    <main className="staff-os">
      <aside className="staff-rail">
        <div className="staff-brand"><span>N K</span><strong>Hotel <em>OS</em></strong></div>
        <nav aria-label="Main workspace">
          {nav.map(item => (
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
            <small>OPERATIONS WORKSPACE</small>
            <h1>{nav.find(item => item.key === view)?.label}</h1>
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
          {view === "home" && <StaffHome staffName={staff.name} shift={shift} counts={counts} tasks={last24Tasks} emails={emails} onOpen={setView} />}
          {view === "tasks" && <ShiftTasks tasks={last24Tasks} staffName={staff.name} canUseTasks={canUseTasks} loading={loading} error={error} onCreate={() => setCreatorOpen(true)} onRefresh={refreshAll} />}
          {view === "email" && <EmailInbox items={emails} staff={staff} shift={shift} canUseTasks={canUseTasks} loading={emailLoading} error={emailError} onRefresh={loadEmails} onTaskCreated={refreshAll} />}
          {view === "whatsapp" && <WhatsAppInbox staff={staff} onCreate={() => setCreatorOpen(true)} />}
          {view === "scheduled" && <ScheduledTasks onCreate={() => setCreatorOpen(true)} />}
          {view === "properties" && <PropertiesWorkspace access={staff.access} />}
          {view === "sms" && <ComingSoonWorkspace title="SMS Inbox" description="Property-linked SMS conversations and task creation will appear here." />}
          {view === "roster" && <RosterWorkspace />}
          {view === "calendar" && <ComingSoonWorkspace title="Calendars" description="Operational events, reminders and property schedules will appear here." />}
          {view === "faq" && <ComingSoonWorkspace title="Hotel FAQ" description="Search approved answers across every active property profile." />}
        </div>
      </section>

      <nav className="staff-mobile-nav" aria-label="Mobile workspace">
        {nav.filter(item => ["home", "tasks", "email", "whatsapp", "scheduled"].includes(item.key)).map(item => <button key={item.key} className={view === item.key ? "active" : ""} onClick={() => setView(item.key)}><span className={`nav-mark nav-${item.key}`} /><small>{item.short}</small>{Boolean(notificationCounts[item.key]) && <b>{notificationCounts[item.key]}</b>}</button>)}
      </nav>

      <button className="staff-fab" onClick={() => setCreatorOpen(true)} aria-label="Create task">＋</button>
      <TaskCreatorModal open={creatorOpen} onClose={() => setCreatorOpen(false)} staff={staff} shift={shift} onCreated={refreshAll} />
    </main>
  );
}
