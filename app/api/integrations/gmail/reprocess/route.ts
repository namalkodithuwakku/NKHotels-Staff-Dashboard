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
};

export async function POST(request: NextRequest) {
  if (!isMasterSession(readServerSession(request))) {
    return NextResponse.json({ success: false, error: "Master access is required." }, { status: 403 });
  }

  try {
    const requested = Number(request.nextUrl.searchParams.get("limit") || 10);
    const limit = Math.min(Math.max(Number.isFinite(requested) ? Math.floor(requested) : 10, 1), 20);
    const rows = await supabaseAdmin<InboxRow[]>(
      `nkh_email_inbox?select=id,sender,subject,body_text,property_name_snapshot&status=eq.Needs%20Review&order=received_at.desc&limit=${limit}`
    );
    let updated = 0;
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
        },
      });
      updated += 1;
    }
    return NextResponse.json({ success: true, updated, remainingHint: rows.length === limit ? "Run again to process the next batch." : "All pending emails were processed." });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to reprocess email summaries." }, { status: 500 });
  }
}
