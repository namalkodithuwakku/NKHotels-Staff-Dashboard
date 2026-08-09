import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { readServerSession } from "../../../lib/serverSession";
import { isSupervisorRequestAuthorized } from "../../lib/supervisorAuth";

type ReportRow = {
  id: string;
  report_time: string;
  period_from: string | null;
  period_to: string | null;
  summary: string | null;
  attention_count: number;
  urgent_count: number;
  items: unknown;
  source: string | null;
  created_at: string;
};

function clean(value: unknown, maximum: number) {
  return String(value || "").replace(/\u0000/g, "").trim().slice(0, maximum);
}

export async function GET(request: NextRequest) {
  const session = readServerSession(request);
  if (!session) return NextResponse.json({ success: false, error: "Please sign in again." }, { status: 401 });

  try {
    const rows = await supabaseAdmin<ReportRow[]>(
      "nkh_ai_monitor_reports?select=id,report_time,period_from,period_to,summary,attention_count,urgent_count,items,source,created_at&order=report_time.desc&limit=24"
    );
    return NextResponse.json({ success: true, reports: rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to load AI monitor reports." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isSupervisorRequestAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const items = Array.isArray(body.items) ? body.items.slice(0, 100) : [];
    const reportTime = clean(body.reportTime, 80) || new Date().toISOString();
    const summary = clean(body.summary, 6000);
    const attentionCount = Math.max(0, Number(body.attentionCount || 0));
    const urgentCount = Math.max(0, Number(body.urgentCount || 0));

    const rows = await supabaseAdmin<ReportRow[]>("nkh_ai_monitor_reports", {
      method: "POST",
      prefer: "return=representation",
      body: {
        report_time: reportTime,
        period_from: clean(body.periodFrom, 80) || null,
        period_to: clean(body.periodTo, 80) || null,
        summary: summary || null,
        attention_count: Number.isFinite(attentionCount) ? attentionCount : 0,
        urgent_count: Number.isFinite(urgentCount) ? urgentCount : 0,
        items,
        source: clean(body.source, 120) || "AI Monitor",
      },
    });

    return NextResponse.json({ success: true, report: rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to save AI monitor report." }, { status: 500 });
  }
}
