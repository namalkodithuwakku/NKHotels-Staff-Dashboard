import { NextRequest, NextResponse } from "next/server";
import { initialGmailImport, setupGmailWatch } from "../../../../lib/gmailIntegration";
import { isMasterSession, readServerSession } from "../../../../lib/serverSession";

function authorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const bearer = request.headers.get("authorization");
  return isMasterSession(readServerSession(request)) || Boolean(cronSecret && bearer === `Bearer ${cronSecret}`);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ success: false, error: "Master access required." }, { status: 401 });
  try {
    const [watch, imported] = await Promise.all([setupGmailWatch(), initialGmailImport()]);
    return NextResponse.json({ success: true, imported, historyId: watch.historyId, expiration: watch.expiration });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Gmail setup failed." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ success: false }, { status: 401 });
  try {
    if (request.nextUrl.searchParams.get("initialize") === "1") {
      const [watch, imported] = await Promise.all([setupGmailWatch(), initialGmailImport()]);
      return NextResponse.json({ success: true, imported, expiration: watch.expiration });
    }
    const watch = await setupGmailWatch();
    return NextResponse.json({ success: true, expiration: watch.expiration });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Gmail watch renewal failed." }, { status: 500 });
  }
}