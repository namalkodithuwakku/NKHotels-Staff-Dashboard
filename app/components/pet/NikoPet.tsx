"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Apple, Hand, Heart, Shirt, Sparkles, X } from "lucide-react";

type PetPayload = {
  pet: {
    name: string;
    mood: string;
    happiness: number;
    energy: number;
    accessory: string;
    enabled: boolean;
    last_interaction_by?: string | null;
  };
  interactions: { used: number; limit: number; remaining: number };
  canManage: boolean;
  message?: string;
};

const accessoryLabels: Record<string, string> = {
  none: "No accessory",
  amber_scarf: "Amber scarf",
  blue_cap: "Blue staff cap",
  flower_crown: "Flower crown",
  birthday_hat: "Birthday hat",
};

async function parse(response: Response) {
  const value = await response.json();
  if (!response.ok || !value.success) throw new Error(value.error || "Niko is resting right now.");
  return value as PetPayload & { success: true };
}

type NikoMotion = "" | "pat" | "feed" | "wave";

function NikoIllustration({ accessory, celebrating, motion }: {
  accessory: string;
  celebrating: boolean;
  motion: NikoMotion;
}) {
  return <svg className={`niko-svg ${celebrating ? "celebrating" : ""} ${motion ? `motion-${motion}` : ""}`} viewBox="0 0 240 220" role="img" aria-label="Niko the NKH team elephant">
    <defs>
      <linearGradient id="niko-body" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#8fd5e4"/><stop offset="1" stopColor="#4e91bd"/>
      </linearGradient>
      <linearGradient id="niko-ear" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#b9e6ec"/><stop offset="1" stopColor="#72b9d0"/>
      </linearGradient>
      <filter id="niko-shadow"><feDropShadow dx="0" dy="8" stdDeviation="7" floodColor="#163e52" floodOpacity=".18"/></filter>
    </defs>
    <ellipse className="niko-ground" cx="122" cy="199" rx="75" ry="13" fill="#163e52" opacity=".1"/>
    <g className="niko-character" filter="url(#niko-shadow)">
      <path className="niko-tail" d="M178 136 Q205 131 204 154" fill="none" stroke="#4b8db8" strokeWidth="9" strokeLinecap="round"/>
      <circle className="niko-tail-tip" cx="204" cy="157" r="7" fill="#3478a5"/>
      <ellipse className="niko-body" cx="126" cy="139" rx="63" ry="53" fill="url(#niko-body)"/>
      <rect className="niko-leg niko-leg-left" x="79" y="163" width="25" height="37" rx="12" fill="#5799c0"/>
      <rect className="niko-leg niko-leg-right" x="145" y="163" width="25" height="37" rx="12" fill="#4785b2"/>
      <ellipse className="niko-ear niko-ear-left" cx="73" cy="86" rx="34" ry="42" fill="url(#niko-ear)" transform="rotate(-18 73 86)"/>
      <ellipse className="niko-ear niko-ear-right" cx="166" cy="84" rx="34" ry="42" fill="url(#niko-ear)" transform="rotate(18 166 84)"/>
      <circle cx="121" cy="88" r="55" fill="url(#niko-body)"/>
      <ellipse cx="82" cy="91" rx="18" ry="25" fill="#d5f0f1" opacity=".52"/>
      <ellipse cx="159" cy="89" rx="18" ry="25" fill="#d5f0f1" opacity=".44"/>
      <g className="niko-eyes">
        <ellipse cx="101" cy="80" rx="5" ry="6" fill="#15384a"/>
        <ellipse cx="143" cy="80" rx="5" ry="6" fill="#15384a"/>
        <circle cx="103" cy="78" r="1.5" fill="#fff"/><circle cx="145" cy="78" r="1.5" fill="#fff"/>
      </g>
      <path className="niko-brow niko-brow-left" d="M93 67 Q101 62 109 67" fill="none" stroke="#286782" strokeWidth="3" strokeLinecap="round"/>
      <path className="niko-brow niko-brow-right" d="M135 67 Q143 62 151 67" fill="none" stroke="#286782" strokeWidth="3" strokeLinecap="round"/>
      <path className="niko-trunk" d="M120 91 C118 124 115 151 132 158 C145 163 151 151 144 143" fill="none" stroke="#4b8db8" strokeWidth="20" strokeLinecap="round"/>
      <path className="niko-smile" d="M108 105 Q121 114 135 104" fill="none" stroke="#276d98" strokeWidth="3" strokeLinecap="round" opacity=".65"/>
      <circle cx="82" cy="104" r="7" fill="#f2a3a9" opacity=".35"/><circle cx="160" cy="103" r="7" fill="#f2a3a9" opacity=".3"/>
      {accessory === "amber_scarf" && <g className="niko-accessory"><path d="M77 125 Q123 147 171 124 L166 143 Q122 160 82 143Z" fill="#ed8a0a"/><path d="M145 141 L166 175 L146 169 L134 145Z" fill="#cf7000"/></g>}
      {accessory === "blue_cap" && <g className="niko-accessory"><path d="M86 45 Q121 16 157 46 L151 58 Q121 47 91 59Z" fill="#245f99"/><path d="M148 53 Q170 53 177 60 Q158 65 143 59Z" fill="#163e52"/><circle cx="122" cy="27" r="6" fill="#ed8a0a"/></g>}
      {accessory === "flower_crown" && <g className="niko-accessory">{[92,108,124,140,156].map((x,index)=><g key={x}><circle cx={x} cy={42 + Math.abs(2-index)*2} r="8" fill={index%2?"#67c5dd":"#f1a43a"}/><circle cx={x} cy={42 + Math.abs(2-index)*2} r="3" fill="#fff6d8"/></g>)}</g>}
      {accessory === "birthday_hat" && <g className="niko-accessory"><path d="M100 47 L124 2 L148 47Z" fill="#6d68bd"/><circle cx="124" cy="3" r="7" fill="#ed8a0a"/><path d="M106 34 L140 18" stroke="#67c5dd" strokeWidth="5"/></g>}
    </g>
    {motion === "pat" && <g className="niko-reaction-hearts">
      <path d="M53 74 C44 62 27 76 53 96 C79 76 62 62 53 74Z" fill="#ed7180"/>
      <path d="M191 61 C184 51 171 63 191 78 C211 63 198 51 191 61Z" fill="#f1a43a"/>
    </g>}
    {motion === "feed" && <g className="niko-reaction-snack">
      <circle cx="196" cy="109" r="13" fill="#e45d52"/><path d="M196 96 Q200 85 209 88" fill="none" stroke="#38946b" strokeWidth="5" strokeLinecap="round"/>
    </g>}
    {motion === "wave" && <g className="niko-reaction-wave">
      <path d="M193 66 Q208 54 216 69 M197 80 Q215 76 220 90" fill="none" stroke="#ed8a0a" strokeWidth="5" strokeLinecap="round"/>
    </g>}
    {celebrating && <g className="niko-confetti">
      <circle cx="34" cy="45" r="5" fill="#ed8a0a"/><rect x="194" y="42" width="9" height="9" rx="2" fill="#239a70"/>
      <path d="M30 120 l12 -8" stroke="#6d68bd" strokeWidth="6"/><path d="M196 112 l12 8" stroke="#3478b9" strokeWidth="6"/>
      <circle cx="191" cy="160" r="4" fill="#dc5660"/>
    </g>}
  </svg>;
}

export default function NikoPet({ staffName, compact = false }: { staffName: string; compact?: boolean }) {
  const [data, setData] = useState<PetPayload | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [celebrating, setCelebrating] = useState(false);
  const [motion, setMotion] = useState<NikoMotion>("");

  const load = useCallback(async () => {
    try {
      setData(await parse(await fetch("/api/team-pet", { cache: "no-store" })));
    } catch (reason) {
      console.error("Niko refresh failed.", reason);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60000);
    const celebrate = (event: Event) => {
      const custom = event as CustomEvent<{ message?: string }>;
      setCelebrating(true);
      setMotion("wave");
      setMessage(custom.detail?.message || "That deserves a little celebration!");
      window.setTimeout(() => setCelebrating(false), 2200);
      window.setTimeout(() => setMotion(""), 2200);
      window.setTimeout(() => setMessage(""), 4200);
    };
    window.addEventListener("nkh-pet-celebrate", celebrate);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("nkh-pet-celebrate", celebrate);
    };
  }, [load]);

  async function interact(action: "pat" | "feed" | "wave") {
    try {
      setBusy(action); setMotion(action); setError("");
      const next = await parse(await fetch("/api/team-pet", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      }));
      setData(next); setMessage(next.message || "Niko is happy to see you!");
      setCelebrating(true);
      window.setTimeout(() => setCelebrating(false), 1500);
      window.setTimeout(() => setMessage(""), 3500);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Niko is resting right now.");
    } finally {
      setBusy("");
      window.setTimeout(() => setMotion(""), 1700);
    }
  }

  async function changeAccessory(accessory: string) {
    try {
      setBusy("accessory"); setError("");
      const next = await parse(await fetch("/api/team-pet", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accessory", accessory }),
      }));
      setData(next); setMessage(next.message || "Niko’s new look is ready!");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update Niko’s outfit.");
    } finally { setBusy(""); }
  }

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 6) return "Niko is still a little sleepy.";
    if (hour < 12) return `Good morning, ${staffName}!`;
    if (hour < 17) return `Hope your day is going smoothly, ${staffName}.`;
    if (hour < 22) return `Good evening, ${staffName}!`;
    return "Niko is settling down for the night.";
  }, [staffName]);

  if (!data?.pet.enabled) return null;
  const remaining = data.interactions.remaining;

  return <div className={`niko-pet ${compact ? "compact" : ""} ${open ? "open" : ""}`}>
    {!open && message && <div className="niko-speech">{message}</div>}
    {!open && <button className="niko-launcher" onClick={() => setOpen(true)} aria-label="Open Niko's corner">
      <NikoIllustration accessory={data.pet.accessory} celebrating={celebrating} motion={motion}/>
      <span className="niko-online"/>
    </button>}
    {open && <section className="niko-panel">
      <header><div><small>NKH TEAM PET</small><h3>{data.pet.name}’s Corner</h3></div><button onClick={() => setOpen(false)} aria-label="Close Niko"><X/></button></header>
      <div className="niko-scene"><NikoIllustration accessory={data.pet.accessory} celebrating={celebrating} motion={motion}/><div className="niko-panel-speech">{message || greeting}</div></div>
      <div className="niko-status">
        <div><span>Happiness</span><b>{data.pet.happiness}%</b><i><em style={{width:`${data.pet.happiness}%`}}/></i></div>
        <div><span>Energy</span><b>{data.pet.energy}%</b><i><em style={{width:`${data.pet.energy}%`}}/></i></div>
      </div>
      {error && <p className="niko-error">{error}</p>}
      <div className="niko-actions">
        <button className={motion === "pat" ? "active" : ""} onClick={() => void interact("pat")} disabled={Boolean(busy)||remaining===0}><Hand/>Pat</button>
        <button className={motion === "feed" ? "active" : ""} onClick={() => void interact("feed")} disabled={Boolean(busy)||remaining===0}><Apple/>Feed</button>
        <button className={motion === "wave" ? "active" : ""} onClick={() => void interact("wave")} disabled={Boolean(busy)||remaining===0}><Heart/>Wave</button>
      </div>
      <p className="niko-visits">{remaining ? `${remaining} of your short visits remaining today` : "Niko has enjoyed your visits today. See you tomorrow!"}</p>
      {data.canManage && <label className="niko-outfit"><span><Shirt/>Niko’s shared outfit</span><select value={data.pet.accessory} disabled={Boolean(busy)} onChange={event => void changeAccessory(event.target.value)}>
        {Object.entries(accessoryLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}
      </select></label>}
      <footer><Sparkles/><span>Mood: <strong>{data.pet.mood}</strong></span>{data.pet.last_interaction_by && <small>Last visit by {data.pet.last_interaction_by}</small>}</footer>
    </section>}
  </div>;
}
