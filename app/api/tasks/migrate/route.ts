import { NextRequest, NextResponse } from "next/server";
import { mapLegacyTask } from "../../../lib/taskMigration";
import { isMasterSession, readServerSession } from "../../../lib/serverSession";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const GOOGLE_WEBAPP_URL = process.env.GOOGLE_WEBAPP_URL;

export async function POST(request: NextRequest) {
  try {
    if (!isMasterSession(readServerSession(request))) {
      return NextResponse.json({ success: false, error: "Master access is required." }, { status: 403 });
    }
    if (!GOOGLE_WEBAPP_URL) {
      return NextResponse.json({ success: false, error: "GOOGLE_WEBAPP_URL is not configured." }, { status: 500 });
    }

    const response = await fetch(`${GOOGLE_WEBAPP_URL}?action=getTasks`, { cache: "no-store" });
    const text = await response.text();
    if (!response.ok) throw new Error(`Google task export failed (${response.status}).`);

    let payload: { success?: boolean; tasks?: Record<string, unknown>[] };
    try { payload = JSON.parse(text); }
    catch { throw new Error("Google task export returned invalid JSON."); }
    if (payload.success === false) throw new Error("Google task export reported an error.");

    const source = Array.isArray(payload.tasks) ? payload.tasks : [];
    const rows = source.map(mapLegacyTask).filter((row): row is NonNullable<typeof row> => row !== null);
    if (rows.length) {
      await supabaseAdmin("nkh_tasks?on_conflict=legacy_task_id", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body: rows,
      });
    }

    const stored = await supabaseAdmin<{ legacy_task_id: string }[]>(
      "nkh_tasks?select=legacy_task_id&legacy_task_id=not.is.null",
    );
    return NextResponse.json({ success: true, googleTasks: source.length, imported: rows.length, skipped: source.length - rows.length, supabaseLegacyTasks: stored.length });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Task migration failed." }, { status: 500 });
  }
}