import { NextResponse } from "next/server";
import { createServerSession, SESSION_COOKIE } from "../../lib/serverSession";

const GOOGLE_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbztfBp0WNIPPX3EI1lrIete8-D3epZ35u5f-UUNLgbLkD71JP6J4-uxbgHIGCw5qX7H/exec";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const url =
      `${GOOGLE_WEBAPP_URL}?action=staffLogin` +
      `&name=${encodeURIComponent(body.name || "")}` +
      `&pin=${encodeURIComponent(body.pin || "")}`;

    const response = await fetch(url, { cache: "no-store" });
    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Login backend returned non-JSON",
          preview: text.slice(0, 300),
        },
        { status: 500 }
      );
    }

    const result = NextResponse.json(data);
    if (data?.success && data?.staff) {
      result.cookies.set(SESSION_COOKIE, createServerSession(data.staff), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });
    }
    return result;
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Login failed",
      },
      { status: 500 }
    );
  }
}
