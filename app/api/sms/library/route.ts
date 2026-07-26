import { NextRequest, NextResponse } from "next/server";
import { hasChannelAccess, readServerSession } from "../../../lib/serverSession";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

function canEdit(access?: string) {
  return ["master", "supervisor"].includes(String(access || "").trim().toLowerCase());
}

function table(type: unknown) {
  if (type === "template") return "nkh_sms_templates";
  if (type === "group") return "nkh_sms_recipient_groups";
  throw new Error("Invalid SMS library type.");
}

export async function GET(request: NextRequest) {
  try {
    const session = readServerSession(request);
    if (!await hasChannelAccess(session, "sms")) {
      return NextResponse.json({ success: false, error: "SMS Center access is not enabled for this profile." }, { status: 403 });
    }
    const [templates, groups] = await Promise.all([
      supabaseAdmin("nkh_sms_templates?select=id,name,message,category,created_by,created_at,updated_at&active=eq.true&order=name.asc"),
      supabaseAdmin("nkh_sms_recipient_groups?select=id,name,description,recipients,created_by,created_at,updated_at&active=eq.true&order=name.asc"),
    ]);
    return NextResponse.json({ success: true, templates, groups, canEdit: canEdit(session?.access) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to load SMS library." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = readServerSession(request);
    if (!session || !canEdit(session.access)) {
      return NextResponse.json({ success: false, error: "Master or Supervisor access is required." }, { status: 403 });
    }
    const input = await request.json();
    const kind = String(input.type || "");
    const name = String(input.name || "").trim().slice(0, 60);
    if (name.length < 2) return NextResponse.json({ success: false, error: "Enter a library name." }, { status: 400 });
    const body = kind === "template"
      ? {
          name,
          message: String(input.message || "").trim().slice(0, 450),
          category: String(input.category || "General").trim().slice(0, 30) || "General",
          created_by: session.name,
        }
      : {
          name,
          description: String(input.description || "").trim().slice(0, 120) || null,
          recipients: Array.isArray(input.recipients) ? input.recipients.slice(0, 250) : [],
          created_by: session.name,
        };
    if (kind === "template" && !body.message) {
      return NextResponse.json({ success: false, error: "Template message is empty." }, { status: 400 });
    }
    if (kind === "group" && !("recipients" in body && body.recipients.length)) {
      return NextResponse.json({ success: false, error: "Select recipients before saving the group." }, { status: 400 });
    }
    const rows = await supabaseAdmin<Array<Record<string, unknown>>>(table(kind), {
      method: "POST", prefer: "return=representation", body,
    });
    return NextResponse.json({ success: true, item: rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to save SMS library item." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = readServerSession(request);
    if (!session || !canEdit(session.access)) {
      return NextResponse.json({ success: false, error: "Master or Supervisor access is required." }, { status: 403 });
    }
    const input = await request.json();
    const kind = String(input.type || "");
    const id = String(input.id || "");
    const name = String(input.name || "").trim().slice(0, 60);
    if (!id || name.length < 2) return NextResponse.json({ success: false, error: "Invalid library item." }, { status: 400 });
    const body = kind === "template"
      ? { name, message: String(input.message || "").trim().slice(0, 450), category: String(input.category || "General").trim().slice(0, 30) || "General" }
      : { name, description: String(input.description || "").trim().slice(0, 120) || null, recipients: Array.isArray(input.recipients) ? input.recipients.slice(0, 250) : [] };
    await supabaseAdmin(`${table(kind)}?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", prefer: "return=minimal", body });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to update SMS library item." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = readServerSession(request);
    if (!session || !canEdit(session.access)) {
      return NextResponse.json({ success: false, error: "Master or Supervisor access is required." }, { status: 403 });
    }
    const input = await request.json();
    await supabaseAdmin(`${table(input.type)}?id=eq.${encodeURIComponent(String(input.id || ""))}`, {
      method: "PATCH", prefer: "return=minimal", body: { active: false },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to delete SMS library item." }, { status: 500 });
  }
}
