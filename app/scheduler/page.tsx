"use client";

import { useState } from "react";
import Sidebar from "../components/Sidebar";
import LiveClock from "../components/LiveClock";
import Login from "../components/Login";
import { useAuth } from "../hooks/useAuth";

const taskTypes = [
  "Room Close",
  "Calendar Update",
  "Rate Update",
  "OTA Audit",
  "Guest Message",
  "Booking Follow-up",
  "Property Check",
  "Manual Task",
];

const priorities = ["Low", "Normal", "High", "Urgent"];
const frequencies = ["One Time", "Daily", "Weekly", "Monthly"];
const days = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function TaskSchedulerPage() {
  const { staff, ready, login, logout } = useAuth();

  const [taskName, setTaskName] = useState("");
  const [taskType, setTaskType] = useState("Room Close");
  const [propertyMode, setPropertyMode] = useState("Single");
  const [property, setProperty] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [frequency, setFrequency] = useState("One Time");
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const [startDate, setStartDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  if (!ready) return null;
  if (!staff) return <Login onLogin={login} />;

  const access = String(staff.access || "").trim().toLowerCase();
  const allowed = access === "master" || access === "supervisor";

  async function saveSchedule() {
    setMessage("");

    if (!taskName.trim()) {
      setMessage("Task name is required.");
      return;
    }

    if (propertyMode === "Single" && !property.trim()) {
      setMessage("Property is required for single property schedule.");
      return;
    }

    if (!assignTo.trim()) {
      setMessage("Assign To is required.");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch("/api/scheduler/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          taskName,
          taskType,
          propertyMode,
          property: propertyMode === "All Properties" ? "All Properties" : property,
          assignTo,
          priority,
          frequency,
          day,
          time,
          startDate,
          notes,
          createdBy: staff?.name || "System",
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setMessage(data.error || "Failed to save schedule.");
        return;
      }

      setTaskName("");
      setProperty("");
      setAssignTo("");
      setNotes("");
      setMessage(`Schedule created: ${data.templateId}`);
    } catch (err: any) {
      setMessage(err.message || "Failed to save schedule.");
    } finally {
      setSaving(false);
    }
  }

  if (!allowed) {
    return (
      <main className="os">
        <Sidebar staff={staff} onLogout={logout} shiftActive={false} />
        <section className="main">
          <header className="hero polished-hero">
            <div>
              <p>N K Hotel OS</p>
              <h1>Access Restricted</h1>
              <span className="sub">Task Scheduler is available for Master and Supervisor only.</span>
            </div>
            <div className="top-actions">
              <LiveClock />
              <div className="live-pill ended"><span></span>Team Access</div>
            </div>
          </header>
        </section>
      </main>
    );
  }

  return (
    <main className="os">
      <Sidebar staff={staff} onLogout={logout} shiftActive={true} />

      <section className="main">
        <header className="hero polished-hero">
          <div>
            <p>N K Hotel OS</p>
            <h1>Task Scheduler</h1>
            <span className="sub">Create one-time, weekly, and monthly property tasks.</span>
          </div>

          <div className="top-actions">
            <LiveClock />
            <div className="live-pill"><span></span>{access === "master" ? "Master Access" : "Supervisor Access"}</div>
          </div>
        </header>

        <div className="glass-card" style={{ maxWidth: 880 }}>
          <h3>New Scheduled Task</h3>

          <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
            <input
              className="premium-search"
              placeholder="Task name, example: Close empty rooms"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
            />

            <select className="premium-search" value={taskType} onChange={(e) => setTaskType(e.target.value)}>
              {taskTypes.map((item) => <option key={item}>{item}</option>)}
            </select>

            <select className="premium-search" value={propertyMode} onChange={(e) => setPropertyMode(e.target.value)}>
              <option>Single</option>
              <option>All Properties</option>
            </select>

            {propertyMode === "Single" && (
              <input
                className="premium-search"
                placeholder="Property name"
                value={property}
                onChange={(e) => setProperty(e.target.value)}
              />
            )}

            <input
              className="premium-search"
              placeholder="Assign to, example: Gayan / Visun / Shift Supervisor"
              value={assignTo}
              onChange={(e) => setAssignTo(e.target.value)}
            />

            <select className="premium-search" value={priority} onChange={(e) => setPriority(e.target.value)}>
              {priorities.map((item) => <option key={item}>{item}</option>)}
            </select>

            <select className="premium-search" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
              {frequencies.map((item) => <option key={item}>{item}</option>)}
            </select>

            {frequency === "Weekly" && (
              <select className="premium-search" value={day} onChange={(e) => setDay(e.target.value)}>
                {days.map((item) => <option key={item} value={item}>{item || "Select weekday"}</option>)}
              </select>
            )}

            {frequency === "Monthly" && (
              <input
                className="premium-search"
                placeholder="Monthly day, example: 1 or 15"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
            )}

            <input
              className="premium-search"
              placeholder="Time, example: 17:00"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />

            <input
              className="premium-search"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />

            <input
              className="premium-search"
              placeholder="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            {message && <div className="brief-item blue">{message}</div>}

            <button className="ghost" onClick={saveSchedule} disabled={saving}>
              {saving ? "Saving..." : "Save Schedule"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}