import { supabaseAdmin } from "./supabaseAdmin";

type GmailHeader = { name?: string; value?: string };
type GmailPart = { mimeType?: string; filename?: string; body?: { data?: string }; parts?: GmailPart[] };
type GmailMessage = {
  id: string;
  threadId?: string;
  internalDate?: string;
  payload?: GmailPart & { headers?: GmailHeader[] };
};

const senderHints = [
  "agoda.com", "booking.com", "guest.booking.com", "airbnb.com",
  "expedia.com", "vrbo.com", "trip.com", "makemytrip.com", "goibibo.com",
];
const subjectHints = [
  "new booking", "last-minute booking", "modified booking", "cancelled booking",
  "canceled booking", "cancellation", "new message", "received this message",
  "reservation confirmed", "booking confirmed", "confirmation code", "reservation id",
  "payment", "review", "inquiry", "availability",
];

function decode(value?: string) {
  if (!value) return "";
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function header(message: GmailMessage, name: string) {
  return message.payload?.headers?.find(item => item.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

function collect(part?: GmailPart, result: { plain: string[]; html: string[]; attachments: string[] } = { plain: [], html: [], attachments: [] }) {
  if (!part) return result;
  if (part.filename) result.attachments.push(part.filename);
  if (part.mimeType === "text/plain" && part.body?.data) result.plain.push(decode(part.body.data));
  if (part.mimeType === "text/html" && part.body?.data) result.html.push(decode(part.body.data));
  part.parts?.forEach(child => collect(child, result));
  return result;
}

function stripHtml(value: string) {
  return value.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function eventFrom(subject: string) {
  const value = subject.toLowerCase();
  if (value.includes("cancel")) return "Cancelled Booking";
  if (value.includes("modif")) return "Modified Booking";
  if (value.includes("message")) return "Guest Message";
  if (value.includes("payment")) return "Payment";
  if (value.includes("review")) return "Review";
  if (value.includes("inquiry") || value.includes("availability")) return "Inquiry";
  if (value.includes("booking") || value.includes("reservation") || value.includes("confirmation")) return "New Booking";
  return "Other";
}

function priorityFrom(event: string) {
  return ["Cancelled Booking", "Guest Message"].includes(event) ? "High" : "Normal";
}

function sourceFrom(from: string) {
  const value = from.toLowerCase();
  if (value.includes("booking.com")) return "Booking.com";
  if (value.includes("agoda")) return "Agoda";
  if (value.includes("airbnb")) return "Airbnb";
  if (value.includes("expedia")) return "Expedia";
  if (value.includes("vrbo")) return "Vrbo";
  if (value.includes("trip.com")) return "Trip.com";
  if (value.includes("makemytrip") || value.includes("goibibo")) return "MakeMyTrip/Goibibo";
  return "Email";
}

function relevant(from: string, subject: string) {
  const sender = from.toLowerCase(), title = subject.toLowerCase();
  return senderHints.some(value => sender.includes(value)) && subjectHints.some(value => title.includes(value));
}

export async function gmailAccessToken() {
  const clientId = process.env.GOOGLE_GMAIL_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_GMAIL_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) throw new Error("Gmail OAuth environment variables are incomplete.");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || "Unable to refresh Gmail access token.");
  return String(data.access_token);
}

async function gmail<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Gmail API failed (${response.status}).`);
  return data as T;
}

export async function importGmailMessage(messageId: string, token: string) {
  const existing = await supabaseAdmin<Array<{ id: string }>>(`nkh_email_inbox?select=id&gmail_message_id=eq.${encodeURIComponent(messageId)}&limit=1`);
  if (existing.length) return false;
  const message = await gmail<GmailMessage>(`messages/${encodeURIComponent(messageId)}?format=full`, token);
  const from = header(message, "From"), subject = header(message, "Subject"), to = header(message, "To");
  if (!relevant(from, subject)) return false;
  const content = collect(message.payload), body = content.plain.join("\n\n").trim() || stripHtml(content.html.join("\n"));
  const properties = await supabaseAdmin<Array<{ id: string; property_name: string }>>("nkh_properties?select=id,property_name&client_status=eq.Active");
  const haystack = `${subject}\n${body}`.toLowerCase();
  const property = properties.find(item => haystack.includes(item.property_name.toLowerCase()));
  const event = eventFrom(subject), source = sourceFrom(from), receivedAt = message.internalDate ? new Date(Number(message.internalDate)).toISOString() : new Date().toISOString();
  await supabaseAdmin("nkh_email_inbox", { method: "POST", prefer: "return=minimal", body: {
    gmail_message_id: message.id,
    gmail_thread_id: message.threadId || null,
    gmail_url: `https://mail.google.com/mail/u/0/#inbox/${message.threadId || message.id}`,
    sender: from || null,
    recipients: to || null,
    subject: subject || "Operational email",
    body_text: body.slice(0, 100000) || null,
    attachment_names: content.attachments.join(", ") || null,
    received_at: receivedAt,
    property_id: property?.id || null,
    property_name_snapshot: property?.property_name || null,
    event_type: event,
    category: source,
    task_type: event === "Guest Message" ? "Guest message" : event,
    priority: priorityFrom(event),
    ai_title: `${event}${property ? ` · ${property.property_name}` : ""}`,
    summary: body.replace(/\s+/g, " ").slice(0, 500) || subject,
    recommended_action: "Review this email and create a task if action is required.",
    status: "Needs Review",
    source_metadata: { source, imported_via: "Gmail API" },
  }});
  return true;
}

export async function syncGmailHistory(historyId: string) {
  const token = await gmailAccessToken();
  const states = await supabaseAdmin<Array<{ last_history_id: string | null }>>("nkh_gmail_sync_state?select=last_history_id&id=eq.primary&limit=1");
  const start = states[0]?.last_history_id;
  let imported = 0;
  if (start) {
    let pageToken = "";
    do {
      const query = new URLSearchParams({ startHistoryId: start, historyTypes: "messageAdded" });
      if (pageToken) query.set("pageToken", pageToken);
      const data = await gmail<{ history?: Array<{ messagesAdded?: Array<{ message?: { id?: string } }> }>; nextPageToken?: string }>(`history?${query}`, token);
      const ids = Array.from(new Set((data.history || []).flatMap(row => row.messagesAdded || []).map(row => row.message?.id).filter(Boolean))) as string[];
      for (const id of ids) if (await importGmailMessage(id, token)) imported += 1;
      pageToken = data.nextPageToken || "";
    } while (pageToken);
  }
  await supabaseAdmin("nkh_gmail_sync_state?id=eq.primary", { method: "PATCH", prefer: "return=minimal", body: { last_history_id: historyId, last_notification_at: new Date().toISOString(), last_error: null } });
  return imported;
}

export async function setupGmailWatch() {
  const topicName = process.env.GOOGLE_GMAIL_TOPIC_NAME;
  if (!topicName) throw new Error("GOOGLE_GMAIL_TOPIC_NAME is missing.");
  const token = await gmailAccessToken();
  const watch = await gmail<{ historyId: string; expiration: string }>("watch", token, {
    method: "POST",
    body: JSON.stringify({ topicName, labelIds: ["INBOX"], labelFilterBehavior: "INCLUDE" }),
  });
  await supabaseAdmin("nkh_gmail_sync_state", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: {
    id: "primary", email_address: process.env.GOOGLE_GMAIL_ACCOUNT || null,
    last_history_id: watch.historyId, watch_expiration_at: new Date(Number(watch.expiration)).toISOString(),
    last_watch_at: new Date().toISOString(), last_error: null,
  }});
  return watch;
}

export async function initialGmailImport() {
  const token = await gmailAccessToken();
  const result = await gmail<{ messages?: Array<{ id: string }> }>(`messages?${new URLSearchParams({ q: "in:inbox newer_than:3d", maxResults: "100" })}`, token);
  let imported = 0;
  for (const message of result.messages || []) if (await importGmailMessage(message.id, token)) imported += 1;
  return imported;
}