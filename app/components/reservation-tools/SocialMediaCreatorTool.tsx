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
  { id: "destination-editorial", name: "Destination Editorial", family: "Signature", layout: "editorial", align: "left" },
  { id: "luxury-stay", name: "Luxury Stay", family: "Signature", layout: "story", align: "center" },
  { id: "premium-offer", name: "Premium Offer", family: "Campaign", layout: "offer", align: "left" },
  { id: "room-collection", name: "Room Collection", family: "Rooms", layout: "frame", align: "center" },
  { id: "experience-feature", name: "Experience Feature", family: "Destination", layout: "split", align: "left" },
  { id: "boutique-minimal", name: "Boutique Minimal", family: "Brand", layout: "minimal", align: "center" },
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
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The selected photo or logo is no longer available. Please choose the image again."));
    image.src = source;
  });
}
function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill: string) {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.fillStyle = fill;
  context.beginPath();
  if (typeof context.roundRect === "function") {
    context.roundRect(x, y, width, height, safeRadius);
  } else {
    context.moveTo(x + safeRadius, y);
    context.lineTo(x + width - safeRadius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    context.lineTo(x + width, y + height - safeRadius);
    context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    context.lineTo(x + safeRadius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    context.lineTo(x, y + safeRadius);
    context.quadraticCurveTo(x, y, x + safeRadius, y);
  }
  context.closePath();
  context.fill();
}
function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = String(text || "").split(/\s+/).filter(Boolean), lines: string[] = []; let line = "";
  words.forEach(word => {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || !line) line = candidate;
    else { lines.push(line); line = word; }
  });
  if (line) lines.push(line);
  return lines;
}
function fitText(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number, startSize: number, minSize: number, family = "Georgia, serif", weight = 700) {
  for (let fontSize = startSize; fontSize >= minSize; fontSize -= 2) {
    context.font = `${weight} ${fontSize}px ${family}`;
    const lines = wrapText(context, text, maxWidth);
    if (lines.length <= maxLines) return { fontSize, lines, lineHeight: fontSize * 1.01 };
  }
  context.font = `${weight} ${minSize}px ${family}`;
  return { fontSize: minSize, lines: wrapText(context, text, maxWidth), lineHeight: minSize * 1.01 };
}
function drawLines(context: CanvasRenderingContext2D, lines: string[], x: number, y: number, lineHeight: number, align: CanvasTextAlign) {
  context.textAlign = align;
  lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}
function drawLotus(context: CanvasRenderingContext2D, centerX: number, centerY: number, scale: number, colour: string) {
  context.save(); context.translate(centerX, centerY); context.strokeStyle = colour; context.lineWidth = 2.4 * scale;
  [-2,-1,0,1,2].forEach(index => {
    context.save(); context.rotate(index * .38); context.beginPath();
    context.ellipse(0, -9 * scale, 5 * scale, 14 * scale, 0, 0, Math.PI * 2); context.stroke(); context.restore();
  });
  context.restore();
}
function drawOrnament(context: CanvasRenderingContext2D, width: number, height: number, colour: string) {
  context.save(); context.globalAlpha = .16; context.strokeStyle = colour; context.lineWidth = 2;
  const radius = Math.min(width, height) * .12;
  [[0, height], [width, height]].forEach(([x, y], side) => {
    for (let ring = 1; ring <= 4; ring++) {
      context.beginPath();
      context.arc(x, y, radius * ring / 4, side ? Math.PI : Math.PI * 1.5, side ? Math.PI * 1.5 : Math.PI * 2);
      context.stroke();
    }
  });
  context.restore();
}
function drawBrushTransition(context: CanvasRenderingContext2D, width: number, height: number, fill: string, direction: "left" | "bottom") {
  context.fillStyle = fill; context.beginPath();
  if (direction === "left") {
    context.moveTo(0, 0); context.lineTo(width * .48, 0);
    context.bezierCurveTo(width * .42, height * .15, width * .5, height * .3, width * .43, height * .46);
    context.bezierCurveTo(width * .36, height * .61, width * .5, height * .77, width * .39, height);
    context.lineTo(0, height);
  } else {
    context.moveTo(0, height * .73);
    context.bezierCurveTo(width * .2, height * .67, width * .37, height * .79, width * .55, height * .73);
    context.bezierCurveTo(width * .74, height * .66, width * .86, height * .77, width, height * .7);
    context.lineTo(width, height); context.lineTo(0, height);
  }
  context.closePath(); context.fill();
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
  const previewUrlRef = useRef(""), logoUrlRef = useRef("");
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
  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current);
  }, []);

  function chooseAsset(event: ChangeEvent<HTMLInputElement>, kind: "photo" | "logo") {
    const file = event.target.files?.[0]; if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choose a JPG, PNG or WebP image.");
    if (file.size > 12 * 1024 * 1024) return setError("The image must be smaller than 12 MB.");
    const url = URL.createObjectURL(file);
    if (kind === "photo") {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = url;
      setPhoto(file); setPreview(url); setZoom(1); setPhotoX(50); setPhotoY(50);
    } else {
      if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current);
      logoUrlRef.current = url;
      setLogo(file); setLogoPreview(url);
    }
    setDesign(""); setError("");
  }

  const renderPoster = useCallback(async (data: Result, source: string) => {
    const image = await loadImage(source), logoImage = logoPreview ? await loadImage(logoPreview) : null;
    const { width, height } = sizes[size], canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d") as CanvasRenderingContext2D; if (!context) throw new Error("This browser cannot prepare the design.");
    const pad = Math.round(Math.min(width, height) * .055), wide = width / height > 1.35;
    const geo = coverGeometry(image, width, height, zoom, photoX, photoY);
    const cream = "#f8f3e8", cleanWhite = "#fffdf8", location = [data.property.city, data.property.country].filter(Boolean).join(", ") || "Sri Lanka";
    const offerText = (data.creative.offerLabel || postType).toUpperCase().slice(0, 28);

    function drawPhotoFull() {
      context.drawImage(image, geo.x, geo.y, geo.width, geo.height);
    }
    function drawLogo(x: number, y: number, maxWidth = width * .2, maxHeight = 86, light = false, align: "left" | "right" = "left") {
      if (logoImage) {
        const scale = Math.min(maxWidth / logoImage.naturalWidth, maxHeight / logoImage.naturalHeight);
        const logoWidth = logoImage.naturalWidth * scale, logoHeight = logoImage.naturalHeight * scale;
        const logoX = align === "right" ? x - logoWidth : x;
        roundedRect(context, logoX - 12, y - 11, logoWidth + 24, logoHeight + 22, 14, "rgba(255,255,255,.90)");
        context.drawImage(logoImage, logoX, y, logoWidth, logoHeight);
      } else {
        context.fillStyle = light ? "#fff" : theme.ink; context.font = "800 25px Arial"; context.textAlign = align;
        context.fillText(data.property.property_name, x, y + 28);
      }
    }
    function drawOffer(x: number, y: number, light = false, align: CanvasTextAlign = "left") {
      context.font = "800 20px Arial"; const labelWidth = Math.min(width * .32, context.measureText(offerText).width + 42);
      const labelX = align === "center" ? x - labelWidth / 2 : x;
      roundedRect(context, labelX, y, labelWidth, 42, 21, light ? "rgba(255,255,255,.93)" : theme.accent);
      context.fillStyle = light ? theme.ink : theme.ink; context.textAlign = "center"; context.textBaseline = "middle";
      context.fillText(offerText, labelX + labelWidth / 2, y + 21);
    }
    function drawHeadline(x: number, y: number, maxWidth: number, colour: string, align: CanvasTextAlign = "left", maxLines = 3) {
      const fitted = fitText(context, data.creative.headline, maxWidth, maxLines, wide ? 66 : size === "story" ? 105 : 86, wide ? 40 : 48);
      context.fillStyle = colour; context.font = `700 ${fitted.fontSize}px Georgia, serif`; context.textBaseline = "alphabetic";
      return drawLines(context, fitted.lines, x, y, fitted.lineHeight, align);
    }
    function drawSupport(x: number, y: number, maxWidth: number, colour: string, align: CanvasTextAlign = "left") {
      const fitted = fitText(context, data.creative.subheadline, maxWidth, 3, wide ? 28 : 34, 20, "Arial", 600);
      context.fillStyle = colour; context.font = `600 ${fitted.fontSize}px Arial`;
      return drawLines(context, fitted.lines, x, y, fitted.lineHeight * 1.18, align);
    }
    function drawFooter(light = false, solid = false) {
      const footerHeight = wide ? 105 : Math.max(150, height * .13), footerY = height - footerHeight;
      if (solid) {
        context.fillStyle = cream; context.fillRect(0, footerY, width, footerHeight); drawOrnament(context, width, height, theme.primary);
      }
      const colour = light && !solid ? "#fff" : theme.ink;
      context.fillStyle = colour; context.font = `700 ${wide ? 27 : 31}px Georgia, serif`; context.textAlign = "left"; context.textBaseline = "alphabetic";
      context.fillText(data.property.property_name.toUpperCase(), pad, footerY + (wide ? 44 : 62));
      context.fillStyle = light && !solid ? "rgba(255,255,255,.78)" : theme.primary; context.font = `600 ${wide ? 18 : 21}px Arial`;
      context.fillText(contactLine.trim() || location, pad, footerY + (wide ? 75 : 99));
      const cta = data.creative.cta || "Enquire now"; context.font = "800 21px Arial";
      const ctaWidth = Math.min(width * .3, Math.max(180, context.measureText(cta).width + 52));
      roundedRect(context, width - pad - ctaWidth, footerY + (wide ? 25 : 42), ctaWidth, 54, 27, theme.primary);
      context.fillStyle = "#fff"; context.textAlign = "center"; context.textBaseline = "middle";
      context.fillText(cta, width - pad - ctaWidth / 2, footerY + (wide ? 52 : 69));
    }

    context.fillStyle = cream; context.fillRect(0, 0, width, height);
    if (template.layout === "editorial") {
      drawPhotoFull(); drawBrushTransition(context, width, height, cleanWhite, wide ? "left" : "bottom");
      drawOrnament(context, width, height, theme.accent);
      const textX = wide ? pad : width / 2, maxWidth = wide ? width * .43 : width * .78;
      const textTop = wide ? height * .2 : height * .075, align: CanvasTextAlign = wide ? "left" : "center";
      if (!wide) {
        context.strokeStyle = theme.accent; context.lineWidth = 3; context.beginPath(); context.moveTo(width * .16, textTop - 22); context.lineTo(width * .38, textTop - 22); context.stroke();
        drawLotus(context, width / 2, textTop - 22, 1.2, theme.accent);
        context.beginPath(); context.moveTo(width * .62, textTop - 22); context.lineTo(width * .84, textTop - 22); context.stroke();
      }
      drawOffer(textX, textTop, false, align);
      const end = drawHeadline(textX, textTop + (wide ? 96 : 105), maxWidth, theme.ink, align, wide ? 3 : 4);
      drawSupport(textX, end + 24, maxWidth * .9, theme.primary, align);
      drawLogo(wide ? width - pad : width - pad, pad, width * .19, 78, false, "right");
      drawFooter(false, true);
    } else if (template.layout === "offer") {
      drawPhotoFull();
      const gradient = context.createLinearGradient(0, 0, wide ? width * .68 : 0, wide ? 0 : height);
      gradient.addColorStop(0, `rgba(5,24,31,${overlay / 100})`); gradient.addColorStop(.58, `rgba(5,24,31,${Math.max(20,overlay - 18) / 100})`); gradient.addColorStop(1, "rgba(5,24,31,.08)");
      context.fillStyle = gradient; context.fillRect(0, 0, width, height);
      drawLogo(pad, pad, width * .2, 78, true);
      const contentY = wide ? height * .29 : height * .43, maxWidth = wide ? width * .52 : width - pad * 2;
      drawOffer(pad, contentY - 65, true);
      const end = drawHeadline(pad, contentY + (wide ? 58 : 76), maxWidth, "#fff", "left", wide ? 2 : 3);
      drawSupport(pad, end + 22, maxWidth * .9, "rgba(255,255,255,.88)");
      drawFooter(true);
    } else if (template.layout === "frame") {
      context.fillStyle = cream; context.fillRect(0, 0, width, height); drawOrnament(context, width, height, theme.accent);
      const photoHeight = wide ? height * .67 : height * .61;
      context.save(); context.beginPath(); context.roundRect(pad, pad, width - pad * 2, photoHeight, 28); context.clip();
      const framed = coverGeometry(image, width - pad * 2, photoHeight, zoom, photoX, photoY);
      context.drawImage(image, pad + framed.x, pad + framed.y, framed.width, framed.height); context.restore();
      drawLogo(pad + 18, pad + 18, width * .17, 70);
      const contentTop = photoHeight + pad + (wide ? 28 : 58);
      drawOffer(width / 2, contentTop - 46, false, "center");
      const end = drawHeadline(width / 2, contentTop + (wide ? 58 : 76), width * .78, theme.ink, "center", wide ? 1 : 2);
      if (!wide) drawSupport(width / 2, end + 15, width * .7, theme.primary, "center");
      drawFooter(false);
    } else if (template.layout === "split") {
      const photoWidth = wide ? width * .56 : width * .6;
      context.save(); context.beginPath(); context.rect(0, 0, photoWidth, height); context.clip(); drawPhotoFull(); context.restore();
      context.fillStyle = cream; context.fillRect(photoWidth, 0, width - photoWidth, height);
      context.save(); context.globalAlpha = .16; drawOrnament(context, width, height, theme.primary); context.restore();
      const x = photoWidth + (width - photoWidth) / 2, maxWidth = (width - photoWidth) * .78;
      drawLogo(width - pad, pad, width * .15, 70, false, "right");
      drawOffer(x, height * .24, false, "center");
      const end = drawHeadline(x, height * .34, maxWidth, theme.ink, "center", wide ? 3 : 4);
      drawSupport(x, end + 22, maxWidth, theme.primary, "center");
      drawFooter(false);
    } else if (template.layout === "minimal") {
      drawPhotoFull();
      const cardWidth = wide ? width * .44 : width * .78, cardHeight = wide ? height * .68 : height * .55;
      const cardX = wide ? pad : (width - cardWidth) / 2, cardY = wide ? (height - cardHeight) / 2 : height * .34;
      roundedRect(context, cardX, cardY, cardWidth, cardHeight, 34, `rgba(255,253,248,${Math.min(94,overlay + 17) / 100})`);
      const x = cardX + cardWidth / 2, maxWidth = cardWidth * .78;
      drawOffer(x, cardY + 48, false, "center");
      const end = drawHeadline(x, cardY + 145, maxWidth, theme.ink, "center", wide ? 2 : 3);
      drawSupport(x, end + 20, maxWidth, theme.primary, "center");
      drawLogo(width - pad, pad, width * .18, 75, true, "right"); drawFooter(false);
    } else {
      drawPhotoFull();
      const gradient = context.createLinearGradient(0, height * .25, 0, height);
      gradient.addColorStop(0, "rgba(4,20,27,0)"); gradient.addColorStop(1, `rgba(4,20,27,${overlay / 100})`);
      context.fillStyle = gradient; context.fillRect(0, 0, width, height);
      drawLogo(pad, pad, width * .19, 80, true);
      const cardY = wide ? height * .3 : height * .56;
      roundedRect(context, pad, cardY, wide ? width * .55 : width - pad * 2, wide ? height * .48 : height * .3, 32, "rgba(255,253,248,.91)");
      const x = wide ? pad * 1.7 : width / 2, align: CanvasTextAlign = wide ? "left" : "center", maxWidth = wide ? width * .44 : width * .76;
      drawOffer(x, cardY + 34, false, align);
      const end = drawHeadline(x, cardY + 132, maxWidth, theme.ink, align, wide ? 2 : 3);
      drawSupport(x, end + 18, maxWidth, theme.primary, align); drawFooter(true);
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
            <div className="social-photo-preview"><img src={preview} alt="Selected hotel"/><div><strong>{photo?.name}</strong><span>{photo ? `${(photo.size / 1024 / 1024).toFixed(1)} MB` : ""}</span></div><button type="button" onClick={() => { if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current); previewUrlRef.current = ""; setPhoto(null); setPreview(""); setDesign(""); }} aria-label="Remove photo"><X/></button></div>}
          {!logoPreview ? <button type="button" className="social-logo-upload" onClick={() => logoRef.current?.click()}><Upload size={17}/><span><strong>Add hotel logo</strong><small>Optional transparent PNG works best</small></span></button> :
            <div className="social-logo-upload has-logo"><img src={logoPreview} alt="Hotel logo"/><span><strong>{logo?.name}</strong><small>Logo ready</small></span><button type="button" onClick={() => { if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current); logoUrlRef.current = ""; setLogo(null); setLogoPreview(""); }}><X size={16}/></button></div>}
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
