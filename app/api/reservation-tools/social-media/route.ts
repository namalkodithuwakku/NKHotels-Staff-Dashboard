import { NextRequest, NextResponse } from "next/server";
import { isMasterSession, readServerSession } from "../../../lib/serverSession";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

type Property = {
  id: string;
  client_code: string;
  property_name: string;
  description?: string | null;
  city?: string | null;
  country?: string | null;
  website_url?: string | null;
  total_rooms?: number | null;
  preferred_language?: string | null;
};

const creativeSchema = {
  type: "object",
  properties: {
    headline: { type: "string" },
    subheadline: { type: "string" },
    offerLabel: { type: "string" },
    cta: { type: "string" },
    caption: { type: "string" },
    hashtags: { type: "array", items: { type: "string" } },
    factWarnings: { type: "array", items: { type: "string" } },
  },
  required: ["headline", "subheadline", "offerLabel", "cta", "caption", "hashtags", "factWarnings"],
  additionalProperties: false,
};

function outputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string") return payload.output_text;
  for (const item of (Array.isArray(payload.output) ? payload.output : []) as Array<Record<string, unknown>>) {
    for (const part of (Array.isArray(item.content) ? item.content : []) as Array<Record<string, unknown>>) {
      if (part.type === "output_text" && typeof part.text === "string") return part.text;
    }
  }
  throw new Error("The Social Media Creator returned no readable content.");
}

function safeJson(value: string) {
  const clean = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(clean); }
  catch { throw new Error("The AI returned incomplete social media content. Please try again."); }
}

export async function GET(request: NextRequest) {
  try {
    if (!isMasterSession(readServerSession(request))) {
      return NextResponse.json({ error: "Master access required." }, { status: 403 });
    }
    const properties = await supabaseAdmin<Property[]>(
      "nkh_properties?select=id,client_code,property_name,description,city,country,website_url,total_rooms,preferred_language&client_status=eq.Active&order=property_name",
    );
    return NextResponse.json({ success: true, properties });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load properties." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isMasterSession(readServerSession(request))) {
      return NextResponse.json({ error: "Master access required." }, { status: 403 });
    }
    const input = await request.json();
    const propertyId = String(input.propertyId || "").trim();
    const postType = String(input.postType || "").trim();
    const objective = String(input.objective || "").trim();
    const ingredients = String(input.ingredients || "").trim().slice(0, 3000);
    const tone = String(input.tone || "Warm and premium").trim();
    const language = String(input.language || "English").trim();
    if (!propertyId || !postType || !objective) {
      return NextResponse.json({ error: "Choose a property, post type and objective." }, { status: 400 });
    }
    const properties = await supabaseAdmin<Property[]>(
      `nkh_properties?select=*&id=eq.${encodeURIComponent(propertyId)}&limit=1`,
    );
    const property = properties[0];
    if (!property) return NextResponse.json({ error: "Property not found." }, { status: 404 });

    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is not configured in Vercel.");
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_SOCIAL_MODEL || "gpt-5.4-mini",
        store: false,
        reasoning: { effort: "low" },
        input: `You are the careful social media copywriter for NKH Dashboard. Create one polished hotel social post.
Use ONLY facts in the supplied property profile and staff ingredients. Never invent a facility, price, room feature, award, distance, contact detail, availability or offer. If a requested claim is unsupported, omit it and add a short fact warning.
The headline must be at most 7 words, subheadline at most 14 words, offer label at most 4 words and CTA at most 5 words. The caption should be natural, specific, ${language}, approximately 80–160 words, and end with an appropriate CTA. Avoid exaggerated claims and generic filler. Return 6–10 relevant hashtags without duplicates. Do not put hashtags inside the caption.
Creative request: ${JSON.stringify({ postType, objective, tone, language, ingredients })}
Verified property profile: ${JSON.stringify(property)}`,
        text: { format: { type: "json_schema", name: "nkh_social_creative", strict: true, schema: creativeSchema } },
      }),
    });
    const raw = await response.text();
    let payload: Record<string, unknown>;
    try { payload = JSON.parse(raw) as Record<string, unknown>; }
    catch { throw new Error(`AI service returned an unreadable response (HTTP ${response.status}).`); }
    if (!response.ok) {
      const apiError = payload.error as Record<string, unknown> | undefined;
      throw new Error(String(apiError?.message || `Social media creation failed (HTTP ${response.status}).`));
    }
    return NextResponse.json({
      success: true,
      property: {
        id: property.id,
        property_name: property.property_name,
        city: property.city,
        country: property.country,
        website_url: property.website_url,
      },
      creative: safeJson(outputText(payload)),
    });
  } catch (error) {
    console.error("Social media creator failed.", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create this post." }, { status: 500 });
  }
}
