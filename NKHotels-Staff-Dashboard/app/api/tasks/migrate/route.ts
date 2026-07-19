import { NextRequest, NextResponse } from "next/server";
import { syncGoogleTasksToSupabase } from "../../../lib/googleTaskSync";
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

    const result = await syncGoogleTasksToSupabase({ refreshExisting: true });

    const stored = await supabaseAdmin<{ legacy_task_id: string }[]>(
      "nkh_tasks?select=legacy_task_id&legacy_task_id=not.is.null",
    );
    return NextResponse.json({ success: true, ...result, supabaseLegacyTasks: stored.length });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Task migration failed." }, { status: 500 });
  }
}
