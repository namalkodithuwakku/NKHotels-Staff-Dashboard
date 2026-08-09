import { NextRequest, NextResponse } from "next/server";
import { readServerSession } from "../../../lib/serverSession";

export const runtime = "nodejs";
export const maxDuration = 60;

function env(name: string) {
  return String(process.env[name] || "").trim();
}

function backendOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

export async function POST(request: NextRequest) {
  const session = readServerSession(request);
  if (!session) return NextResponse.json({ success: false, error: "Please sign in again." }, { status: 401 });

  const access = String(session.access || "").trim().toLowerCase();
  if (!["master", "supervisor"].includes(access)) {
    return NextResponse.json({ success: false, error: "Only Master or Supervisor can run the AI Supervisor manually." }, { status: 403 });
  }

  const configuredBackendUrl = env("NKH_AI_BACKEND_URL");
  const backendUrl = backendOrigin(configuredBackendUrl);
  const supervisorKey = env("NKH_AI_SUPERVISOR_API_KEY");
  if (!configuredBackendUrl || !backendUrl || !supervisorKey) {
    return NextResponse.json({ success: false, error: "AI Supervisor manual-run connection is not configured correctly." }, { status: 503 });
  }

  try {
    const endpoint = `${backendUrl}/api/ai-supervisor/run`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${supervisorKey}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(55000),
    });

    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    const text = await response.text();

    if (!contentType.includes("application/json")) {
      return NextResponse.json({
        success: false,
        error: "The configured AI backend returned a web page instead of the supervisor API.",
        backendHost: new URL(backendUrl).host,
        endpoint,
        status: response.status,
      }, { status: 502 });
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(text);
    } catch {
      return NextResponse.json({
        success: false,
        error: "The AI backend returned invalid JSON.",
        backendHost: new URL(backendUrl).host,
        status: response.status,
      }, { status: 502 });
    }

    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Manual AI Supervisor run failed." }, { status: 500 });
  }
}
