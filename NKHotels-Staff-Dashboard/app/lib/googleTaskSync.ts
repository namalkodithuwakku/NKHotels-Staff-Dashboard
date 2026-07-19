import { mapLegacyTask } from "./taskMigration";
import { supabaseAdmin } from "./supabaseAdmin";

export async function syncGoogleTasksToSupabase(options: { refreshExisting?: boolean } = {}) {
  const url = process.env.GOOGLE_WEBAPP_URL;
  if (!url) throw new Error("GOOGLE_WEBAPP_URL is not configured.");
  const response = await fetch(`${url}?action=getTasks`, { cache: "no-store" });
  const text = await response.text();
  if (!response.ok) throw new Error(`Google task export failed (${response.status}).`);
  let payload: { success?: boolean; tasks?: Record<string, unknown>[] };
  try { payload = JSON.parse(text); }
  catch { throw new Error("Google task export returned invalid JSON."); }
  if (payload.success === false) throw new Error("Google task export reported an error.");
  const source = Array.isArray(payload.tasks) ? payload.tasks : [];
  const rows = source.map(mapLegacyTask).filter((row): row is NonNullable<typeof row> => row !== null);
  if (rows.length) await supabaseAdmin("nkh_tasks?on_conflict=legacy_task_id", {
    method: "POST",
    prefer: `${options.refreshExisting ? "resolution=merge-duplicates" : "resolution=ignore-duplicates"},return=minimal`,
    body: rows,
  });
  return { googleTasks: source.length, imported: rows.length, skipped: source.length - rows.length };
}
