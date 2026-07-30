import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { NextRequest, NextResponse } from "next/server";
import { isMasterSession, readServerSession } from "../../../../lib/serverSession";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

type SavedReport = {
  id: string; check_in: string; check_out: string; adults: number; rooms: number;
  property_snapshot: { property?: Record<string, unknown> }; report: Record<string, any>;
  sources: Array<{ title: string; url: string }>; created_at: string;
};

const navy = rgb(0.055, 0.16, 0.22), teal = rgb(0.02, 0.55, 0.58), amber = rgb(0.96, 0.55, 0.06);
const ink = rgb(0.08, 0.14, 0.18), muted = rgb(0.38, 0.46, 0.51), line = rgb(0.86, 0.9, 0.91), pale = rgb(0.95, 0.98, 0.98);

function text(value: unknown) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
function truncate(value: unknown, max: number) { const clean = text(value); return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean; }
function wrap(value: unknown, font: PDFFont, size: number, width: number) {
  const words = text(value).split(" ").filter(Boolean), lines: string[] = []; let current = "";
  words.forEach(word => {
    const trial = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(trial, size) <= width) current = trial;
    else { if (current) lines.push(current); current = word; }
  });
  if (current) lines.push(current);
  return lines;
}
function drawWrapped(page: PDFPage, value: unknown, x: number, y: number, width: number, font: PDFFont, size: number, color = ink, maxLines = 5, leading = size + 3) {
  const lines = wrap(value, font, size, width).slice(0, maxLines);
  lines.forEach((row, index) => page.drawText(index === maxLines - 1 && wrap(value, font, size, width).length > maxLines ? truncate(row, Math.max(8, row.length - 1)) : row, { x, y: y - index * leading, size, font, color }));
  return y - lines.length * leading;
}
function label(page: PDFPage, value: string, x: number, y: number, font: PDFFont) {
  page.drawText(value.toUpperCase(), { x, y, size: 7.2, font, color: teal });
}
function header(page: PDFPage, title: string, subtitle: string, bold: PDFFont, regular: PDFFont) {
  page.drawRectangle({ x: 0, y: 795, width: 595, height: 47, color: navy });
  page.drawText("NKH DASHBOARD", { x: 32, y: 816, size: 10, font: bold, color: rgb(1,1,1) });
  page.drawText(title, { x: 32, y: 758, size: 22, font: bold, color: ink });
  page.drawText(subtitle, { x: 32, y: 740, size: 8.5, font: regular, color: muted });
  page.drawLine({ start: { x: 32, y: 726 }, end: { x: 563, y: 726 }, thickness: 1, color: line });
}
function bulletList(page: PDFPage, items: unknown[], x: number, y: number, width: number, regular: PDFFont, max = 3) {
  let cursor = y;
  (items || []).slice(0, max).forEach(item => {
    page.drawCircle({ x: x + 3, y: cursor + 2, size: 1.8, color: amber });
    cursor = drawWrapped(page, item, x + 11, cursor + 5, width - 11, regular, 8.2, ink, 3, 10) - 4;
  });
  return cursor;
}
function safeFileName(value: unknown) { return text(value).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "hotel"; }

export async function GET(request: NextRequest) {
  try {
    if (!isMasterSession(readServerSession(request))) return NextResponse.json({ error: "Master access required." }, { status: 403 });
    const reportId = request.nextUrl.searchParams.get("reportId") || "";
    if (!/^[0-9a-f-]{36}$/i.test(reportId)) return NextResponse.json({ error: "Invalid report." }, { status: 400 });
    const rows = await supabaseAdmin<SavedReport[]>(`nkh_competitor_reports?select=*&id=eq.${encodeURIComponent(reportId)}&limit=1`);
    const saved = rows[0];
    if (!saved) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    const report = saved.report || {}, property = saved.property_snapshot?.property || {};
    const propertyName = text(property.property_name || "Hotel"), city = text(property.city || property.country || "");

    const pdf = await PDFDocument.create();
    pdf.setTitle(`${propertyName} Competitor Analysis`);
    pdf.setAuthor("NKH Dashboard");
    const regular = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const page1 = pdf.addPage([595, 842]);
    header(page1, "Competitor Analysis", `${propertyName}${city ? ` · ${city}` : ""}  |  ${saved.check_in} to ${saved.check_out}  |  ${saved.adults} guests · ${saved.rooms} room(s)`, bold, regular);

    const cards = [
      ["MARKET POSITION", text(report.marketPosition || "Unclear")],
      ["MARKET AVERAGE", report.marketAverageRate == null ? "Not verified" : `${text(report.rateCurrency)} ${Math.round(report.marketAverageRate).toLocaleString()}`],
      ["RECOMMENDED RANGE", report.recommendedRateMin == null ? "Evidence limited" : `${text(report.rateCurrency)} ${Math.round(report.recommendedRateMin).toLocaleString()}–${Math.round(report.recommendedRateMax || report.recommendedRateMin).toLocaleString()}`],
    ];
    cards.forEach((card, index) => {
      const x = 32 + index * 179;
      page1.drawRectangle({ x, y: 650, width: 167, height: 60, color: pale, borderColor: line, borderWidth: 0.7 });
      label(page1, card[0], x + 12, 690, bold);
      drawWrapped(page1, card[1], x + 12, 674, 143, bold, 11, ink, 2, 12);
    });
    label(page1, "EXECUTIVE SUMMARY", 32, 628, bold);
    drawWrapped(page1, report.executiveSummary, 32, 611, 531, regular, 9.1, ink, 5, 12);

    label(page1, "COMPARABLE HOTELS", 32, 548, bold);
    const columns = [32, 178, 263, 337, 462], widths = [136, 75, 64, 115, 101];
    ["HOTEL","PUBLIC RATE","REVIEW","STRONGEST EDGE","EVIDENCE"].forEach((value, index) => page1.drawText(value, { x: columns[index], y: 530, size: 7, font: bold, color: muted }));
    page1.drawLine({ start: { x: 32, y: 523 }, end: { x: 563, y: 523 }, thickness: 0.8, color: line });
    (report.competitors || []).slice(0, 7).forEach((competitor: Record<string, any>, index: number) => {
      const y = 497 - index * 43;
      page1.drawText(truncate(competitor.name, 27), { x: columns[0], y, size: 8.3, font: bold, color: ink });
      page1.drawText(truncate(`${competitor.location || ""} · ${competitor.propertyType || ""}`, 31), { x: columns[0], y: y - 12, size: 6.8, font: regular, color: muted });
      drawWrapped(page1, competitor.displayedRate == null ? "Not verified" : `${competitor.currency || report.rateCurrency || ""} ${Math.round(competitor.displayedRate).toLocaleString()}`, columns[1], y, widths[1], regular, 7.5, ink, 2, 9);
      page1.drawText(competitor.reviewScore == null ? "—" : truncate(competitor.reviewScore, 8), { x: columns[2], y, size: 8, font: regular, color: ink });
      drawWrapped(page1, competitor.strongestAdvantage, columns[3], y, widths[3], regular, 7.2, ink, 3, 9);
      page1.drawText(competitor.rateVerified ? "RATE VERIFIED" : truncate(competitor.confidence || "LOW", 14).toUpperCase(), { x: columns[4], y, size: 6.7, font: bold, color: competitor.rateVerified ? teal : amber });
      page1.drawLine({ start: { x: 32, y: y - 24 }, end: { x: 563, y: y - 24 }, thickness: 0.5, color: line });
    });
    label(page1, "THREE DECISIONS THAT MATTER", 32, 188, bold);
    bulletList(page1, report.keyFindings || [], 32, 169, 531, regular, 3);
    page1.drawText("Rates are public snapshots for the exact search criteria only when marked verified.", { x: 32, y: 24, size: 7, font: regular, color: muted });

    const page2 = pdf.addPage([595, 842]);
    header(page2, "Action Plan & SWOT", `${propertyName} · management summary`, bold, regular);
    const swot = report.swot || {};
    const boxes: Array<[string, unknown[], number, number]> = [
      ["Strengths", swot.strengths || [], 32, 620], ["Weaknesses", swot.weaknesses || [], 303, 620],
      ["Opportunities", swot.opportunities || [], 32, 478], ["Threats", swot.threats || [], 303, 478],
    ];
    boxes.forEach(([title, items, x, y]) => {
      page2.drawRectangle({ x, y, width: 260, height: 126, color: pale, borderColor: line, borderWidth: 0.7 });
      label(page2, title, x + 14, y + 103, bold);
      bulletList(page2, items, x + 14, y + 82, 230, regular, 3);
    });
    label(page2, "TOP 10 PRIORITIZED RECOMMENDATIONS", 32, 444, bold);
    (report.actions || []).slice().sort((a: Record<string, any>, b: Record<string, any>) => Number(a.rank || 99) - Number(b.rank || 99)).slice(0, 10).forEach((action: Record<string, any>, index: number) => {
      const column = index < 5 ? 0 : 1, row = index % 5;
      const x = column === 0 ? 32 : 303, y = 410 - row * 54;
      page2.drawRectangle({ x, y: y - 28, width: 260, height: 43, color: pale, borderColor: line, borderWidth: 0.6 });
      page2.drawCircle({ x: x + 17, y: y - 6, size: 10, color: index === 0 ? amber : teal });
      page2.drawText(String(action.rank || index + 1), { x: x + (Number(action.rank || index + 1) > 9 ? 11 : 14), y: y - 9, size: 7.5, font: bold, color: rgb(1,1,1) });
      page2.drawText(truncate(action.title, 31), { x: x + 34, y: y + 3, size: 8, font: bold, color: ink });
      page2.drawText(`${truncate(action.timeframe || "", 13)} · ${truncate(action.impact || "Medium", 7)} impact`, { x: x + 34, y: y - 7, size: 6.2, font: bold, color: teal });
      drawWrapped(page2, action.action, x + 34, y - 18, 216, regular, 6.5, ink, 2, 7.5);
    });
    label(page2, "CAUTIONS", 32, 145, bold);
    bulletList(page2, report.cautions || [], 32, 127, 531, regular, 3);
    const sources = (saved.sources || []).slice(0, 6);
    label(page2, "EVIDENCE SOURCES", 32, 76, bold);
    sources.forEach((source, index) => page2.drawText(`${index + 1}. ${truncate(source.title || source.url, 78)}`, { x: 32, y: 61 - index * 9, size: 6.4, font: regular, color: muted }));
    page2.drawText(`Generated ${new Date(saved.created_at).toLocaleDateString("en-GB")} · NKH Dashboard · Advisory report`, { x: 350, y: 24, size: 6.5, font: regular, color: muted });

    const bytes = await pdf.save();
    return new NextResponse(Buffer.from(bytes), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${safeFileName(propertyName)}-competitor-analysis.pdf"`, "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Competitor PDF failed.", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create PDF." }, { status: 500 });
  }
}
