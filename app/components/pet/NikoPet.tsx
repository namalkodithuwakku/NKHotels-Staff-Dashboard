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
  interactions: { used: number; unlimited: boolean };
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
type NikoFood = "apple" | "pineapple" | "banana" | "mango" | "watermelon" | "carrot";

const nikoFoods: Array<{ value: NikoFood; label: string; icon: string }> = [
  { value: "apple", label: "Apple", icon: "🍎" },
  { value: "pineapple", label: "Pineapple", icon: "🍍" },
  { value: "banana", label: "Banana", icon: "🍌" },
  { value: "mango", label: "Mango", icon: "🥭" },
  { value: "watermelon", label: "Watermelon", icon: "🍉" },
  { value: "carrot", label: "Carrot", icon: "🥕" },
];

function NikoSnack({ food }: { food: NikoFood }) {
  if (food === "pineapple") return <g><path d="M184 101 L208 101 L205 126 Q196 134 187 126Z" fill="#f2b632"/><path d="M186 103 L206 123 M206 103 L187 123 M196 101 V129" stroke="#d38a14" strokeWidth="2"/><path d="M196 101 l-10 -10 M196 101 l1 -14 M197 101 l10 -11" stroke="#3f9a62" strokeWidth="5" strokeLinecap="round"/></g>;
  if (food === "banana") return <path d="M181 104 Q190 132 214 113 Q199 141 181 121 Q176 113 181 104Z" fill="#f2cf45" stroke="#d6a72b" strokeWidth="2"/>;
  if (food === "mango") return <g><ellipse cx="196" cy="113" rx="13" ry="17" fill="#f19b31" transform="rotate(20 196 113)"/><path d="M195 97 Q204 88 211 94" fill="none" stroke="#3f9a62" strokeWidth="5" strokeLinecap="round"/></g>;
  if (food === "watermelon") return <g><path d="M179 104 Q196 136 214 104Z" fill="#ef6372" stroke="#3f9a62" strokeWidth="5"/><circle cx="190" cy="113" r="1.5" fill="#3b3b3b"/><circle cx="201" cy="117" r="1.5" fill="#3b3b3b"/></g>;
  if (food === "carrot") return <g><path d="M187 101 L211 107 L190 132Z" fill="#ee8a2c"/><path d="M188 102 l-8 -10 M190 102 l1 -13 M192 103 l9 -10" stroke="#409a63" strokeWidth="5" strokeLinecap="round"/></g>;
  return <g><circle cx="196" cy="109" r="13" fill="#e45d52"/><path d="M196 96 Q200 85 209 88" fill="none" stroke="#38946b" strokeWidth="5" strokeLinecap="round"/></g>;
}

function NikoIllustration({ accessory, celebrating, motion, food }: {
  accessory: string;
  celebrating: boolean;
  motion: NikoMotion;
  food: NikoFood;
}) {
  return <svg className={`niko-svg ${celebrating ? "celebrating" : ""} ${motion ? `motion-${motion}` : ""}`} viewBox="0 0 240 220" role="img" aria-label="Niko the NKH team elephant">
    <defs>
      <linearGradient id="niko-body" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#a5e4ed"/><stop offset=".45" stopColor="#76c4dc"/><stop offset="1" stopColor="#4385b3"/>
      </linearGradient>
      <linearGradient id="niko-ear" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#b9e6ec"/><stop offset="1" stopColor="#72b9d0"/>
      </linearGradient>
      <linearGradient id="niko-belly" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#d9f4f3" stopOpacity=".82"/><stop offset="1" stopColor="#9fd9e4" stopOpacity=".42"/>
      </linearGradient>
      <linearGradient id="niko-vest" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#244b62"/><stop offset="1" stopColor="#102f41"/>
      </linearGradient>
      <radialGradient id="niko-eye" cx="35%" cy="30%" r="70%">
        <stop offset="0" stopColor="#74c9e4"/><stop offset=".48" stopColor="#28769d"/><stop offset="1" stopColor="#12384c"/>
      </radialGradient>
      <filter id="niko-shadow"><feDropShadow dx="0" dy="8" stdDeviation="7" floodColor="#163e52" floodOpacity=".18"/></filter>
      <filter id="niko-soft-glow"><feDropShadow dx="0" dy="0" stdDeviation="2.2" floodColor="#ffd078" floodOpacity=".55"/></filter>
    </defs>
    <ellipse className="niko-ground" cx="122" cy="199" rx="75" ry="13" fill="#163e52" opacity=".1"/>
    <g className="niko-character" filter="url(#niko-shadow)">
      <path className="niko-tail" d="M178 136 Q205 131 204 154" fill="none" stroke="#4b8db8" strokeWidth="9" strokeLinecap="round"/>
      <circle className="niko-tail-tip" cx="204" cy="157" r="7" fill="#3478a5"/>
      <ellipse className="niko-body" cx="124" cy="143" rx="61" ry="52" fill="url(#niko-body)"/>
      <ellipse className="niko-belly" cx="124" cy="151" rx="37" ry="39" fill="url(#niko-belly)"/>
      <g className="niko-vest">
        <path d="M91 112 Q104 119 124 120 Q145 119 158 111 L168 157 Q149 176 124 177 Q98 176 80 157Z" fill="url(#niko-vest)" opacity=".94"/>
        <path d="M91 113 L119 132 L105 146 L84 122Z" fill="#fff" opacity=".94"/>
        <path d="M157 113 L129 132 L143 146 L164 122Z" fill="#fff" opacity=".94"/>
        <path d="M119 131 L124 139 L129 131 L124 121Z" fill="#ef930e"/>
        <circle cx="124" cy="153" r="2.2" fill="#f7b340"/><circle cx="124" cy="164" r="2.2" fill="#f7b340"/>
        <g className="niko-badge"><rect x="139" y="143" width="20" height="13" rx="4" fill="#f4a321"/><text x="149" y="152.4" textAnchor="middle" fontSize="5.5" fontWeight="900" fill="#15384a">NKH</text></g>
      </g>
      <g className="niko-arm niko-arm-left"><path d="M81 128 Q58 137 65 160" fill="none" stroke="#67acd0" strokeWidth="18" strokeLinecap="round"/><circle cx="67" cy="161" r="10" fill="#70b7d7"/></g>
      <g className="niko-arm niko-arm-right"><path d="M166 127 Q187 137 181 158" fill="none" stroke="#4b90ba" strokeWidth="18" strokeLinecap="round"/><circle cx="180" cy="160" r="10" fill="#579bc3"/></g>
      <g className="niko-leg niko-leg-left"><rect x="79" y="163" width="29" height="38" rx="14" fill="#5799c0"/><path d="M86 193 v5 M94 192 v6 M102 193 v5" stroke="#d8f0f1" strokeWidth="2" strokeLinecap="round" opacity=".8"/></g>
      <g className="niko-leg niko-leg-right"><rect x="141" y="163" width="29" height="38" rx="14" fill="#4785b2"/><path d="M148 193 v5 M156 192 v6 M164 193 v5" stroke="#d8f0f1" strokeWidth="2" strokeLinecap="round" opacity=".75"/></g>
      <ellipse className="niko-ear niko-ear-left" cx="73" cy="86" rx="34" ry="42" fill="url(#niko-ear)" transform="rotate(-18 73 86)"/>
      <ellipse className="niko-ear niko-ear-right" cx="166" cy="84" rx="34" ry="42" fill="url(#niko-ear)" transform="rotate(18 166 84)"/>
      <g className="niko-head">
      <path d="M67 89 C67 48 88 30 121 29 C156 28 177 51 176 88 C175 119 155 139 122 140 C89 140 68 120 67 89Z" fill="url(#niko-body)"/>
      <ellipse cx="84" cy="93" rx="18" ry="26" fill="#d5f0f1" opacity=".5"/>
      <ellipse cx="159" cy="91" rx="18" ry="26" fill="#d5f0f1" opacity=".44"/>
      <path d="M79 51 Q121 26 165 53" fill="none" stroke="#d6f5f5" strokeWidth="7" strokeLinecap="round" opacity=".3"/>
      <g className="niko-eyes">
        <g className="niko-eye niko-eye-left"><ellipse cx="100" cy="79" rx="11" ry="13" fill="#fff"/><ellipse className="niko-pupil" cx="102" cy="81" rx="6.5" ry="8" fill="url(#niko-eye)"/><ellipse cx="104" cy="77" rx="2.3" ry="3" fill="#fff"/><circle cx="99" cy="84" r="1.2" fill="#9ce4ed"/></g>
        <g className="niko-eye niko-eye-right"><ellipse cx="143" cy="79" rx="11" ry="13" fill="#fff"/><ellipse className="niko-pupil" cx="145" cy="81" rx="6.5" ry="8" fill="url(#niko-eye)"/><ellipse cx="147" cy="77" rx="2.3" ry="3" fill="#fff"/><circle cx="142" cy="84" r="1.2" fill="#9ce4ed"/></g>
        <path className="niko-lashes" d="M89 71 l-5 -4 M154 71 l5 -4" stroke="#244e63" strokeWidth="2" strokeLinecap="round"/>
      </g>
      <path className="niko-brow niko-brow-left" d="M93 67 Q101 62 109 67" fill="none" stroke="#286782" strokeWidth="3" strokeLinecap="round"/>
      <path className="niko-brow niko-brow-right" d="M135 67 Q143 62 151 67" fill="none" stroke="#286782" strokeWidth="3" strokeLinecap="round"/>
      <path className="niko-trunk" d="M120 91 C118 124 115 151 132 158 C145 163 151 151 144 143" fill="none" stroke="#4b8db8" strokeWidth="20" strokeLinecap="round"/>
      <path className="niko-trunk-shine" d="M116 99 C115 116 114 132 119 142" fill="none" stroke="#a8deea" strokeWidth="4" strokeLinecap="round" opacity=".44"/>
      <g className="niko-mouth"><path className="niko-smile" d="M106 105 Q121 118 137 104" fill="none" stroke="#276d98" strokeWidth="3" strokeLinecap="round" opacity=".78"/><path className="niko-tusk niko-tusk-left" d="M108 105 q-4 10 5 12" fill="#fff" stroke="#d3e8eb" strokeWidth="1"/><path className="niko-tusk niko-tusk-right" d="M134 105 q4 10 -5 12" fill="#fff" stroke="#d3e8eb" strokeWidth="1"/></g>
      <circle cx="82" cy="104" r="7" fill="#f2a3a9" opacity=".35"/><circle cx="160" cy="103" r="7" fill="#f2a3a9" opacity=".3"/>
      <g className="niko-crown" filter="url(#niko-soft-glow)"><path d="M88 43 Q121 28 157 43" fill="none" stroke="#e79513" strokeWidth="3" strokeLinecap="round"/><circle cx="91" cy="42" r="6" fill="#ffad25"/><circle cx="106" cy="36" r="5" fill="#ffc052"/><circle cx="122" cy="33" r="6" fill="#f39a10"/><circle cx="139" cy="36" r="5" fill="#ffc052"/><circle cx="155" cy="42" r="6" fill="#ffad25"/></g>
      </g>
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
      <NikoSnack food={food}/>
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
  const [food, setFood] = useState<NikoFood>("apple");

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
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, food: action === "feed" ? food : undefined }),
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
  return <div className={`niko-pet ${compact ? "compact" : ""} ${open ? "open" : ""}`}>
    {!open && message && <div className="niko-speech">{message}</div>}
    {!open && <button className="niko-launcher" onClick={() => setOpen(true)} aria-label="Open Niko's corner">
      <NikoIllustration accessory={data.pet.accessory} celebrating={celebrating} motion={motion} food={food}/>
      <span className="niko-online"/>
    </button>}
    {open && <section className="niko-panel">
      <header><div><small>NKH TEAM PET</small><h3>{data.pet.name}’s Corner</h3></div><button onClick={() => setOpen(false)} aria-label="Close Niko"><X/></button></header>
      <div className="niko-scene"><NikoIllustration accessory={data.pet.accessory} celebrating={celebrating} motion={motion} food={food}/><div className="niko-panel-speech">{message || greeting}</div></div>
      <div className="niko-status">
        <div><span>Happiness</span><b>{data.pet.happiness}%</b><i><em style={{width:`${data.pet.happiness}%`}}/></i></div>
        <div><span>Energy</span><b>{data.pet.energy}%</b><i><em style={{width:`${data.pet.energy}%`}}/></i></div>
      </div>
      {error && <p className="niko-error">{error}</p>}
      <div className="niko-foods" aria-label="Choose Niko's snack">
        <span>Favourite snacks</span>
        <div>{nikoFoods.map(item => <button key={item.value} type="button" className={food === item.value ? "active" : ""} onClick={() => setFood(item.value)} title={item.label} aria-label={`Choose ${item.label}`}><b aria-hidden="true">{item.icon}</b><small>{item.label}</small></button>)}</div>
      </div>
      <div className="niko-actions">
        <button className={motion === "pat" ? "active" : ""} onClick={() => void interact("pat")} disabled={Boolean(busy)}><Hand/>Pat</button>
        <button className={motion === "feed" ? "active" : ""} onClick={() => void interact("feed")} disabled={Boolean(busy)}><Apple/>Feed {nikoFoods.find(item => item.value === food)?.icon}</button>
        <button className={motion === "wave" ? "active" : ""} onClick={() => void interact("wave")} disabled={Boolean(busy)}><Heart/>Wave</button>
      </div>
      <p className="niko-visits">Unlimited pats, snacks and waves — visit Niko whenever you like.</p>
      {data.canManage && <label className="niko-outfit"><span><Shirt/>Niko’s shared outfit</span><select value={data.pet.accessory} disabled={Boolean(busy)} onChange={event => void changeAccessory(event.target.value)}>
        {Object.entries(accessoryLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}
      </select></label>}
      <footer><Sparkles/><span>Mood: <strong>{data.pet.mood}</strong></span>{data.pet.last_interaction_by && <small>Last visit by {data.pet.last_interaction_by}</small>}</footer>
    </section>}
  </div>;
}
