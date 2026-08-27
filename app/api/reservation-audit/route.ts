import { NextRequest, NextResponse } from "next/server";
import { runLiveReservationAudit } from "../../lib/liveReservationAudit";
import { importRecentOtaEmails } from "../../lib/gmailIntegration";
import { readServerSession } from "../../lib/serverSession";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { isSupervisorRequestAuthorized } from "../lib/supervisorAuth";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: NextRequest) {
  return Boolean(readServerSession(request)) || isSupervisorRequestAuthorized(request);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  try {
    const rows = await supabaseAdmin<Record<string, unknown>[]>(
      "nkh_reservation_audit_events?select=*&order=email_received_at.desc&limit=200",
    );
    return NextResponse.json({ success: true, items: rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to load reservation audit." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  try {
    let imported = 0;
    let gmailWarning: string | null = null;
    try {
      imported = await importRecentOtaEmails(7);
    } catch (error) {
      gmailWarning = error instanceof Error ? error.message : "Recent Gmail refresh failed.";
      console.error("Reservation audit Gmail refresh failed; checking existing inbox copy.", error);
    }
    const result = await runLiveReservationAudit(10);
    return NextResponse.json({ success: true, imported, gmailWarning, ...result });
  } catch (error) {
    console.error("Live reservation audit failed.", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Reservation audit failed." }, { status: 500 });
  }
}
