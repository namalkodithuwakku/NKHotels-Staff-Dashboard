import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { emailAddress } from "../../../../lib/emailLearning";

type IncomingEmail = {
  messageId?: string;
  threadId?: string;
  from?: string;
  to?: string;
  subject?: string;
  body?: string;
  receivedAt?: string;
  gmailUrl?: string;
  attachmentNames?: string[];
};

type Property = { id: string; client_code: string; property_name: string };
type Contact = { property_id: string; email: string | null };
type ExistingInbox = { id: string; status: string | null; task_id: string | null };
type ExistingTask = { id: string; status: string | null };
type Staff = { id: string; display_name: string | null };

type SupervisorCommand = {
  sourceEmailId?: string;
  property?: string;
  assignedTo?: string;
  taskType?: string;
  title?: string;
  priority?: string;
  bookingId?: string;
  summary?: string;
  action?: string;
  reason?: string;
  sourceTime?: string;
};

const secret = process.env.EMAIL_TASK_INTEGRATION_SECRET;
const AI_COMMAND_SENDER = "info@nkhotels.lk";
const AI_COMMAND_RECIPIENT = "nkhotelsup@gmail.com";
const AI_COMMAND_SUBJECT = "[NKH-AI-TASK]";
const AI_COMMAND_MARKER = "NKH_AI_TASK_V1";
const AI_SUPERVISOR = "AI Supervisor";

function safeMatch(received: string | null) {
  if (!secret || !received) return false;
  const expected = Buffer.from(secret);
  const actual = Buffer.from(received);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function authorized(request: NextRequest) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null;
  return safeMatch(request.headers.get("x-nkh-email-secret")) || safeMatch(bearer);
}

function clean(value: unknown, maximum: number) {
  return String(value || "").replace(/\u0000/g, "").trim().slice(0, maximum);
}

function normalize(value: string) {
  return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function cleanPriority(value: unknown) {
  const requested = String(value || "Normal").trim();
  return ["Normal", "High", "Urgent", "Critical"].includes(requested) ? requested : "Normal";
}

async function first<T>(path: string) {
  const rows = await supabaseAdmin<T[]>(path);
  return rows[0] || null;
}

function classify(subject: string, body: string) {
  const text = `${subject}\n${body.slice(0, 2500)}`.toLowerCase();
  if (/\b(cancelled|canceled|cancellation|booking cancelled|booking canceled)\b/.test(text)) return { event: "Booking Cancellation", taskType: "Booking Info", priority: "High", action: "Review cancellation and decide whether an operational task is required." };
  if (/\b(modified booking|booking modified|reservation modified|amend(?:ed|ment)?|change to (?:the )?(?:booking|reservation))\b/.test(text)) return { event: "Booking Modification", taskType: "Booking Info", priority: "High", action: "Review booking changes and decide whether an operational task is required." };
  if (/\b(last-minute booking|last minute booking)\b/.test(text)) return { event: "Last-minute Booking", taskType: "FIT Booking", priority: "Urgent", action: "Check the booking immediately and decide what staff action is required." };
  if (/\b(new booking|new reservation|reservation confirmed|new booking confirmed|confirmation code|reservation id)\b/.test(text)) return { event: "New Booking", taskType: "FIT Booking", priority: "High", action: "Verify the booking and decide whether a staff task is required." };
  if (/\b(new message|received this message|guest message|message from (?:your )?guest)\b/.test(text)) return { event: "Guest Message", taskType: "Guest Message", priority: "High", action: "Review the guest message and decide whether staff action is required." };
  if (/\b(payment failed|payment issue|card declined|invalid card|virtual card|payment required)\b/.test(text)) return { event: "Payment Issue", taskType: "OTA Issue", priority: "High", action: "Review the payment issue and decide whether escalation is required." };
  if (/\b(availability inquiry|availability enquiry|booking inquiry|booking enquiry|availability request)\b/.test(text)) return { event: "Availability Enquiry", taskType: "FIT Booking", priority: "Normal", action: "Review the enquiry and decide whether staff follow-up is required." };
  return { event: "Email Review", taskType: "Other", priority: "Normal", action: "Review this email. Create a staff task only if there is a clear operational action." };
}

function bookingId(subject: string, body: string) {
  const text = `${subject}\n${body.slice(0, 4000)}`;
  const patterns = [
    /(?:booking|reservation|confirmation)\s*(?:id|number|no\.?|code|#)\s*[:#-]?\s*([A-Z0-9-]{5,24})/i,
    /\b(?:ID|PIN)\s*[:#-]\s*([A-Z0-9-]{5,24})\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].toUpperCase();
  }
  return null;
}

function findProperty(message: IncomingEmail, properties: Property[], contacts: Contact[]) {
  const recipient = emailAddress(clean(message.to, 500));
  const contact = contacts.find(item => item.email && emailAddress(item.email) === recipient);
  if (contact) return properties.find(item => item.id === contact.property_id) || null;
  const haystack = normalize(`${clean(message.subject, 500)} ${clean(message.body, 8000)} ${clean(message.to, 500)}`);
  const matches = properties.map(property => ({ property, score: haystack.includes(normalize(property.property_name)) ? normalize(property.property_name).length : haystack.includes(normalize(property.client_code)) ? 5 : 0 })).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
  return matches[0]?.property || null;
}

function shortSummary(subject: string, body: string) {
  const compact = body.replace(/https?:\/\/\S+/gi, " ").replace(/\s+/g, " ").trim();
  return clean(compact || subject, 500);
}

function isSupervisorCommand(message: IncomingEmail) {
  const sender = emailAddress(clean(message.from, 500));
  const recipients = clean(message.to, 1000).toLowerCase();
  const subject = clean(message.subject, 500);
  const body = clean(message.body, 12000);
  return sender === AI_COMMAND_SENDER && recipients.includes(AI_COMMAND_RECIPIENT) && subject.startsWith(AI_COMMAND_SUBJECT) && body.startsWith(AI_COMMAND_MARKER);
}

function parseSupervisorCommand(body: string): SupervisorCommand {
  const raw = body.slice(AI_COMMAND_MARKER.length).trim();
  const parsed = JSON.parse(raw) as SupervisorCommand;
  return parsed && typeof parsed === "object" ? parsed : {};
}

async function createSupervisorTask(message: IncomingEmail) {
  const command = parseSupervisorCommand(clean(message.body, 12000));
  const sourceEmailId = clean(command.sourceEmailId, 180);
  const title = clean(command.title || command.taskType || "Operational task", 220);
  if (!sourceEmailId || !title) throw new Error("AI Supervisor command requires sourceEmailId and title.");

  const existing = await first<ExistingTask>(`nkh_tasks?select=id,status&source_email_id=eq.${encodeURIComponent(sourceEmailId)}&limit=1`);
  if (existing) return { messageId: clean(message.messageId, 180), status: "duplicate_task", taskId: existing.id };

  const propertyName = clean(command.property, 220);
  const assignedName = clean(command.assignedTo, 180);
  const [property, staff, inbox] = await Promise.all([
    propertyName ? first<Property>(`nkh_properties?select=id,client_code,property_name&property_name=eq.${encodeURIComponent(propertyName)}&limit=1`) : null,
    assignedName ? first<Staff>(`nkh_staff?select=id,display_name&or=(display_name.eq.${encodeURIComponent(assignedName)},google_staff_name.eq.${encodeURIComponent(assignedName)})&limit=1`) : null,
    first<ExistingInbox>(`nkh_email_inbox?select=id,status,task_id&gmail_message_id=eq.${encodeURIComponent(sourceEmailId)}&limit=1`),
  ]);

  const notes = [clean(command.summary, 1200), clean(command.action, 800)].filter(Boolean).join("\n\n");
  const rows = await supabaseAdmin<Array<{ id: string }>>("nkh_tasks", {
    method: "POST",
    prefer: "return=representation",
    body: {
      status: "Pending",
      priority: cleanPriority(command.priority),
      intent: "AI Supervisor",
      task_type: clean(command.taskType || "Other", 120) || "Other",
      source: AI_SUPERVISOR,
      property_id: property?.id || null,
      property_name_snapshot: propertyName || null,
      booking_id: clean(command.bookingId, 120) || null,
      subject: title,
      notes: notes || null,
      assigned_staff_id: staff?.id || null,
      assigned_name_snapshot: assignedName || null,
      source_email_id: sourceEmailId,
      source_gmail_url: null,
      source_metadata: {
        supervisor: AI_SUPERVISOR,
        relay: "gmail-command-v1",
        command_message_id: clean(message.messageId, 180) || null,
        reason: clean(command.reason, 800) || null,
        source_received_at: clean(command.sourceTime, 80) || null,
      },
      created_by_staff_id: null,
      created_by_name_snapshot: AI_SUPERVISOR,
    },
  });
  const task = rows[0];

  await supabaseAdmin("nkh_task_events", {
    method: "POST",
    prefer: "return=minimal",
    body: {
      task_id: task.id,
      event_type: "Created by AI Supervisor",
      to_status: "Pending",
      actor_staff_id: null,
      actor_name_snapshot: AI_SUPERVISOR,
      event_data: { source_email_id: sourceEmailId, relay: "gmail-command-v1", assigned_to: assignedName || null, property: propertyName || null },
    },
  });

  if (inbox?.id) {
    const handledAt = new Date().toISOString();
    await Promise.all([
      supabaseAdmin(`nkh_email_inbox?id=eq.${encodeURIComponent(inbox.id)}`, { method: "PATCH", prefer: "return=minimal", body: { status: "Handled by AI Supervisor", task_id: task.id, handled_by_staff_id: null, handled_by_name_snapshot: AI_SUPERVISOR, handled_at: handledAt } }),
      supabaseAdmin("nkh_email_audit", { method: "POST", prefer: "return=minimal", body: { email_inbox_id: inbox.id, gmail_message_id: sourceEmailId, action: "Operational Task Created by AI Supervisor", actor_staff_id: null, actor_name_snapshot: AI_SUPERVISOR, task_id: task.id, details: { relay: "gmail-command-v1", task_type: clean(command.taskType || "Other", 120), property: propertyName || null, assigned_to: assignedName || null } } }),
    ]);
  }

  return { messageId: clean(message.messageId, 180), status: "task_created_by_ai_supervisor", taskId: task.id, sourceEmailId };
}

async function queueForSupervisor(message: IncomingEmail, properties: Property[], contacts: Contact[]) {
  const messageId = clean(message.messageId, 180);
  const from = clean(message.from, 500);
  const subject = clean(message.subject, 500);
  const body = clean(message.body, 8000);
  if (!messageId || !from || !subject) return { messageId, status: "error", error: "Message ID, sender and subject are required." };

  const existing = await first<ExistingInbox>(`nkh_email_inbox?gmail_message_id=eq.${encodeURIComponent(messageId)}&select=id,status,task_id&limit=1`);
  if (existing) return { messageId, status: "duplicate", inboxId: existing.id, queueStatus: existing.status };

  const classification = classify(subject, body);
  const property = findProperty(message, properties, contacts);
  const reservationId = bookingId(subject, body);
  const summary = shortSummary(subject, body);
  const receivedAt = clean(message.receivedAt, 80) || new Date().toISOString();

  const rows = await supabaseAdmin<Array<{ id: string }>>("nkh_email_inbox", {
    method: "POST",
    prefer: "return=representation",
    body: {
      gmail_message_id: messageId,
      gmail_url: clean(message.gmailUrl, 1000) || null,
      sender: from,
      recipients: clean(message.to, 500) || null,
      subject,
      body_text: body || null,
      attachment_names: Array.isArray(message.attachmentNames) ? message.attachmentNames.slice(0, 20).join(", ") : null,
      received_at: receivedAt,
      property_name_snapshot: property?.property_name || null,
      booking_id: reservationId,
      event_type: classification.event,
      category: classification.event,
      task_type: classification.taskType,
      priority: classification.priority,
      ai_title: property?.property_name ? `${property.property_name} · ${classification.event}` : classification.event,
      summary,
      recommended_action: classification.action,
      status: "Needs Review",
      task_id: null,
      handled_by_staff_id: null,
      handled_by_name_snapshot: null,
      handled_at: null,
    },
  });

  await supabaseAdmin("nkh_email_ingestion_logs", { method: "POST", prefer: "return=minimal", body: { source_email_id: messageId, outcome: "queued_for_ai_supervisor", sender: from, subject } }).catch(() => undefined);
  return { messageId, status: "queued_for_ai_supervisor", inboxId: rows[0]?.id || null, property: property?.property_name || null, event: classification.event };
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  try {
    const input = await request.json();
    const messages: IncomingEmail[] = Array.isArray(input.messages) ? input.messages.slice(0, 20) : [input];
    if (!messages.length) return NextResponse.json({ success: false, error: "No email messages supplied." }, { status: 400 });

    const [properties, contacts] = await Promise.all([
      supabaseAdmin<Property[]>("nkh_properties?select=id,client_code,property_name&client_status=eq.Active"),
      supabaseAdmin<Contact[]>("nkh_property_contacts?select=property_id,email&email=not.is.null"),
    ]);

    const results = [];
    for (const message of messages) {
      try {
        results.push(isSupervisorCommand(message) ? await createSupervisorTask(message) : await queueForSupervisor(message, properties, contacts));
      } catch (error) {
        results.push({ messageId: clean(message.messageId, 180), status: "error", error: error instanceof Error ? error.message : "Email processing failed." });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      queued: results.filter(item => item.status === "queued_for_ai_supervisor").length,
      tasksCreated: results.filter(item => item.status === "task_created_by_ai_supervisor").length,
      results,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Email supervisor ingestion failed." }, { status: 500 });
  }
}
