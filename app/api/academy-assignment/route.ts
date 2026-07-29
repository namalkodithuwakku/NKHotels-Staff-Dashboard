import { NextRequest, NextResponse } from "next/server";
import { readServerSession } from "../../lib/serverSession";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

type Assignment = {
  id: string;
  staff_id: string;
  staff_name: string;
  assignment_date: string;
  assignment_type: "Daily" | "Monthly Exam";
  course_id: string | null;
  course_name: string | null;
  question_count: number;
  duration_minutes: number;
  question_ids: string[];
  status: "Assigned" | "In Progress" | "Completed" | "Expired";
  task_id: string | null;
  started_at: string | null;
  expires_at: string | null;
  completed_at: string | null;
  score: number | null;
  correct_answers: number | null;
};
type Question = {
  id: string;
  slug: string;
  term: string;
  definition: string;
  category: string;
  difficulty: string;
  image_url: string | null;
};
type Answer = {
  question_id: string;
  selected_term: string;
  correct_term: string;
  definition_snapshot: string;
  correct: boolean;
  answered_at: string;
};

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index++) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function ordered<T>(values: T[], key: (item: T) => string, seed: string) {
  return [...values].sort((left, right) =>
    hash(`${seed}|${key(left)}`) - hash(`${seed}|${key(right)}`)
  );
}

async function assignmentFor(request: NextRequest, id: string) {
  const session = readServerSession(request);
  if (!session) throw new Error("Staff access required.");
  const assignment = (await supabaseAdmin<Assignment[]>(
    `nkh_academy_assignments?select=*&id=eq.${encodeURIComponent(id)}&limit=1`
  ))[0];
  if (!assignment || assignment.staff_name.trim().toLowerCase() !== session.name.trim().toLowerCase()) {
    throw new Error("Academy assignment was not found.");
  }
  return { assignment, session };
}

async function questionsFor(assignment: Assignment) {
  if (!assignment.question_ids.length) return [];
  const rows = await supabaseAdmin<Question[]>(
    `nkh_hospitality_questions?select=id,slug,term,definition,category,difficulty,image_url&id=in.(${assignment.question_ids.join(",")})`
  );
  const byId = new Map(rows.map(item => [item.id, item]));
  return assignment.question_ids.map(id => byId.get(id)).filter(Boolean) as Question[];
}

function optionsFor(question: Question, questions: Question[], assignmentId: string) {
  const sameCategory = questions.filter(item => item.id !== question.id && item.category === question.category);
  const others = questions.filter(item => item.id !== question.id);
  const pool = sameCategory.length >= 2 ? sameCategory : others;
  const distractors = ordered(pool, item => item.slug, `${assignmentId}|${question.id}|options`)
    .slice(0, 2)
    .map(item => item.term);
  return ordered([question.term, ...distractors], item => item, `${assignmentId}|${question.id}|order`);
}

async function expireIfNeeded(assignment: Assignment) {
  if (
    assignment.status === "In Progress" &&
    assignment.expires_at &&
    new Date(assignment.expires_at).getTime() <= Date.now()
  ) {
    await supabaseAdmin(`nkh_academy_assignments?id=eq.${assignment.id}`, {
      method: "PATCH", prefer: "return=minimal", body: { status: "Expired" },
    });
    assignment.status = "Expired";
    return true;
  }
  return assignment.status === "Expired";
}

async function state(assignment: Assignment) {
  await expireIfNeeded(assignment);
  const [questions, answers] = await Promise.all([
    questionsFor(assignment),
    supabaseAdmin<Answer[]>(
      `nkh_academy_assignment_answers?select=question_id,selected_term,correct_term,definition_snapshot,correct,answered_at&assignment_id=eq.${assignment.id}&order=answered_at.asc`
    ),
  ]);
  const answered = new Map(answers.map(item => [item.question_id, item]));
  const current = questions.find(item => !answered.has(item.id)) || null;
  const correct = answers.filter(item => item.correct).length;
  const finished = assignment.status === "Completed" || assignment.status === "Expired";
  return {
    success: true,
    assignment: {
      id: assignment.id,
      type: assignment.assignment_type,
      courseId: assignment.course_id,
      courseName: assignment.course_name,
      date: assignment.assignment_date,
      questionCount: assignment.question_count,
      durationMinutes: assignment.duration_minutes,
      status: assignment.status,
      startedAt: assignment.started_at,
      expiresAt: assignment.expires_at,
      completedAt: assignment.completed_at,
      taskId: assignment.task_id,
    },
    progress: {
      answered: answers.length,
      correct,
      score: correct * 10,
      maximum: assignment.question_count * 10,
      complete: assignment.status === "Completed",
    },
    current: !finished && assignment.status === "In Progress" && current ? {
      id: current.id,
      definition: current.definition,
      category: current.category,
      difficulty: current.difficulty,
      imageUrl: current.image_url,
      options: optionsFor(current, questions, assignment.id),
      questionNumber: answers.length + 1,
    } : null,
    results: finished ? questions.map(question => {
      const answer = answered.get(question.id);
      return {
        questionId: question.id,
        term: question.term,
        definition: question.definition,
        selectedAnswer: answer?.selected_term || "Not answered",
        correctAnswer: question.term,
        correct: answer?.correct === true,
      };
    }) : [],
  };
}

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id") || "";
    if (!id) return NextResponse.json({ success: false, error: "Assignment ID is required." }, { status: 400 });
    const { assignment } = await assignmentFor(request, id);
    return NextResponse.json(await state(assignment));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load Academy assignment.";
    return NextResponse.json({ success: false, error: message }, { status: message.includes("access") ? 401 : 404 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = await request.json();
    const id = String(input.assignmentId || "");
    const action = String(input.action || "");
    const { assignment, session } = await assignmentFor(request, id);

    if (action === "start") {
      if (assignment.status === "Assigned") {
        const now = new Date();
        const expires = new Date(now.getTime() + assignment.duration_minutes * 60000);
        await Promise.all([
          supabaseAdmin(`nkh_academy_assignments?id=eq.${assignment.id}`, {
            method: "PATCH", prefer: "return=minimal",
            body: { status: "In Progress", started_at: now.toISOString(), expires_at: expires.toISOString() },
          }),
          assignment.task_id
            ? supabaseAdmin(`nkh_tasks?id=eq.${assignment.task_id}`, {
                method: "PATCH", prefer: "return=minimal", body: { status: "In Progress", started_at: now.toISOString() },
              })
            : Promise.resolve(null),
        ]);
        assignment.status = "In Progress";
        assignment.started_at = now.toISOString();
        assignment.expires_at = expires.toISOString();
      }
      return NextResponse.json(await state(assignment));
    }

    if (action !== "answer" || assignment.status !== "In Progress") {
      return NextResponse.json({ success: false, error: "Start this assignment before answering." }, { status: 400 });
    }
    if (await expireIfNeeded(assignment)) {
      return NextResponse.json(await state(assignment));
    }

    const questionId = String(input.questionId || "");
    const selectedTerm = String(input.answer || "").trim().slice(0, 120);
    if (!assignment.question_ids.includes(questionId) || !selectedTerm) {
      return NextResponse.json({ success: false, error: "A valid answer is required." }, { status: 400 });
    }
    const question = (await supabaseAdmin<Question[]>(
      `nkh_hospitality_questions?select=id,slug,term,definition,category,difficulty,image_url&id=eq.${questionId}&limit=1`
    ))[0];
    if (!question) return NextResponse.json({ success: false, error: "Question was not found." }, { status: 404 });
    const correct = selectedTerm.toLowerCase() === question.term.toLowerCase();
    await supabaseAdmin("nkh_academy_assignment_answers", {
      method: "POST", prefer: "return=minimal",
      body: {
        assignment_id: assignment.id,
        question_id: question.id,
        selected_term: selectedTerm,
        correct_term: question.term,
        definition_snapshot: question.definition,
        correct,
      },
    });
    await supabaseAdmin("nkh_hospitality_quiz_attempts?on_conflict=play_date,staff_name,question_id", {
      method: "POST",
      prefer: "resolution=ignore-duplicates,return=minimal",
      body: {
        play_date: assignment.assignment_date,
        staff_name: session.name,
        question_id: question.id,
        selected_term: selectedTerm,
        correct,
        points: correct ? 10 : 0,
      },
    }).catch(() => undefined);

    const answers = await supabaseAdmin<Array<{ correct: boolean }>>(
      `nkh_academy_assignment_answers?select=correct&assignment_id=eq.${assignment.id}`
    );
    if (answers.length >= assignment.question_count) {
      const now = new Date().toISOString();
      const correctAnswers = answers.filter(item => item.correct).length;
      await Promise.all([
        supabaseAdmin(`nkh_academy_assignments?id=eq.${assignment.id}`, {
          method: "PATCH", prefer: "return=minimal",
          body: {
            status: "Completed",
            completed_at: now,
            correct_answers: correctAnswers,
            score: correctAnswers * 10,
          },
        }),
        assignment.task_id
          ? supabaseAdmin(`nkh_tasks?id=eq.${assignment.task_id}`, {
              method: "PATCH", prefer: "return=minimal",
              body: {
                status: "Done",
                completed_at: now,
                completed_by_staff_id: assignment.staff_id,
                completed_by_name_snapshot: session.name,
                completion_note: `${correctAnswers}/${assignment.question_count} correct`,
              },
            })
          : Promise.resolve(null),
      ]);
      if (assignment.task_id) {
        await supabaseAdmin("nkh_task_events", {
          method: "POST", prefer: "return=minimal", body: {
            task_id: assignment.task_id,
            event_type: "Completed",
            from_status: "In Progress",
            to_status: "Done",
            actor_staff_id: assignment.staff_id,
            actor_name_snapshot: session.name,
            note: `${correctAnswers}/${assignment.question_count} correct`,
          },
        });
      }
      assignment.status = "Completed";
      assignment.completed_at = now;
      assignment.correct_answers = correctAnswers;
      assignment.score = correctAnswers * 10;
    }
    return NextResponse.json({
      ...(await state(assignment)),
      result: { correct, correctTerm: question.term, explanation: question.definition, points: correct ? 10 : 0 },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update Academy assignment.";
    return NextResponse.json(
      { success: false, error: message.includes("duplicate key") ? "This question has already been answered." : message },
      { status: message.includes("duplicate key") ? 409 : 500 }
    );
  }
}
