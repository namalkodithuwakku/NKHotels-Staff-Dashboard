import "server-only";
import type { NextRequest } from "next/server";
import { readServerSession } from "./serverSession";
import { supabaseAdmin } from "./supabaseAdmin";
import { hasPermission, normalizeRole, type Permission } from "./nkhPermissions";

type Staff = { id: string; access_level: string; employment_status: string; login_enabled: boolean };
export type Authorization = { ok: true; staffId: string; role: NonNullable<ReturnType<typeof normalizeRole>> } | { ok: false; status: 401 | 403 | 503 };

// New routes must call this before reading or writing protected data.
// Assignment/ownership checks are additionally required at the resource level.
export async function authorizeNKH(request: NextRequest, permission: Permission): Promise<Authorization> {
  const session = readServerSession(request);
  if (!session) return { ok: false, status: 401 };
  try {
    // Exact display name only; ambiguous or renamed identities fail closed.
    const rows = await supabaseAdmin<Staff[]>(`nkh_staff?select=id,access_level,employment_status,login_enabled&display_name=eq.${encodeURIComponent('"' + session.name.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"')}&limit=2`);
    const staff = rows[0];
    if (rows.length !== 1 || staff.employment_status !== "Active" || staff.login_enabled !== true) return { ok: false, status: 403 };
    const role = normalizeRole(staff.access_level);
    // Reject stale role claims; require fresh sign-in after role changes.
    if (!role || role !== normalizeRole(session.access) || !hasPermission(role, permission)) return { ok: false, status: 403 };
    return { ok: true, staffId: staff.id, role };
  } catch {
    return { ok: false, status: 503 };
  }
}
