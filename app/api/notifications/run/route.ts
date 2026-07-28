import { NextRequest, NextResponse } from "next/server";
import { readServerSession } from "../../../lib/serverSession";
import { runOperationalAlerts } from "../../../lib/operationalAlerts";

export async function POST(request: NextRequest) {
  try {
    const session = readServerSession(request);
    const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || request.nextUrl.searchParams.get("secret");
    const scheduled = Boolean(process.env.ALERT_CRON_SECRET && supplied === process.env.ALERT_CRON_SECRET);
    if (!session && !scheduled) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    return NextResponse.json(await runOperationalAlerts());
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to run alerts." }, { status: 500 });
  }
}
