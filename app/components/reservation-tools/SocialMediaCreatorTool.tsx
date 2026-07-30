"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Check, Clipboard, Download, ImagePlus, Megaphone, Sparkles, TriangleAlert, Upload, X } from "lucide-react";

type Property = { id: string; client_code: string; property_name: string; city?: string; country?: string; description?: string };
type Creative = { headline: string; subheadline: string; offerLabel: string; cta: string; caption: string; hashtags: string[]; factWarnings: string[] };
type Result = { property: Property & { website_url?: string }; creative: Creative };
type SizeKey = "portrait" | "square" | "story";

const postTypes = [
  "Room showcase", "Property introduction", "Special offer", "Seasonal promotion",
  "Last-minute availability", "Dining or restaurant", "Pool or facility",
  "Experience or attraction", "Guest review or testimonial", "Event or wedding",
  "Direct booking benefit", "Travel tip or destination", "Festive greeting",
  "Recruitment", "General brand awareness",
];
const objectives = ["Drive direct enquiries", "Build brand awareness", "Fill selected dates", "Promote an offer", "Increase engagement", "Showcase an experience"];
const tones = ["Warm and premium", "Elegant and calm", "Friendly and welcoming", "Energetic and bright", "Family friendly", "Urgent but tasteful"];
const sizes: Record<SizeKey, { label: string; width: number; height: number }> = {
  portrait: { label: "Portrait · 1080 × 1350", width: 1080, height: 1350 },
  square: { label: "Square · 1080 × 1080", width: 1080, height: 1080 },
  story: { label: "Story · 1080 × 1920", width: 1080, height: 1920 },
};

async function payload(response: Response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : {}; }
  catch { return { error: `The service returned an unreadable response (HTTP ${response.status}).` }; }
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

function drawWrappedText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  words.forEach(word => {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || !line) line = candidate;
    else { lines.push(line); line = word; }
  });
  if (line) lines.push(line);
  const visible = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    while (context.measureText(`${visible[maxLines - 1]}…`).width > maxWidth) {
      visible[maxLines - 1] = visible[maxLines - 1].split(" ").slice(0, -1).join(" ");
    }
    visible[maxLines - 1] += "…";
  }
  visible.forEach((item, index) => context.fillText(item, x, y + index * lineHeight));
  return y + visible.length * lineHeight;
}

export default function SocialMediaCreatorTool() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [postType, setPostType] = useState(postTypes[0]);
  const [objective, setObjective] = useState(objectives[0]);
  const [tone, setTone] = useState(tones[0]);
  const [language, setLanguage] = useState("English");
  const [size, setSize] = useState<SizeKey>("portrait");
  const [ingredients, setIngredients] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [design, setDesign] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const property = useMemo(() => properties.find(item => item.id === propertyId), [properties, propertyId]);

  useEffect(() => {
    fetch("/api/reservation-tools/social-media", { cache: "no-store" }).then(async response => {
      const data = await payload(response);
      if (!response.ok) throw new Error(data.error || "Unable to load properties.");
      setProperties(data.properties || []);
      setPropertyId(data.properties?.[0]?.id || "");
    }).catch(reason => setError(reason instanceof Error ? reason.message : "Unable to load properties."));
  }, []);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choose a JPG, PNG or WebP hotel photo.");
    if (file.size > 12 * 1024 * 1024) return setError("The photo must be smaller than 12 MB.");
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(file); setPreview(URL.createObjectURL(file)); setDesign(""); setError("");
  }

  async function renderPoster(data: Result, source: string) {
    const image = await loadImage(source);
    const { width, height } = sizes[size];
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser cannot prepare the design.");
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale, drawHeight = image.naturalHeight * scale;
    context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
    const gradient = context.createLinearGradient(0, height * .2, 0, height);
    gradient.addColorStop(0, "rgba(4,25,34,0.02)");
    gradient.addColorStop(.5, "rgba(4,25,34,0.12)");
    gradient.addColorStop(1, "rgba(4,25,34,0.94)");
    context.fillStyle = gradient; context.fillRect(0, 0, width, height);
    const pad = Math.round(width * .065);
    context.fillStyle = "#f59e0b";
    context.beginPath(); context.roundRect(pad, pad, Math.min(width * .38, 360), 58, 29); context.fill();
    context.fillStyle = "#102a35"; context.font = "800 25px Arial"; context.textBaseline = "middle";
    context.fillText((data.creative.offerLabel || postType).toUpperCase().slice(0, 24), pad + 24, pad + 30);
    const bottom = height - pad;
    context.textBaseline = "alphabetic";
    context.fillStyle = "#ffffff"; context.font = `800 ${size === "story" ? 84 : 72}px Arial`;
    const end = drawWrappedText(context, data.creative.headline, pad, bottom - (size === "story" ? 430 : 350), width - pad * 2, size === "story" ? 94 : 82, 3);
    context.fillStyle = "rgba(255,255,255,.9)"; context.font = `500 ${size === "story" ? 37 : 31}px Arial`;
    drawWrappedText(context, data.creative.subheadline, pad, end + 18, width - pad * 2, size === "story" ? 48 : 41, 2);
    context.fillStyle = "#ffffff"; context.font = "800 31px Arial";
    context.fillText(data.property.property_name, pad, bottom - 48);
    const location = [data.property.city, data.property.country].filter(Boolean).join(", ");
    context.fillStyle = "rgba(255,255,255,.72)"; context.font = "500 23px Arial";
    context.fillText(location || "Sri Lanka", pad, bottom - 12);
    context.fillStyle = "#22b99a";
    const ctaWidth = Math.max(210, context.measureText(data.creative.cta).width + 60);
    context.beginPath(); context.roundRect(width - pad - ctaWidth, bottom - 78, ctaWidth, 62, 31); context.fill();
    context.fillStyle = "#ffffff"; context.font = "800 24px Arial"; context.textAlign = "center"; context.textBaseline = "middle";
    context.fillText(data.creative.cta, width - pad - ctaWidth / 2, bottom - 47);
    context.textAlign = "left";
    return canvas.toDataURL("image/png", .94);
  }

  async function createPost() {
    if (!propertyId) return setError("Choose a property.");
    if (!photo || !preview) return setError("Upload one real hotel photo before creating the design.");
    if (!ingredients.trim()) return setError("Add the offer, dates, feature or message the post must communicate.");
    setLoading(true); setError(""); setResult(null); setDesign("");
    try {
      const response = await fetch("/api/reservation-tools/social-media", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, postType, objective, tone, language, ingredients }),
      });
      const data = await payload(response);
      if (!response.ok) throw new Error(data.error || "Unable to create this post.");
      setResult(data);
      setDesign(await renderPoster(data, preview));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to create this post."); }
    finally { setLoading(false); }
  }

  async function copyCaption() {
    if (!result) return;
    await navigator.clipboard.writeText(`${result.creative.caption}\n\n${result.creative.hashtags.map(tag => tag.startsWith("#") ? tag : `#${tag.replace(/\s/g, "")}`).join(" ")}`);
    setCopied(true); window.setTimeout(() => setCopied(false), 1800);
  }

  return <section className="social-creator">
    <header className="social-creator-hero">
      <div><small>PROPERTY-AWARE CREATIVE STUDIO</small><h2>Social Media Creator</h2><p>Turn a real hotel photo and verified property information into a polished post—without inventing facilities or offers.</p></div>
      <Megaphone size={35}/>
    </header>
    <div className="social-creator-layout">
      <section className="social-creator-form">
        <header><span>01</span><div><h3>Creative brief</h3><p>Tell the creator exactly what this post should achieve.</p></div></header>
        <div className="social-form-grid">
          <label className="wide"><span>Hotel</span><select value={propertyId} onChange={event => setPropertyId(event.target.value)}>{properties.map(item => <option key={item.id} value={item.id}>{item.property_name} · {item.client_code}</option>)}</select></label>
          <label><span>Post type</span><select value={postType} onChange={event => setPostType(event.target.value)}>{postTypes.map(value => <option key={value}>{value}</option>)}</select></label>
          <label><span>Objective</span><select value={objective} onChange={event => setObjective(event.target.value)}>{objectives.map(value => <option key={value}>{value}</option>)}</select></label>
          <label><span>Tone</span><select value={tone} onChange={event => setTone(event.target.value)}>{tones.map(value => <option key={value}>{value}</option>)}</select></label>
          <label><span>Language</span><select value={language} onChange={event => setLanguage(event.target.value)}>{["English","Sinhala","Tamil"].map(value => <option key={value}>{value}</option>)}</select></label>
          <label className="wide"><span>Post size</span><div className="social-size-picker">{(Object.keys(sizes) as SizeKey[]).map(key => <button type="button" className={size === key ? "active" : ""} key={key} onClick={() => setSize(key)}>{sizes[key].label}</button>)}</div></label>
          <label className="wide"><span>Required ingredients</span><textarea value={ingredients} onChange={event => setIngredients(event.target.value)} placeholder="Example: 15% direct-booking offer, valid 1–15 August, breakfast included, couples, WhatsApp us to reserve. Only enter approved facts."/><small>Include approved price, dates, benefits, audience and call to action. Unsupported claims will be flagged.</small></label>
        </div>
        <header><span>02</span><div><h3>Real hotel photo</h3><p>The original property remains recognisable; the dashboard adds a clean branded overlay.</p></div></header>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={choosePhoto}/>
        {!preview ? <button type="button" className="social-photo-drop" onClick={() => inputRef.current?.click()}><ImagePlus/><strong>Upload hotel photo</strong><span>JPG, PNG or WebP · maximum 12 MB</span></button> :
          <div className="social-photo-preview"><img src={preview} alt="Selected hotel"/><div><strong>{photo?.name}</strong><span>{photo ? `${(photo.size / 1024 / 1024).toFixed(1)} MB` : ""}</span></div><button type="button" onClick={() => { setPhoto(null); setPreview(""); setDesign(""); }} aria-label="Remove photo"><X/></button></div>}
        {property && <div className="social-property-note"><Check size={16}/><span>Using the verified profile for <strong>{property.property_name}</strong>{property.city ? ` in ${property.city}` : ""}.</span></div>}
        {error && <div className="social-creator-error"><TriangleAlert size={18}/>{error}</div>}
        <button className="social-create-button" onClick={createPost} disabled={loading || !propertyId}><Sparkles size={19}/>{loading ? "Creating caption & design…" : "Create caption & design"}</button>
      </section>
      <section className="social-result-panel">
        {!result && !loading && <div className="social-result-empty"><Upload/><h3>Your finished post appears here</h3><p>Upload a real property photo and complete the brief. The creator prepares the caption and exact-text visual together.</p></div>}
        {loading && <div className="social-result-empty social-loading"><i/><h3>Building your post</h3><p>Checking property facts, writing the caption and preparing the selected format.</p></div>}
        {result && design && <div className="social-result">
          <div className="social-design-preview"><img src={design} alt={`${result.property.property_name} social media design`}/></div>
          <div className="social-result-actions">
            <a href={design} download={`${result.property.property_name.replace(/\W+/g, "-").toLowerCase()}-${postType.replace(/\W+/g, "-").toLowerCase()}.png`}><Download size={17}/>Download PNG</a>
            <button onClick={copyCaption}>{copied ? <Check size={17}/> : <Clipboard size={17}/>} {copied ? "Copied" : "Copy caption"}</button>
          </div>
          <article className="social-caption"><small>READY-TO-POST CAPTION</small><p>{result.creative.caption}</p><div>{result.creative.hashtags.map(tag => <span key={tag}>{tag.startsWith("#") ? tag : `#${tag.replace(/\s/g, "")}`}</span>)}</div></article>
          {result.creative.factWarnings.length > 0 && <aside className="social-fact-warning"><TriangleAlert size={18}/><div><strong>Check before publishing</strong>{result.creative.factWarnings.map(item => <p key={item}>{item}</p>)}</div></aside>}
        </div>}
      </section>
    </div>
  </section>;
}
