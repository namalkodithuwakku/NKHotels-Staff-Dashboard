import { NextResponse } from "next/server";

const GOOGLE_SCRIPT_URL = process.env.GOOGLE_WEBAPP_URL;

export async function GET() {
  if (!GOOGLE_SCRIPT_URL) {
    return NextResponse.json(
      { success: false, error: "GOOGLE_SCRIPT_URL missing" },
      { status: 500 }
    );
  }

  const url = `${GOOGLE_SCRIPT_URL}?action=getEmailReaderItems`;

  const response = await fetch(url, { cache: "no-store" });
  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { success: false, error: "Google Script returned invalid JSON" },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}