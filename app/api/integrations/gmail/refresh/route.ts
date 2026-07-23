import { NextRequest, NextResponse } from "next/server";
import { initialGmailImport } from "../../../../lib/gmailIntegration";
import { readServerSession } from "../../../../lib/serverSession";

export async function POST(request: NextRequest) {
  if (!readServerSession(request)) {
    return NextResponse.json(
      { success: false, error: "Staff access required." },
      { status: 401 }
    );
  }

  try {
    const imported = await initialGmailImport();
    return NextResponse.json({ success: true, imported });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Gmail refresh failed.",
      },
      { status: 500 }
    );
  }
}
