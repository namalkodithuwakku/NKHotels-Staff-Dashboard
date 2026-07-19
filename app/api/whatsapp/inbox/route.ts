import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { canManageProperties, isMasterSession, readServerSession } from "../../../lib/serverSession";

function sessionFor(request: NextRequest) { const session = readServerSession(request); return canManageProperties(session) ? session : null; }
async function audit(actor: string, role: string, action: string, entityId: string, details: Record<string, unknown> = {}) {
  try { await supabaseAdmin("inbox_audit_logs", { method: "POST", prefer: "return=minimal", body: { actor_role: role.toUpperCase(), action, entity_type: "conversation", entity_id: entityId, details: { actor, ...details } } }); } catch { /* Audit schema belongs to the inbox; deletion must not be left half-complete. */ }
}

export async function GET(request: NextRequest) {
  try {
    if (!sessionFor(request)) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const id = request.nextUrl.searchParams.get("conversation_id");
    if (id) {
      const [messages, notes] = await Promise.all([
        supabaseAdmin<unknown[]>(`wa_messages?conversation_id=eq.${encodeURIComponent(id)}&select=id,direction,body,message_type,delivery_status,sent_by,created_at,meta_timestamp,media_id,error_message&order=created_at.asc`),
        supabaseAdmin<unknown[]>(`wa_internal_notes?conversation_id=eq.${encodeURIComponent(id)}&select=id,note,created_by,created_at&order=created_at.desc`),
      ]);
      return NextResponse.json({ messages, notes });
    }
    const [conversations, staff] = await Promise.all([
      supabaseAdmin<unknown[]>("wa_conversations?select=id,contact_id,status,assigned_to,label,unread_count,last_message_preview,last_message_at,customer_window_expires_at,contact:wa_contacts(id,wa_id,phone,profile_name,property_name,property_id,contact_name,job_position,client_status,is_active)&order=last_message_at.desc.nullslast"),
      supabaseAdmin<unknown[]>("nkh_staff?select=display_name&employment_status=eq.Active&order=display_name.asc"),
    ]);
    return NextResponse.json({ conversations, staff });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load WhatsApp inbox." }, { status: 500 }); }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = sessionFor(request); if (!session) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const input = await request.json(); if (!input.id) return NextResponse.json({ error: "Conversation ID is required." }, { status: 400 });
    const allowed = ["status", "assigned_to", "label", "unread_count"];
    const update = Object.fromEntries(allowed.filter(key => input[key] !== undefined).map(key => [key, input[key]]));
    await supabaseAdmin(`wa_conversations?id=eq.${encodeURIComponent(input.id)}`, { method: "PATCH", prefer: "return=minimal", body: update });
    await audit(session.name, session.access, "update", input.id, update);
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Conversation update failed." }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  try {
    const session = sessionFor(request); if (!session) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const input = await request.json();
    if (!input.conversation_id || !String(input.note || "").trim()) return NextResponse.json({ error: "Conversation and note are required." }, { status: 400 });
    await supabaseAdmin("wa_internal_notes", { method: "POST", prefer: "return=minimal", body: { conversation_id: input.conversation_id, note: String(input.note).trim(), created_by: session.name } });
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save note." }, { status: 500 }); }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = readServerSession(request); if (!isMasterSession(session)) return NextResponse.json({ error: "Master access is required." }, { status: 403 });
    const id = request.nextUrl.searchParams.get("id"); if (!id) return NextResponse.json({ error: "Conversation ID is required." }, { status: 400 });
    const encoded = encodeURIComponent(id);
    await supabaseAdmin(`wa_internal_notes?conversation_id=eq.${encoded}`, { method: "DELETE", prefer: "return=minimal" });
    await supabaseAdmin(`wa_messages?conversation_id=eq.${encoded}`, { method: "DELETE", prefer: "return=minimal" });
    await supabaseAdmin(`wa_conversations?id=eq.${encoded}`, { method: "DELETE", prefer: "return=minimal" });
    await audit(session!.name, session!.access, "delete", id);
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Conversation deletion failed." }, { status: 500 }); }
}
