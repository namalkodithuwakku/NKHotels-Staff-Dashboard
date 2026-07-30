import { NextRequest, NextResponse } from "next/server";
import { isMasterSession, readServerSession } from "../../../lib/serverSession";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const maxDuration = 300;

type ImageQuestion = {
  id: string;
  slug: string;
  term: string;
  definition: string;
  category: string;
  image_prompt?: string | null;
  image_attempts: number;
  image_url?: string | null;
  image_status?: string;
};

function authorised(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

async function uploadImage(path: string, bytes: Uint8Array) {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment variables are not configured.");
  const headers: Record<string, string> = {
    apikey: key,
    "Content-Type": "image/webp",
    "x-upsert": "true",
  };
  if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
  const response = await fetch(`${url}/storage/v1/object/nkh-team-break/${path}`, {
    method: "POST",
    headers,
    body: Buffer.from(bytes),
  });
  if (!response.ok) throw new Error(`Supabase image upload failed (${response.status}): ${await response.text()}`);
  return `${url}/storage/v1/object/public/nkh-team-break/${path}`;
}

async function generate(question: ImageQuestion) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  await supabaseAdmin(`nkh_hospitality_questions?id=eq.${question.id}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: { image_status: "Generating", image_attempts: Number(question.image_attempts || 0) + 1, image_last_error: null },
  });
  const conceptPrompt = question.image_prompt || [
    "Create a friendly, relaxing, softly dimensional hospitality learning image for adult hotel staff.",
    `Show the concept “${question.term}”: ${question.definition}.`,
    "Use gentle blue, green, amber and neutral colours in a believable boutique hotel setting.",
    "Objects must remain normal and must never have eyes, mouths, faces, hands, arms or mascot personalities.",
    "No children, childish cartoon style, text, logos, watermarks or UI.",
  ].join(" ");
  const sriLankanStaffStandard = [
    "NKH Academy people standard:",
    "If people are useful for explaining the concept, depict pleasant adult Sri Lankan hospitality staff with natural Sri Lankan facial features and a realistic range of Sri Lankan skin tones.",
    "Give them warm, calm, professional expressions and believable working poses.",
    "Uniforms must follow polished international Western hotel standards appropriate to the role: tailored front-office suits, blazers, collared shirts, waistcoats, smart restaurant uniforms, chef uniforms, or neat housekeeping uniforms.",
    "Keep uniforms modern, modest, clean and premium, using coordinated neutral, navy, teal or warm accent colours.",
    "Do not use traditional costumes, ceremonial clothing, flags, exaggerated cultural styling, stereotypes, caricatures, or generic European-only staff appearance unless the learning concept specifically requires cultural attire.",
    "Do not force a person into an object-only concept.",
  ].join(" ");
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_TEAM_BREAK_IMAGE_MODEL || "gpt-image-1-mini",
      prompt: `${conceptPrompt} ${sriLankanStaffStandard}`,
      size: "1024x1024",
      quality: "low",
      output_format: "webp",
    }),
  });
  const payload = await response.json() as { data?: Array<{ b64_json?: string }>; error?: { message?: string } };
  if (!response.ok || !payload.data?.[0]?.b64_json) {
    throw new Error(payload.error?.message || `OpenAI image generation failed (${response.status}).`);
  }
  const imageUrl = await uploadImage(`hospitality/${question.slug}.webp`, Uint8Array.from(Buffer.from(payload.data[0].b64_json, "base64")));
  const versionedImageUrl = `${imageUrl}?v=${Date.now()}`;
  await supabaseAdmin(`nkh_hospitality_questions?id=eq.${question.id}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: {
      image_url: versionedImageUrl,
      image_status: "Ready",
      image_generated_at: new Date().toISOString(),
      image_last_error: null,
    },
  });
  return { id: question.id, term: question.term, imageUrl: versionedImageUrl };
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ success: false, error: "Cron authorization required." }, { status: 401 });
  const limit = Math.min(20, Math.max(1, Number(process.env.TEAM_BREAK_IMAGES_PER_DAY || 20)));
  const queue = await supabaseAdmin<ImageQuestion[]>(
    `nkh_hospitality_questions?select=id,slug,term,definition,category,image_prompt,image_attempts&active=eq.true&image_url=is.null&image_attempts=lt.3&order=image_attempts.asc,created_at.asc&limit=${limit}`
  );
  const generated: unknown[] = [];
  const errors: Array<{ id: string; term: string; error: string }> = [];
  let cursor = 0;
  async function worker() {
    while (cursor < queue.length) {
      const question = queue[cursor++];
      try {
        generated.push(await generate(question));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Image generation failed.";
        errors.push({ id: question.id, term: question.term, error: message });
        await supabaseAdmin(`nkh_hospitality_questions?id=eq.${question.id}`, {
          method: "PATCH",
          prefer: "return=minimal",
          body: { image_status: "Failed", image_last_error: message.slice(0, 500) },
        }).catch(() => undefined);
      }
    }
  }
  await Promise.all([worker(), worker()]);
  return NextResponse.json({ success: true, requested: queue.length, generated, errors });
}

export async function POST(request: NextRequest) {
  const session = readServerSession(request);
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Staff access required." },
      { status: 401 }
    );
  }

  try {
    const input = await request.json();
    const questionId = String(input.questionId || "").trim();
    const regenerate = input.regenerate === true;
    if (!questionId) {
      return NextResponse.json(
        { success: false, error: "Question ID is required." },
        { status: 400 }
      );
    }

    const rows = await supabaseAdmin<ImageQuestion[]>(
      `nkh_hospitality_questions?select=id,slug,term,definition,category,image_prompt,image_attempts,image_url,image_status&id=eq.${encodeURIComponent(questionId)}&active=eq.true&limit=1`
    );
    const question = rows[0];
    if (!question) {
      return NextResponse.json(
        { success: false, error: "Hospitality question was not found." },
        { status: 404 }
      );
    }
    if (regenerate && !isMasterSession(session)) {
      return NextResponse.json(
        { success: false, error: "Only Master can replace an existing Academy visual." },
        { status: 403 }
      );
    }
    if (question.image_url && !regenerate) {
      return NextResponse.json({
        success: true,
        alreadyReady: true,
        id: question.id,
        imageUrl: question.image_url,
      });
    }
    if (question.image_status === "Generating") {
      return NextResponse.json(
        { success: false, error: "This visual is already being prepared." },
        { status: 409 }
      );
    }

    if (regenerate) {
      await supabaseAdmin(`nkh_hospitality_questions?id=eq.${question.id}`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: { image_url: null, image_status: "Pending", image_attempts: 0, image_last_error: null },
      });
      question.image_attempts = 0;
      question.image_url = null;
      question.image_status = "Pending";
    }
    const result = await generate(question);
    return NextResponse.json({
      success: true,
      generatedBy: session.name,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate this visual.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
