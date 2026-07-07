import LiveClock from "../../components/LiveClock";
import { StaffSession } from "../../hooks/useAuth";

export default function CEOHeader({ staff }: { staff: StaffSession }) {
  return (
    <header className="hero polished-hero">
      <div>
        <p>N K Hotel OS</p>
        <h1>Operations Command Center</h1>
        <span className="sub">
          Good Day, {staff.name} · Master View · Company operations overview
        </span>
      </div>

      <div className="top-actions">
        <LiveClock />
        <div className="live-pill">
          <span></span>
          CEO View
        </div>
      </div>
    </header>
  );
}