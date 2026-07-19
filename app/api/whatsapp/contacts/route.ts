import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { canManageProperties, isMasterSession, readServerSession } from "../../../lib/serverSession";

const normalize = (value: string) => value.replace(/\D/g, "");
async function contactAudit(actor: string, role: string, action: string, id: string, details: Record<string, unknown> = {}) {
  try { await supabaseAdmin("inbox_audit_logs", { method: "POST", prefer: "return=minimal", body: { actor_role: role.toUpperCase(), action, entity_type: "contact", entity_id: id, details: { actor, ...details } } }); } catch { /* Keep contact operation usable if the older audit constraint lacks contact. */ }
}

export async function GET(request: NextRequest) {
  try {
    if (!canManageProperties(readServerSession(request))) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const [contacts, properties] = await Promise.all([
      supabaseAdmin<unknown[]>("wa_contacts?select=id,wa_id,phone,profile_name,property_name,property_id,contact_name,name_prefix,job_position,is_active,client_status,notes,created_at&order=property_name.asc.nullslast,contact_name.asc.nullslast"),
      supabaseAdmin<unknown[]>("nkh_properties?select=id,client_code,property_name,client_status&order=property_name.asc"),
    ]);
    return NextResponse.json({ contacts, properties });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load contacts." }, { status: 500 }); }
}

async function save(request: NextRequest, update: boolean) {
  const session = readServerSession(request); if (!canManageProperties(session)) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const input = await request.json(), waId = normalize(String(input.phone || input.wa_id || ""));
  if (waId.length < 8 || waId.length > 15) return NextResponse.json({ error: "Use a valid number with country code, for example +94771234567." }, { status: 400 });
  if (update && !input.id) return NextResponse.json({ error: "Contact ID is required." }, { status: 400 });
  const property = input.property_id ? (await supabaseAdmin<Array<{ property_name: string; client_status: string }>>(`nkh_properties?id=eq.${encodeURIComponent(input.property_id)}&select=property_name,client_status&limit=1`))[0] : null;
  const body = { wa_id: waId, phone: `+${waId}`, property_id: input.property_id || null, property_name: property?.property_name || null, profile_name: String(input.contact_name || "").trim() || null, contact_name: String(input.contact_name || "").trim() || null, name_prefix: String(input.name_prefix || "").trim() || null, job_position: String(input.job_position || "").trim() || null, is_active: input.is_active !== false, client_status: property?.client_status === "Active" ? "Existing Client" : property?.client_status || "Unknown", notes: String(input.notes || "").trim() || null };
  const path = update ? `wa_contacts?id=eq.${encodeURIComponent(input.id)}` : "wa_contacts?on_conflict=wa_id";
  const rows = await supabaseAdmin<Array<{ id: string }>>(path, { method: update ? "PATCH" : "POST", prefer: update ? "return=representation" : "resolution=merge-duplicates,return=representation", body });
  const id = rows[0]?.id || input.id; await contactAudit(session!.name, session!.access, update ? "update" : "create", id, { wa_id: waId, property_id: input.property_id || null });
  return NextResponse.json({ success: true, id });
}
export async function POST(request: NextRequest) { try { return await save(request, false); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to add contact." }, { status: 500 }); } }
export async function PATCH(request: NextRequest) { try { return await save(request, true); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update contact." }, { status: 500 }); } }

export async function DELETE(request: NextRequest) {
  try {
    const session = readServerSession(request); if (!isMasterSession(session)) return NextResponse.json({ error: "Master access is required." }, { status: 403 });
    const id = request.nextUrl.searchParams.get("id"); if (!id) return NextResponse.json({ error: "Contact ID is required." }, { status: 400 });
    const encoded = encodeURIComponent(id), conversations = await supabaseAdmin<Array<{ id: string }>>(`wa_conversations?contact_id=eq.${encoded}&select=id`);
    for (const conversation of conversations) {
      const cid = encodeURIComponent(conversation.id);
      await supabaseAdmin(`wa_internal_notes?conversation_id=eq.${cid}`, { method: "DELETE", prefer: "return=minimal" });
      await supabaseAdmin(`wa_messages?conversation_id=eq.${cid}`, { method: "DELETE", prefer: "return=minimal" });
    }
    await supabaseAdmin(`wa_conversations?contact_id=eq.${encoded}`, { method: "DELETE", prefer: "return=minimal" });
    await supabaseAdmin(`wa_contacts?id=eq.${encoded}`, { method: "DELETE", prefer: "return=minimal" });
    await contactAudit(session!.name, session!.access, "delete", id, { conversations_deleted: conversations.length });
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Contact deletion failed." }, { status: 500 }); }
}
