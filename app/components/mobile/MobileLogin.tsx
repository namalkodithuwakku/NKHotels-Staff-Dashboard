"use client";

import { useState } from "react";
import {
  ArrowRight,
  KeyRound,
  UserRound,
} from "lucide-react";
import { StaffSession } from "../../hooks/useAuth";

export default function MobileLogin({
  onLogin,
}: {
  onLogin: (staff: StaffSession) => void;
}) {
  const [username, setUsername] = useState("");
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          pin,
        }),
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
    <main className="mobile-login-page">
      <div className="mobile-login-glow top" />
      <div className="mobile-login-glow bottom" />

      <form
        className="mobile-login-card"
        onSubmit={handleLogin}
      >
        <div className="mobile-login-logo login-wordmark" aria-label="N K Hotel OS"><b>N K</b><span>Hotel <em>OS</em></span></div>

        <span className="mobile-login-kicker">
          STAFF OPERATIONS
        </span>

        <h1>Welcome back</h1>

        <p className="mobile-login-copy">
          Sign in to view your live operations.
        </p>

        <label htmlFor="mobile-staff-name">
          Username
        </label>

        <div className="mobile-login-field">
          <UserRound size={17} />
          <input
            id="mobile-staff-name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            autoCapitalize="none"
            autoComplete="username"
          />
        </div>

        <label htmlFor="mobile-staff-pin">
          PIN
        </label>

        <div className="mobile-login-field">
          <KeyRound size={17} />
          <input
            id="mobile-staff-pin"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Enter your PIN"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
          />
        </div>

        {error && (
          <div className="mobile-login-error">
            {error}
          </div>
        )}

        <button
          className="mobile-login-submit"
          type="submit"
          disabled={loading}
        >
          <span>
            {loading ? "Signing in..." : "Sign In"}
          </span>

          {!loading && (
            <ArrowRight
              size={18}
              strokeWidth={2.4}
            />
          )}
        </button>

        <p className="mobile-login-version">
          N K Hotel OS · Staff Dashboard
        </p>
      </form>
    </main>
  );
}