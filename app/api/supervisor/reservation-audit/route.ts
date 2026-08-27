import { NextRequest, NextResponse } from "next/server";
import { runLiveReservationAudit } from "../../../lib/liveReservationAudit";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { isSupervisorRequestAuthorized } from "../../lib/supervisorAuth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isSupervisorRequestAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const run = await runLiveReservationAudit(10);
    const items = await supabaseAdmin<Array<Record<string, unknown>>>(
      "nkh_reservation_audit_events?select=id,gmail_message_id,property_id,property_name,ota_source,event_type,booking_reference,email_received_at,due_at,audit_status,severity,match_confidence,expected_data,findings,last_checked_at&audit_status=in.(Needs%20Staff%20Action,Unable%20to%20Match)&order=severity.desc,due_at.asc&limit=100",
    );

    return NextResponse.json({
      success: true,
      section: "Reservation Audit",
      urgentCount: items.filter(item => item.severity === "Urgent").length,
      attentionCount: items.length,
      run,
      items,
      staffInstruction: "Update the calendar and reply with the audit item or booking number before the next hourly monitor.",
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to run reservation audit." }, { status: 500 });
  }
}
