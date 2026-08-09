import { createPublicKey, verify as verifySignature } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const OIDC_AUDIENCE = "nkh-staff-dashboard";
const TRUSTED_REPOSITORY = "namalkodithuwakku/nk-hotels-owner-portal";
const TRUSTED_REF = "refs/heads/main";
const TRUSTED_WORKFLOW_SUFFIX = "/.github/workflows/nkh-ai-supervisor-dispatch.yml@refs/heads/main";
const AI_SUPERVISOR = "AI Supervisor";
const JWKS_URL = "https://token.actions.githubusercontent.com/.well-known/jwks";

type Command = {
  commandId?: string;
  sourceEmailId?: string;
  property?: string;
  assignedTo?: string;
  taskType?: string;
  title?: string;
  priority?: string;
  bookingId?: string;
  summary?: string;
  action?: string;
  reason?: string;
  sourceTime?: string;
};

type JwtHeader = { alg?: string; kid?: string; typ?: string };
type JwtPayload = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  repository?: string;
  repository_visibility?: string;
  ref?: string;
  workflow_ref?: string;
};

type Property = { id: string; property_name: string };
type Staff = { id: string; display_name: string | null };
type ExistingTask = { id: string; status: string | null };
type NodeJsonWebKey = import("node:crypto").JsonWebKey;
type Jwk = NodeJsonWebKey & { kid?: string; alg?: string; use?: string };

function clean(value: unknown, max: number) {
  return String(value || "").replace(/\u0000/g, "").trim().slice(0, max);
}

function base64urlJson<T>(part: string): T {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as T;
}

function audienceMatches(aud: string | string[] | undefined) {
  return Array.isArray(aud) ? aud.includes(OIDC_AUDIENCE) : aud === OIDC_AUDIENCE;
}

async function verifyGithubOidc(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed OIDC token.");

  const header = base64urlJson<JwtHeader>(parts[0]);
  const payload = base64urlJson<JwtPayload>(parts[1]);
  if (header.alg !== "RS256" || !header.kid) throw new Error("Unsupported OIDC signing algorithm.");

  const jwksResponse = await fetch(JWKS_URL, { cache: "no-store" });
  if (!jwksResponse.ok) throw new Error("Unable to load GitHub OIDC signing keys.");
  const jwks = (await jwksResponse.json()) as { keys?: Jwk[] };
  const jwk = (jwks.keys || []).find(key => key.kid === header.kid);
  if (!jwk) throw new Error("GitHub OIDC signing key not found.");

  const publicKey = createPublicKey({ key: jwk as NodeJsonWebKey, format: "jwk" });
  const verified = verifySignature(
    "RSA-SHA256",
    Buffer.from(`${parts[0]}.${parts[1]}`),
    publicKey,
    Buffer.from(parts[2], "base64url"),
  );
  if (!verified) throw new Error("Invalid GitHub OIDC signature.");

  const now = Math.floor(Date.now() / 1000);
  if (payload.iss !== OIDC_ISSUER) throw new Error("Invalid OIDC issuer.");
  if (!audienceMatches(payload.aud)) throw new Error("Invalid OIDC audience.");
  if (!payload.exp || payload.exp < now) throw new Error("Expired OIDC token.");
  if (payload.nbf && payload.nbf > now + 30) throw new Error("OIDC token is not active yet.");
  if (payload.repository !== TRUSTED_REPOSITORY) throw new Error("Untrusted repository.");
  if (payload.repository_visibility !== "private") throw new Error("Relay repository must be private.");
  if (payload.ref !== TRUSTED_REF) throw new Error("Untrusted relay branch.");
  if (!payload.workflow_ref?.endsWith(TRUSTED_WORKFLOW_SUFFIX)) throw new Error("Untrusted relay workflow.");
  return payload;
}

function cleanPriority(value: unknown) {
  const requested = clean(value || "Normal", 20);
  return ["Normal", "High", "Urgent", "Critical"].includes(requested) ? requested : "Normal";
}

async function first<T>(path: string) {
  const rows = await supabaseAdmin<T[]>(path);
  return rows[0] || null;
}

export async function POST(request: NextRequest) {
  try {
    const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!bearer) return NextResponse.json({ success: false, error: "Missing GitHub OIDC token." }, { status: 401 });
    await verifyGithubOidc(bearer);

    const command = (await request.json()) as Command;
    const sourceEmailId = clean(command.sourceEmailId, 180);
    const commandId = clean(command.commandId, 180);
    const title = clean(command.title || command.taskType || "Operational task", 220);
    if (!sourceEmailId || !commandId || !title) {
      return NextResponse.json({ success: false, error: "commandId, sourceEmailId and title are required." }, { status: 400 });
    }

    const existing = await first<ExistingTask>(
      `nkh_tasks?select=id,status&source_email_id=eq.${encodeURIComponent(sourceEmailId)}&limit=1`,
    );
    if (existing) {
      return NextResponse.json({ success: true, duplicate: true, taskId: existing.id, status: existing.status });
    }

    const propertyName = clean(command.property, 220);
    const assignedName = clean(command.assignedTo, 180);
    const [property, staff] = await Promise.all([
      propertyName
        ? first<Property>(`nkh_properties?select=id,property_name&property_name=eq.${encodeURIComponent(propertyName)}&limit=1`)
        : null,
      assignedName
        ? first<Staff>(`nkh_staff?select=id,display_name&or=(display_name.eq.${encodeURIComponent(assignedName)},google_staff_name.eq.${encodeURIComponent(assignedName)})&limit=1`)
        : null,
    ]);

    const notes = [clean(command.summary, 1200), clean(command.action, 900)].filter(Boolean).join("\n\n");
    const rows = await supabaseAdmin<Array<{ id: string }>>("nkh_tasks", {
      method: "POST",
      prefer: "return=representation",
      body: {
        status: "Pending",
        priority: cleanPriority(command.priority),
        intent: AI_SUPERVISOR,
        task_type: clean(command.taskType || "Other", 120) || "Other",
        source: AI_SUPERVISOR,
        property_id: property?.id || null,
        property_name_snapshot: propertyName || null,
        booking_id: clean(command.bookingId, 120) || null,
        subject: title,
        notes: notes || null,
        assigned_staff_id: staff?.id || null,
        assigned_name_snapshot: staff?.display_name || assignedName || null,
        source_email_id: sourceEmailId,
        source_gmail_url: null,
        source_metadata: {
          supervisor: AI_SUPERVISOR,
          relay: "github-oidc-v1",
          command_id: commandId,
          reason: clean(command.reason, 800) || null,
          source_received_at: clean(command.sourceTime, 80) || null,
        },
        created_by_staff_id: null,
        created_by_name_snapshot: AI_SUPERVISOR,
      },
    });

    const task = rows[0];
    await supabaseAdmin("nkh_task_events", {
      method: "POST",
      prefer: "return=minimal",
      body: {
        task_id: task.id,
        event_type: "Created by AI Supervisor",
        to_status: "Pending",
        actor_staff_id: null,
        actor_name_snapshot: AI_SUPERVISOR,
        event_data: {
          relay: "github-oidc-v1",
          command_id: commandId,
          source_email_id: sourceEmailId,
          property: propertyName || null,
          assigned_to: staff?.display_name || assignedName || null,
        },
      },
    });

    return NextResponse.json({ success: true, taskId: task.id, sourceEmailId, commandId });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Supervisor relay failed." },
      { status: 401 },
    );
  }
}
