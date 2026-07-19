import { NextRequest, NextResponse } from "next/server";

const GOOGLE_WEBAPP_URL = process.env.GOOGLE_WEBAPP_URL;

export async function POST(request: NextRequest) {
  try {
    if (!GOOGLE_WEBAPP_URL) {
      return NextResponse.json(
        {
          success: false,
          error: "GOOGLE_WEBAPP_URL missing",
        },
        { status: 500 }
      );
    }

    const body = await request.json();

    const emailId = String(body.emailId || "").trim();
    const staffName = String(body.staffName || "").trim();
    const reason = String(body.reason || "No action required").trim();

    if (!emailId) {
      return NextResponse.json(
        {
          success: false,
          error: "Email ID required",
        },
        { status: 400 }
      );
    }

    const params = new URLSearchParams({
      action: "ignoreAIEmail",
      emailId,
      staffName,
      reason,
    });

    const response = await fetch(
      `${GOOGLE_WEBAPP_URL}?${params.toString()}`,
      {
        method: "GET",
        cache: "no-store",
      }
    );

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Google Apps Script returned invalid JSON",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(data, {
      status: data.success ? 200 : 400,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to ignore AI email",
      },
      { status: 500 }
    );
  }
}