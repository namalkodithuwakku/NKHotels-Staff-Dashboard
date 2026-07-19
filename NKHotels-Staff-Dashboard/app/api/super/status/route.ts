import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  callSuperAction,
} from "../_shared";

export async function GET(
  request: NextRequest
) {
  try {
    const staffName =
      request.nextUrl.searchParams.get(
        "staffName"
      ) || "";

    const data =
      await callSuperAction(
        "getSuperStatus",
        {
          staffName,
        }
      );

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Failed to load Super status",
      },
      {
        status: 500,
      }
    );
  }
}
