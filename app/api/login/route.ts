import { NextResponse } from "next/server";

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

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Login failed",
      },
      { status: 500 }
    );
  }
}