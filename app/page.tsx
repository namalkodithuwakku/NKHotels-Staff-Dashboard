"use client";

import Login from "./components/Login";
import { useAuth } from "./hooks/useAuth";

import TeamDashboard from "./dashboards/TeamDashboard";
import SupervisorDashboard from "./dashboards/SupervisorDashboard";
import MasterDashboard from "./dashboards/MasterDashboard";

export default function Home() {
  const { staff, ready, login, logout } = useAuth();

  if (!ready) return null;

  if (!staff) {
    return <Login onLogin={login} />;
  }

  const access = String(staff.access || "")
    .trim()
    .toLowerCase();

switch (access) {
  case "master":
    return (
      <MasterDashboard
        staff={staff}
        onLogout={logout}
      />
    );

  case "supervisor":
    return (
      <SupervisorDashboard
        staff={staff}
        onLogout={logout}
      />
    );

  default:
    return (
      <TeamDashboard
        staff={staff}
        onLogout={logout}
      />
    );
}
}