import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { readServerSession } from "../../../lib/serverSession";

type CommentRow = {
  id: string;
  report_id: string;
  item_key: string;
  staff_name: string;
  comment_text: string;
  created_at: string;
};

function clean(value: unknown, maximum: number) {
  return String(value || "").replace(/\u0000/g, "").trim().slice(0, maximum);
}

export async function GET(request: NextRequest) {
  const session = readServerSession(request);
  if (!session) return NextResponse.json({ success: false, error: "Please sign in again." }, { status: 401 });

  try {
    const url = new URL(request.url);
    const reportId = clean(url.searchParams.get("reportId"), 80);
    const itemKey = clean(url.searchParams.get("itemKey"), 180);
    if (!reportId || !itemKey) {
      return NextResponse.json({ success: false, error: "reportId and itemKey are required." }, { status: 400 });
    }

    const rows = await supabaseAdmin<CommentRow[]>(
      `nkh_ai_monitor_comments?select=id,report_id,item_key,staff_name,comment_text,created_at&report_id=eq.${encodeURIComponent(reportId)}&item_key=eq.${encodeURIComponent(itemKey)}&order=created_at.asc&limit=100`
    );
    return NextResponse.json({ success: true, comments: rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to load comments." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = readServerSession(request);
  if (!session) return NextResponse.json({ success: false, error: "Please sign in again." }, { status: 401 });

  try {
    const body = await request.json();
    const reportId = clean(body.reportId, 80);
    const itemKey = clean(body.itemKey, 180);
    const commentText = clean(body.comment, 2000);
    if (!reportId || !itemKey || !commentText) {
      return NextResponse.json({ success: false, error: "Report, item and comment are required." }, { status: 400 });
    }

    const report = await supabaseAdmin<Array<{ id: string }>>(
      `nkh_ai_monitor_reports?select=id&id=eq.${encodeURIComponent(reportId)}&limit=1`
    );
    if (!report[0]) return NextResponse.json({ success: false, error: "AI monitor report not found." }, { status: 404 });

    const rows = await supabaseAdmin<CommentRow[]>("nkh_ai_monitor_comments", {
      method: "POST",
      prefer: "return=representation",
      body: {
        report_id: reportId,
        item_key: itemKey,
        staff_name: clean(session.name, 180) || "Staff",
        comment_text: commentText,
      },
    });

    return NextResponse.json({ success: true, comment: rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to save comment." }, { status: 500 });
  }
}
