import { NextRequest, NextResponse } from "next/server";
import { readServerSession } from "../../../lib/serverSession";

export const runtime = "nodejs";
export const maxDuration = 60;

function env(name: string) {
  return String(process.env[name] || "").trim();
}

export async function POST(request: NextRequest) {
  const session = readServerSession(request);
  if (!session) return NextResponse.json({ success: false, error: "Please sign in again." }, { status: 401 });

  const access = String(session.access || "").trim().toLowerCase();
  if (!["master", "supervisor"].includes(access)) {
    return NextResponse.json({ success: false, error: "Only Master or Supervisor can run the AI Supervisor manually." }, { status: 403 });
  }

  const backendUrl = env("NKH_AI_BACKEND_URL").replace(/\/$/, "");
  const supervisorKey = env("NKH_AI_SUPERVISOR_API_KEY");
  if (!backendUrl || !supervisorKey) {
    return NextResponse.json({ success: false, error: "AI Supervisor manual-run connection is not configured." }, { status: 503 });
  }

  try {
    const response = await fetch(`${backendUrl}/api/ai-supervisor/run`, {
      method: "POST",
      headers: { Authorization: `Bearer ${supervisorKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(55000),
    });
    const text = await response.text();
    let payload: Record<string, unknown> = {};
    try { payload = JSON.parse(text); } catch { payload = { error: text.slice(0, 500) }; }
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Manual AI Supervisor run failed." }, { status: 500 });
  }
}
