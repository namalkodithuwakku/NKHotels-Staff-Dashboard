import { StaffSession } from "../hooks/useAuth";

const navItems = [
  "Work Queue",
  "Booking Calendar",
  "Properties",
  "Clients",
  "Reports",
  "Settings",
];

export default function Sidebar({
  staff,
  onLogout,
  shiftActive,
}: {
  staff: StaffSession;
  onLogout: () => void;
  shiftActive: boolean;
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div
          className="logo"
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <img
            src="/icons/N%20K%20Hotel%20OS%20Logo.png"
            alt="NK Hotel OS"
            style={{
              width: "88%",
              height: "88%",
              objectFit: "contain",
              display: "block",
            }}
          />
        </div>

        <div>
          <strong>NK Hotel OS</strong>
          <span>Operations Workspace</span>
        </div>
      </div>

      <nav>
        {navItems.map((item, index) => (
          <a key={item} className={index === 0 ? "active" : ""}>
            <span className="nav-dot"></span>
            {item}
          </a>
        ))}
      </nav>

      <div className="side-card">
        <span>Shift Status</span>
        <strong>{shiftActive ? "Online" : "Ended"}</strong>
        <p>{staff.name}</p>
      </div>

      <button className="sidebar-logout" onClick={onLogout}>
        Logout
      </button>
    </aside>
  );
}