import { NextRequest, NextResponse } from "next/server";
import { isMasterSession, readServerSession } from "../../lib/serverSession";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

type PetState = {
  id: number;
  name: string;
  mood: string;
  happiness: number;
  energy: number;
  accessory: string;
  enabled: boolean;
  last_interaction_by?: string | null;
  last_interaction_at?: string | null;
};

const accessories = ["none", "amber_scarf", "blue_cap", "flower_crown", "birthday_hat"];

function colomboDate() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

async function currentState() {
  const rows = await supabaseAdmin<PetState[]>(
    "nkh_team_pet_state?select=id,name,mood,happiness,energy,accessory,enabled,last_interaction_by,last_interaction_at&id=eq.1&limit=1"
  );
  if (rows[0]) return rows[0];
  const created = await supabaseAdmin<PetState[]>("nkh_team_pet_state", {
    method: "POST",
    prefer: "return=representation",
    body: { id: 1 },
  });
  return created[0];
}

async function personalCount(staffName: string, date: string) {
  const rows = await supabaseAdmin<Array<{ id: string }>>(
    `nkh_team_pet_interactions?select=id&interaction_date=eq.${date}&staff_name=ilike.${encodeURIComponent(staffName)}&limit=20`
  );
  return rows.length;
}

async function responseState(staffName: string) {
  const date = colomboDate();
  const [pet, used] = await Promise.all([currentState(), personalCount(staffName, date)]);
  return { success: true, pet, interactions: { used, limit: 3, remaining: Math.max(0, 3 - used) } };
}

export async function GET(request: NextRequest) {
  try {
    const session = readServerSession(request);
    if (!session) return NextResponse.json({ success: false, error: "Staff access required." }, { status: 401 });
    return NextResponse.json({ ...(await responseState(session.name)), canManage: isMasterSession(session) });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unable to load Niko.",
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = readServerSession(request);
    if (!session) return NextResponse.json({ success: false, error: "Staff access required." }, { status: 401 });
    const input = await request.json();
    const action = String(input.action || "");

    if (action === "accessory") {
      if (!isMasterSession(session)) {
        return NextResponse.json({ success: false, error: "Master access is required to change Niko’s outfit." }, { status: 403 });
      }
      const accessory = String(input.accessory || "");
      if (!accessories.includes(accessory)) {
        return NextResponse.json({ success: false, error: "Unknown Niko accessory." }, { status: 400 });
      }
      await supabaseAdmin("nkh_team_pet_state?id=eq.1", {
        method: "PATCH",
        prefer: "return=minimal",
        body: { accessory, updated_at: new Date().toISOString() },
      });
      return NextResponse.json({ ...(await responseState(session.name)), canManage: true, message: "Niko’s outfit was updated." });
    }

    if (!["pat", "feed", "wave"].includes(action)) {
      return NextResponse.json({ success: false, error: "Choose a Niko interaction." }, { status: 400 });
    }
    const date = colomboDate();
    const used = await personalCount(session.name, date);
    if (used >= 3) {
      return NextResponse.json({ success: false, error: "Niko has enjoyed your three visits today. Come back tomorrow!" }, { status: 429 });
    }
    const pet = await currentState();
    const changes = action === "feed"
      ? { happiness: 2, energy: 7, mood: "Content" }
      : action === "wave"
        ? { happiness: 3, energy: 0, mood: "Excited" }
        : { happiness: 4, energy: -1, mood: "Happy" };
    await supabaseAdmin("nkh_team_pet_interactions", {
      method: "POST",
      prefer: "return=minimal",
      body: { staff_name: session.name, action, interaction_date: date },
    });
    await supabaseAdmin("nkh_team_pet_state?id=eq.1", {
      method: "PATCH",
      prefer: "return=minimal",
      body: {
        happiness: Math.max(0, Math.min(100, Number(pet.happiness || 0) + changes.happiness)),
        energy: Math.max(0, Math.min(100, Number(pet.energy || 0) + changes.energy)),
        mood: changes.mood,
        last_interaction_by: session.name,
        last_interaction_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });
    const messages: Record<string, string> = {
      pat: `Niko enjoyed the gentle pat from ${session.name}.`,
      feed: `${session.name} gave Niko a healthy snack.`,
      wave: `Niko is waving back at ${session.name}!`,
    };
    return NextResponse.json({
      ...(await responseState(session.name)),
      canManage: isMasterSession(session),
      message: messages[action],
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unable to interact with Niko.",
    }, { status: 500 });
  }
}
