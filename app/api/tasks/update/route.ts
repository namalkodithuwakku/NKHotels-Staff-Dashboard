import { NextResponse } from "next/server";

const GOOGLE_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbztfBp0WNIPPX3EI1lrIete8-D3epZ35u5f-UUNLgbLkD71JP6J4-uxbgHIGCw5qX7H/exec";

async function notifyInboxTaskCompleted(input: {
  taskId: string;
  status: string;
  staffName: string;
  completionNote: string;
}) {
  const url = process.env.INBOX_TASK_COMPLETION_URL;
  const secret = process.env.INBOX_INTEGRATION_SECRET;
  if (!url || !secret) return { sent: false, error: "Inbox completion integration is not configured" };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-nkh-inbox-secret": secret,
      },
      body: JSON.stringify(input),
      cache: "no-store",
    });
    const data = await response.json();
    return response.ok
      ? { sent: data.sent === true, skipped: data.skipped === true }
      : { sent: false, error: data.error || "Inbox rejected completion notification" };
  } catch (error) {
    return {
      sent: false,
      error: error instanceof Error ? error.message : "Inbox completion notification failed",
    };
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId") || "";
    const status = searchParams.get("status") || "";
    const staffName = searchParams.get("staffName") || "";
    const completionNote = searchParams.get("completionNote") || "";

    const url =
      `${GOOGLE_WEBAPP_URL}?action=updateTaskStatus` +
      `&taskId=${encodeURIComponent(taskId)}` +
      `&status=${encodeURIComponent(status)}` +
      `&staffName=${encodeURIComponent(staffName)}` +
      `&completionNote=${encodeURIComponent(completionNote)}`;

    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });
    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Apps Script returned non-JSON",
          preview: text.substring(0, 500),
        },
        { status: 500 },
      );
    }

    if (data.success && ["done", "completed"].includes(status.trim().toLowerCase())) {
      const completionNotification = await notifyInboxTaskCompleted({ taskId, status, staffName, completionNote });
      return NextResponse.json({ ...data, completionNotification });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Task update failed",
      },
      { status: 500 },
    );
  }
}
