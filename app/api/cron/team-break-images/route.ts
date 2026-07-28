import { NextRequest, NextResponse } from "next/server";
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
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_TEAM_BREAK_IMAGE_MODEL || "gpt-image-1-mini",
      prompt: question.image_prompt || `Create a clean realistic hospitality training illustration for “${question.term}”. ${question.definition}. No text or logos.`,
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
  await supabaseAdmin(`nkh_hospitality_questions?id=eq.${question.id}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: {
      image_url: imageUrl,
      image_status: "Ready",
      image_generated_at: new Date().toISOString(),
      image_last_error: null,
    },
  });
  return { id: question.id, term: question.term, imageUrl };
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ success: false, error: "Cron authorization required." }, { status: 401 });
  const limit = Math.min(4, Math.max(1, Number(process.env.TEAM_BREAK_IMAGES_PER_DAY || 2)));
  const queue = await supabaseAdmin<ImageQuestion[]>(
    `nkh_hospitality_questions?select=id,slug,term,definition,category,image_prompt,image_attempts&active=eq.true&image_url=is.null&image_attempts=lt.3&order=image_attempts.asc,created_at.asc&limit=${limit}`
  );
  const generated: unknown[] = [];
  const errors: Array<{ id: string; term: string; error: string }> = [];
  for (const question of queue) {
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
  return NextResponse.json({ success: true, requested: queue.length, generated, errors });
}
