import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { canManageProperties, readServerSession } from "../../../lib/serverSession";

type Target = { id: string; contact: { wa_id: string } };
export async function POST(request: NextRequest) {
  try {
    const session = readServerSession(request); if (!canManageProperties(session)) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const input = await request.json(), text = String(input.text || "").trim();
    if (!input.conversation_id || !text) return NextResponse.json({ error: "Conversation and message are required." }, { status: 400 });
    const token = process.env.WHATSAPP_ACCESS_TOKEN, phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneId) return NextResponse.json({ error: "Add WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID to this Vercel project." }, { status: 503 });
    const targets = await supabaseAdmin<Target[]>(`wa_conversations?id=eq.${encodeURIComponent(input.conversation_id)}&select=id,contact:wa_contacts(wa_id)`);
    const waId = targets[0]?.contact?.wa_id; if (!waId) return NextResponse.json({ error: "WhatsApp contact was not found." }, { status: 404 });
    const version = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
    const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: waId, type: "text", text: { preview_url: false, body: text } }) });
    const data = await response.json(); if (!response.ok) return NextResponse.json({ error: data?.error?.message || "WhatsApp rejected the message." }, { status: response.status });
    const now = new Date().toISOString(), messageId = data?.messages?.[0]?.id || null;
    await supabaseAdmin("wa_messages", { method: "POST", prefer: "return=minimal", body: { conversation_id: input.conversation_id, meta_message_id: messageId, direction: "outgoing", message_type: "text", body: text, delivery_status: "sent", sent_by: session?.name || "NKH Team", meta_timestamp: now, raw_payload: data } });
    await supabaseAdmin(`wa_conversations?id=eq.${encodeURIComponent(input.conversation_id)}`, { method: "PATCH", prefer: "return=minimal", body: { last_message_preview: text.slice(0, 180), last_message_at: now } });
    return NextResponse.json({ success: true, message_id: messageId });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to send WhatsApp message." }, { status: 500 }); }
}
