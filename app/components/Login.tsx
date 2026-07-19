"use client";

import { useState } from "react";
import { ArrowRight, KeyRound, UserRound } from "lucide-react";
import { StaffSession } from "../hooks/useAuth";

export default function Login({ onLogin }: { onLogin: (staff: StaffSession) => void }) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, pin }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Login failed");
        return;
      }

      onLogin(data.staff);
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleLogin}>
        <div className="login-brand-panel">
          <div className="login-wordmark" aria-label="N K Hotel OS"><b>N K</b><span>Hotel <em>OS</em></span></div>
          <span>OPERATIONS WORKSPACE</span>
          <h1>Welcome back</h1>
          <p>Sign in to manage N K Hotels operations.</p>
        </div>
        <div className="login-form-body">
          <label htmlFor="staff-name">Staff Name</label>
          <div className="login-field"><UserRound size={18}/><input id="staff-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" autoComplete="username" /></div>
          <label htmlFor="staff-pin">PIN</label>
          <div className="login-field"><KeyRound size={18}/><input id="staff-pin" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Enter your PIN" type="password" inputMode="numeric" autoComplete="current-password" /></div>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" disabled={loading}><span>{loading ? "Signing in..." : "Sign In"}</span>{!loading && <ArrowRight size={18}/>}</button>
          <small className="login-version">N K Hotel OS · Staff Dashboard</small>
        </div>
      </form>
    </main>
  );
}
