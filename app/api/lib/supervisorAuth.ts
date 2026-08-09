import crypto from "node:crypto";
import { NextRequest } from "next/server";

const HEADER_NAME = "authorization";

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function isSupervisorRequestAuthorized(request: NextRequest) {
  const configured = String(process.env.NKH_AI_SUPERVISOR_API_KEY || "").trim();
  if (!configured) return false;

  const header = String(request.headers.get(HEADER_NAME) || "").trim();
  if (!header.toLowerCase().startsWith("bearer ")) return false;

  const supplied = header.slice(7).trim();
  return Boolean(supplied) && safeEqual(supplied, configured);
}

export const AI_SUPERVISOR_NAME = "AI Supervisor";
