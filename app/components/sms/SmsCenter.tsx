"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, RefreshCw, Search, Send, Users } from "lucide-react";
import ConfirmDialog from "../ui/ConfirmDialog";

type Recipient = {
  key: string; type: "Staff" | "Client" | "Lead" | "Custom"; id: string; name: string;
  phone: string; property?: string | null;
};
type History = {
  id: string; recipient_type: string; recipient_name: string | null; property_name: string | null;
  phone_masked: string; message: string; message_parts: number; delivery_status: string;
  error_message: string | null; attempt_count: number; sent_by: string; sent_at: string | null; created_at: string;
};
type SmsTemplate = { id: string; name: string; message: string; category: string };
type GroupRecipient = Recipient & { key: string };
type SmsGroup = { id: string; name: string; description?: string | null; recipients: GroupRecipient[] };

const templates = [
  { name: "Custom message", text: "" },
  { name: "Task reminder", text: "N K Hotels reminder: Please check and complete your pending operational task. Thank you." },
  { name: "Client follow-up", text: "Hello, this is a friendly reminder from N K Hotels regarding our pending follow-up. Please contact our team when convenient." },
  { name: "Payment reminder", text: "Hello, this is a friendly payment reminder from N K Hotels. Please contact our team if you need any clarification." },
];

function date(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function SmsCenter({ staff }: { staff: any }) {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [history, setHistory] = useState<History[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [group, setGroup] = useState("All");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [custom, setCustom] = useState("");
  const [status, setStatus] = useState("All");
  const [canBulk, setCanBulk] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<SmsTemplate[]>([]);
  const [savedGroups, setSavedGroups] = useState<SmsGroup[]>([]);
  const [canEditLibrary, setCanEditLibrary] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateCategory, setTemplateCategory] = useState("General");
  const [templateMessage, setTemplateMessage] = useState("");
  const [editingTemplate, setEditingTemplate] = useState("");
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupNumbers, setGroupNumbers] = useState("");
  const [editingGroup, setEditingGroup] = useState("");
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [libraryBusy, setLibraryBusy] = useState("");

  const load = useCallback(async () => {
    try {
      setBusy(current => current || "load");
      const response = await fetch("/api/sms", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to load SMS Center.");
      setRecipients(data.recipients || []);
      setHistory(data.history || []);
      setCanBulk(Boolean(data.canBulkSend));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load SMS Center.");
    } finally { setBusy(current => current === "load" ? "" : current); }
  }, []);

  const loadLibrary = useCallback(async () => {
    try {
      const response = await fetch("/api/sms/library", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to load saved SMS items.");
      setSavedTemplates(data.templates || []);
      setSavedGroups(data.groups || []);
      setCanEditLibrary(Boolean(data.canEdit));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load saved SMS items.");
    }
  }, []);

  useEffect(() => { void load(); void loadLibrary(); }, [load, loadLibrary]);

  const visible = useMemo(() => recipients.filter(item => {
    const matchesGroup = group === "All" || item.type === group;
    const haystack = `${item.name} ${item.property || ""} ${item.phone}`.toLowerCase();
    return matchesGroup && haystack.includes(query.toLowerCase());
  }), [recipients, group, query]);
  const visibleHistory = useMemo(() => history.filter(item => status === "All" || item.delivery_status === status), [history, status]);
  const chars = message.length, parts = Math.max(1, Math.ceil(chars / 160));

  function toggle(key: string) {
    setSelected(current => current.includes(key) ? current.filter(value => value !== key) : [...current, key]);
  }

  function selectVisible() {
    if (!canBulk) return;
    const keys = visible.map(item => item.key);
    setSelected(current => keys.every(key => current.includes(key))
      ? current.filter(key => !keys.includes(key))
      : Array.from(new Set([...current, ...keys])));
  }

  function currentGroupRecipients() {
    const chosen = selected
      .map(key => recipients.find(item => item.key === key))
      .filter(Boolean) as Recipient[];
    const customRecipients: GroupRecipient[] = groupNumbers
      .split(/[\s,;\n]+/)
      .map(value => value.trim())
      .filter(Boolean)
      .map(phone => ({ key: `Custom:${phone}`, type: "Custom" as const, id: "", name: "Custom recipient", phone }));
    return Array.from(
      new Map([...chosen, ...customRecipients].map(item => [item.key, item])).values(),
    );
  }

  async function saveTemplate() {
    if (!templateName.trim() || !templateMessage.trim()) return setError("Enter a template name and message.");
    try {
      setLibraryBusy("template"); setError("");
      const response = await fetch("/api/sms/library", {
        method: editingTemplate ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "template", id: editingTemplate, name: templateName, category: templateCategory, message: templateMessage }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to save template.");
      setNotice(editingTemplate ? "SMS template updated." : "SMS template saved.");
      setTemplateName(""); setTemplateCategory("General"); setTemplateMessage(""); setEditingTemplate(""); setShowTemplateForm(false);
      await loadLibrary();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save template."); }
    finally { setLibraryBusy(""); }
  }

  async function saveGroup() {
    const members = currentGroupRecipients();
    if (!groupName.trim() || !members.length) return setError("Enter a group name and select at least one recipient.");
    try {
      setLibraryBusy("group"); setError("");
      const response = await fetch("/api/sms/library", {
        method: editingGroup ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "group", id: editingGroup, name: groupName, description: groupDescription, recipients: members }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to save recipient group.");
      setNotice(editingGroup ? "Recipient group updated." : "Recipient group saved.");
      setGroupName(""); setGroupDescription(""); setGroupNumbers(""); setEditingGroup(""); setShowGroupForm(false);
      await loadLibrary();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save recipient group."); }
    finally { setLibraryBusy(""); }
  }

  async function removeLibraryItem(type: "template" | "group", id: string) {
    try {
      setLibraryBusy(id); setError("");
      const response = await fetch("/api/sms/library", {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, id }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to remove saved item.");
      await loadLibrary();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to remove saved item."); }
    finally { setLibraryBusy(""); }
  }

  function applyGroup(group: SmsGroup) {
    const availableKeys = new Set(recipients.map(item => item.key));
    setSelected(group.recipients.map(item => item.key).filter(key => availableKeys.has(key)));
    setCustom(group.recipients.filter(item => !availableKeys.has(item.key)).map(item => item.phone).join(", "));
    setNotice(`${group.name} loaded with ${group.recipients.length} recipient${group.recipients.length === 1 ? "" : "s"}.`);
  }

  function requestSend() {
    const customPhones = custom.split(/[\s,;\n]+/).map(value => value.trim()).filter(Boolean);
    const total = selected.length + customPhones.length;
    if (!total) return setError("Select a recipient or enter a custom phone number.");
    if (!message.trim()) return setError("Enter an SMS message.");
    if (total > 1 && !canBulk) return setError("Master or Supervisor access is required for bulk SMS.");
    setError("");
    setConfirmOpen(true);
  }

  async function sendSms() {
    const customPhones = custom.split(/[\s,;\n]+/).map(value => value.trim()).filter(Boolean);
    try {
      setConfirmOpen(false);
      setBusy("send"); setError(""); setNotice("");
      const response = await fetch("/api/sms", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientKeys: selected, customPhones, message }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "SMS delivery failed.");
      setNotice(`${data.sent} SMS message${data.sent === 1 ? "" : "s"} sent${data.failed?.length ? `; ${data.failed.length} failed` : ""}.`);
      setSelected([]); setCustom(""); setMessage("");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "SMS delivery failed.");
      await load();
    } finally { setBusy(""); }
  }

  const customCount = custom.split(/[\s,;\n]+/).map(value => value.trim()).filter(Boolean).length;
  const sendCount = selected.length + customCount;
  const selectedNames = selected
    .map(key => recipients.find(item => item.key === key)?.name)
    .filter(Boolean);
  const recipientSummary = selectedNames.length
    ? `${selectedNames.slice(0, 3).join(", ")}${selectedNames.length > 3 ? ` and ${selectedNames.length - 3} more` : ""}`
    : customCount
      ? `${customCount} custom phone number${customCount === 1 ? "" : "s"}`
      : "No recipient selected";

  async function retry(id: string) {
    try {
      setBusy(id); setError("");
      const response = await fetch("/api/sms", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Retry failed.");
      setNotice("SMS sent successfully.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Retry failed."); }
    finally { setBusy(""); }
  }

  return <section className="sms-center">
    <header className="sms-titlebar">
      <div><small>OUTBOUND COMMUNICATION</small><h2>SMS Center</h2><p>Send individual or bulk Dialog SMS messages and review delivery history.</p></div>
      <button onClick={() => void load()} disabled={Boolean(busy)}><RefreshCw size={15}/> Refresh</button>
    </header>
    {error && <div className="workspace-error">{error}</div>}
    {notice && <div className="sms-notice"><Check size={16}/>{notice}</div>}

    <div className="sms-compose-grid">
      <section className="sms-recipients">
        <header><div><Users size={18}/><strong>Recipients</strong></div><span>{selected.length} selected</span></header>
        <div className="sms-recipient-tools">
          <label><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search staff, clients or leads"/></label>
          <div>{["All","Staff","Client","Lead"].map(item => <button key={item} className={group === item ? "active" : ""} onClick={() => setGroup(item)}>{item}</button>)}</div>
          {canBulk && <button className="sms-select-visible" onClick={selectVisible}>Select visible</button>}
        </div>
        <div className="sms-recipient-list">{visible.map(item => <button key={item.key} className={selected.includes(item.key) ? "selected" : ""} onClick={() => toggle(item.key)}>
          <span>{selected.includes(item.key) ? <Check size={14}/> : item.name.slice(0, 1).toUpperCase()}</span>
          <div><strong>{item.name}</strong><small>{item.type}{item.property ? ` · ${item.property}` : ""}</small></div>
          <em>{item.phone}</em>
        </button>)}{!visible.length && <p>No matching recipients with phone numbers.</p>}</div>
      </section>

      <section className="sms-composer">
        <header><small>NEW MESSAGE</small><h3>Compose SMS</h3></header>
        <label>Template<select defaultValue="" onChange={event => {
          const value = event.target.value;
          if (value.startsWith("built:")) setMessage(templates[Number(value.slice(6))].text);
          else {
            const item = savedTemplates.find(template => template.id === value);
            if (item) setMessage(item.message);
          }
        }}>
          <option value="">Choose a template</option>
          <optgroup label="Built-in">{templates.map((item, index) => <option value={`built:${index}`} key={item.name}>{item.name}</option>)}</optgroup>
          {savedTemplates.length > 0 && <optgroup label="Saved templates">{savedTemplates.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</optgroup>}
        </select></label>
        <label>Custom phone numbers <span>Separate multiple numbers using commas</span><textarea className="sms-custom-numbers" value={custom} onChange={event => setCustom(event.target.value)} placeholder="9477XXXXXXX"/></label>
        <label>Message<textarea value={message} maxLength={450} onChange={event => setMessage(event.target.value)} placeholder="Write your reminder or operational message…"/></label>
        <div className="sms-counter"><span>{chars}/450 characters</span><strong>{parts} SMS part{parts === 1 ? "" : "s"}</strong></div>
        <button className="sms-send" onClick={requestSend} disabled={busy === "send" || (!selected.length && !custom.trim()) || !message.trim()}><Send size={16}/>{busy === "send" ? "Sending…" : `Send SMS${sendCount ? ` (${sendCount})` : ""}`}</button>
        <p className="sms-sender-note">Sending as {staff?.name || "NKH Team"} via the configured Dialog mask.</p>
      </section>
    </div>

    <section className="sms-library">
      <header>
        <div><small>QUICK SEND LIBRARY</small><h3>Templates & recipient groups</h3></div>
        <p>Reuse approved messages and frequently contacted number lists.</p>
      </header>
      <div className="sms-library-grid">
        <section>
          <div className="sms-library-heading"><div><strong>Saved templates</strong><span>{savedTemplates.length}</span></div>{canEditLibrary && <button className="sms-library-add" onClick={() => {
            setEditingTemplate(""); setTemplateName(""); setTemplateCategory("General"); setTemplateMessage(message); setShowTemplateForm(true);
          }}>+ Add Template</button>}</div>
          <div className="sms-library-items">
            {savedTemplates.map(item => <article key={item.id}>
              <button className="sms-library-main" onClick={() => setMessage(item.message)}>
                <strong>{item.name}</strong><small>{item.category}</small><p>{item.message}</p>
              </button>
              {canEditLibrary && <div>
                <button onClick={() => { setEditingTemplate(item.id); setTemplateName(item.name); setTemplateCategory(item.category); setTemplateMessage(item.message); setShowTemplateForm(true); }}>Edit</button>
                <button className="danger" disabled={libraryBusy === item.id} onClick={() => void removeLibraryItem("template", item.id)}>Delete</button>
              </div>}
            </article>)}
            {!savedTemplates.length && <p className="sms-library-empty">No saved templates yet.</p>}
          </div>
          {canEditLibrary && showTemplateForm && <div className="sms-library-form sms-library-template-form">
            <input value={templateName} onChange={event => setTemplateName(event.target.value)} placeholder="Template name"/>
            <input value={templateCategory} onChange={event => setTemplateCategory(event.target.value)} placeholder="Category"/>
            <textarea value={templateMessage} maxLength={450} onChange={event => setTemplateMessage(event.target.value)} placeholder="Write the saved SMS message here"/>
            <div className="sms-library-form-actions">
              <button className="sms-library-cancel" onClick={() => { setShowTemplateForm(false); setEditingTemplate(""); setTemplateName(""); setTemplateCategory("General"); setTemplateMessage(""); }}>Cancel</button>
              <button onClick={() => void saveTemplate()} disabled={libraryBusy === "template" || !templateName.trim() || !templateMessage.trim()}>{editingTemplate ? "Update Template" : "Save Template"}</button>
            </div>
          </div>}
        </section>

        <section>
          <div className="sms-library-heading"><div><strong>Recipient groups</strong><span>{savedGroups.length}</span></div>{canEditLibrary && <button className="sms-library-add" onClick={() => {
            setEditingGroup(""); setGroupName(""); setGroupDescription(""); setGroupNumbers(""); setShowGroupForm(true);
          }}>+ Add Group</button>}</div>
          <div className="sms-library-items">
            {savedGroups.map(item => <article key={item.id}>
              <button className="sms-library-main" onClick={() => applyGroup(item)}>
                <strong>{item.name}</strong><small>{item.recipients.length} recipient{item.recipients.length === 1 ? "" : "s"}</small><p>{item.description || item.recipients.slice(0, 3).map(member => member.name).join(", ")}</p>
              </button>
              {canEditLibrary && <div>
                <button onClick={() => {
                  applyGroup(item);
                  const availableKeys = new Set(recipients.map(recipient => recipient.key));
                  setEditingGroup(item.id);
                  setGroupName(item.name);
                  setGroupDescription(item.description || "");
                  setGroupNumbers(item.recipients.filter(recipient => !availableKeys.has(recipient.key)).map(recipient => recipient.phone).join("\n"));
                  setShowGroupForm(true);
                }}>Edit</button>
                <button className="danger" disabled={libraryBusy === item.id} onClick={() => void removeLibraryItem("group", item.id)}>Delete</button>
              </div>}
            </article>)}
            {!savedGroups.length && <p className="sms-library-empty">No saved recipient groups yet.</p>}
          </div>
          {canEditLibrary && showGroupForm && <div className="sms-library-form">
            <p className="sms-group-help">Paste numbers below, or select staff, clients and leads from the Recipients panel above. Both can be saved together.</p>
            <input value={groupName} onChange={event => setGroupName(event.target.value)} placeholder="Group name"/>
            <input value={groupDescription} onChange={event => setGroupDescription(event.target.value)} placeholder="Short description (optional)"/>
            <label className="sms-group-numbers">
              <span>Phone numbers <em>{currentGroupRecipients().length} recipient{currentGroupRecipients().length === 1 ? "" : "s"} detected</em></span>
              <textarea value={groupNumbers} onChange={event => setGroupNumbers(event.target.value)} placeholder={"94771234567\n94772345678\n94773456789"}/>
              <small>Use commas, spaces, semicolons, or one number per line.</small>
            </label>
            <div className="sms-library-form-actions">
              <button className="sms-library-cancel" onClick={() => { setShowGroupForm(false); setEditingGroup(""); setGroupName(""); setGroupDescription(""); setGroupNumbers(""); }}>Cancel</button>
              <button onClick={() => void saveGroup()} disabled={libraryBusy === "group" || !groupName.trim() || !currentGroupRecipients().length}>{editingGroup ? "Update Group" : `Save Group (${currentGroupRecipients().length})`}</button>
            </div>
          </div>}
        </section>
      </div>
    </section>

    <section className="sms-history">
      <header><div><small>DELIVERY RECORDS</small><h3>SMS History</h3></div><div>{["All","Sent","Failed","Pending"].map(item => <button key={item} className={status === item ? "active" : ""} onClick={() => setStatus(item)}>{item}</button>)}</div></header>
      <div className="sms-history-list">{visibleHistory.map(item => <article key={item.id}>
        <span className={`sms-state ${item.delivery_status.toLowerCase()}`}>{item.delivery_status}</span>
        <div><strong>{item.recipient_name || item.phone_masked}</strong><small>{item.recipient_type}{item.property_name ? ` · ${item.property_name}` : ""} · {item.phone_masked}</small><p>{item.message}</p></div>
        <aside><time>{date(item.sent_at || item.created_at)}</time><small>{item.message_parts} part{item.message_parts === 1 ? "" : "s"} · by {item.sent_by}</small>{item.delivery_status === "Failed" && <button onClick={() => retry(item.id)} disabled={busy === item.id}>{busy === item.id ? "Retrying…" : "Retry"}</button>}</aside>
      </article>)}{!visibleHistory.length && <p className="sms-empty">No SMS records in this view.</p>}</div>
    </section>

    <ConfirmDialog
      open={confirmOpen}
      title={`Send SMS to ${sendCount} recipient${sendCount === 1 ? "" : "s"}?`}
      message="Please review the recipient and message before sending. SMS delivery cannot be recalled."
      confirmLabel="Send SMS"
      tone="amber"
      loading={busy === "send"}
      details={[
        `Recipient: ${recipientSummary}`,
        `Message: ${message.trim().slice(0, 110)}${message.trim().length > 110 ? "…" : ""}`,
        `${chars} characters · ${parts} SMS part${parts === 1 ? "" : "s"}`,
      ]}
      onConfirm={sendSms}
      onCancel={() => setConfirmOpen(false)}
    />
  </section>;
}
