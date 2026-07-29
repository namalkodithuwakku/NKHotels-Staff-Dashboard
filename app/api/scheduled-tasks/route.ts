import { NextRequest, NextResponse } from "next/server";
import { readServerSession } from "../../lib/serverSession";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

type AssignmentRow = {
  id: string;
  staff_name: string;
  assignment_date: string;
  assignment_type: "Daily" | "Monthly Exam";
  course_name: string | null;
  question_count: number;
  duration_minutes: number;
  status: string;
  task_id: string | null;
};

function todayColombo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function GET(request: NextRequest) {
  try {
    const session = readServerSession(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Please sign in again." }, { status: 401 });
    }
    const master = String(session.access || "").toLowerCase() === "master";
    const staffFilter = master
      ? ""
      : `&staff_name=ilike.${encodeURIComponent(session.name)}`;
    const rows = await supabaseAdmin<AssignmentRow[]>(
      `nkh_academy_assignments?select=id,staff_name,assignment_date,assignment_type,course_name,question_count,duration_minutes,status,task_id&assignment_date=gte.${todayColombo()}${staffFilter}&order=assignment_date.asc,staff_name.asc&limit=500`
    );
    return NextResponse.json({
      success: true,
      items: rows.map(row => ({
        id: row.id,
        date: row.assignment_date,
        type: row.assignment_type,
        title: row.assignment_type === "Monthly Exam"
          ? "NKH Academy Monthly Exam"
          : `NKH Academy · ${row.course_name || "Daily Learning"}`,
        courseName: row.course_name || "NKH Academy",
        staffName: row.staff_name,
        questionCount: row.question_count,
        durationMinutes: row.duration_minutes,
        status: row.status,
        released: Boolean(row.task_id),
      })),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unable to load scheduled tasks.",
    }, { status: 500 });
  }
}
