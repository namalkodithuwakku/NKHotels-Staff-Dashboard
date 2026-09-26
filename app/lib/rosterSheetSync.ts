export async function requestRosterSheetRefresh() {
  const url = process.env.GOOGLE_ROSTER_WEBAPP_URL;
  const secret = process.env.NKH_ROSTER_SYNC_SECRET;
  if (!url || !secret) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "refreshFromDashboard", secret }),
      cache: "no-store",
    });
  } catch (error) {
    console.error("Roster sheet refresh failed", error);
  }
}
