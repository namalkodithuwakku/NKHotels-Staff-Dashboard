import { NextResponse } from "next/server";

const GOOGLE_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbztfBp0WNIPPX3EI1lrIete8-D3epZ35u5f-UUNLgbLkD71JP6J4-uxbgHIGCw5qX7H/exec";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const response = await fetch(GOOGLE_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "updateTaskStatus",
        taskId: body.taskId,
        status: body.status,
        staffName: body.staffName,
      }),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Task status update failed" },
      { status: 500 }
    );
  }
}