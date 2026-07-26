import { supabaseAdmin } from "./supabaseAdmin";

type TaskLink = {
  id: string;
  conversation_id: string;
  acknowledgement_sent_at: string | null;
  completion_reply_sent_at: string | null;
};
type Conversation = { id: string; contact_id: string | null };
type Contact = { id: string; wa_id: string | null; phone: string | null };

function normalizeRecipient(value: string) {
  let recipient = String(value || "").replace(/[^\d]/g, "");
  if (recipient.startsWith("0094")) recipient = recipient.slice(2);
  if (recipient.startsWith("0")) recipient = `94${recipient.slice(1)}`;
  return recipient;
}

function whatsappSettings() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) throw new Error("WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID is missing.");
  return { token, phoneId, version: process.env.WHATSAPP_GRAPH_VERSION || "v23.0" };
}

async function targetForTask(taskId: string) {
  const links = await supabaseAdmin<TaskLink[]>(
    `wa_task_links?dashboard_task_id=eq.${encodeURIComponent(taskId)}&select=id,conversation_id,acknowledgement_sent_at,completion_reply_sent_at&limit=1`,
  );
  const link = links[0];
  if (!link) return null;
  const conversations = await supabaseAdmin<Conversation[]>(
    `wa_conversations?id=eq.${encodeURIComponent(link.conversation_id)}&select=id,contact_id&limit=1`,
  );
  const conversation = conversations[0];
  if (!conversation?.contact_id) throw new Error("WhatsApp task conversation has no linked contact.");
  const contacts = await supabaseAdmin<Contact[]>(
    `wa_contacts?id=eq.${encodeURIComponent(conversation.contact_id)}&select=id,wa_id,phone&limit=1`,
  );
  const contact = contacts[0];
  const recipient = normalizeRecipient(String(contact?.wa_id || contact?.phone || ""));
  if (!recipient) throw new Error("WhatsApp task contact has no WhatsApp number.");
  return { link, recipient };
}

async function sendAndRecord(taskId: string, text: string, sentBy: string, kind: "created" | "done") {
  const target = await targetForTask(taskId);
  if (!target) return { sent: false, skipped: true, reason: "No WhatsApp task link" };
  if (kind === "created" && target.link.acknowledgement_sent_at) {
    return { sent: false, skipped: true, reason: "Creation confirmation already sent" };
  }
  if (kind === "done" && target.link.completion_reply_sent_at) {
    return { sent: false, skipped: true, reason: "Completion confirmation already sent" };
  }

  const { token, phoneId, version } = whatsappSettings();
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: target.recipient,
      type: "text",
      text: { preview_url: false, body: text },
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "WhatsApp rejected the task confirmation.");

  const sentAt = new Date().toISOString();
  await Promise.all([
    supabaseAdmin("wa_messages", {
      method: "POST",
      prefer: "return=minimal",
      body: {
        conversation_id: target.link.conversation_id,
        meta_message_id: data?.messages?.[0]?.id || null,
        direction: "outgoing",
        message_type: "text",
        body: text,
        delivery_status: "sent",
        sent_by: sentBy || "NKH Team",
        meta_timestamp: sentAt,
        raw_payload: data,
      },
    }),
    supabaseAdmin(`wa_conversations?id=eq.${encodeURIComponent(target.link.conversation_id)}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: { last_message_preview: text.slice(0, 180), last_message_at: sentAt },
    }),
    supabaseAdmin(`wa_task_links?id=eq.${encodeURIComponent(target.link.id)}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: kind === "created"
        ? { acknowledgement_sent_at: sentAt }
        : { task_status: "Done", completion_reply_sent_at: sentAt },
    }),
  ]);
  return { sent: true, skipped: false };
}

export function sendWhatsAppTaskCreated(input: {
  taskId: string;
  property?: string | null;
  subject?: string | null;
  assignedTo?: string | null;
}) {
  const text = [
    "✅ Task received by N K Hotels",
    input.property || null,
    input.subject || null,
    input.assignedTo ? `Assigned to: ${input.assignedTo}` : "Our operations team will attend to it.",
  ].filter(Boolean).join("\n");
  return sendAndRecord(input.taskId, text, "NKH Dashboard", "created");
}

export function sendWhatsAppTaskDone(input: {
  taskId: string;
  property?: string | null;
  subject?: string | null;
  staffName?: string;
  completionNote?: string;
}) {
  const text = [
    "✅ Task completed",
    input.property || null,
    input.subject || null,
    input.staffName ? `Completed by: ${input.staffName}` : null,
    input.completionNote ? `Note: ${input.completionNote}` : null,
  ].filter(Boolean).join("\n");
  return sendAndRecord(input.taskId, text, input.staffName || "NKH Team", "done");
}
