import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { emailAddress, emailSubjectPattern, protectedOperationalEmail } from "../../../../lib/emailLearning";

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
type Roster = {
  start_time: string | null;
  end_time: string | null;
  staff: { id: string; display_name: string } | null;
};
type ExistingTask = { id: string; status: string; assigned_name_snapshot: string | null };

const secret = process.env.EMAIL_TASK_INTEGRATION_SECRET;

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

function classify(subject: string, body: string) {
  const text = `${subject}\n${body.slice(0, 2500)}`.toLowerCase();
  if (/\b(cancelled|canceled|cancellation|booking cancelled|booking canceled)\b/.test(text)) {
    return { actionable: true, event: "Booking Cancellation", taskType: "Booking Info", priority: "High" };
  }
  if (/\b(modified booking|booking modified|reservation modified|amend(?:ed|ment)?|change to (?:the )?(?:booking|reservation))\b/.test(text)) {
    return { actionable: true, event: "Booking Modification", taskType: "Booking Info", priority: "High" };
  }
  if (/\b(last-minute booking|last minute booking)\b/.test(text)) {
    return { actionable: true, event: "Last-minute Booking", taskType: "FIT Booking", priority: "Urgent" };
  }
  if (/\b(new booking|new reservation|reservation confirmed|new booking confirmed|confirmation code|reservation id)\b/.test(text)) {
    return { actionable: true, event: "New Booking", taskType: "FIT Booking", priority: "High" };
  }
  if (/\b(new message|received this message|guest message|message from (?:your )?guest)\b/.test(text)) {
    return { actionable: true, event: "Guest Message", taskType: "Guest message", priority: "High" };
  }
  if (/\b(payment failed|payment issue|card declined|invalid card|virtual card|payment required)\b/.test(text)) {
    return { actionable: true, event: "Payment Issue", taskType: "OTA Issue", priority: "High" };
  }
  if (/\b(availability inquiry|availability enquiry|booking inquiry|booking enquiry|availability request)\b/.test(text)) {
    return { actionable: true, event: "Availability Enquiry", taskType: "FIT Booking", priority: "Normal" };
  }
  return { actionable: false, event: "Non-operational", taskType: "Other", priority: "Normal" };
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
  const matches = properties
    .map(property => ({
      property,
      score: haystack.includes(normalize(property.property_name)) ? normalize(property.property_name).length
        : haystack.includes(normalize(property.client_code)) ? 5 : 0,
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);
  return matches[0]?.property || null;
}

function colomboNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find(part => part.type === type)?.value || "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

function clock(value: string | null) {
  if (!value) return -1;
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function activeRosterMember(roster: Roster[], minute: number) {
  return roster.find(item => {
    const start = clock(item.start_time);
    const end = clock(item.end_time);
    if (start < 0 || end < 0 || !item.staff) return false;
    return end >= start ? minute >= start && minute <= end : minute >= start || minute <= end;
  })?.staff || null;
}

function taskSubject(event: string, propertyName: string, originalSubject: string) {
  const suffix = clean(originalSubject, 110);
  return clean(`${propertyName} · ${event}${suffix ? ` · ${suffix}` : ""}`, 220);
}

async function processMessage(
  message: IncomingEmail,
  properties: Property[],
  contacts: Contact[],
  assigned: { id: string; display_name: string } | null,
) {
  const messageId = clean(message.messageId, 180);
  const from = clean(message.from, 500);
  const subject = clean(message.subject, 500);
  const body = clean(message.body, 8000);
  if (!messageId || !from || !subject) return { messageId, status: "error", error: "Message ID, sender and subject are required." };

  const existing = await supabaseAdmin<ExistingTask[]>(
    `nkh_tasks?source_email_id=eq.${encodeURIComponent(messageId)}&select=id,status,assigned_name_snapshot&limit=1`,
  );
  if (existing[0]) {
    return { messageId, status: "duplicate", taskId: existing[0].id, assignedTo: existing[0].assigned_name_snapshot };
  }
  const classification = classify(subject, body);
  const property = findProperty(message, properties, contacts);
  const senderKey = emailAddress(from);
  const subjectPattern = emailSubjectPattern(subject);
  const protectedMessage = protectedOperationalEmail(subject, body);
  if (!protectedMessage) {
    const rules = await supabaseAdmin<Array<{ id:string; match_count:number }>>(
      `nkh_email_filter_rules?is_active=eq.true&sender_key=eq.${encodeURIComponent(senderKey)}&subject_pattern=eq.${encodeURIComponent(subjectPattern)}&select=id,match_count&limit=1`,
    );
    if (rules[0]) {
      await supabaseAdmin(`nkh_email_filter_rules?id=eq.${rules[0].id}`, { method:"PATCH", prefer:"return=minimal", body:{ match_count:Number(rules[0].match_count||0)+1, last_matched_at:new Date().toISOString() } });
      await supabaseAdmin("nkh_email_ingestion_logs", { method:"POST", prefer:"return=minimal", body:{ source_email_id:messageId,outcome:"auto_ignored",sender:from,subject,filter_rule_id:rules[0].id } });
      return { messageId, status: "auto_ignored", reason: "Matched a learned ignore rule." };
    }
  }

  const reservationId = bookingId(subject, body);
  const rows = await supabaseAdmin<Array<{ id: string }>>("nkh_tasks", {
    method: "POST",
    prefer: "return=representation",
    body: {
      status: "Pending",
      priority: classification.actionable ? classification.priority : "Normal",
      intent: classification.actionable ? classification.event : "Email Review",
      task_type: classification.actionable ? classification.taskType : "Other",
      source: "Email Automation",
      property_id: property?.id || null,
      property_name_snapshot: property?.property_name || "General / Unidentified",
      booking_id: reservationId,
      subject: taskSubject(classification.actionable ? classification.event : "Email", property?.property_name || "General", subject),
      notes: clean(body.replace(/\s+/g, " "), 1200) || subject,
      assigned_staff_id: assigned?.id || null,
      assigned_name_snapshot: assigned?.display_name || null,
      source_email_id: messageId,
      source_gmail_url: clean(message.gmailUrl, 1000) || null,
      source_metadata: {
        sender: from,
        recipient: clean(message.to, 500),
        threadId: clean(message.threadId, 180) || null,
        receivedAt: clean(message.receivedAt, 80) || null,
        event: classification.event,
        attachments: Array.isArray(message.attachmentNames) ? message.attachmentNames.slice(0, 20) : [],
        senderKey,
        subjectPattern,
        protectedOperational: protectedMessage,
        classifier: "NKH email learning engine v2",
      },
      created_by_name_snapshot: "Email Automation",
    },
  });
  const task = rows[0];
  await supabaseAdmin("nkh_task_events", {
    method: "POST",
    prefer: "return=minimal",
    body: {
      task_id: task.id,
      event_type: "Created",
      to_status: "Pending",
      actor_name_snapshot: "Email Automation",
      event_data: { source: "Email", messageId, event: classification.event },
    },
  });
  await supabaseAdmin("nkh_email_ingestion_logs", { method:"POST", prefer:"return=minimal", body:{
    source_email_id:messageId,outcome:"created",task_id:task.id,sender:from,subject,
  }});
  return {
    messageId,
    status: "created",
    taskId: task.id,
    assignedTo: assigned?.display_name || null,
    property: property?.property_name || "General / Unidentified",
    event: classification.event,
  };
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  try {
    const input = await request.json();
    const messages: IncomingEmail[] = Array.isArray(input.messages) ? input.messages.slice(0, 20) : [input];
    if (!messages.length) return NextResponse.json({ success: false, error: "No email messages supplied." }, { status: 400 });

    const now = colomboNow();
    const [properties, contacts, roster] = await Promise.all([
      supabaseAdmin<Property[]>("nkh_properties?select=id,client_code,property_name&client_status=eq.Active"),
      supabaseAdmin<Contact[]>("nkh_property_contacts?select=property_id,email&email=not.is.null"),
      supabaseAdmin<Roster[]>(`nkh_roster_entries?select=start_time,end_time,staff:nkh_staff(id,display_name)&shift_date=eq.${now.date}&status=eq.Scheduled`),
    ]);
    const assigned = activeRosterMember(roster, now.minutes);
    const results = [];
    for (const message of messages) {
      try {
        results.push(await processMessage(message, properties, contacts, assigned));
      } catch (error) {
        const messageId = clean(message.messageId, 180);
        const duplicate = String(error).toLowerCase().includes("duplicate key");
        if (duplicate && messageId) {
          const existing = await supabaseAdmin<ExistingTask[]>(
            `nkh_tasks?source_email_id=eq.${encodeURIComponent(messageId)}&select=id,status,assigned_name_snapshot&limit=1`,
          );
          results.push({ messageId, status: "duplicate", taskId: existing[0]?.id || null });
        } else {
          results.push({ messageId, status: "error", error: error instanceof Error ? error.message : "Task creation failed." });
        }
      }
    }
    return NextResponse.json({
      success: true,
      processed: results.length,
      created: results.filter(item => item.status === "created").length,
      results,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Email task ingestion failed." }, { status: 500 });
  }
}
