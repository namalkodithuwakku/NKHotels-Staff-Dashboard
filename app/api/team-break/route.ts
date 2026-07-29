import { NextRequest, NextResponse } from "next/server";
import {
  ACADEMY_QUESTION_TARGET_PER_COURSE,
  ACADEMY_TOTAL_QUESTION_TARGET,
  academyCourse,
  academyCourses,
} from "../../lib/academyCourses";
import { hospitalityQuestionBank } from "../../lib/hospitalityQuestionBank";
import { readServerSession } from "../../lib/serverSession";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

type Question = {
  id: string;
  slug: string;
  term: string;
  definition: string;
  category: string;
  difficulty: "Easy" | "Medium" | "Advanced";
  image_url?: string | null;
};

type Attempt = {
  question_id: string;
  staff_name: string;
  selected_term: string;
  correct: boolean;
  points: number;
  answered_at: string;
};

const DAILY_LIMIT = 10;
const POINTS_PER_CORRECT_ANSWER = 10;

function colomboDate() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index++) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function seeded<T>(values: T[], key: (value: T) => string, seed: string) {
  return [...values].sort((left, right) =>
    hash(`${seed}|${key(left)}`) - hash(`${seed}|${key(right)}`)
  );
}

async function pagedRows<T>(path: string, pageSize = 1000) {
  const rows: T[] = [];
  let offset = 0;
  while (true) {
    const separator = path.includes("?") ? "&" : "?";
    const page = await supabaseAdmin<T[]>(
      `${path}${separator}limit=${pageSize}&offset=${offset}`
    );
    rows.push(...page);
    if (page.length < pageSize) return rows;
    offset += pageSize;
  }
}

async function ensureCatalogue() {
  const existing = await pagedRows<{ slug: string }>(
    "nkh_hospitality_questions?select=slug&order=slug.asc"
  );
  const known = new Set(existing.map(item => item.slug));
  const missing = hospitalityQuestionBank.filter(item => !known.has(item.slug));
  if (!missing.length) return;
  for (let index = 0; index < missing.length; index += 50) {
    await supabaseAdmin("nkh_hospitality_questions?on_conflict=slug", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: missing.slice(index, index + 50).map(item => ({
        ...item,
        image_prompt: [
          "Create a friendly, relaxing, polished hospitality learning image in the approachable visual language of a premium vocabulary picture card for adults.",
          `The visual concept is “${item.term}” in the ${item.category} category.`,
          `Meaning: ${item.definition}`,
          "Use a softly dimensional editorial illustration with gentle blue, green, amber and neutral colours, natural light, rounded forms and an uncluttered boutique hotel setting.",
          "Keep it mature, calm and suitable for adult hotel staff training rather than a children's cartoon.",
          "Show adult professional hotel staff or adult guests only when people are genuinely useful to explain the concept.",
          "Objects and buildings must remain normal: never add eyes, mouths, faces, hands, arms, expressions or mascot personalities to beds, keys, luggage, food, documents, rooms, phones or any other item.",
          "No children, cute mascots, talking objects, text, letters, logos, watermarks, charts, UI screenshots or visible brand names.",
          "Clear landscape-friendly composition with one understandable central idea.",
        ].join(" "),
      })),
    });
  }
}

async function allQuestions() {
  await ensureCatalogue();
  return pagedRows<Question>(
    "nkh_hospitality_questions?select=id,slug,term,definition,category,difficulty,image_url&active=eq.true&order=category.asc,term.asc"
  );
}

function dailyQuestions(questions: Question[], date: string, staffName: string) {
  const categoryBuckets = new Map<string, Question[]>();
  questions.forEach(question => {
    const bucket = categoryBuckets.get(question.category) || [];
    bucket.push(question);
    categoryBuckets.set(question.category, bucket);
  });
  const categories = seeded([...categoryBuckets.keys()], value => value, `${date}|${staffName}|categories`);
  const chosen: Question[] = [];
  let round = 0;
  while (chosen.length < DAILY_LIMIT && round < 20) {
    for (const category of categories) {
      const bucket = seeded(categoryBuckets.get(category) || [], item => item.slug, `${date}|${staffName}|${category}`)
        .sort((left, right) => Number(Boolean(right.image_url)) - Number(Boolean(left.image_url)));
      const question = bucket[round];
      if (question && !chosen.some(item => item.id === question.id)) chosen.push(question);
      if (chosen.length === DAILY_LIMIT) break;
    }
    round++;
  }
  return chosen;
}

function optionsFor(question: Question, questions: Question[], date: string, staffName: string) {
  const sameCategory = questions.filter(item => item.category === question.category && item.id !== question.id);
  const fallback = questions.filter(item => item.id !== question.id);
  const distractors = seeded(sameCategory.length >= 2 ? sameCategory : fallback, item => item.slug, `${date}|${staffName}|${question.slug}|options`)
    .slice(0, 2)
    .map(item => item.term);
  return seeded([question.term, ...distractors], value => value, `${question.slug}|${staffName}|${date}|order`);
}

async function buildState(staffName: string, courseId: string) {
  const date = colomboDate();
  const questions = await allQuestions();
  const course = academyCourse(courseId);
  const courseQuestions = questions.filter(question => course.categories.includes(question.category));
  const selected = dailyQuestions(courseQuestions, date, `${staffName}|${course.id}`);
  const [myAttempts, teamAttempts] = await Promise.all([
    pagedRows<Attempt>(
      `nkh_hospitality_quiz_attempts?select=question_id,staff_name,selected_term,correct,points,answered_at&play_date=eq.${date}&staff_name=ilike.${encodeURIComponent(staffName)}&order=answered_at.asc`
    ),
    pagedRows<Attempt>(
      `nkh_hospitality_quiz_attempts?select=question_id,staff_name,selected_term,correct,points,answered_at&play_date=eq.${date}&order=answered_at.asc`
    ),
  ]);
  const courseQuestionIds = new Set(courseQuestions.map(question => question.id));
  const courseMyAttempts = myAttempts.filter(item => courseQuestionIds.has(item.question_id));
  const courseTeamAttempts = teamAttempts.filter(item => courseQuestionIds.has(item.question_id));
  const answered = new Map(courseMyAttempts.map(item => [item.question_id, item]));
  const current = selected.find(item => !answered.has(item.id)) || null;
  const leaderboard = new Map<string, { staffName: string; points: number; correct: number; answered: number }>();
  courseTeamAttempts.forEach(item => {
    const key = item.staff_name.toLowerCase();
    const row = leaderboard.get(key) || { staffName: item.staff_name, points: 0, correct: 0, answered: 0 };
    row.points += item.correct ? POINTS_PER_CORRECT_ANSWER : 0;
    row.correct += item.correct ? 1 : 0;
    row.answered++;
    leaderboard.set(key, row);
  });
  const score = courseMyAttempts.reduce((total, item) => total + (item.correct ? POINTS_PER_CORRECT_ANSWER : 0), 0);
  const maximum = DAILY_LIMIT * POINTS_PER_CORRECT_ANSWER;
  return {
    success: true,
    date,
    catalogueSize: questions.length,
    academyTarget: ACADEMY_TOTAL_QUESTION_TARGET,
    course: {
      ...course,
      questionCount: courseQuestions.length,
      questionTarget: ACADEMY_QUESTION_TARGET_PER_COURSE,
    },
    courses: academyCourses.map(item => {
      const items = questions.filter(question => item.categories.includes(question.category));
      return {
        ...item,
        questionCount: items.length,
        questionTarget: ACADEMY_QUESTION_TARGET_PER_COURSE,
        imagesReady: items.filter(question => Boolean(question.image_url)).length,
      };
    }),
    dailyLimit: DAILY_LIMIT,
    progress: {
      answered: courseMyAttempts.length,
      correct: courseMyAttempts.filter(item => item.correct).length,
      score,
      maximum,
      complete: courseMyAttempts.length >= DAILY_LIMIT,
    },
    current: current ? {
      id: current.id,
      definition: current.definition,
      category: current.category,
      difficulty: current.difficulty,
      imageUrl: current.image_url || null,
      options: optionsFor(current, courseQuestions, date, `${staffName}|${course.id}`),
      questionNumber: courseMyAttempts.length + 1,
    } : null,
    recentAnswers: selected.filter(item => answered.has(item.id)).map(item => {
      const attempt = answered.get(item.id)!;
      return {
        id: item.id,
        term: item.term,
        correct: attempt.correct,
        points: attempt.correct ? POINTS_PER_CORRECT_ANSWER : 0,
        selectedTerm: attempt.selected_term,
        category: item.category,
      };
    }).reverse().slice(0, 5),
    leaderboard: [...leaderboard.values()]
      .sort((left, right) => right.points - left.points || right.correct - left.correct || left.staffName.localeCompare(right.staffName))
      .slice(0, 12),
    imageProgress: {
      ready: courseQuestions.filter(item => Boolean(item.image_url)).length,
      total: courseQuestions.length,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = readServerSession(request);
    if (!session) return NextResponse.json({ success: false, error: "Staff access required." }, { status: 401 });
    return NextResponse.json(await buildState(session.name, request.nextUrl.searchParams.get("course") || ""));
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unable to load the Hospitality Challenge.",
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = readServerSession(request);
    if (!session) return NextResponse.json({ success: false, error: "Staff access required." }, { status: 401 });
    const input = await request.json();
    const questionId = String(input.questionId || "");
    const selectedTerm = String(input.answer || "").trim().slice(0, 100);
    const course = academyCourse(input.courseId);
    const date = colomboDate();
    const questions = await allQuestions();
    const courseQuestions = questions.filter(question => course.categories.includes(question.category));
    const selected = dailyQuestions(courseQuestions, date, `${session.name}|${course.id}`);
    const question = selected.find(item => item.id === questionId);
    if (!question || !selectedTerm) {
      return NextResponse.json({ success: false, error: "That question is not part of today’s challenge." }, { status: 400 });
    }
    const existing = await supabaseAdmin<Array<{ id: string }>>(
      `nkh_hospitality_quiz_attempts?select=id&play_date=eq.${date}&staff_name=ilike.${encodeURIComponent(session.name)}&question_id=eq.${question.id}&limit=1`
    );
    if (existing.length) {
      return NextResponse.json({ success: false, error: "This question has already been answered." }, { status: 409 });
    }
    const correct = selectedTerm.toLowerCase() === question.term.toLowerCase();
    await supabaseAdmin("nkh_hospitality_quiz_attempts", {
      method: "POST",
      prefer: "return=minimal",
      body: {
        play_date: date,
        staff_name: session.name,
        question_id: question.id,
        selected_term: selectedTerm,
        correct,
        points: correct ? POINTS_PER_CORRECT_ANSWER : 0,
      },
    });
    return NextResponse.json({
      ...(await buildState(session.name, course.id)),
      result: {
        correct,
        correctTerm: question.term,
        explanation: question.definition,
        points: correct ? POINTS_PER_CORRECT_ANSWER : 0,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save the answer.";
    return NextResponse.json({ success: false, error: message.includes("23505") ? "This question has already been answered." : message }, { status: message.includes("23505") ? 409 : 500 });
  }
}
