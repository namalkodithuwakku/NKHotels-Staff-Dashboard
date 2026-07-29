import { academyCourses } from "./academyCourses";
import { supabaseAdmin } from "./supabaseAdmin";

type Shift = {
  staff_id: string;
  shift_date: string;
  start_time: string | null;
  end_time: string | null;
  staff: { id: string; display_name: string } | null;
};
type Question = { id: string; slug: string; category: string };
type Assignment = { id: string; task_id: string | null };

function colomboDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find(part => part.type === type)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function scheduleEnd(date: string) {
  const [year, month] = date.split("-").map(Number);
  const end = new Date(Date.UTC(year, month + 1, 0));
  return end.toISOString().slice(0, 10);
}

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index++) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function choose<T>(values: T[], key: (item: T) => string, seed: string, count: number) {
  return [...values]
    .sort((left, right) => hash(`${seed}|${key(left)}`) - hash(`${seed}|${key(right)}`))
    .slice(0, count);
}

async function pagedQuestions() {
  const rows: Question[] = [];
  let offset = 0;
  while (true) {
    const page = await supabaseAdmin<Question[]>(
      `nkh_hospitality_questions?select=id,slug,category&active=eq.true&order=category.asc,slug.asc&limit=1000&offset=${offset}`
    );
    rows.push(...page);
    if (page.length < 1000) return rows;
    offset += 1000;
  }
}

function dueAt(date: string) {
  return `${date}T23:59:59+05:30`;
}

async function createTask(
  assignment: Assignment,
  shift: Shift,
  type: "Daily" | "Monthly Exam",
  courseName: string | null,
  count: number,
  duration: number,
) {
  if (assignment.task_id || !shift.staff) return assignment.task_id;
  const subject = type === "Monthly Exam"
    ? "NKH Academy · Monthly Exam · 40 questions"
    : `NKH Academy · ${courseName} · 10 questions`;
  const rows = await supabaseAdmin<Array<{ id: string }>>("nkh_tasks", {
    method: "POST",
    prefer: "return=representation",
    body: {
      status: "Pending",
      priority: "Normal",
      intent: type === "Monthly Exam" ? "Academy Monthly Exam" : "Academy Learning",
      task_type: "Training",
      source: "NKH Academy",
      property_name_snapshot: "NKH Academy",
      subject,
      notes: `${count} questions · ${duration} minutes. Available anytime during today's scheduled working day. The timer begins only when you press Start.`,
      assigned_staff_id: shift.staff.id,
      assigned_name_snapshot: shift.staff.display_name,
      shift_label: `${String(shift.start_time || "").slice(0, 5)} – ${String(shift.end_time || "").slice(0, 5)}`,
      due_at: dueAt(shift.shift_date),
      source_metadata: { academyAssignmentId: assignment.id, assignmentType: type },
      created_by_name_snapshot: "NKH Academy",
    },
  });
  const taskId = rows[0].id;
  await Promise.all([
    supabaseAdmin(`nkh_academy_assignments?id=eq.${assignment.id}`, {
      method: "PATCH", prefer: "return=minimal", body: { task_id: taskId },
    }),
    supabaseAdmin("nkh_task_events", {
      method: "POST", prefer: "return=minimal", body: {
        task_id: taskId,
        event_type: "Created",
        to_status: "Pending",
        actor_name_snapshot: "NKH Academy",
        event_data: { academyAssignmentId: assignment.id, assignmentType: type },
      },
    }),
  ]);
  return taskId;
}

export async function runAcademyAssignmentEngine() {
  const date = colomboDate();
  const endDate = scheduleEnd(date);
  const [rawShifts, questions] = await Promise.all([
    supabaseAdmin<Shift[]>(
      `nkh_roster_entries?select=staff_id,shift_date,start_time,end_time,staff:nkh_staff(id,display_name)&shift_date=gte.${date}&shift_date=lte.${endDate}&status=eq.Scheduled&order=shift_date.asc`
    ),
    pagedQuestions(),
  ]);
  const shifts = Array.from(
    new Map(rawShifts.map(shift => [`${shift.staff_id}|${shift.shift_date}`, shift])).values()
  );
  const finalShiftByStaffMonth = new Map<string, string>();
  shifts.forEach(shift => {
    const key = `${shift.staff_id}|${shift.shift_date.slice(0, 7)}`;
    const current = finalShiftByStaffMonth.get(key);
    if (!current || shift.shift_date > current) finalShiftByStaffMonth.set(key, shift.shift_date);
  });
  const results: Array<Record<string, unknown>> = [];

  for (const shift of shifts) {
    if (!shift.staff) continue;
    const [year, month, day] = shift.shift_date.split("-").map(Number);
    const staffMonth = `${shift.staff_id}|${shift.shift_date.slice(0, 7)}`;
    const examDay = day >= 25 && finalShiftByStaffMonth.get(staffMonth) === shift.shift_date;
    const type = examDay ? "Monthly Exam" : "Daily";
    const count = examDay ? 40 : 10;
    const duration = examDay ? 60 : 20;
    const course = examDay
      ? null
      : academyCourses[(Math.floor(Date.UTC(year, month - 1, day) / 86400000) + hash(shift.staff_id)) % academyCourses.length];
    const pool = course
      ? questions.filter(question => course.categories.includes(question.category))
      : questions;
    if (pool.length < count) {
      results.push({ staff: shift.staff.display_name, status: "skipped", reason: "Question pool is incomplete." });
      continue;
    }

    let assignment = (await supabaseAdmin<Assignment[]>(
      `nkh_academy_assignments?select=id,task_id&staff_id=eq.${shift.staff_id}&assignment_date=eq.${date}&limit=1`
    ))[0];
    if (!assignment) {
      const selected = choose(pool, item => item.slug, `${date}|${shift.staff_id}|${type}|${course?.id || "exam"}`, count);
      try {
        assignment = (await supabaseAdmin<Assignment[]>("nkh_academy_assignments", {
          method: "POST",
          prefer: "return=representation",
          body: {
            staff_id: shift.staff.id,
            staff_name: shift.staff.display_name,
            assignment_date: date,
            assignment_type: type,
            course_id: course?.id || null,
            course_name: course?.name || "Monthly Academy Exam",
            question_count: count,
            duration_minutes: duration,
            question_ids: selected.map(question => question.id),
          },
        }))[0];
      } catch (error) {
        assignment = (await supabaseAdmin<Assignment[]>(
          `nkh_academy_assignments?select=id,task_id&staff_id=eq.${shift.staff_id}&assignment_date=eq.${date}&limit=1`
        ))[0];
        if (!assignment) throw error;
      }
    }
    const taskId = shift.shift_date === date
      ? await createTask(assignment, shift, type, course?.name || null, count, duration)
      : assignment.task_id;
    results.push({
      staff: shift.staff.display_name,
      date: shift.shift_date,
      status: shift.shift_date === date ? "released" : "scheduled",
      type,
      taskId,
    });
  }
  return { success: true, date, scheduledThrough: endDate, assignments: results };
}
