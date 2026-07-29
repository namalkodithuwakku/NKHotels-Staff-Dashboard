import { NextRequest, NextResponse } from "next/server";
import { readServerSession } from "../../../lib/serverSession";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

type SyncState = { last_started_at: string | null };

export async function POST(request: NextRequest) {
  try {
    if (!readServerSession(request)) {
      return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    }
    const input = await request.json() as { propertyId?: string };
    const propertyId = String(input.propertyId || "").trim();
    if (!propertyId) return NextResponse.json({ error: "Property is required." }, { status: 400 });

    const [state] = await supabaseAdmin<SyncState[]>(
      `nkh_calendar_sync_state?property_id=eq.${encodeURIComponent(propertyId)}&select=last_started_at`
    );
    const lastStarted = state?.last_started_at ? new Date(state.last_started_at).getTime() : 0;
    if (lastStarted && Date.now() - lastStarted < 2 * 60 * 1000) {
      return NextResponse.json({ success: true, skipped: true, reason: "Recently refreshed" });
    }

    const scriptUrl = String(process.env.NKH_CALENDAR_SCRIPT_URL || "").trim();
    const secret = String(process.env.NKH_CALENDAR_SYNC_SECRET || "").trim();
    if (!scriptUrl || !secret) {
      return NextResponse.json({ error: "Background calendar refresh is not configured." }, { status: 503 });
    }
    const response = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "backgroundCalendarRefresh", propertyId, secret }),
      cache: "no-store",
    });
    const text = await response.text();
    let result: Record<string, unknown> = {};
    try { result = JSON.parse(text); } catch {
      throw new Error(`Calendar reader returned invalid JSON (${response.status}).`);
    }
    if (!response.ok || result.success !== true) {
      throw new Error(String(result.error || result.message || "Background calendar refresh failed."));
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Background calendar refresh failed." }, { status: 500 });
  }
}
