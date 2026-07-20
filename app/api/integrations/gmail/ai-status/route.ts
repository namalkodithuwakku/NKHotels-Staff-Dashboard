import { NextRequest, NextResponse } from "next/server";
import { analyzeOperationalEmail } from "../../../../lib/emailIntelligence";
import { isMasterSession, readServerSession } from "../../../../lib/serverSession";

export async function GET(request: NextRequest) {
  if (!isMasterSession(readServerSession(request))) {
    return NextResponse.json({ success: false, error: "Master access is required." }, { status: 403 });
  }

  const configured = Boolean(process.env.OPENAI_API_KEY);
  if (!configured) {
    return NextResponse.json({ success: false, configured, error: "OPENAI_API_KEY is unavailable to this production deployment." }, { status: 503 });
  }

  const result = await analyzeOperationalEmail({
    from: "guest@example.com",
    subject: "Late check-in request - booking 123456789",
    property: "Test Hotel",
    body: "Guest Amal requests late check-in at 11:30 PM tonight for booking number 123456789. Please confirm whether reception can assist.",
  });

  return NextResponse.json({
    success: result.source === "openai",
    configured,
    model: process.env.OPENAI_EMAIL_MODEL || "gpt-5.4-nano",
    source: result.source,
    error: result.error || null,
    sample: result.source === "openai" ? { title: result.title, summary: result.summary, action: result.recommendedAction } : null,
  }, { status: result.source === "openai" ? 200 : 502 });
}