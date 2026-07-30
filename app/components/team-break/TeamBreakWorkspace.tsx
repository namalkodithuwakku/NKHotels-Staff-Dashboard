"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award, BookOpenCheck, Check, ChevronRight, Crown, Hotel,
  ImageIcon, RefreshCw, Sparkles, Star, Trophy, Users, X,
} from "lucide-react";
import AcademyAssignment from "./AcademyAssignment";

type ChallengeState = {
  date: string;
  catalogueSize: number;
  academyTarget: number;
  course: {
    id: string;
    name: string;
    shortName: string;
    description: string;
    categories: string[];
    tone: string;
    questionCount: number;
    questionTarget: number;
  };
  courses: Array<{
    id: string;
    name: string;
    shortName: string;
    description: string;
    tone: string;
    questionCount: number;
    questionTarget: number;
    imagesReady: number;
  }>;
  dailyLimit: number;
  progress: { answered: number; correct: number; score: number; maximum: number; complete: boolean };
  current: null | {
    id: string;
    definition: string;
    category: string;
    difficulty: "Easy" | "Medium" | "Advanced";
    imageUrl: string | null;
    options: string[];
    questionNumber: number;
  };
  recentAnswers: Array<{
    id: string;
    term: string;
    correct: boolean;
    points: number;
    selectedTerm: string;
    category: string;
  }>;
  leaderboard: Array<{ staffName: string; points: number; correct: number; answered: number }>;
  imageProgress: { ready: number; total: number };
  result?: { correct: boolean; correctTerm: string; explanation: string; points: number };
};

async function payload(response: Response) {
  const value = await response.json();
  if (!response.ok || !value.success) throw new Error(value.error || "Hospitality Challenge request failed.");
  return value as ChallengeState;
}

function initials(name: string) {
  return name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
}

export default function TeamBreakWorkspace({ staffName, canRegenerate = false }: { staffName: string; canRegenerate?: boolean }) {
  const [state, setState] = useState<ChallengeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [answering, setAnswering] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ChallengeState["result"] | null>(null);
  const [completedBurst, setCompletedBurst] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [imageError, setImageError] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("reservations");
  const [assignmentId, setAssignmentId] = useState("");

  useEffect(() => {
    setAssignmentId(window.sessionStorage.getItem("nkh_academy_assignment_id") || "");
  }, []);

  const load = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setLoading(true);
      setState(await payload(await fetch(`/api/team-break?course=${encodeURIComponent(selectedCourse)}`, { cache: "no-store" })));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load the challenge.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [selectedCourse]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function answer(selected: string) {
    if (!state?.current || answering || result) return;
    try {
      setAnswering(selected);
      setError("");
      const next = await payload(await fetch("/api/team-break", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: state.current.id, answer: selected, courseId: state.course.id }),
      }));
      setState(next);
      setResult(next.result || null);
      if (next.result?.correct) {
        window.dispatchEvent(new CustomEvent("nkh-pet-celebrate", {
          detail: {
            message: next.progress.complete
              ? "Amazing! Today’s challenge is complete!"
              : "Great answer! Niko is cheering for you.",
          },
        }));
      }
      if (next.progress.complete) {
        setCompletedBurst(true);
        window.setTimeout(() => setCompletedBurst(false), 2200);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save your answer.");
    } finally {
      setAnswering("");
    }
  }

  function chooseCourse(courseId: string) {
    if (courseId === selectedCourse) return;
    setResult(null);
    setImageError("");
    setGeneratingImage(false);
    setSelectedCourse(courseId);
  }

  async function generateCurrentImage(regenerate = false) {
    if (!state?.current || (!regenerate && state.current.imageUrl) || generatingImage) return;
    try {
      setGeneratingImage(true);
      setImageError("");
      const response = await fetch("/api/cron/team-break-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: state.current.id, regenerate }),
      });
      const value = await response.json();
      if (!response.ok || !value.success || !value.imageUrl) {
        throw new Error(value.error || "Unable to prepare this hospitality visual.");
      }
      setState(current => current?.current ? {
        ...current,
        current: { ...current.current, imageUrl: value.imageUrl },
        imageProgress: {
          ...current.imageProgress,
          ready: Math.min(current.imageProgress.total, current.imageProgress.ready + (value.alreadyReady || regenerate ? 0 : 1)),
        },
      } : current);
      window.dispatchEvent(new CustomEvent("nkh-pet-celebrate", {
        detail: { message: "A new hospitality visual is ready!" },
      }));
    } catch (reason) {
      setImageError(reason instanceof Error ? reason.message : "Unable to prepare this visual.");
    } finally {
      setGeneratingImage(false);
    }
  }

  const myRank = useMemo(() => {
    if (!state) return 0;
    return state.leaderboard.findIndex(row => row.staffName.toLowerCase() === staffName.toLowerCase()) + 1;
  }, [state, staffName]);
  const progressPercent = state ? Math.min(100, state.progress.answered / state.dailyLimit * 100) : 0;
  const imagePercent = state?.imageProgress.total
    ? Math.round(state.imageProgress.ready / state.imageProgress.total * 100)
    : 0;

  if (loading) return <div className="hospitality-loading"><RefreshCw/><strong>Preparing today’s hospitality challenge…</strong></div>;

  if (assignmentId) return <AcademyAssignment assignmentId={assignmentId} canRegenerate={canRegenerate} onBack={() => {
    window.sessionStorage.removeItem("nkh_academy_assignment_id");
    setAssignmentId("");
  }}/>;

  return <div className="hospitality-challenge">
    <section className="hospitality-hero">
      <div className="hospitality-hero-copy">
        <small>NKH ACADEMY</small>
        <h2>Hospitality learning, made enjoyable</h2>
        <p>Choose a course and complete ten calm, useful questions at your own pace.</p>
      </div>
      <div className="hospitality-hero-metric"><BookOpenCheck/><div><strong>{state?.catalogueSize || 0}</strong><span>of {state?.academyTarget || 2400} concepts</span></div></div>
      <div className="hospitality-hero-metric"><Star/><div><strong>{state?.progress.score || 0}</strong><span>your points today</span></div></div>
      <Sparkles className="hospitality-hero-spark"/>
    </section>

    {error && <div className="hospitality-error">{error}<button onClick={() => void load()}>Try again</button></div>}

    <div className="academy-focus-layout">
    {state?.courses.length ? <section className="academy-course-library academy-course-sidebar">
      <header>
        <div><small>COURSE LIBRARY</small><h3>Choose your course</h3></div>
        <span>{state.catalogueSize} of {state.academyTarget} concepts prepared</span>
      </header>
      <div className="academy-course-grid">
        {state.courses.map(course => {
          const active = course.id === state.course.id;
          const visualPercent = course.questionCount
            ? Math.round(course.imagesReady / course.questionCount * 100)
            : 0;
          return <button type="button" key={course.id}
            className={`academy-course-card tone-${course.tone} ${active ? "active" : ""}`}
            onClick={() => chooseCourse(course.id)}>
            <span>{course.shortName.slice(0, 2).toUpperCase()}</span>
            <div><strong>{course.name}</strong><small>{course.description}</small></div>
            <em>{course.questionCount}/{course.questionTarget} questions · {visualPercent}% visuals</em>
            {active && <Check size={16}/>}
          </button>;
        })}
      </div>
    </section> : null}

    <div className="hospitality-layout">
      <main className="hospitality-game">
        <header className="hospitality-progress-header">
          <div><span>{state?.course.shortName.toUpperCase() || "DAILY COURSE"}</span><strong>{state?.progress.answered || 0} of {state?.dailyLimit || 10} answered</strong></div>
          <div className="hospitality-progress-track"><span style={{ width: `${progressPercent}%` }}/></div>
          <b>{Math.round(progressPercent)}%</b>
        </header>

        {result ? <section className={`hospitality-answer-result ${result.correct ? "correct" : "wrong"}`}>
          <div className="answer-result-icon">{result.correct ? <Check/> : <X/>}</div>
          <small>{result.correct ? `CORRECT · +${result.points} POINTS` : "LEARNING MOMENT"}</small>
          <h3>{result.correctTerm}</h3>
          <p>{result.explanation}</p>
          <button onClick={() => setResult(null)}>
            {state?.progress.complete ? "See today’s result" : "Next question"} <ChevronRight size={17}/>
          </button>
        </section> : state?.progress.complete ? <section className="hospitality-complete">
          <div className="hospitality-complete-trophy"><Trophy/></div>
          <small>{state.course.shortName.toUpperCase()} COMPLETE</small>
          <h3>Excellent work, {staffName}!</h3>
          <p>You answered {state.progress.correct} of {state.dailyLimit} correctly and earned <b>{state.progress.score} points</b>.</p>
          <div><span><strong>{state.progress.score}</strong>score</span><span><strong>{state.progress.correct}</strong>correct</span><span><strong>#{myRank || "–"}</strong>team rank</span></div>
          <small className="come-back">Choose another Academy course, or return tomorrow for a fresh set.</small>
        </section> : state?.current ? <>
          <section className="hospitality-question">
            <div className={`hospitality-question-image category-${state.current.category.toLowerCase().replace(/[^a-z]+/g, "-")}`}
              style={state.current.imageUrl ? { backgroundImage: `linear-gradient(180deg,transparent 55%,rgba(10,40,55,.35)),url("${state.current.imageUrl}")` } : undefined}>
              {!state.current.imageUrl && <section className="hospitality-image-generator">
                {generatingImage ? <RefreshCw className="hospitality-image-spinner"/> : <Hotel/>}
                <strong>{generatingImage ? "Creating your visual…" : "This visual is ready to be created"}</strong>
                <span>{generatingImage ? "Please keep this page open for a moment." : "Help build the shared NKH learning library."}</span>
                <button type="button" disabled={generatingImage} onClick={() => void generateCurrentImage()}>
                  {generatingImage ? "Generating…" : <><Sparkles size={15}/> Generate image</>}
                </button>
                {imageError && <small>{imageError}</small>}
              </section>}
              {state.current.imageUrl && canRegenerate && <button className="academy-replace-visual" type="button" disabled={generatingImage} onClick={() => void generateCurrentImage(true)}>
                <RefreshCw size={14}/>{generatingImage ? "Replacing…" : "Replace visual"}
              </button>}
              <div><span>{state.current.category}</span><b>{state.current.difficulty} · 10 points</b></div>
            </div>
            <div className="hospitality-question-copy">
              <small>QUESTION {state.current.questionNumber} OF {state.dailyLimit}</small>
              <h3>Which hospitality term matches this definition?</h3>
              <p>{state.current.definition}</p>
            </div>
          </section>
          <div className="hospitality-options">
            {state.current.options.map((option, index) => <button key={option} disabled={Boolean(answering)}
              className={answering === option ? "answering" : ""} onClick={() => void answer(option)}>
              <span>{String.fromCharCode(65 + index)}</span><strong>{option}</strong><ChevronRight/>
            </button>)}
          </div>
          <p className="hospitality-calm-note">No timer. Learn carefully and enjoy the course.</p>
        </> : null}
      </main>

      <aside className="hospitality-side">
        <section className="hospitality-score-card">
          <header><div><small>TEAM TODAY</small><h3>Knowledge board</h3></div><Users/></header>
          <div className="hospitality-leaderboard">{state?.leaderboard.length ? state.leaderboard.map((row, index) =>
            <div key={row.staffName} className={row.staffName.toLowerCase() === staffName.toLowerCase() ? "mine" : ""}>
              <b>{index === 0 ? <Crown/> : index + 1}</b><span>{initials(row.staffName)}</span>
              <div><strong>{row.staffName}</strong><small>{row.correct}/{row.answered} correct</small></div><em>{row.points}</em>
            </div>
          ) : <p>Complete a question to start today’s board.</p>}</div>
          <small className="hospitality-score-note">Friendly learning only—never used for work performance.</small>
        </section>

        <section className="hospitality-recent">
          <header><div><small>YOUR LEARNING</small><h3>Recent answers</h3></div><Award/></header>
          {state?.recentAnswers.length ? state.recentAnswers.map(item => <div key={item.id}>
            <span className={item.correct ? "right" : "missed"}>{item.correct ? <Check/> : <X/>}</span>
            <div><strong>{item.term}</strong><small>{item.category}</small></div><b>{item.points ? `+${item.points}` : "Learned"}</b>
          </div>) : <p>Your answers will appear here.</p>}
        </section>

        <section className="hospitality-image-status">
          <ImageIcon/><div><strong>{state?.course.shortName || "Course"} visual library</strong><span>{state?.imageProgress.ready || 0} of {state?.imageProgress.total || 0} prepared · {imagePercent}%</span></div>
        </section>
      </aside>
    </div>
    </div>

    {completedBurst && <div className="hospitality-celebration" aria-hidden="true">
      <Sparkles/><Trophy/><Sparkles/>
    </div>}
  </div>;
}
