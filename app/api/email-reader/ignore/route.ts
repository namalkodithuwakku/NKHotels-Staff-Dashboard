import { NextRequest, NextResponse } from "next/server";
import { isMasterSession, readServerSession } from "../../../lib/serverSession";

const GOOGLE_WEBAPP_URL = process.env.GOOGLE_WEBAPP_URL;

async function ignoreEmail(emailId: string, staffName: string, reason: string) {
  const params = new URLSearchParams({ action: "ignoreAIEmail", emailId, staffName, reason });
  const response = await fetch(`${GOOGLE_WEBAPP_URL}?${params.toString()}`, { method: "GET", cache: "no-store" });
  const text = await response.text();
  try {
    const data = JSON.parse(text);
    return { emailId, success: Boolean(data.success), error: data.success ? undefined : String(data.error || "Failed to ignore email") };
  } catch {
    return { emailId, success: false, error: "Google Apps Script returned invalid JSON" };
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!GOOGLE_WEBAPP_URL) return NextResponse.json({ success: false, error: "GOOGLE_WEBAPP_URL missing" }, { status: 500 });

    const session = readServerSession(request);
    if (!session) return NextResponse.json({ success: false, error: "Please sign in again." }, { status: 401 });

    const body = await request.json();
    const singleId = String(body.emailId || "").trim();
    const emailIds = Array.from(new Set([
      ...((Array.isArray(body.emailIds) ? body.emailIds : []).map((value: unknown) => String(value || "").trim())),
      ...(singleId ? [singleId] : []),
    ].filter(Boolean))).slice(0, 100);
    const staffName = String(body.staffName || session.name || "").trim();
    const reason = String(body.reason || "No action required").trim();

    if (!emailIds.length) return NextResponse.json({ success: false, error: "Email ID required" }, { status: 400 });
    if (emailIds.length > 1 && !isMasterSession(session)) {
      return NextResponse.json({ success: false, error: "Bulk ignore is available to Master only." }, { status: 403 });
    }

    const results: Array<{ emailId: string; success: boolean; error?: string }> = [];
    for (let index = 0; index < emailIds.length; index += 5) {
      results.push(...await Promise.all(emailIds.slice(index, index + 5).map((emailId) => ignoreEmail(emailId, staffName, reason))));
    }
    const ignored = results.filter((result) => result.success).map((result) => result.emailId);
    const failed = results.filter((result) => !result.success);
    return NextResponse.json({ success: failed.length === 0, ignored, ignoredCount: ignored.length, failed }, { status: failed.length ? 207 : 200 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to ignore email" }, { status: 500 });
  }
}
