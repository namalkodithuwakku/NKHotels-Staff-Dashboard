"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bot, ChevronLeft, ChevronRight, Clock3, MessageCircle, RefreshCw, Send, X } from "lucide-react";

type MonitorItem = {
  id?: string;
  key?: string;
  property?: string;
  hotel?: string;
  type?: string;
  event?: string;
  bookingReference?: string;
  bookingId?: string;
  guest?: string;
  arrivalDate?: string;
  urgency?: string;
  summary?: string;
  actionNeeded?: string;
  action?: string;
};

type MonitorReport = {
  id: string;
  report_time: string;
  period_from: string | null;
  period_to: string | null;
  summary: string | null;
  attention_count: number;
  urgent_count: number;
  items: MonitorItem[] | null;
  source: string | null;
  created_at: string;
};

type MonitorComment = {
  id: string;
  report_id: string;
  item_key: string;
  staff_name: string;
  comment_text: string;
  created_at: string;
};

type TaskLike = Record<string, unknown>;

function itemKey(item: MonitorItem, index: number) {
  return String(item.id || item.key || item.bookingReference || item.bookingId || `${index + 1}`);
}

function itemProperty(item: MonitorItem) {
  return String(item.property || item.hotel || "General operations");
}

function itemType(item: MonitorItem) {
  return String(item.type || item.event || "Monitor item");
}

function itemReference(item: MonitorItem) {
  return String(item.bookingReference || item.bookingId || "");
}

function itemAction(item: MonitorItem) {
  return String(item.actionNeeded || item.action || "");
}

function reportTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export default function AISupervisorGuide({
  staffName,
  tasks: _tasks,
  onOpenTasks: _onOpenTasks,
  compact = false,
}: {
  staffName: string;
  tasks: TaskLike[];
  onOpenTasks?: () => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reports, setReports] = useState<MonitorReport[]>([]);
  const [reportIndex, setReportIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [openCommentKey, setOpenCommentKey] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [comments, setComments] = useState<Record<string, MonitorComment[]>>({});

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/ai-monitor/reports", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success !== true) throw new Error(payload?.error || "Unable to load AI monitor reports.");
      const next = Array.isArray(payload.reports) ? payload.reports : [];
      setReports(next);
      setReportIndex(index => Math.min(index, Math.max(0, next.length - 1)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load AI monitor reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadReports();
    const timer = window.setInterval(() => void loadReports(), 60000);
    return () => window.clearInterval(timer);
  }, [open, loadReports]);

  const report = reports[reportIndex] || null;
  const items = useMemo(() => Array.isArray(report?.items) ? report!.items! : [], [report]);

  async function loadComments(reportId: string, key: string) {
    try {
      const response = await fetch(`/api/ai-monitor/comments?reportId=${encodeURIComponent(reportId)}&itemKey=${encodeURIComponent(key)}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success !== true) throw new Error(payload?.error || "Unable to load comments.");
      setComments(current => ({ ...current, [`${reportId}:${key}`]: Array.isArray(payload.comments) ? payload.comments : [] }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load comments.");
    }
  }

  async function toggleComments(reportId: string, key: string) {
    const compound = `${reportId}:${key}`;
    if (openCommentKey === compound) {
      setOpenCommentKey("");
      setCommentDraft("");
      return;
    }
    setOpenCommentKey(compound);
    setCommentDraft("");
    if (!comments[compound]) await loadComments(reportId, key);
  }

  async function saveComment(reportId: string, key: string) {
    const text = commentDraft.trim();
    if (!text || commentBusy) return;
    try {
      setCommentBusy(true);
      setError("");
      const response = await fetch("/api/ai-monitor/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, itemKey: key, comment: text }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success !== true) throw new Error(payload?.error || "Unable to save comment.");
      const compound = `${reportId}:${key}`;
      setComments(current => ({ ...current, [compound]: [...(current[compound] || []), payload.comment] }));
      setCommentDraft("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save comment.");
    } finally {
      setCommentBusy(false);
    }
  }

  function previousReport() {
    if (!reports.length) return;
    setReportIndex(index => Math.min(reports.length - 1, index + 1));
    setOpenCommentKey("");
  }

  function nextReport() {
    if (!reports.length) return;
    setReportIndex(index => Math.max(0, index - 1));
    setOpenCommentKey("");
  }

  const launcherLabel = report
    ? report.attention_count > 0
      ? `${report.attention_count} need attention`
      : "Latest report clear"
    : "Monitor reports";

  return (
    <div className={`ai-supervisor-guide ${compact ? "compact" : ""} ${open ? "open" : ""}`}>
      {!open && (
        <button className="ai-supervisor-launcher" type="button" onClick={() => setOpen(true)} aria-label="Open AI Supervisor monitor reports">
          <span className="ai-supervisor-avatar"><Bot size={20} /></span>
          <span className="ai-supervisor-launcher-copy">
            <strong>AI Supervisor</strong>
            <small>{launcherLabel}</small>
          </span>
          {report?.urgent_count ? <b>{report.urgent_count}</b> : null}
        </button>
      )}

      {open && (
        <section className="ai-supervisor-panel ai-supervisor-panel-clean ai-monitor-panel" role="dialog" aria-label="AI Supervisor monitor reports">
          <header>
            <div className="ai-supervisor-heading">
              <span className="ai-supervisor-avatar"><Bot size={20} /></span>
              <div><small>NKH AI MONITOR</small><h3>AI Supervisor</h3></div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close AI Supervisor"><X size={18} /></button>
          </header>

          <div className="ai-monitor-toolbar">
            <div>
              <strong>Monitor reports</strong>
              <small>{report ? `${reportTime(report.period_from)} – ${reportTime(report.period_to || report.report_time)}` : "Hourly operational monitoring"}</small>
            </div>
            <button type="button" onClick={() => void loadReports()} disabled={loading} aria-label="Refresh reports">
              <RefreshCw size={16} className={loading ? "ai-supervisor-spin" : ""} />
            </button>
          </div>

          {error && <div className="ai-monitor-error">{error}</div>}

          {report ? (
            <>
              <div className="ai-monitor-report-nav">
                <button type="button" onClick={previousReport} disabled={reportIndex >= reports.length - 1}><ChevronLeft size={16} /> Older</button>
                <span>{reportTime(report.report_time)}</span>
                <button type="button" onClick={nextReport} disabled={reportIndex === 0}>Newer <ChevronRight size={16} /></button>
              </div>

              <div className="ai-monitor-overview">
                <div><span>Needs attention</span><strong>{report.attention_count || 0}</strong></div>
                <div><span>Urgent</span><strong>{report.urgent_count || 0}</strong></div>
                <div><span>Items</span><strong>{items.length}</strong></div>
              </div>

              {report.summary && <p className="ai-monitor-report-summary">{report.summary}</p>}

              <div className="ai-monitor-items">
                {items.length ? items.map((item, index) => {
                  const key = itemKey(item, index);
                  const compound = `${report.id}:${key}`;
                  const itemComments = comments[compound] || [];
                  const commentOpen = openCommentKey === compound;
                  const urgency = String(item.urgency || "").toLowerCase();
                  return (
                    <article className={`ai-monitor-item ${urgency ? `urgency-${urgency}` : ""}`} key={key}>
                      <div className="ai-monitor-item-top">
                        <div>
                          <small>{itemProperty(item)}</small>
                          <h4>{itemType(item)}</h4>
                        </div>
                        {item.urgency && <span><AlertTriangle size={13} /> {item.urgency}</span>}
                      </div>

                      <div className="ai-monitor-meta">
                        {itemReference(item) && <b>Ref {itemReference(item)}</b>}
                        {item.guest && <span>{item.guest}</span>}
                        {item.arrivalDate && <span><Clock3 size={12} /> Arrival {item.arrivalDate}</span>}
                      </div>

                      {item.summary && <p>{item.summary}</p>}
                      {itemAction(item) && <div className="ai-monitor-action"><strong>Action needed</strong><span>{itemAction(item)}</span></div>}

                      <button className="ai-monitor-comment-toggle" type="button" onClick={() => void toggleComments(report.id, key)}>
                        <MessageCircle size={15} /> {commentOpen ? "Close comments" : itemComments.length ? `Comments (${itemComments.length})` : "Comment"}
                      </button>

                      {commentOpen && (
                        <div className="ai-monitor-comments">
                          {itemComments.length > 0 && <div className="ai-monitor-comment-list">
                            {itemComments.map(comment => <div key={comment.id}><strong>{comment.staff_name}</strong><span>{reportTime(comment.created_at)}</span><p>{comment.comment_text}</p></div>)}
                          </div>}
                          <div className="ai-monitor-comment-box">
                            <textarea value={commentDraft} onChange={event => setCommentDraft(event.target.value)} placeholder={`Add a remark as ${staffName}`} maxLength={2000} />
                            <button type="button" disabled={!commentDraft.trim() || commentBusy} onClick={() => void saveComment(report.id, key)}><Send size={14} /> {commentBusy ? "Saving…" : "Save comment"}</button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                }) : <div className="ai-monitor-empty">No operational items were recorded in this report.</div>}
              </div>
            </>
          ) : (
            <div className="ai-monitor-empty">
              <Bot size={28} />
              <strong>No AI monitor report yet</strong>
              <p>The panel is ready. The first saved monitor report will appear here automatically.</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
