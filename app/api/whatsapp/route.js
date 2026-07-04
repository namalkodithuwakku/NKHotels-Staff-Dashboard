import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    console.log("✅ WhatsApp Webhook Verified");
    return new Response(challenge, { status: 200 });
  }

  return new Response("Verification failed", { status: 403 });
}

export async function POST(request) {
  try {

    const body = await request.json();

    console.log("================================================");
    console.log("📩 RAW META EVENT");
    console.log(JSON.stringify(body, null, 2));
    console.log("================================================");

    const value = body?.entry?.[0]?.changes?.[0]?.value;

    if (!value) {
      console.log("❌ No value object");

      return NextResponse.json({
        success: true,
        ignored: "No value"
      });
    }

    if (!value.messages || value.messages.length === 0) {
      console.log("❌ No incoming message");

      return NextResponse.json({
        success: true,
        ignored: "No message"
      });
    }

    const msg = value.messages[0];

    console.log("📨 Message Type:", msg.type);

    const payload = {
      phone: msg.from || "",

      message:
        msg.text?.body ||
        msg.button?.text ||
        msg.interactive?.button_reply?.title ||
        msg.interactive?.list_reply?.title ||
        "",

      messageId: msg.id || "",

      contextId: msg.context?.id || "",

      rawType: msg.type || "",

      timestamp: msg.timestamp || ""
    };

    console.log("============== PAYLOAD TO APPS SCRIPT ==============");
    console.log(JSON.stringify(payload, null, 2));
    console.log("====================================================");

    if (!process.env.GOOGLE_WEBAPP_URL) {

      console.error("❌ GOOGLE_WEBAPP_URL missing");

      return NextResponse.json({
        success: false,
        error: "GOOGLE_WEBAPP_URL missing"
      });

    }

    const response = await fetch(process.env.GOOGLE_WEBAPP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();

    console.log("================ APPS SCRIPT RESPONSE ================");
    console.log(responseText);
    console.log("======================================================");

    return NextResponse.json({
      success: true,
      forwarded: payload,
      appsScript: responseText
    });

  }
  catch (err) {

    console.error("❌ WEBHOOK ERROR");
    console.error(err);

    return NextResponse.json({
      success: false,
      error: err.toString()
    }, {
      status: 200
    });

  }
}