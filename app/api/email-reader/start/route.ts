import {
  NextRequest,
  NextResponse,
} from "next/server";
import { syncGoogleTasksToSupabase } from "../../../lib/googleTaskSync";

const GOOGLE_WEBAPP_URL =
  process.env.GOOGLE_WEBAPP_URL;

export async function POST(
  request: NextRequest
) {
  try {
    if (!GOOGLE_WEBAPP_URL) {
      return NextResponse.json(
        {
          success: false,
          error:
            "GOOGLE_WEBAPP_URL missing",
        },
        {
          status: 500,
        }
      );
    }

    const body =
      await request.json();

    const emailId = String(
      body.emailId || ""
    ).trim();

    const staffName = String(
      body.staffName || ""
    ).trim();

    const staffPhone = String(
      body.staffPhone || ""
    ).trim();

    const shift = String(
      body.shift || ""
    ).trim();

    if (!emailId) {
      return NextResponse.json(
        {
          success: false,
          error: "Email ID required",
        },
        {
          status: 400,
        }
      );
    }

    const params =
      new URLSearchParams({
        action: "startEmailTask",
        emailId,
        staffName,
        staffPhone,
        shift,
      });

    const response = await fetch(
      `${GOOGLE_WEBAPP_URL}?${params.toString()}`,
      {
        method: "GET",
        cache: "no-store",
      }
    );

    const text =
      await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "Google Apps Script returned invalid JSON",
        },
        {
          status: 500,
        }
      );
    }

    const taskSync = data.success ? await syncGoogleTasksToSupabase() : undefined;
    return NextResponse.json({ ...data, taskSync }, {
      status:
        data.success
          ? 200
          : 400,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to start email task",
      },
      {
        status: 500,
      }
    );
  }
}
