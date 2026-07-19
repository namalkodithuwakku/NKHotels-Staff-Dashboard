import { StaffSession } from "../hooks/useAuth";
import { getNavigation } from "../config/navigation";

export default function Sidebar({
  staff,
  onLogout,
  shiftActive,
}: {
  staff: StaffSession;
  onLogout: () => void;
  shiftActive: boolean;
}) {
  const navItems = getNavigation(staff.access);

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo">
          <img
            src="/icons/Favicon.png"
            alt="NK Hotel OS"
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        </div>

        <div>
          <strong>NK Hotel OS</strong>
          <span>
            {staff.access === "Master"
              ? "Command Center"
              : "Operations Workspace"}
          </span>
        </div>
      </div>

      <nav>
        {navItems.map((item, index) => (
          <a
            key={item.label}
            href={item.href}
            className={index === 0 ? "active" : ""}
          >
            <span className="nav-dot"></span>
            {item.label}
          </a>
        ))}
      </nav>

      <div className="side-card">
        <div className="team-online">
          <span className={shiftActive ? "online-dot" : "online-dot muted"} />
          <strong>
            {staff.access === "Master" ? "Master Online" : "Team Online"}
          </strong>
        </div>

        <p>{staff.name}</p>
      </div>

      <button className="sidebar-logout" onClick={onLogout}>
        Logout
      </button>
    </aside>
  );
}