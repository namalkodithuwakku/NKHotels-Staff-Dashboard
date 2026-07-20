"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { FormEvent, useCallback, useEffect, useState } from "react";

type Profile = { id: string; display_name: string; email: string | null; phone: string | null; whatsapp_number: string | null; access_level: string; employment_status: string; timezone: string; color_hex: string; google_staff_name: string | null; login_username: string | null; login_enabled: boolean; has_pin: boolean; pin_updated_at: string | null; last_login_at: string | null };
async function json<T>(url: string, init?: RequestInit): Promise<T> { const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Request failed."); return data as T; }

export default function StaffProfilesWorkspace() {
  const [profiles, setProfiles] = useState<Profile[]>([]), [editor, setEditor] = useState<Profile | "new" | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [search, setSearch] = useState("");
  const load = useCallback(async () => { try { setError(""); setProfiles(await json<Profile[]>("/api/staff-profiles")); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load staff."); } }, []);
  useEffect(() => { void load(); }, [load]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget), values = Object.fromEntries(form);
    const payload = { ...values, login_enabled: form.has("login_enabled") };
    try { await json("/api/staff-profiles", { method: editor === "new" ? "POST" : "PATCH", body: JSON.stringify(editor === "new" ? payload : { ...payload, id: editor?.id }) }); setEditor(null); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save staff."); } finally { setBusy(false); }
  }
  const shown = profiles.filter(item => [item.display_name, item.login_username, item.access_level, item.employment_status].join(" ").toLowerCase().includes(search.toLowerCase()));
  const editing = editor && editor !== "new" ? editor : null;
  return <div className="staff-profiles-workspace">
    <div className="property-toolbar"><div><small>OPERATIONAL DIRECTORY</small><h2>Staff profiles</h2><p>Staff records, permissions and secure Supabase login credentials.</p></div><button className="primary-action" onClick={() => setEditor("new")}>＋ Add Staff</button></div>
    {error && <p className="workspace-error">{error}</p>}
    <div className="staff-profile-tools"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search staff, username, access or status" /><span>{profiles.filter(item => item.employment_status === "Active").length} active</span></div>
    <div className="staff-profile-list">{shown.map(item => <button key={item.id} onClick={() => setEditor(item)}><i style={{ background: item.color_hex }}>{item.display_name.slice(0,1).toUpperCase()}</i><div><strong>{item.display_name}</strong><small>{item.access_level} · @{item.login_username || "username needed"}</small></div><span className={item.employment_status.toLowerCase()}>{item.employment_status}</span><em>{item.login_enabled && item.has_pin ? "Login ready" : "Login setup needed"}</em></button>)}</div>
    {editor && <div className="creator-backdrop"><form className="staff-profile-editor" onSubmit={save}><header><div><small>STAFF PROFILE</small><h2>{editor === "new" ? "Add staff" : "Edit staff"}</h2></div><button type="button" onClick={() => setEditor(null)}>×</button></header>
      <div className="roster-editor-grid">
        <label>Display name<input name="display_name" required defaultValue={editing?.display_name || ""} /></label>
        <label>Login username<input name="login_username" required autoCapitalize="none" autoComplete="off" defaultValue={editing?.login_username || ""} placeholder="e.g. visun" /></label>
        <label>Access<select name="access_level" defaultValue={editing?.access_level || "Team"}><option>Master</option><option>Supervisor</option><option>Team</option></select></label>
        <label>Status<select name="employment_status" defaultValue={editing?.employment_status || "Active"}><option>Active</option><option>Inactive</option><option>Leave</option></select></label>
        <label>New PIN<input name="pin" required={editor === "new"} type="password" inputMode="numeric" autoComplete="new-password" minLength={4} maxLength={12} placeholder={editing?.has_pin ? "Leave blank to keep current PIN" : "4–12 numbers"} /></label>
        <label className="staff-login-toggle"><span>Login access</span><span><input name="login_enabled" type="checkbox" defaultChecked={editing?.login_enabled ?? true} /> Enabled</span></label>
        <label>Phone<input name="phone" inputMode="tel" defaultValue={editing?.phone || ""} placeholder="947XXXXXXXX" /></label>
        <label>WhatsApp<input name="whatsapp_number" inputMode="tel" defaultValue={editing?.whatsapp_number || ""} placeholder="947XXXXXXXX" /></label>
        <label>Email<input name="email" type="email" defaultValue={editing?.email || ""} /></label>
        <label>Profile color<input name="color_hex" type="color" defaultValue={editing?.color_hex || "#E98A15"} /></label>
        <label className="wide">Legacy Google name<input name="google_staff_name" defaultValue={editing?.google_staff_name || editing?.display_name || ""} placeholder="Temporary fallback only" /></label>
      </div>
      <div className="login-source-note"><strong>{editing?.has_pin ? "Supabase login ready" : "PIN setup required"}</strong><p>PINs are salted and hashed. They cannot be viewed later; entering a new PIN securely replaces the old one. Google remains a temporary fallback only for profiles without a Supabase PIN.</p>{editing?.last_login_at && <p>Last login: {new Date(editing.last_login_at).toLocaleString()}</p>}</div>
      <footer><button type="button" onClick={() => setEditor(null)}>Cancel</button><button className="primary-action" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button></footer>
    </form></div>}
  </div>;
}