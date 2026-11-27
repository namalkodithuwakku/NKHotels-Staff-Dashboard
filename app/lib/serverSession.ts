import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "./supabaseAdmin";

export const SESSION_COOKIE = "nkh_dashboard_session";
type ServerSession = { name: string; access: string; exp: number };

function secret() {
  const value = process.env.NKH_SESSION_SIGNING_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("Server session secret is not configured.");
  return value;
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createServerSession(staff: { name?: string; access?: string }) {
  const payload = Buffer.from(JSON.stringify({ name: String(staff.name || ""), access: String(staff.access || "Team"), exp: Date.now() + 7 * 24 * 60 * 60 * 1000 } satisfies ServerSession)).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function readServerSession(request: NextRequest): ServerSession | null {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const [payload, supplied, extra] = token.split(".");
    if (extra !== undefined) return null;
    if (!payload || !supplied) return null;
    const expected = signature(payload), left = Buffer.from(supplied), right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as ServerSession;
    return typeof session.exp === "number" && Number.isFinite(session.exp) && session.exp > Date.now() && typeof session.name === "string" && session.name.trim() && typeof session.access === "string" ? session : null;
  } catch { return null; }
}

export function canManageProperties(session: ServerSession | null) {
  // Staff roles remain in Google during Migration 1. Any verified staff session may
  // manage properties until role records and permissions move to Supabase.
  return session !== null;
}

export function isMasterSession(session: ServerSession | null) {
  return String(session?.access || "").trim().toLowerCase() === "master";
}

export async function hasChannelAccess(
  session: ServerSession | null,
  channel: "whatsapp" | "sms",
) {
  if (!session) return false;
  const field = channel === "whatsapp" ? "can_access_whatsapp" : "can_access_sms";
  const name = encodeURIComponent('"'+session.name.replace(/\\/g,"\\\\").replace(/"/g,'\\"')+'"');
  const rows = await supabaseAdmin<Array<{access_level:string;login_enabled:boolean;can_access_whatsapp:boolean;can_access_sms:boolean}>>(
    `nkh_staff?select=access_level,login_enabled,${field}&display_name=eq.${name}&employment_status=eq.Active&limit=2`
  );
  const row=rows[0];
  return rows.length===1 && row.login_enabled===true && row.access_level.trim().toLowerCase()===session.access.trim().toLowerCase() && (isMasterSession(session)||row[field]===true);
}
