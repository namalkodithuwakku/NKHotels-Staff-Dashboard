import { NextRequest, NextResponse } from "next/server";
import { readServerSession } from "../../lib/serverSession";

export async function GET(request: NextRequest) {
  const session = readServerSession(request);

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    name: session.name,
    access: session.access,
  });
}
