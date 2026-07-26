import { NextRequest, NextResponse } from "next/server";
import { analyzeOperationalEmail } from "../../../../lib/emailIntelligence";
import { isMasterSession, readServerSession } from "../../../../lib/serverSession";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type InboxRow = {
  id: string;
  sender: string | null;
  subject: string | null;
  body_text: string | null;
  property_name_snapshot: string | null;
  source_metadata: Record<string, unknown> | null;
};

export async function POST(request: NextRequest) {
  if (!isMasterSession(readServerSession(request))) {
    return NextResponse.json({ success: false, error: "Master access is required." }, { status: 403 });
  }

  try {
    const requested = Number(request.nextUrl.searchParams.get("limit") || 10);
    const limit = Math.min(Math.max(Number.isFinite(requested) ? Math.floor(requested) : 10, 1), 20);
    const requestedOffset = Number(request.nextUrl.searchParams.get("offset") || 0);
    const offset = Math.max(Number.isFinite(requestedOffset) ? Math.floor(requestedOffset) : 0, 0);
    const rows = await supabaseAdmin<InboxRow[]>(
      `nkh_email_inbox?select=id,sender,subject,body_text,property_name_snapshot,source_metadata&status=eq.Needs%20Review&order=received_at.desc&offset=${offset}&limit=${limit}`
    );
    let openaiUpdated = 0;
    let fallbackUpdated = 0;
    const errors: Array<{ id: string; error: string }> = [];
    for (const row of rows) {
      const intelligence = await analyzeOperationalEmail({
        from: row.sender || "",
        subject: row.subject || "",
        body: row.body_text || "",
        property: row.property_name_snapshot,
      });
      await supabaseAdmin(`nkh_email_inbox?id=eq.${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: {
          ai_title: intelligence.title,
          summary: intelligence.summary,
          recommended_action: intelligence.recommendedAction,
          event_type: intelligence.eventType,
          task_type: intelligence.taskType,
          priority: intelligence.priority,
          booking_id: intelligence.bookingId,
          source_metadata: {
            ...(row.source_metadata || {}),
            ai_source: intelligence.source,
            ai_error: intelligence.error || null,
            ai_model: process.env.OPENAI_EMAIL_MODEL || "gpt-5.6-luna",
            ai_processed_at: new Date().toISOString(),
          },
        },
      });
      if (intelligence.source === "openai") {
        openaiUpdated += 1;
      } else {
        fallbackUpdated += 1;
        errors.push({ id: row.id, error: intelligence.error || "OpenAI was unavailable; fallback summary was used." });
      }
    }
    return NextResponse.json({
      success: fallbackUpdated === 0,
      processed: rows.length,
      openaiUpdated,
      fallbackUpdated,
      errors,
      nextOffset: rows.length === limit ? offset + rows.length : null,
      remainingHint: rows.length === limit
        ? `Run again with offset=${offset + rows.length} to process the next batch.`
        : "This batch reached the end of the pending inbox.",
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to reprocess email summaries." }, { status: 500 });
  }
}
