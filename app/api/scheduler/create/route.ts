import { NextResponse } from "next/server";

const GOOGLE_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbztfBp0WNIPPX3EI1lrIete8-D3epZ35u5f-UUNLgbLkD71JP6J4-uxbgHIGCw5qX7H/exec";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const params = new URLSearchParams({
      action: "createTaskSchedule",
      taskName: body.taskName || "",
      taskType: body.taskType || "Manual Task",
      propertyMode: body.propertyMode || "Single",
      property: body.property || "",
      assignTo: body.assignTo || "",
      priority: body.priority || "Normal",
      frequency: body.frequency || "One Time",
      day: body.day || "",
      time: body.time || "",
      startDate: body.startDate || "",
      notes: body.notes || "",
      createdBy: body.createdBy || "",
    });

    const response = await fetch(`${GOOGLE_WEBAPP_URL}?${params.toString()}`, {
      cache: "no-store",
    });

    const text = await response.text();

    try {
      return NextResponse.json(JSON.parse(text));
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Scheduler backend returned non-JSON",
          preview: text.slice(0, 300),
        },
        { status: 500 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Create schedule failed" },
      { status: 500 }
    );
  }
}