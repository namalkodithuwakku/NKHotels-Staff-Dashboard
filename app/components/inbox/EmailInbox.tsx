"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
import { Check, CheckSquare2, MinusSquare, Square } from "lucide-react";
import { ignoreAIEmail, startEmailTask } from "../../lib/api";

function time(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function body(value: string) {
  return String(value || "Email body is unavailable.").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

export default function EmailInbox({ items, staff, shift, canUseTasks, loading, error, onRefresh, onTaskCreated }: any) {
  const [selectedId, setSelectedId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const isMaster = String(staff?.access || "").trim().toLowerCase() === "master";

  const filtered = useMemo(() => items.filter((item: any) => {
    const id = String(item.emailId || item.id);
    return !hiddenIds.includes(id) && [item.aiTitle, item.subject, item.summary, item.property, item.from]
      .join(" ").toLowerCase().includes(search.toLowerCase());
  }), [items, search, hiddenIds]);

  const visibleIds = filtered.map((item: any) => String(item.emailId || item.id));
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id: string) => selectedIds.includes(id));
  const someVisibleSelected = visibleIds.some((id: string) => selectedIds.includes(id));
  const selected = filtered.find((item: any) => String(item.emailId || item.id) === selectedId) || filtered[0];

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  }

  function toggleSelected(id: string) {
    setSelectedIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  }

  function toggleAllVisible() {
    setSelectedIds(current => allVisibleSelected
      ? current.filter(id => !visibleIds.includes(id))
      : Array.from(new Set([...current, ...visibleIds])));
  }

  async function create() {
    if (!selected) return;
    const id = String(selected.emailId || selected.id);
    try {
      setBusy("create");
      await startEmailTask({
        emailId: id, staffName: staff.name, shift: shift?.shift || "", property: selected.property,
        taskType: selected.taskType, category: selected.category, priority: selected.priority,
        aiTitle: selected.aiTitle, subject: selected.subject, summary: selected.summary,
        action: selected.action, event: selected.event, bookingId: selected.bookingId,
        gmailLink: selected.gmailLink, from: selected.from, to: selected.to, time: selected.time,
      });
      setHiddenIds(current => [...current, id]);
      setSelectedIds(current => current.filter(value => value !== id));
      setSelectedId("");
      showNotice("Task created successfully");
      setBusy("");
      void (onTaskCreated || onRefresh)();
    } catch (reason) {
      setBusy("");
      alert(reason instanceof Error ? reason.message : "Unable to create task");
    }
  }

  async function ignore() {
    if (!selected) return;
    const id = String(selected.emailId || selected.id);
    try {
      setBusy("ignore");
      await ignoreAIEmail({ emailId: id, staffName: staff.name, reason: "Reviewed in Email Inbox" });
      setHiddenIds(current => [...current, id]);
      setSelectedId("");
      showNotice("Email ignored");
      void onRefresh();
    } catch (reason) {
      alert(reason instanceof Error ? reason.message : "Unable to ignore email");
    } finally { setBusy(""); }
  }

  async function ignoreSelected() {
    if (!isMaster || selectedIds.length === 0) return;
    if (!window.confirm(`Ignore ${selectedIds.length} selected email${selectedIds.length === 1 ? "" : "s"}?`)) return;
    try {
      setBusy("bulk-ignore");
      const result = await ignoreAIEmail({ emailIds: selectedIds, staffName: staff.name, reason: "Bulk ignored by Master" });
      const ignored = Array.isArray(result.ignored) ? result.ignored : selectedIds;
      setHiddenIds(current => Array.from(new Set([...current, ...ignored])));
      setSelectedIds(current => current.filter(id => !ignored.includes(id)));
      if (ignored.includes(selectedId)) setSelectedId("");
      showNotice(`${ignored.length} email${ignored.length === 1 ? "" : "s"} ignored`);
      if (Array.isArray(result.failed) && result.failed.length) alert(`${result.failed.length} email${result.failed.length === 1 ? "" : "s"} could not be ignored. They remain selected.`);
      void onRefresh();
    } catch (reason) {
      alert(reason instanceof Error ? reason.message : "Unable to ignore selected emails");
    } finally { setBusy(""); }
  }

  return <>
    <div className={`inbox-shell ${selected ? "has-selection" : ""}`}>
      <section className="inbox-list">
        <div className="inbox-search"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search mail"/><button disabled={loading} onClick={onRefresh}>{loading ? "…" : "↻"}</button></div>
        {isMaster && <div className="email-bulk-toolbar">
          <button type="button" onClick={toggleAllVisible} disabled={!visibleIds.length || busy !== ""}>
            {allVisibleSelected ? <CheckSquare2 size={16}/> : someVisibleSelected ? <MinusSquare size={16}/> : <Square size={16}/>} Select all visible
          </button>
          <span>{selectedIds.length ? `${selectedIds.length} selected` : "Select emails to manage"}</span>
          {selectedIds.length > 0 && <><button type="button" onClick={() => setSelectedIds([])} disabled={busy !== ""}>Clear</button><button type="button" className="bulk-ignore" onClick={ignoreSelected} disabled={busy !== ""}>{busy === "bulk-ignore" ? "Ignoring…" : "Ignore selected"}</button></>}
        </div>}
        {error && <p className="workspace-error">{error}</p>}
        <div className="message-list">
          {loading && items.length === 0 ? <div className="workspace-empty"><strong>Loading email inbox…</strong><p>Reading processed emails from Google.</p></div>
            : filtered.length === 0 ? <div className="workspace-empty"><strong>Inbox is clear</strong><p>New operational emails will appear here.</p></div>
            : filtered.map((item: any) => {
              const id = String(item.emailId || item.id);
              const checked = selectedIds.includes(id);
              return <div key={id} className={`email-list-row ${selected === item ? "selected" : ""} ${checked ? "checked" : ""}`}>
                {isMaster && <button type="button" className="email-select-box" onClick={() => toggleSelected(id)} aria-label={`${checked ? "Deselect" : "Select"} email`}>{checked ? <Check size={14}/> : null}</button>}
                <button type="button" className="email-list-main" onClick={() => setSelectedId(id)}>
                  <span className="mail-dot"/><div><div><strong>{item.aiTitle || item.subject || "New email"}</strong><time>{time(item.time)}</time></div><small>{item.property || item.category || "General"} · {item.from || "Email"}</small><p>{item.summary || item.action || "Open to review this message"}</p></div>{item.attachmentNames && <b title="Attachment">⌕</b>}
                </button>
              </div>;
            })}
        </div>
      </section>
      <section className="email-preview">{!selected ? <div className="preview-empty"><span>✉</span><strong>Select an email</strong><p>Read the summary and decide the next action.</p></div> : <><header><button className="mobile-back" onClick={() => setSelectedId("")}>← Inbox</button><div><span className="eyebrow">AI OPERATIONAL TITLE</span><h2>{selected.aiTitle || selected.subject || "Email review"}</h2><p>{selected.property || "Property not detected"}</p></div><span className="review-badge">Needs review</span></header><div className="email-meta"><p><strong>From</strong><span>{selected.from || "-"}</span></p><p><strong>To</strong><span>{selected.to || "-"}</span></p><p><strong>Received</strong><span>{selected.time ? new Date(selected.time).toLocaleString() : "-"}</span></p></div><div className="ai-summary"><span>AI SUMMARY</span><p>{selected.summary || selected.action || "Review the original email below."}</p></div><div className="original-email"><h3>Original email</h3><pre>{body(selected.body)}</pre>{selected.attachmentNames && <div className="attachments"><strong>Attachments</strong><span>{selected.attachmentNames}</span></div>}</div><div className="sticky-actions"><button className="secondary-action" disabled={busy !== ""} onClick={ignore}>{busy === "ignore" ? "Ignoring…" : "Ignore"}</button>{selected.gmailLink && <a href={selected.gmailLink} target="_blank" rel="noreferrer">Open in Gmail</a>}<button className="primary-action" disabled={!canUseTasks || busy !== ""} onClick={create}>{busy === "create" ? "Creating…" : "Create Task"}</button></div></>}</section>
    </div>
    {notice && <div className="email-task-success" role="status"><span>✓</span><div><strong>{notice}</strong><small>The inbox has been updated.</small></div></div>}
  </>;
}
