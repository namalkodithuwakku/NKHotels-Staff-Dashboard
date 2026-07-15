import { NextResponse } from "next/server";

const SCRIPT_URL = process.env.GOOGLE_WEBAPP_URL;

export async function POST(request: Request) {
  try {
    if (!SCRIPT_URL) {
      return NextResponse.json({
        success: false,
        error: "Missing Apps Script URL",
      });
    }

    const body = await request.json();

    const params = new URLSearchParams({
      action: "createTask",
      taskType: body.taskType || "Other",
      source: body.source || "Staff Dashboard",
      property: body.property || "",
      note: body.note || "",
      subject: body.subject || body.taskType || "Quick Action",
      priority: body.priority || "Normal",
      staffName: body.staffName || "",
      staffPhone: body.staffPhone || "",
      shift: body.shift || "",
    });

    const response = await fetch(`${SCRIPT_URL}?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
    });

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json({
        success: false,
        error: "Apps Script returned non-JSON response.",
        preview: text.substring(0, 300),
      });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || "Failed to create task",
    });
  }
}