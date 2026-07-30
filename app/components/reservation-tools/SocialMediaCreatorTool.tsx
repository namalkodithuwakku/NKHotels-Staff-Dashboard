"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Clipboard, Download, ImagePlus, Layers3, Megaphone, RefreshCw, Sparkles, TriangleAlert, Upload, X } from "lucide-react";

type Property = { id: string; client_code: string; property_name: string; city?: string; country?: string; description?: string };
type Creative = { headline: string; subheadline: string; offerLabel: string; cta: string; caption: string; hashtags: string[]; factWarnings: string[] };
type Result = { property: Property & { website_url?: string }; creative: Creative };
type SizeKey = "portrait" | "square" | "story" | "landscape";
type LayoutKey = "editorial" | "offer" | "minimal" | "frame" | "split" | "story";

type Template = { id: string; name: string; family: string; layout: LayoutKey; align: "left" | "center"; inverse?: boolean };
type Theme = { id: string; name: string; primary: string; accent: string; ink: string; pale: string };

const postTypes = [
  "Room showcase", "Property introduction", "Special offer", "Seasonal promotion",
  "Last-minute availability", "Dining or restaurant", "Pool or facility",
  "Experience or attraction", "Guest review or testimonial", "Event or wedding",
  "Direct booking benefit", "Travel tip or destination", "Festive greeting",
  "Recruitment", "General brand awareness",
];
const objectives = ["Drive direct enquiries", "Build brand awareness", "Fill selected dates", "Promote an offer", "Increase engagement", "Showcase an experience"];
const tones = ["Warm and premium", "Elegant and calm", "Friendly and welcoming", "Energetic and bright", "Family friendly", "Urgent but tasteful"];
const sizes: Record<SizeKey, { label: string; short: string; width: number; height: number }> = {
  portrait: { label: "Portrait · 1080 × 1350", short: "Portrait", width: 1080, height: 1350 },
  square: { label: "Square · 1080 × 1080", short: "Square", width: 1080, height: 1080 },
  story: { label: "Story · 1080 × 1920", short: "Story", width: 1080, height: 1920 },
  landscape: { label: "Landscape · 1200 × 630", short: "Landscape", width: 1200, height: 630 },
};
const templates: Template[] = [
  { id: "editorial-left", name: "Editorial", family: "Luxury", layout: "editorial", align: "left" },
  { id: "editorial-center", name: "Editorial Centre", family: "Luxury", layout: "editorial", align: "center" },
  { id: "offer-bold", name: "Offer Spotlight", family: "Promotion", layout: "offer", align: "left" },
  { id: "offer-clean", name: "Clean Offer", family: "Promotion", layout: "offer", align: "center" },
  { id: "minimal-air", name: "Minimal Air", family: "Brand", layout: "minimal", align: "left" },
  { id: "minimal-centre", name: "Minimal Centre", family: "Brand", layout: "minimal", align: "center" },
  { id: "framed-stay", name: "Framed Stay", family: "Rooms", layout: "frame", align: "left" },
  { id: "framed-luxury", name: "Framed Luxury", family: "Rooms", layout: "frame", align: "center" },
  { id: "split-story", name: "Split Story", family: "Experience", layout: "split", align: "left" },
  { id: "split-offer", name: "Split Offer", family: "Experience", layout: "split", align: "center" },
  { id: "story-card", name: "Story Card", family: "Social", layout: "story", align: "left" },
  { id: "story-glass", name: "Glass Story", family: "Social", layout: "story", align: "center" },
];
const themes: Theme[] = [
  { id: "ocean", name: "Ocean Blue", primary: "#0d6178", accent: "#58c7d8", ink: "#092f3c", pale: "#e9f8fa" },
  { id: "tropical", name: "Tropical Green", primary: "#087b67", accent: "#56c596", ink: "#0b3b34", pale: "#eaf8f2" },
  { id: "sunset", name: "Sunset Amber", primary: "#d8780b", accent: "#ffc75b", ink: "#442609", pale: "#fff5df" },
  { id: "charcoal", name: "Luxury Charcoal", primary: "#202a31", accent: "#d9aa55", ink: "#13191d", pale: "#f4efe6" },
  { id: "burgundy", name: "Boutique Burgundy", primary: "#782d48", accent: "#e3a6b8", ink: "#3b1421", pale: "#fbedf1" },
  { id: "sand", name: "Sand & Teal", primary: "#137b7c", accent: "#e8b96d", ink: "#174445", pale: "#faf1df" },
];

async function payload(response: Response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : {}; }
  catch { return { error: `The service returned an unreadable response (HTTP ${response.status}).` }; }
}
function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = source;
  });
}
function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill: string) {
  context.fillStyle = fill; context.beginPath(); context.roundRect(x, y, width, height, radius); context.fill();
}
function drawWrappedText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number, align: CanvasTextAlign = "left") {
  const words = String(text || "").split(/\s+/).filter(Boolean), lines: string[] = []; let line = "";
  words.forEach(word => {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || !line) line = candidate;
    else { lines.push(line); line = word; }
  });
  if (line) lines.push(line);
  const visible = lines.slice(0, maxLines);
  if (lines.length > maxLines && visible.length) {
    while (visible[maxLines - 1] && context.measureText(`${visible[maxLines - 1]}…`).width > maxWidth) {
      visible[maxLines - 1] = visible[maxLines - 1].split(" ").slice(0, -1).join(" ");
    }
    visible[maxLines - 1] += "…";
  }
  context.textAlign = align; visible.forEach((item, index) => context.fillText(item, x, y + index * lineHeight));
  return y + visible.length * lineHeight;
}
function coverGeometry(image: HTMLImageElement, width: number, height: number, zoom: number, xPosition: number, yPosition: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight) * zoom;
  const drawWidth = image.naturalWidth * scale, drawHeight = image.naturalHeight * scale;
  return { x: (width - drawWidth) * (xPosition / 100), y: (height - drawHeight) * (yPosition / 100), width: drawWidth, height: drawHeight };
}

export default function SocialMediaCreatorTool() {
  const [properties, setProperties] = useState<Property[]>([]), [propertyId, setPropertyId] = useState("");
  const [postType, setPostType] = useState(postTypes[0]), [objective, setObjective] = useState(objectives[0]);
  const [tone, setTone] = useState(tones[0]), [language, setLanguage] = useState("English");
  const [size, setSize] = useState<SizeKey>("portrait"), [ingredients, setIngredients] = useState("");
  const [templateId, setTemplateId] = useState(templates[0].id), [themeId, setThemeId] = useState(themes[0].id);
  const [zoom, setZoom] = useState(1), [photoX, setPhotoX] = useState(50), [photoY, setPhotoY] = useState(50);
  const [overlay, setOverlay] = useState(68), [contactLine, setContactLine] = useState("");
  const [photo, setPhoto] = useState<File | null>(null), [preview, setPreview] = useState("");
  const [logo, setLogo] = useState<File | null>(null), [logoPreview, setLogoPreview] = useState("");
  const [design, setDesign] = useState(""), [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false), [rendering, setRendering] = useState(false);
  const [error, setError] = useState(""), [copied, setCopied] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null), logoRef = useRef<HTMLInputElement>(null);
  const property = useMemo(() => properties.find(item => item.id === propertyId), [properties, propertyId]);
  const template = useMemo(() => templates.find(item => item.id === templateId) || templates[0], [templateId]);
  const theme = useMemo(() => themes.find(item => item.id === themeId) || themes[0], [themeId]);

  useEffect(() => {
    fetch("/api/reservation-tools/social-media", { cache: "no-store" }).then(async response => {
      const data = await payload(response);
      if (!response.ok) throw new Error(data.error || "Unable to load properties.");
      setProperties(data.properties || []); setPropertyId(data.properties?.[0]?.id || "");
    }).catch(reason => setError(reason instanceof Error ? reason.message : "Unable to load properties."));
  }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); if (logoPreview) URL.revokeObjectURL(logoPreview); }, [preview, logoPreview]);

  function chooseAsset(event: ChangeEvent<HTMLInputElement>, kind: "photo" | "logo") {
    const file = event.target.files?.[0]; if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choose a JPG, PNG or WebP image.");
    if (file.size > 12 * 1024 * 1024) return setError("The image must be smaller than 12 MB.");
    const url = URL.createObjectURL(file);
    if (kind === "photo") {
      if (preview) URL.revokeObjectURL(preview);
      setPhoto(file); setPreview(url); setZoom(1); setPhotoX(50); setPhotoY(50);
    } else {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      setLogo(file); setLogoPreview(url);
    }
    setDesign(""); setError("");
  }

  const renderPoster = useCallback(async (data: Result, source: string) => {
    const image = await loadImage(source), logoImage = logoPreview ? await loadImage(logoPreview) : null;
    const { width, height } = sizes[size], canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d"); if (!context) throw new Error("This browser cannot prepare the design.");
    const pad = Math.round(Math.min(width, height) * .065), isWide = width / height > 1.35;
    const headlineSize = isWide ? 58 : size === "story" ? 86 : 72, bodySize = isWide ? 27 : 31;
    const geo = coverGeometry(image, width, height, zoom, photoX, photoY);
    context.fillStyle = theme.pale; context.fillRect(0, 0, width, height);

    if (template.layout === "split") {
      const photoWidth = template.align === "left" ? width * .58 : width * .54;
      context.save(); context.beginPath(); context.rect(0, 0, photoWidth, height); context.clip();
      context.drawImage(image, geo.x, geo.y, geo.width, geo.height); context.restore();
      context.fillStyle = theme.pale; context.fillRect(photoWidth, 0, width - photoWidth, height);
    } else if (template.layout === "frame") {
      context.fillStyle = theme.pale; context.fillRect(0, 0, width, height);
      context.save(); context.beginPath(); context.roundRect(pad, pad, width - pad * 2, height * .61, 32); context.clip();
      const frameGeo = coverGeometry(image, width - pad * 2, height * .61, zoom, photoX, photoY);
      context.drawImage(image, pad + frameGeo.x, pad + frameGeo.y, frameGeo.width, frameGeo.height); context.restore();
    } else {
      context.drawImage(image, geo.x, geo.y, geo.width, geo.height);
    }

    if (["editorial", "offer", "story"].includes(template.layout)) {
      const gradient = context.createLinearGradient(0, height * .12, 0, height);
      gradient.addColorStop(0, `rgba(5,24,31,${Math.max(0, overlay - 48) / 100})`);
      gradient.addColorStop(.48, `rgba(5,24,31,${Math.max(5, overlay - 42) / 100})`);
      gradient.addColorStop(1, `rgba(5,24,31,${overlay / 100})`);
      context.fillStyle = gradient; context.fillRect(0, 0, width, height);
    }
    if (template.layout === "minimal") {
      context.fillStyle = `rgba(255,255,255,${Math.min(92, overlay + 12) / 100})`;
      const boxWidth = template.align === "center" ? width * .78 : width * .67;
      roundedRect(context, template.align === "center" ? (width - boxWidth) / 2 : pad, height * .56, boxWidth, height * .35, 28, context.fillStyle as string);
    }
    if (template.layout === "story") {
      roundedRect(context, pad, height * .55, width - pad * 2, height * .34, 35, `rgba(255,255,255,${Math.min(92, overlay + 12) / 100})`);
    }

    const lightText = ["editorial", "offer"].includes(template.layout);
    const cardText = ["minimal", "frame", "split", "story"].includes(template.layout);
    const ink = lightText ? "#ffffff" : theme.ink;
    const align: CanvasTextAlign = template.align;
    const textX = template.layout === "split"
      ? width * .62
      : template.align === "center" ? width / 2 : pad;
    const maxWidth = template.layout === "split"
      ? width * .32
      : template.align === "center" ? width - pad * 2.6 : width - pad * 2;
    let top = template.layout === "frame" ? height * .73
      : template.layout === "split" ? height * .27
      : template.layout === "minimal" || template.layout === "story" ? height * .64
      : isWide ? height * .42 : height * .59;

    context.textAlign = align; context.textBaseline = "alphabetic";
    const pillText = (data.creative.offerLabel || postType).toUpperCase().slice(0, 25);
    context.font = "800 22px Arial";
    const pillWidth = Math.min(maxWidth, context.measureText(pillText).width + 44);
    const pillX = align === "center" ? textX - pillWidth / 2 : textX;
    roundedRect(context, pillX, top - 53, pillWidth, 43, 22, theme.accent);
    context.fillStyle = theme.ink; context.textAlign = "center"; context.textBaseline = "middle";
    context.fillText(pillText, pillX + pillWidth / 2, top - 31);

    context.textAlign = align; context.textBaseline = "alphabetic"; context.fillStyle = ink;
    context.font = `${template.layout === "editorial" ? "700" : "800"} ${headlineSize}px Georgia, serif`;
    const end = drawWrappedText(context, data.creative.headline, textX, top + headlineSize, maxWidth, headlineSize * 1.05, isWide ? 2 : 3, align);
    context.fillStyle = lightText ? "rgba(255,255,255,.88)" : theme.primary;
    context.font = `600 ${bodySize}px Arial`;
    drawWrappedText(context, data.creative.subheadline, textX, end + 18, maxWidth, bodySize * 1.35, 2, align);

    const footerY = height - pad;
    if (!cardText || template.layout === "frame") {
      context.fillStyle = lightText ? "#fff" : theme.ink; context.font = "800 29px Arial"; context.textAlign = "left";
      context.fillText(data.property.property_name, pad, footerY - 38);
      context.fillStyle = lightText ? "rgba(255,255,255,.72)" : theme.primary; context.font = "500 21px Arial";
      context.fillText([data.property.city, data.property.country].filter(Boolean).join(", ") || "Sri Lanka", pad, footerY - 5);
    }
    if (template.layout === "split") {
      context.fillStyle = theme.ink; context.font = "800 27px Arial"; context.textAlign = "left";
      context.fillText(data.property.property_name, width * .62, footerY - 65);
    }

    if (logoImage) {
      const maxLogoWidth = width * .19, maxLogoHeight = 75;
      const logoScale = Math.min(maxLogoWidth / logoImage.naturalWidth, maxLogoHeight / logoImage.naturalHeight);
      const logoWidth = logoImage.naturalWidth * logoScale, logoHeight = logoImage.naturalHeight * logoScale;
      roundedRect(context, pad - 10, pad - 10, logoWidth + 20, logoHeight + 20, 14, "rgba(255,255,255,.90)");
      context.drawImage(logoImage, pad, pad, logoWidth, logoHeight);
    } else {
      context.fillStyle = lightText ? "#fff" : theme.ink; context.font = "900 25px Arial"; context.textAlign = "left";
      context.fillText(data.property.property_name, pad, pad + 20);
    }

    const ctaText = data.creative.cta || "Book now";
    context.font = "800 23px Arial"; const ctaWidth = Math.max(190, context.measureText(ctaText).width + 56);
    const ctaX = width - pad - ctaWidth, ctaY = footerY - 65;
    roundedRect(context, ctaX, ctaY, ctaWidth, 58, 29, theme.primary);
    context.fillStyle = "#fff"; context.textAlign = "center"; context.textBaseline = "middle";
    context.fillText(ctaText, ctaX + ctaWidth / 2, ctaY + 29);
    if (contactLine.trim()) {
      context.fillStyle = lightText ? "rgba(255,255,255,.78)" : theme.primary; context.font = "600 18px Arial"; context.textAlign = "right"; context.textBaseline = "alphabetic";
      context.fillText(contactLine.trim().slice(0, 68), width - pad, ctaY - 13);
    }
    return canvas.toDataURL("image/png", .95);
  }, [contactLine, logoPreview, overlay, photoX, photoY, postType, size, template, theme, zoom]);

  useEffect(() => {
    if (!result || !preview) return;
    let cancelled = false; setRendering(true);
    const timer = window.setTimeout(() => {
      renderPoster(result, preview).then(value => { if (!cancelled) setDesign(value); })
        .catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to update the design."); })
        .finally(() => { if (!cancelled) setRendering(false); });
    }, 120);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [result, preview, renderPoster]);

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
      const data = await payload(response); if (!response.ok) throw new Error(data.error || "Unable to create this post.");
      setResult(data);
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
      <div><small>PROPERTY-AWARE CREATIVE STUDIO</small><h2>Social Media Creator</h2><p>Professional hotel content built from verified details, real photography and exact-text premium templates.</p></div>
      <Megaphone size={35}/>
    </header>
    <div className="social-creator-layout">
      <section className="social-creator-form">
        <header><span>01</span><div><h3>Creative brief</h3><p>Define the property, campaign and approved message.</p></div></header>
        <div className="social-form-grid">
          <label className="wide"><span>Hotel</span><select value={propertyId} onChange={event => setPropertyId(event.target.value)}>{properties.map(item => <option key={item.id} value={item.id}>{item.property_name} · {item.client_code}</option>)}</select></label>
          <label><span>Post type</span><select value={postType} onChange={event => setPostType(event.target.value)}>{postTypes.map(value => <option key={value}>{value}</option>)}</select></label>
          <label><span>Objective</span><select value={objective} onChange={event => setObjective(event.target.value)}>{objectives.map(value => <option key={value}>{value}</option>)}</select></label>
          <label><span>Tone</span><select value={tone} onChange={event => setTone(event.target.value)}>{tones.map(value => <option key={value}>{value}</option>)}</select></label>
          <label><span>Language</span><select value={language} onChange={event => setLanguage(event.target.value)}>{["English","Sinhala","Tamil"].map(value => <option key={value}>{value}</option>)}</select></label>
          <label className="wide"><span>Required ingredients</span><textarea value={ingredients} onChange={event => setIngredients(event.target.value)} placeholder="Approved offer, validity dates, inclusions, audience and booking instruction…"/><small>Only add confirmed facts. Unsupported claims are flagged before publishing.</small></label>
        </div>

        <header><span>02</span><div><h3>Photography & brand</h3><p>Use the real hotel photo, optional logo and public contact line.</p></div></header>
        <div className="social-assets">
          <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={event => chooseAsset(event, "photo")}/>
          <input ref={logoRef} type="file" accept="image/png,image/webp,image/jpeg" hidden onChange={event => chooseAsset(event, "logo")}/>
          {!preview ? <button type="button" className="social-photo-drop" onClick={() => photoRef.current?.click()}><ImagePlus/><strong>Upload hotel photo</strong><span>JPG, PNG or WebP · maximum 12 MB</span></button> :
            <div className="social-photo-preview"><img src={preview} alt="Selected hotel"/><div><strong>{photo?.name}</strong><span>{photo ? `${(photo.size / 1024 / 1024).toFixed(1)} MB` : ""}</span></div><button type="button" onClick={() => { setPhoto(null); setPreview(""); setDesign(""); }} aria-label="Remove photo"><X/></button></div>}
          {!logoPreview ? <button type="button" className="social-logo-upload" onClick={() => logoRef.current?.click()}><Upload size={17}/><span><strong>Add hotel logo</strong><small>Optional transparent PNG works best</small></span></button> :
            <div className="social-logo-upload has-logo"><img src={logoPreview} alt="Hotel logo"/><span><strong>{logo?.name}</strong><small>Logo ready</small></span><button type="button" onClick={() => { setLogo(null); setLogoPreview(""); }}><X size={16}/></button></div>}
          <label className="social-contact-line"><span>Public contact line</span><input value={contactLine} onChange={event => setContactLine(event.target.value)} placeholder="WhatsApp 07X XXX XXXX · hotelwebsite.com"/></label>
        </div>

        <header><span>03</span><div><h3>Design direction</h3><p>Choose a professional layout, brand palette and export size.</p></div></header>
        <div className="social-template-gallery">{templates.map(item => <button type="button" key={item.id} className={templateId === item.id ? "active" : ""} onClick={() => setTemplateId(item.id)}>
          <i className={`template-thumb layout-${item.layout}`}><b/><em/><span/></i><strong>{item.name}</strong><small>{item.family}</small>
        </button>)}</div>
        <div className="social-theme-row">{themes.map(item => <button type="button" key={item.id} title={item.name} className={themeId === item.id ? "active" : ""} onClick={() => setThemeId(item.id)} style={{ "--theme-primary": item.primary, "--theme-accent": item.accent } as React.CSSProperties}><i/><span>{item.name}</span></button>)}</div>
        <div className="social-size-picker">{(Object.keys(sizes) as SizeKey[]).map(key => <button type="button" className={size === key ? "active" : ""} key={key} onClick={() => setSize(key)}><strong>{sizes[key].short}</strong><small>{sizes[key].width} × {sizes[key].height}</small></button>)}</div>

        {preview && <div className="social-photo-controls">
          <label><span>Photo zoom <b>{Math.round(zoom * 100)}%</b></span><input type="range" min="1" max="1.8" step=".02" value={zoom} onChange={event => setZoom(Number(event.target.value))}/></label>
          <label><span>Horizontal focus <b>{photoX}%</b></span><input type="range" min="0" max="100" value={photoX} onChange={event => setPhotoX(Number(event.target.value))}/></label>
          <label><span>Vertical focus <b>{photoY}%</b></span><input type="range" min="0" max="100" value={photoY} onChange={event => setPhotoY(Number(event.target.value))}/></label>
          <label><span>Overlay strength <b>{overlay}%</b></span><input type="range" min="35" max="88" value={overlay} onChange={event => setOverlay(Number(event.target.value))}/></label>
        </div>}
        {property && <div className="social-property-note"><Check size={16}/><span>Using the verified profile for <strong>{property.property_name}</strong>{property.city ? ` in ${property.city}` : ""}.</span></div>}
        {error && <div className="social-creator-error"><TriangleAlert size={18}/>{error}</div>}
        <button className="social-create-button" onClick={createPost} disabled={loading || !propertyId}><Sparkles size={19}/>{loading ? "Creating caption & design…" : result ? "Regenerate content" : "Create caption & design"}</button>
      </section>

      <section className="social-result-panel">
        {!result && !loading && <div className="social-result-empty"><Layers3/><h3>Premium creative preview</h3><p>Complete the brief and upload a real hotel photo. Your selected template, palette and format will appear here.</p></div>}
        {loading && <div className="social-result-empty social-loading"><i/><h3>Building your campaign</h3><p>Checking property facts, writing the content and balancing the selected design.</p></div>}
        {result && <div className="social-result">
          <div className={`social-design-preview ${rendering ? "rendering" : ""}`}>{design ? <img src={design} alt={`${result.property.property_name} social media design`}/> : <RefreshCw className="social-render-spinner"/>}</div>
          <div className="social-live-note"><Check size={15}/><span>Template, colour, crop and size changes update this preview automatically.</span></div>
          <div className="social-result-actions">
            <a href={design || undefined} aria-disabled={!design} download={`${result.property.property_name.replace(/\W+/g, "-").toLowerCase()}-${postType.replace(/\W+/g, "-").toLowerCase()}-${size}.png`}><Download size={17}/>Download PNG</a>
            <button onClick={copyCaption}>{copied ? <Check size={17}/> : <Clipboard size={17}/>} {copied ? "Copied" : "Copy caption"}</button>
          </div>
          <article className="social-caption"><small>READY-TO-POST CAPTION</small><p>{result.creative.caption}</p><div>{result.creative.hashtags.map(tag => <span key={tag}>{tag.startsWith("#") ? tag : `#${tag.replace(/\s/g, "")}`}</span>)}</div></article>
          {result.creative.factWarnings.length > 0 && <aside className="social-fact-warning"><TriangleAlert size={18}/><div><strong>Check before publishing</strong>{result.creative.factWarnings.map(item => <p key={item}>{item}</p>)}</div></aside>}
        </div>}
      </section>
    </div>
  </section>;
}
