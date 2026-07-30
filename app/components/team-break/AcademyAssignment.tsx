"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Check, Clock3, FileCheck2, Hotel, RefreshCw, Sparkles, X } from "lucide-react";

type AssignmentState = {
  assignment: {
    id: string;
    type: "Daily" | "Monthly Exam";
    courseName: string;
    questionCount: number;
    durationMinutes: number;
    status: "Assigned" | "In Progress" | "Completed" | "Expired";
    expiresAt: string | null;
  };
  progress: { answered: number; correct: number; score: number; maximum: number; complete: boolean };
  current: null | {
    id: string;
    definition: string;
    category: string;
    difficulty: string;
    imageUrl: string | null;
    options: string[];
    questionNumber: number;
  };
  results: Array<{
    questionId: string;
    term: string;
    definition: string;
    selectedAnswer: string;
    correctAnswer: string;
    correct: boolean;
  }>;
  result?: { correct: boolean; correctTerm: string; explanation: string; points: number };
};

async function read(response: Response) {
  const value = await response.json();
  if (!response.ok || !value.success) throw new Error(value.error || "Academy request failed.");
  return value as AssignmentState;
}

function duration(seconds: number) {
  const safe = Math.max(0, seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export default function AcademyAssignment({
  assignmentId,
  onBack,
  canRegenerate = false,
}: {
  assignmentId: string;
  onBack: () => void;
  canRegenerate?: boolean;
}) {
  const [state, setState] = useState<AssignmentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [answering, setAnswering] = useState("");
  const [feedback, setFeedback] = useState<AssignmentState["result"] | null>(null);
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [generatingImage, setGeneratingImage] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setState(await read(await fetch(`/api/academy-assignment?id=${encodeURIComponent(assignmentId)}`, { cache: "no-store" })));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load assignment.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [assignmentId]);

  useEffect(() => {
    if (!state?.assignment.expiresAt || state.assignment.status !== "In Progress") {
      setSecondsLeft(0);
      return;
    }
    const tick = () => {
      const next = Math.max(0, Math.ceil((new Date(state.assignment.expiresAt!).getTime() - Date.now()) / 1000));
      setSecondsLeft(next);
      if (next === 0) void load();
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [state?.assignment.expiresAt, state?.assignment.status]);

  async function start() {
    try {
      setLoading(true);
      setError("");
      setState(await read(await fetch("/api/academy-assignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, action: "start" }),
      })));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to start assignment.");
    } finally {
      setLoading(false);
    }
  }

  async function answer(selected: string) {
    if (!state?.current || answering || feedback) return;
    try {
      setAnswering(selected);
      setError("");
      const next = await read(await fetch("/api/academy-assignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          action: "answer",
          questionId: state.current.id,
          answer: selected,
        }),
      }));
      setState(next);
      setFeedback(next.result || null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save answer.");
    } finally {
      setAnswering("");
    }
  }

  async function generateImage(regenerate = false) {
    if (!state?.current || generatingImage) return;
    try {
      setGeneratingImage(true);
      setError("");
      const response = await fetch("/api/cron/team-break-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: state.current.id, regenerate }),
      });
      const value = await response.json();
      if (!response.ok || !value.success || !value.imageUrl) throw new Error(value.error || "Image generation failed.");
      setState(current => current?.current
        ? { ...current, current: { ...current.current, imageUrl: value.imageUrl } }
        : current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to generate image.");
    } finally {
      setGeneratingImage(false);
    }
  }

  if (loading && !state) return <div className="hospitality-loading"><RefreshCw/><strong>Preparing your Academy assignment…</strong></div>;

  return <div className="academy-assignment-shell">
    <header className="academy-assignment-topbar">
      <button type="button" onClick={onBack}><ArrowLeft size={17}/> Academy</button>
      <div>
        <small>{state?.assignment.type || "ACADEMY ASSIGNMENT"}</small>
        <h2>{state?.assignment.courseName || "NKH Academy"}</h2>
      </div>
      {state?.assignment.status === "In Progress"
        ? <strong className={secondsLeft < 300 ? "ending" : ""}><Clock3 size={17}/>{duration(secondsLeft)}</strong>
        : <span>{state?.assignment.questionCount || 0} questions · {state?.assignment.durationMinutes || 0} minutes</span>}
    </header>

    {error && <div className="hospitality-error">{error}<button onClick={() => void load()}>Try again</button></div>}

    {state?.assignment.status === "Assigned" ? <section className="academy-start-card">
      <div><FileCheck2/></div>
      <small>{state.assignment.type === "Monthly Exam" ? "MONTHLY KNOWLEDGE EXAM" : "TODAY’S LEARNING ASSIGNMENT"}</small>
      <h3>{state.assignment.courseName}</h3>
      <p>You can begin anytime during your working day. Once started, complete all {state.assignment.questionCount} questions within {state.assignment.durationMinutes} minutes.</p>
      <ul>
        <li><Check/> The timer starts only after you press Start</li>
        <li><Check/> Your answers are saved after every question</li>
        <li><Check/> A complete result sheet is provided at the end</li>
      </ul>
      <button type="button" onClick={() => void start()} disabled={loading}>
        {loading ? "Starting…" : `Start ${state.assignment.type === "Monthly Exam" ? "exam" : "assignment"}`}
      </button>
    </section> : null}

    {feedback ? <section className={`hospitality-answer-result academy-feedback ${feedback.correct ? "correct" : "wrong"}`}>
      <div className="answer-result-icon">{feedback.correct ? <Check/> : <X/>}</div>
      <small>{feedback.correct ? `CORRECT · +${feedback.points} POINTS` : "LEARNING MOMENT"}</small>
      <h3>{feedback.correctTerm}</h3>
      <p>{feedback.explanation}</p>
      <button onClick={() => setFeedback(null)}>
        {state?.progress.complete ? "View result sheet" : "Next question"}
      </button>
    </section> : state?.assignment.status === "In Progress" && state.current ? <section className="academy-live-question">
      <header>
        <div><small>QUESTION {state.current.questionNumber} OF {state.assignment.questionCount}</small><strong>{state.current.category}</strong></div>
        <span>{state.progress.answered}/{state.assignment.questionCount}</span>
      </header>
      <div className="academy-live-body">
        <div className="academy-live-image" style={state.current.imageUrl ? { backgroundImage: `url("${state.current.imageUrl}")` } : undefined}>
          {!state.current.imageUrl && <section>
            {generatingImage ? <RefreshCw className="hospitality-image-spinner"/> : <Hotel/>}
            <strong>{generatingImage ? "Creating visual…" : "Visual not created yet"}</strong>
            <button type="button" onClick={() => void generateImage()} disabled={generatingImage}>
              <Sparkles size={14}/>{generatingImage ? "Generating…" : "Generate image"}
            </button>
          </section>}
          {state.current.imageUrl && canRegenerate && <button className="academy-replace-visual" type="button" disabled={generatingImage} onClick={() => void generateImage(true)}>
            <RefreshCw size={14}/>{generatingImage ? "Replacing…" : "Replace visual"}
          </button>}
        </div>
        <div className="academy-live-copy">
          <small>{state.current.difficulty}</small>
          <h3>Which hospitality term matches this definition?</h3>
          <p>{state.current.definition}</p>
        </div>
      </div>
      <div className="hospitality-options academy-live-options">
        {state.current.options.map((option, index) => <button key={option} disabled={Boolean(answering)}
          className={answering === option ? "answering" : ""} onClick={() => void answer(option)}>
          <span>{String.fromCharCode(65 + index)}</span><strong>{option}</strong>
        </button>)}
      </div>
    </section> : null}

    {state && ["Completed", "Expired"].includes(state.assignment.status) ? <section className="academy-results">
      <header>
        <div className={state.assignment.status === "Completed" ? "passed" : "expired"}><FileCheck2/></div>
        <div><small>{state.assignment.status === "Completed" ? "RESULT SHEET" : "TIME COMPLETED"}</small><h2>{state.assignment.courseName}</h2><p>{state.progress.correct} correct from {state.assignment.questionCount} questions · {state.progress.score}/{state.progress.maximum} points</p></div>
        <strong>{Math.round(state.progress.correct / state.assignment.questionCount * 100)}%</strong>
      </header>
      <div className="academy-result-list">
        {state.results.map((item, index) => <article key={item.questionId} className={item.correct ? "correct" : "wrong"}>
          <span>{item.correct ? <Check/> : <X/>}</span>
          <div><small>QUESTION {index + 1}</small><p>{item.definition}</p><dl><dt>Your answer</dt><dd>{item.selectedAnswer}</dd><dt>Correct answer</dt><dd>{item.correctAnswer}</dd></dl></div>
        </article>)}
      </div>
    </section> : null}
  </div>;
}
