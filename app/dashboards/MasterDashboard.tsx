"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { StaffSession } from "../hooks/useAuth";
import { useTasks } from "../hooks/useTasks";
import { fetchInboxNotificationCounts } from "../lib/api";
import ShiftTasks from "../components/tasks/ShiftTasks";
import ScheduledTasks from "../components/scheduled/ScheduledTasks";
import WhatsAppInbox from "../components/whatsapp/WhatsAppInbox";
import SmsCenter from "../components/sms/SmsCenter";
import PropertiesWorkspace from "../components/properties/PropertiesWorkspace";
import RosterWorkspace from "../components/roster/RosterWorkspace";
import StaffProfilesWorkspace from "../components/master/StaffProfilesWorkspace";
import ComingSoonWorkspace from "../components/shared/ComingSoonWorkspace";
import MobileWorkspaceMenu from "../components/mobile/MobileWorkspaceMenu";
import TaskCreatorModal from "../components/tasks/TaskCreatorModal";
import TeamBreakWorkspace from "../components/team-break/TeamBreakWorkspace";
import NikoPet from "../components/pet/NikoPet";
import CalendarWorkspace from "../components/calendar/CalendarWorkspace";
import ReservationToolsWorkspace from "../components/reservation-tools/ReservationToolsWorkspace";
import OccupancyInventoryWorkspace from "../components/occupancy/OccupancyInventoryWorkspace";
import RevenueManagerWorkspace from "../components/revenue/RevenueManagerWorkspace";

type MasterView = "overview" | "tasks" | "scheduled" | "properties" | "staff" | "roster" | "calendar" | "occupancy" | "revenue-manager" | "reservation-tools" | "whatsapp" | "sms" | "team-break" | "reports" | "settings";
const navigation: Array<{ key: MasterView; label: string }> = [
  { key: "overview", label: "Overview" }, { key: "tasks", label: "Company Tasks" },
  { key: "scheduled", label: "Scheduled Tasks" }, { key: "properties", label: "Properties" },
  { key: "staff", label: "Staff Profiles" }, { key: "roster", label: "Roster" },
  { key: "calendar", label: "Calendars" }, { key: "occupancy", label: "Occupancy" },
  { key: "revenue-manager", label: "Revenue Manager" }, { key: "reservation-tools", label: "NKH Tools" },
  { key: "whatsapp", label: "WhatsApp Inbox" }, { key: "sms", label: "SMS Center" },
  { key: "team-break", label: "NKH Academy" }, { key: "reports", label: "Reports" },
  { key: "settings", label: "Settings" },
];

export default function MasterDashboard({ staff, onLogout }: { staff: StaffSession; onLogout: () => void }) {
  const [view, setView] = useState<MasterView>("overview"), [creatorOpen, setCreatorOpen] = useState(false);
  const [channelCounts, setChannelCounts] = useState({ tasks: 0, whatsapp: 0, sms: 0 });
  const { last24Tasks, loading, error, reload, closeTasksOptimistically } = useTasks(staff.name, true, true);
  useEffect(() => {
    async function loadNotificationCounts() {
      try { setChannelCounts(await fetchInboxNotificationCounts()); }
      catch (reason) { console.error("Notification count refresh failed.", reason); }
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
  async function refreshAll() {
    await Promise.all([reload(), fetchInboxNotificationCounts().then(setChannelCounts).catch(reason => console.error("Task notification refresh failed.", reason))]);
  }
  const counts = useMemo(() => {
    let urgent = 0, open = 0, active = 0, done = 0;
    last24Tasks.forEach((task: any) => {
      const status = String(task.status || "").trim().toLowerCase(), priority = String(task.priority || "").toLowerCase();
      const closed = ["done", "completed", "ignored", "acknowledged", "cancelled", "canceled"].some(value => status.includes(value));
      if (closed) done++; else if (status.includes("progress")) active++; else { open++; if (["high", "urgent", "critical"].includes(priority)) urgent++; }
    });
    return { urgent, open, active, done };
  }, [last24Tasks]);
  const notificationCounts: Partial<Record<MasterView, number>> = { tasks: counts.open + counts.active, whatsapp: channelCounts.whatsapp, sms: channelCounts.sms };
  const shift = { canWork: true, shift: "Master", scheduledStart: "", scheduledEnd: "", activeStaffName: staff.name };

  return <main className="staff-os master-os"><aside className="staff-rail">
    <div className="staff-brand"><span>NKH</span><strong><em>Dashboard</em></strong></div><div className="master-rail-label">MASTER WORKSPACE</div>
    <nav aria-label="Master workspace">{navigation.map(item => <button key={item.key} className={view === item.key ? "active" : ""} onClick={() => setView(item.key)}><span className={`nav-mark nav-${item.key}`} />{item.label}{Boolean(notificationCounts[item.key]) && <b>{notificationCounts[item.key]}</b>}</button>)}</nav>
    <div className="staff-user"><span>{staff.name.slice(0,1).toUpperCase()}</span><div><strong>{staff.name}</strong><small>Master</small></div><button onClick={onLogout}>↗</button></div>
  </aside><section className="staff-stage"><header className="staff-topbar master-topbar"><div><small>NKH COMMAND CENTER</small><h1>{navigation.find(item => item.key === view)?.label}</h1></div><div className="master-top-actions"><span><i />Master access</span><button className="primary-action" onClick={() => setCreatorOpen(true)}>＋ Create Task</button></div></header><div className="staff-content">
    {view === "overview" && <div className="master-overview"><section className="home-welcome"><div><small>COMPANY OPERATIONS</small><h2>Good day, {staff.name}</h2><p>Live operational overview across N K Hotels.</p></div><button onClick={() => setCreatorOpen(true)}>Create action <span>→</span></button></section><div className="workload-grid"><button className="workload red" onClick={() => setView("tasks")}><small>URGENT</small><strong>{counts.urgent}</strong><span>Needs attention</span></button><button className="workload amber" onClick={() => setView("tasks")}><small>OPEN</small><strong>{counts.open}</strong><span>Company queue</span></button><button className="workload blue" onClick={() => setView("tasks")}><small>IN PROGRESS</small><strong>{counts.active}</strong><span>Active work</span></button><button className="workload green" onClick={() => setView("tasks")}><small>COMPLETED</small><strong>{counts.done}</strong><span>Last 24 hours</span></button></div><div className="master-quick-grid"><button onClick={() => setView("staff")}><span>SP</span><strong>Staff Profiles</strong><small>Phones, access and operational records</small></button><button onClick={() => setView("roster")}><span>RO</span><strong>Roster</strong><small>Team scheduling and coverage</small></button><button onClick={() => setView("properties")}><span>PR</span><strong>Properties</strong><small>Profiles, rates and FAQs</small></button><button onClick={() => setView("reservation-tools")}><span>RA</span><strong>Reservation Audit</strong><small>Compare OTA exports with calendars</small></button></div></div>}
    {view === "tasks" && <ShiftTasks tasks={last24Tasks} staffName={staff.name} canUseTasks loading={loading} error={error} onCreate={() => setCreatorOpen(true)} onRefresh={refreshAll} onOptimisticClose={closeTasksOptimistically} />}
    {view === "scheduled" && <ScheduledTasks onCreate={() => setCreatorOpen(true)} />}
    {view === "properties" && <PropertiesWorkspace access="Master" />}
    {view === "staff" && <StaffProfilesWorkspace />}
    {view === "roster" && <RosterWorkspace />}
    {view === "calendar" && <CalendarWorkspace />}
    {view === "occupancy" && <OccupancyInventoryWorkspace />}
    {view === "revenue-manager" && <RevenueManagerWorkspace />}
    {view === "reservation-tools" && <ReservationToolsWorkspace />}
    {view === "whatsapp" && <WhatsAppInbox staff={staff} onCreate={() => setCreatorOpen(true)} />}
    {view === "sms" && <SmsCenter staff={staff} />}
    {view === "reports" && <ComingSoonWorkspace title="Reports" description="Company performance, roster coverage and service reports will appear here." />}
    {view === "settings" && <ComingSoonWorkspace title="Settings" description="Company-wide integrations, access rules and operational defaults will appear here." />}
    {view === "team-break" && <TeamBreakWorkspace staffName={staff.name} canRegenerate />}
  </div></section><MobileWorkspaceMenu items={navigation} primaryKeys={["overview","tasks","calendar","occupancy"]} activeKey={view} counts={notificationCounts} onSelect={key => setView(key as MasterView)} onLogout={onLogout} /><button className="staff-fab" onClick={() => setCreatorOpen(true)}>＋</button><TaskCreatorModal open={creatorOpen} onClose={() => setCreatorOpen(false)} staff={staff} shift={shift} onCreated={refreshAll} /><NikoPet staffName={staff.name} compact={view === "tasks" || view === "whatsapp" || view === "sms" || view === "reservation-tools" || view === "occupancy" || view === "revenue-manager"} /></main>;
}
