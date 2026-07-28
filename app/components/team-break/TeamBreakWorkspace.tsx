"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award, BookOpenCheck, Check, ChevronRight, Crown, Hotel,
  ImageIcon, RefreshCw, Sparkles, Star, Trophy, Users, X,
} from "lucide-react";

type ChallengeState = {
  date: string;
  catalogueSize: number;
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

export default function TeamBreakWorkspace({ staffName }: { staffName: string }) {
  const [state, setState] = useState<ChallengeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [answering, setAnswering] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ChallengeState["result"] | null>(null);
  const [completedBurst, setCompletedBurst] = useState(false);

  const load = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setLoading(true);
      setState(await payload(await fetch("/api/team-break", { cache: "no-store" })));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load the challenge.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

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
        body: JSON.stringify({ questionId: state.current.id, answer: selected }),
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

  const myRank = useMemo(() => {
    if (!state) return 0;
    return state.leaderboard.findIndex(row => row.staffName.toLowerCase() === staffName.toLowerCase()) + 1;
  }, [state, staffName]);
  const progressPercent = state ? Math.min(100, state.progress.answered / state.dailyLimit * 100) : 0;
  const imagePercent = state?.imageProgress.total
    ? Math.round(state.imageProgress.ready / state.imageProgress.total * 100)
    : 0;

  if (loading) return <div className="hospitality-loading"><RefreshCw/><strong>Preparing today’s hospitality challenge…</strong></div>;

  return <div className="hospitality-challenge">
    <section className="hospitality-hero">
      <div className="hospitality-hero-copy">
        <small>NKH TEAM BREAK</small>
        <h2>Hospitality Knowledge Challenge</h2>
        <p>Ten fresh questions every day. Learn something useful without rushing.</p>
      </div>
      <div className="hospitality-hero-metric"><BookOpenCheck/><div><strong>{state?.catalogueSize || 0}</strong><span>hospitality concepts</span></div></div>
      <div className="hospitality-hero-metric"><Star/><div><strong>{state?.progress.score || 0}</strong><span>your points today</span></div></div>
      <Sparkles className="hospitality-hero-spark"/>
    </section>

    {error && <div className="hospitality-error">{error}<button onClick={() => void load()}>Try again</button></div>}

    <div className="hospitality-layout">
      <main className="hospitality-game">
        <header className="hospitality-progress-header">
          <div><span>DAILY CHALLENGE</span><strong>{state?.progress.answered || 0} of {state?.dailyLimit || 10} answered</strong></div>
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
          <small>DAILY CHALLENGE COMPLETE</small>
          <h3>Excellent work, {staffName}!</h3>
          <p>You answered {state.progress.correct} of {state.dailyLimit} correctly and earned <b>{state.progress.score} points</b>.</p>
          <div><span><strong>{state.progress.score}</strong>score</span><span><strong>{state.progress.correct}</strong>correct</span><span><strong>#{myRank || "–"}</strong>team rank</span></div>
          <small className="come-back">A new random challenge will be ready tomorrow.</small>
        </section> : state?.current ? <>
          <section className="hospitality-question">
            <div className={`hospitality-question-image category-${state.current.category.toLowerCase().replace(/[^a-z]+/g, "-")}`}
              style={state.current.imageUrl ? { backgroundImage: `linear-gradient(180deg,transparent 55%,rgba(10,40,55,.35)),url("${state.current.imageUrl}")` } : undefined}>
              {!state.current.imageUrl && <><Hotel/><span>Hospitality visual preparing</span></>}
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
          <p className="hospitality-calm-note">No timer. Choose carefully and enjoy the break.</p>
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
          <ImageIcon/><div><strong>Visual library</strong><span>{state?.imageProgress.ready || 0} of {state?.imageProgress.total || 0} prepared · {imagePercent}%</span></div>
        </section>
      </aside>
    </div>

    {completedBurst && <div className="hospitality-celebration" aria-hidden="true">
      <Sparkles/><Trophy/><Sparkles/>
    </div>}
  </div>;
}
