import { NextResponse } from "next/server";

const SCRIPT_URL =
  process.env.GOOGLE_WEBAPP_URL ||
  process.env.NKH_SCRIPT_URL ||
  process.env.GOOGLE_SCRIPT_URL;

export async function GET() {
  try {
    if (!SCRIPT_URL) {
      return NextResponse.json({
        success: false,
        error: "Missing Apps Script URL",
      });
    }

    const url = `${SCRIPT_URL}?action=getProperties`;
    const response = await fetch(url, { cache: "no-store" });
    const data = await response.json();

    const properties = (data.properties || [])
      .map((p: string) => String(p).trim())
      .filter(Boolean)
      .sort((a: string, b: string) => a.localeCompare(b));

    return NextResponse.json({ success: true, properties });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || "Failed to load properties",
    });
  }
}