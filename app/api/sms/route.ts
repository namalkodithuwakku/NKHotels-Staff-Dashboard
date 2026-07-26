import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { maskPhone, normalizeSriLankanPhone, sendDialogSms, smsParts } from "../../lib/dialogSms";
import { hasChannelAccess, readServerSession } from "../../lib/serverSession";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

type Recipient = {
  key: string; type: "Staff" | "Client" | "Lead"; id: string; name: string;
  phone: string; propertyId?: string | null; property?: string | null;
};
type SmsRow = {
  id: string; batch_id: string; recipient_type: string; recipient_name: string | null;
  property_name: string | null; phone_masked: string; message: string; message_parts: number;
  delivery_status: string; error_message: string | null; attempt_count: number;
  sent_by: string; sent_at: string | null; created_at: string;
};

function privileged(access?: string) {
  return ["master", "supervisor"].includes(String(access || "").trim().toLowerCase());
}

async function recipients() {
  const [staff, contacts] = await Promise.all([
    supabaseAdmin<Array<{ id: string; display_name: string; phone: string | null; whatsapp_number: string | null }>>(
      "nkh_staff?select=id,display_name,phone,whatsapp_number&employment_status=eq.Active&order=display_name.asc",
    ),
    supabaseAdmin<Array<{ id: string; contact_name: string; phone: string | null; sms_number: string | null; property_id: string; property: { property_name: string; client_status: string } | null }>>(
      "nkh_property_contacts?select=id,contact_name,phone,sms_number,property_id,property:nkh_properties(property_name,client_status)&order=contact_name.asc",
    ),
  ]);
  const rows: Recipient[] = [];
  for (const item of staff) {
    const phone = item.phone || item.whatsapp_number;
    if (phone) rows.push({ key: `Staff:${item.id}`, type: "Staff", id: item.id, name: item.display_name, phone });
  }
  for (const item of contacts) {
    const phone = item.sms_number || item.phone;
    if (!phone) continue;
    const type = item.property?.client_status === "Lead" ? "Lead" : "Client";
    rows.push({
      key: `${type}:${item.id}`, type, id: item.id, name: item.contact_name, phone,
      propertyId: item.property_id, property: item.property?.property_name || null,
    });
  }
  return rows;
}

export async function GET(request: NextRequest) {
  try {
    const session = readServerSession(request);
    if (!await hasChannelAccess(session, "sms")) return NextResponse.json({ success: false, error: "SMS Center access is not enabled for this profile." }, { status: 403 });
    const [available, history] = await Promise.all([
      recipients(),
      supabaseAdmin<SmsRow[]>("nkh_sms_messages?select=id,batch_id,recipient_type,recipient_name,property_name,phone_masked,message,message_parts,delivery_status,error_message,attempt_count,sent_by,sent_at,created_at&order=created_at.desc&limit=250"),
    ]);
    return NextResponse.json({ success: true, recipients: available, history, canBulkSend: privileged(session?.access) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to load SMS Center." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = readServerSession(request);
    if (!await hasChannelAccess(session, "sms")) return NextResponse.json({ success: false, error: "SMS Center access is not enabled for this profile." }, { status: 403 });
    const input = await request.json();
    const message = String(input.message || "").trim().slice(0, 450);
    if (!message) return NextResponse.json({ success: false, error: "Enter an SMS message." }, { status: 400 });
    const available = await recipients();
    const selectedKeys = Array.isArray(input.recipientKeys) ? input.recipientKeys.map(String) : [];
    const selected = available.filter(item => selectedKeys.includes(item.key));
    const customPhones: string[] = Array.isArray(input.customPhones) ? input.customPhones.map(String).filter(Boolean) : [];
    const targets: Array<Recipient | { key: string; type: "Custom"; id: string; name: string; phone: string }> = [
      ...selected,
      ...customPhones.map(phone => ({ key: `Custom:${phone}`, type: "Custom" as const, id: "", name: "Custom recipient", phone })),
    ];
    if (!targets.length) return NextResponse.json({ success: false, error: "Select at least one recipient." }, { status: 400 });
    if (targets.length > 1 && !privileged(session?.access)) {
      return NextResponse.json({ success: false, error: "Master or Supervisor access is required for bulk SMS." }, { status: 403 });
    }
    if (targets.length > 100) return NextResponse.json({ success: false, error: "A batch is limited to 100 recipients." }, { status: 400 });

    const batchId = randomUUID();
    const sent: string[] = [], failed: Array<{ phone: string; error: string }> = [];
    for (const target of targets) {
      let phone = target.phone;
      let rowId = "";
      try {
        phone = normalizeSriLankanPhone(phone);
        const rows = await supabaseAdmin<Array<{ id: string }>>("nkh_sms_messages", {
          method: "POST", prefer: "return=representation",
          body: {
            batch_id: batchId, recipient_type: target.type, recipient_id: target.id || null,
            recipient_name: target.name, property_id: "propertyId" in target ? target.propertyId || null : null,
            property_name: "property" in target ? target.property || null : null,
            phone, phone_masked: maskPhone(phone), message, message_parts: smsParts(message),
            delivery_status: "Pending", sent_by: session!.name,
          },
        });
        rowId = rows[0].id;
        const result = await sendDialogSms(phone, message);
        await supabaseAdmin(`nkh_sms_messages?id=eq.${encodeURIComponent(rowId)}`, {
          method: "PATCH", prefer: "return=minimal",
          body: { delivery_status: "Sent", attempt_count: 1, provider_response: result, sent_at: new Date().toISOString(), error_message: null },
        });
        sent.push(rowId);
      } catch (reason) {
        const error = reason instanceof Error ? reason.message : "SMS delivery failed";
        if (rowId) await supabaseAdmin(`nkh_sms_messages?id=eq.${encodeURIComponent(rowId)}`, {
          method: "PATCH", prefer: "return=minimal",
          body: { delivery_status: "Failed", attempt_count: 1, error_message: error.slice(0, 500) },
        }).catch(() => undefined);
        failed.push({ phone: maskPhoneSafe(phone), error });
      }
    }
    return NextResponse.json({ success: sent.length > 0, batchId, sent: sent.length, failed, error: sent.length ? undefined : failed[0]?.error });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "SMS sending failed." }, { status: 500 });
  }
}

function maskPhoneSafe(phone: string) {
  try { return maskPhone(phone); } catch { return "Invalid number"; }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = readServerSession(request);
    if (!await hasChannelAccess(session, "sms")) return NextResponse.json({ success: false, error: "SMS Center access is not enabled for this profile." }, { status: 403 });
    const input = await request.json();
    const rows = await supabaseAdmin<Array<SmsRow & { phone: string }>>(
      `nkh_sms_messages?id=eq.${encodeURIComponent(String(input.id || ""))}&select=*&limit=1`,
    );
    const row = rows[0];
    if (!row || row.delivery_status !== "Failed") return NextResponse.json({ success: false, error: "Only failed SMS records can be retried." }, { status: 400 });
    const result = await sendDialogSms(row.phone, row.message);
    await supabaseAdmin(`nkh_sms_messages?id=eq.${encodeURIComponent(row.id)}`, {
      method: "PATCH", prefer: "return=minimal",
      body: { delivery_status: "Sent", attempt_count: row.attempt_count + 1, provider_response: result, sent_at: new Date().toISOString(), error_message: null },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "SMS retry failed." }, { status: 500 });
  }
}
