import { NextResponse } from "next/server";

export async function GET(request) {
  console.log("✅ GET webhook called");

  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  console.log("GET params:", { mode, tokenReceived: !!token, challenge });

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    console.log("✅ WhatsApp webhook verification successful");
    return new Response(challenge, { status: 200 });
  }

  console.log("❌ WhatsApp webhook verification failed");
  return new Response("Verification failed", { status: 403 });
}

export async function POST(request) {
  console.log("🚀 POST webhook called");

  try {
    const body = await request.json();

    console.log("📩 RAW META EVENT");
    console.log(JSON.stringify(body, null, 2));

    const value = body?.entry?.[0]?.changes?.[0]?.value;

    if (!value) {
      console.log("⚠️ No value found");
      return NextResponse.json({ success: true, ignored: "No value" });
    }

    if (value.statuses?.length) {
      console.log("ℹ️ STATUS EVENT");
      console.log(JSON.stringify(value.statuses, null, 2));
      return NextResponse.json({ success: true, ignored: "Status event" });
    }

    if (!value.messages?.length) {
      console.log("⚠️ No message found");
      return NextResponse.json({ success: true, ignored: "No message" });
    }

    const results = [];

    for (const msg of value.messages) {
      const payload = {
        phone: msg.from || "",
        message:
          msg.text?.body ||
          msg.button?.text ||
          msg.button?.payload ||
          msg.interactive?.button_reply?.title ||
          msg.interactive?.button_reply?.id ||
          msg.interactive?.list_reply?.title ||
          msg.interactive?.list_reply?.id ||
          "",
        messageId: msg.id || "",
        contextId: msg.context?.id || "",
        rawType: msg.type || "",
        timestamp: msg.timestamp || "",
      };

      console.log("✅ PAYLOAD TO APPS SCRIPT");
      console.log(JSON.stringify(payload, null, 2));

      if (!process.env.GOOGLE_WEBAPP_URL) {
        console.log("❌ GOOGLE_WEBAPP_URL missing in Vercel env");
        results.push({ payload, error: "GOOGLE_WEBAPP_URL missing" });
        continue;
      }

      const response = await fetch(process.env.GOOGLE_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();

      console.log("📤 APPS SCRIPT RESPONSE");
      console.log(responseText);

      results.push({
        payload,
        status: response.status,
        response: responseText,
      });
    }

    return NextResponse.json({ success: true, results });
  } catch (err) {
    console.error("❌ WEBHOOK ERROR", err);

    return NextResponse.json(
      {
        success: false,
        error: err?.toString?.() || "Unknown error",
      },
      { status: 200 }
    );
  }
}