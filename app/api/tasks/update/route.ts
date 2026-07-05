import { NextResponse } from "next/server";

const GOOGLE_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbztfBp0WNIPPX3EI1lrIete8-D3epZ35u5f-UUNLgbLkD71JP6J4-uxbgHIGCw5qX7H/exec";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const taskId = searchParams.get("taskId") || "";
    const status = searchParams.get("status") || "";
    const staffName = searchParams.get("staffName") || "";

    const url =
      `${GOOGLE_WEBAPP_URL}?action=updateTaskStatus` +
      `&taskId=${encodeURIComponent(taskId)}` +
      `&status=${encodeURIComponent(status)}` +
      `&staffName=${encodeURIComponent(staffName)}`;

    console.log("Update URL:", url);

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
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Task update failed",
      },
      { status: 500 }
    );
  }
}