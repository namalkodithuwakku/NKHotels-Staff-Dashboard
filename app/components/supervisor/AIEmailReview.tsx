"use client";

import { useCallback, useEffect, useState } from "react";

type ReviewItem = {
  id: string;
  emailId: string;
  from: string | null;
  subject: string | null;
  time: string | null;
  property: string | null;
  bookingId: string | null;
  taskType: string;
  priority: string;
  title: string;
  summary: string;
  action: string;
};

export default function AIEmailReview() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/ai-email-review", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || data.success !== true) throw new Error(data.error || "Unable to load AI review queue.");
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load AI review queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createTask(item: ReviewItem) {
    setCreating(item.id);
    setMessage("");
    try {
      const response = await fetch("/api/ai-email-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inboxId: item.id }),
      });
      const data = await response.json();
      if (!response.ok || data.success !== true) throw new Error(data.error || "Unable to create task.");
      setItems(current => current.filter(row => row.id !== item.id));
      setMessage(data.duplicate ? "Task already existed. Email marked handled." : "Task created successfully.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to create task.");
    } finally {
      setCreating(null);
    }
  }

  return (
    <section className="ai-email-review">
      <div className="ai-email-review-head">
        <div>
          <small>AI SUPERVISOR</small>
          <h2>Email Review</h2>
          <p>Only emails already identified as needing operational attention appear here.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}>Refresh</button>
      </div>

      {message && <div className="ai-email-review-message" role="status">{message}</div>}
      {error && <div className="ai-email-review-error">{error}</div>}
      {loading && <div className="ai-email-review-empty">Loading AI review queue…</div>}
      {!loading && !error && items.length === 0 && <div className="ai-email-review-empty">No actionable emails waiting for review.</div>}

      <div className="ai-email-review-list">
        {items.map(item => (
          <article key={item.id} className="ai-email-review-card">
            <div className="ai-email-review-card-top">
              <div>
                <strong>{item.property || "Property not matched"}</strong>
                <span>{item.taskType}</span>
              </div>
              <b className={`priority-${String(item.priority).toLowerCase()}`}>{item.priority}</b>
            </div>
            <h3>{item.title}</h3>
            <p>{item.summary || item.subject || "Operational email requires review."}</p>
            <div className="ai-email-review-action"><small>WHAT TO DO</small><strong>{item.action}</strong></div>
            <div className="ai-email-review-meta">
              {item.bookingId && <span>Ref {item.bookingId}</span>}
              {item.from && <span>{item.from}</span>}
              {item.time && <span>{new Date(item.time).toLocaleString()}</span>}
            </div>
            <button type="button" className="ai-email-review-create" disabled={creating === item.id} onClick={() => void createTask(item)}>
              {creating === item.id ? "Creating…" : "Create Task"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
