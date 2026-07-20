import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function normalizeUsername(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function validUsername(value: string) {
  return /^[a-z0-9._-]{3,40}$/.test(value);
}

export function validPin(value: unknown) {
  return /^\d{4,12}$/.test(String(value || ""));
}

export function hashPin(pin: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPin(pin: string, stored: string) {
  try {
    const [scheme, salt, expectedHex] = stored.split("$");
    if (scheme !== "scrypt" || !salt || !expectedHex) return false;
    const supplied = scryptSync(pin, salt, 64);
    const expected = Buffer.from(expectedHex, "hex");
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  } catch {
    return false;
  }
}
