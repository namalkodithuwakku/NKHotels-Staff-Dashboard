import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";

export const SESSION_COOKIE = "nkh_dashboard_session";
type ServerSession = { name: string; access: string; exp: number };

function secret() {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
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
    const [payload, supplied] = token.split(".");
    if (!payload || !supplied) return null;
    const expected = signature(payload), left = Buffer.from(supplied), right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as ServerSession;
    return session.exp > Date.now() && session.name ? session : null;
  } catch { return null; }
}

export function canManageProperties(session: ServerSession | null) {
  // Staff roles remain in Google during Migration 1. Any verified staff session may
  // manage properties until role records and permissions move to Supabase.
  return session !== null;
}
