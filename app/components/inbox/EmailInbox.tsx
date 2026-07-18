"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
import { ignoreAIEmail, startEmailTask } from "../../lib/api";

function time(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function body(value: string) { return String(value || "Email body is unavailable.").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim(); }

export default function EmailInbox({ items, staff, shift, canUseTasks, error, onRefresh }: any) {
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const filtered = useMemo(() => items.filter((item: any) => [item.aiTitle, item.subject, item.summary, item.property, item.from].join(" ").toLowerCase().includes(search.toLowerCase())), [items, search]);
  const selected = filtered.find((item: any) => String(item.emailId || item.id) === selectedId) || filtered[0];
  async function start() { if (!selected) return; const id = String(selected.emailId || selected.id); try { setBusy("start"); await startEmailTask({ emailId: id, staffName: staff.name, staffPhone: staff.phone || staff.whatsapp || "", shift: shift?.shift || "" }); await onRefresh(); } finally { setBusy(""); } }
  async function ignore() { if (!selected) return; const id = String(selected.emailId || selected.id); try { setBusy("ignore"); await ignoreAIEmail({ emailId: id, staffName: staff.name, reason: "Reviewed in Email Inbox" }); await onRefresh(); } finally { setBusy(""); } }
  return <div className={`inbox-shell ${selected ? "has-selection" : ""}`}>
    <section className="inbox-list"><div className="inbox-search"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search mail"/><button onClick={onRefresh}>↻</button></div>{error && <p className="workspace-error">{error}</p>}<div className="message-list">{filtered.length === 0 ? <div className="workspace-empty"><strong>Inbox is clear</strong><p>New operational emails will appear here.</p></div> : filtered.map((item: any) => { const id = String(item.emailId || item.id); return <button key={id} className={selected === item ? "selected" : ""} onClick={() => setSelectedId(id)}><span className="mail-dot"/><div><div><strong>{item.aiTitle || item.subject || "New email"}</strong><time>{time(item.time)}</time></div><small>{item.property || item.category || "General"} · {item.from || "Email"}</small><p>{item.summary || item.action || "Open to review this message"}</p></div>{item.attachmentNames && <b title="Attachment">⌕</b>}</button>})}</div></section>
    <section className="email-preview">{!selected ? <div className="preview-empty"><span>✉</span><strong>Select an email</strong><p>Read the summary and decide the next action.</p></div> : <><header><button className="mobile-back" onClick={() => setSelectedId("")}>← Inbox</button><div><span className="eyebrow">AI OPERATIONAL TITLE</span><h2>{selected.aiTitle || selected.subject || "Email review"}</h2><p>{selected.property || "Property not detected"}</p></div><span className="review-badge">Needs review</span></header><div className="email-meta"><p><strong>From</strong><span>{selected.from || "-"}</span></p><p><strong>To</strong><span>{selected.to || "-"}</span></p><p><strong>Received</strong><span>{selected.time ? new Date(selected.time).toLocaleString() : "-"}</span></p></div><div className="ai-summary"><span>AI SUMMARY</span><p>{selected.summary || selected.action || "Review the original email below."}</p></div><div className="original-email"><h3>Original email</h3><pre>{body(selected.body)}</pre>{selected.attachmentNames && <div className="attachments"><strong>Attachments</strong><span>{selected.attachmentNames}</span></div>}</div><div className="sticky-actions"><button className="secondary-action" disabled={busy !== ""} onClick={ignore}>{busy === "ignore" ? "Ignoring…" : "Ignore"}</button>{selected.gmailLink && <a href={selected.gmailLink} target="_blank" rel="noreferrer">Open in Gmail</a>}<button className="primary-action" disabled={!canUseTasks || busy !== ""} onClick={start}>{busy === "start" ? "Creating…" : "Create & Start Task"}</button></div></>}</section>
  </div>;
}
