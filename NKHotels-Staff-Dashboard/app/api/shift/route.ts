import { NextResponse } from "next/server";

const GOOGLE_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbztfBp0WNIPPX3EI1lrIete8-D3epZ35u5f-UUNLgbLkD71JP6J4-uxbgHIGCw5qX7H/exec";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const staff = searchParams.get("staff") || "";

    const response = await fetch(
      `${GOOGLE_WEBAPP_URL}?action=getStaffShift&staff=${encodeURIComponent(staff)}`,
      { cache: "no-store" }
    );

    const text = await response.text();

    try {
      const data = JSON.parse(text);
      return NextResponse.json(data);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Google Apps Script returned non-JSON for shift",
          preview: text.slice(0, 500),
        },
        { status: 500 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to load shift",
      },
      { status: 500 }
    );
  }
}