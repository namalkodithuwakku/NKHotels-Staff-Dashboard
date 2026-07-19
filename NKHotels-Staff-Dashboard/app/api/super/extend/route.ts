import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  callSuperAction,
} from "../_shared";

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      await request.json();

    const data =
      await callSuperAction(
        "extendSuper",
        {
          staffName:
            body?.staffName || "",
        }
      );

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Failed to extend Super",
      },
      {
        status: 500,
      }
    );
  }
}
