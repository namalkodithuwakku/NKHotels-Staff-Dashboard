import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

const GOOGLE_WEBAPP_URL = process.env.GOOGLE_WEBAPP_URL;
const INBOX_INTEGRATION_SECRET = process.env.INBOX_INTEGRATION_SECRET;

function secretsMatch(received: string | null) {
  if (!INBOX_INTEGRATION_SECRET || !received) return false;
  const expected = Buffer.from(INBOX_INTEGRATION_SECRET);
  const actual = Buffer.from(received);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function POST(request: NextRequest) {
  if (!secretsMatch(request.headers.get("x-nkh-inbox-secret"))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!GOOGLE_WEBAPP_URL) {
    return NextResponse.json({ success: false, error: "GOOGLE_WEBAPP_URL missing" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const property = String(body.property || "").trim();
    const subject = String(body.subject || "").trim();
    const note = String(body.note || "").trim();

    if (!property || !subject || !note) {
      return NextResponse.json(
        { success: false, error: "Property, subject and note are required" },
        { status: 400 },
      );
    }

    const params = new URLSearchParams({
      action: "createTask",
      taskType: String(body.taskType || "Other"),
      source: "WhatsApp AI",
      property,
      note,
      subject,
      priority: String(body.priority || "Normal"),
      staffName: "",
      staffPhone: "",
      shift: "",
    });

    const response = await fetch(`${GOOGLE_WEBAPP_URL}?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
    });
    const text = await response.text();

    try {
      const data = JSON.parse(text);
      return NextResponse.json(data, { status: data.success ? 200 : 400 });
    } catch {
      return NextResponse.json(
        { success: false, error: "Apps Script returned non-JSON", preview: text.slice(0, 200) },
        { status: 502 },
      );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Task creation failed" },
      { status: 500 },
    );
  }
}
