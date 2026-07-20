import { NextRequest, NextResponse } from "next/server";
import { syncGmailHistory } from "../../../../lib/gmailIntegration";

export async function POST(request: NextRequest) {
  const expected = process.env.GMAIL_PUBSUB_WEBHOOK_SECRET;
  if (!expected || request.nextUrl.searchParams.get("secret") !== expected) {
    return NextResponse.json({ success: false }, { status: 401 });
  }
  try {
    const envelope = await request.json();
    const encoded = envelope?.message?.data;
    if (!encoded) return NextResponse.json({ success: true, imported: 0 });
    const notification = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
    const imported = await syncGmailHistory(String(notification.historyId || ""));
    return NextResponse.json({ success: true, imported });
  } catch (error) {
    console.error("Gmail Pub/Sub processing failed", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Gmail notification failed." }, { status: 500 });
  }
}