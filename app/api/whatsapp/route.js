import { NextResponse } from "next/server";

export async function GET(request) {
  console.log("✅ GET webhook called");

  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    console.log("✅ Verification successful");
    return new Response(challenge, { status: 200 });
  }

  console.log("❌ Verification failed");
  return new Response("Verification failed", { status: 403 });
}

export async function POST(request) {
  console.log("========== POST START ==========");

  try {
    const body = await request.json();

    console.log("📩 RAW BODY");
    console.log(JSON.stringify(body, null, 2));

    return NextResponse.json({
      success: true,
      received: true,
    });
  } catch (err) {
    console.error("❌ POST ERROR");
    console.error(err);

    return NextResponse.json(
      {
        success: false,
        error: err.toString(),
      },
      { status: 500 }
    );
  }
}