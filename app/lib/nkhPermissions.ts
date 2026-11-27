// Pure, deny-by-default capability policy for new NKH OS modules.
// Existing routes retain their legacy behavior until individually migrated.
export type Role = "master" | "supervisor" | "team";
export type Permission =
  | "operations.read" | "operations.manage" | "operations.assigned"
  | "finance.read" | "finance.write" | "finance.approve"
  | "revenue.read" | "revenue.manage"
  | "administration.read" | "administration.manage"
  | "payroll.own" | "executive.read";
const grants: Record<Role, readonly Permission[]> = {
  master: ["operations.read","operations.manage","operations.assigned","finance.read","finance.write","finance.approve","revenue.read","revenue.manage","administration.read","administration.manage","payroll.own","executive.read"],
  supervisor: ["operations.read","operations.manage","operations.assigned","revenue.read","revenue.manage","administration.read","payroll.own"],
  team: ["operations.assigned","payroll.own"],
};
export function normalizeRole(value: unknown): Role | null {
  if (typeof value !== "string") return null;
  const role = value.trim().toLowerCase();
  return role === "master" || role === "supervisor" || role === "team" ? role : null;
}
export function hasPermission(role: unknown, permission: Permission): boolean {
  const normalized = normalizeRole(role);
  return normalized !== null && grants[normalized].includes(permission);
}
