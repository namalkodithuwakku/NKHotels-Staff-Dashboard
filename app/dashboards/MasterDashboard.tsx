"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from "react";
import { StaffSession } from "../hooks/useAuth";
import { useTasks } from "../hooks/useTasks";
import { fetchEmailReaderItems, fetchInboxNotificationCounts, refreshGmailInbox } from "../lib/api";
import ShiftTasks from "../components/tasks/ShiftTasks";
import EmailInbox from "../components/inbox/EmailInbox";
import WhatsAppInbox from "../components/whatsapp/WhatsAppInbox";
import PropertiesWorkspace from "../components/properties/PropertiesWorkspace";
import RosterWorkspace from "../components/roster/RosterWorkspace";
import StaffProfilesWorkspace from "../components/master/StaffProfilesWorkspace";
import ComingSoonWorkspace from "../components/shared/ComingSoonWorkspace";
import TaskCreatorModal from "../components/tasks/TaskCreatorModal";

type MasterView = "overview" | "tasks" | "properties" | "staff" | "roster" | "email" | "whatsapp" | "sms" | "reports" | "settings";
const navigation: Array<{ key: MasterView; label: string }> = [
  { key: "overview", label: "Overview" }, { key: "tasks", label: "Company Tasks" },
  { key: "properties", label: "Properties" }, { key: "staff", label: "Staff Profiles" },
  { key: "roster", label: "Roster" }, { key: "email", label: "Email Inbox" },
  { key: "whatsapp", label: "WhatsApp Inbox" }, { key: "sms", label: "SMS Center" },
  { key: "reports", label: "Reports" }, { key: "settings", label: "Settings" },
];

export default function MasterDashboard({ staff, onLogout }: { staff: StaffSession; onLogout: () => void }) {
  const [view, setView] = useState<MasterView>("overview"), [emails, setEmails] = useState<any[]>([]), [emailError, setEmailError] = useState(""), [emailLoading, setEmailLoading] = useState(false), [creatorOpen, setCreatorOpen] = useState(false);
  const [channelCounts, setChannelCounts] = useState({ whatsapp: 0, sms: 0 });
  const { last24Tasks, loading, error, reload } = useTasks(staff.name, true, true);
  const loadEmails = useCallback(async () => { try { setEmailLoading(true); setEmailError(""); setEmails(await fetchEmailReaderItems()); } catch (reason) { setEmailError(reason instanceof Error ? reason.message : "Unable to load email inbox."); } finally { setEmailLoading(false); } }, []);
  useEffect(() => {
    if (!["overview", "email"].includes(view)) return;
    void loadEmails();
    const inboxTimer = window.setInterval(loadEmails, 60000);

    async function syncGmail() {
      try {
        await refreshGmailInbox();
        await loadEmails();
      } catch (reason) {
        console.error("Automatic Gmail refresh failed.", reason);
      }
    }

    void syncGmail();
    const gmailTimer = window.setInterval(syncGmail, 120000);

    return () => {
      window.clearInterval(inboxTimer);
      window.clearInterval(gmailTimer);
    };
  }, [view, loadEmails]);
  useEffect(() => {
    async function loadNotificationCounts() {
      try {
        setChannelCounts(await fetchInboxNotificationCounts());
      } catch (reason) {
        console.error("Notification count refresh failed.", reason);
      }
    }
    void loadNotificationCounts();
    const timer = window.setInterval(loadNotificationCounts, 15000);
    return () => window.clearInterval(timer);
  }, []);
  async function refreshAll() { await Promise.all([reload(), loadEmails()]); }
  const counts = useMemo(() => { let urgent = 0, open = 0, active = 0, done = 0; last24Tasks.forEach((task: any) => { const status = String(task.status || "").toLowerCase(), priority = String(task.priority || "").toLowerCase(); if (status.includes("done") || status.includes("completed")) done++; else if (status.includes("progress")) active++; else { open++; if (["high", "urgent", "critical"].includes(priority)) urgent++; } }); return { urgent, open, active, done }; }, [last24Tasks]);
  const notificationCounts: Partial<Record<MasterView, number>> = {
    tasks: counts.open,
    email: emails.length,
    whatsapp: channelCounts.whatsapp,
    sms: channelCounts.sms,
  };
  const shift = { canWork: true, shift: "Master", scheduledStart: "", scheduledEnd: "", activeStaffName: staff.name };
  return <main className="staff-os master-os"><aside className="staff-rail"><div className="staff-brand"><span>N K</span><strong>Hotel <em>OS</em></strong></div><div className="master-rail-label">MASTER WORKSPACE</div><nav aria-label="Master workspace">{navigation.map(item => <button key={item.key} className={view === item.key ? "active" : ""} onClick={() => setView(item.key)}><span className={`nav-mark nav-${item.key}`} />{item.label}{Boolean(notificationCounts[item.key]) && <b>{notificationCounts[item.key]}</b>}</button>)}</nav><div className="staff-user"><span>{staff.name.slice(0,1).toUpperCase()}</span><div><strong>{staff.name}</strong><small>Master</small></div><button onClick={onLogout}>↗</button></div></aside><section className="staff-stage"><header className="staff-topbar master-topbar"><div><small>N K HOTELS COMMAND CENTER</small><h1>{navigation.find(item => item.key === view)?.label}</h1></div><div className="master-top-actions"><span><i />Master access</span><button className="primary-action" onClick={() => setCreatorOpen(true)}>＋ Create Task</button></div></header><div className="staff-content">
    {view === "overview" && <div className="master-overview"><section className="home-welcome"><div><small>COMPANY OPERATIONS</small><h2>Good day, {staff.name}</h2><p>Live operational overview across N K Hotels.</p></div><button onClick={() => setCreatorOpen(true)}>Create action <span>→</span></button></section><div className="workload-grid"><button className="workload red" onClick={() => setView("tasks")}><small>URGENT</small><strong>{counts.urgent}</strong><span>Needs attention</span></button><button className="workload amber" onClick={() => setView("tasks")}><small>OPEN</small><strong>{counts.open}</strong><span>Company queue</span></button><button className="workload blue" onClick={() => setView("tasks")}><small>IN PROGRESS</small><strong>{counts.active}</strong><span>Active work</span></button><button className="workload green" onClick={() => setView("tasks")}><small>COMPLETED</small><strong>{counts.done}</strong><span>Last 24 hours</span></button></div><div className="master-quick-grid"><button onClick={() => setView("staff")}><span>SP</span><strong>Staff Profiles</strong><small>Phones, access and operational records</small></button><button onClick={() => setView("roster")}><span>RO</span><strong>Roster</strong><small>Team scheduling and coverage</small></button><button onClick={() => setView("properties")}><span>PR</span><strong>Properties</strong><small>Profiles, rates and FAQs</small></button><button onClick={() => setView("email")}><span>EM</span><strong>Email Inbox</strong><small>{emails.length} items awaiting review</small></button></div></div>}
    {view === "tasks" && <ShiftTasks tasks={last24Tasks} staffName={staff.name} canUseTasks loading={loading} error={error} onCreate={() => setCreatorOpen(true)} onRefresh={refreshAll} />}
    {view === "properties" && <PropertiesWorkspace access="Master" />}{view === "staff" && <StaffProfilesWorkspace />}{view === "roster" && <RosterWorkspace />}
    {view === "email" && <EmailInbox items={emails} staff={staff} shift={shift} canUseTasks loading={emailLoading} error={emailError} onRefresh={loadEmails} onTaskCreated={refreshAll} />}{view === "whatsapp" && <WhatsAppInbox staff={staff} onCreate={() => setCreatorOpen(true)} />}
    {view === "sms" && <ComingSoonWorkspace title="SMS Center" description="Dialog SMS delivery, urgent-task alerts and delivery history will be managed here." />}{view === "reports" && <ComingSoonWorkspace title="Reports" description="Company performance, roster coverage and service reports will appear here." />}{view === "settings" && <ComingSoonWorkspace title="Settings" description="Company-wide integrations, access rules and operational defaults will appear here." />}
  </div></section><nav className="staff-mobile-nav" aria-label="Master mobile navigation">{navigation.filter(item => ["overview","tasks","properties","staff","roster"].includes(item.key)).map(item => <button key={item.key} className={view === item.key ? "active" : ""} onClick={() => setView(item.key)}><span className={`nav-mark nav-${item.key}`} /><small>{item.label.split(" ")[0]}</small></button>)}</nav><button className="staff-fab" onClick={() => setCreatorOpen(true)}>＋</button><TaskCreatorModal open={creatorOpen} onClose={() => setCreatorOpen(false)} staff={staff} shift={shift} onCreated={refreshAll} /></main>;
}
