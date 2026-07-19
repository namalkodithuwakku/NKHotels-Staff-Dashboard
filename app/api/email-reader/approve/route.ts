import { NextResponse } from "next/server";

/**
 * Legacy Google Sheet email-to-task route.
 *
 * Email tasks are now created manually from the dashboard and written
 * directly to Supabase through /api/email-reader/start. Keep this route
 * closed so an old client cannot restart the Google task workflow.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      disabled: true,
      error: "Automatic email-to-task creation is disabled. Create the task manually from Email Inbox.",
    },
    { status: 410 }
  );
}
