import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { NextRequest, NextResponse } from "next/server";
import { isMasterSession, readServerSession } from "../../../../lib/serverSession";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
type Saved = { date_from: string; date_to: string; property_snapshot: Record<string, any>; metrics: Record<string, any>; recommendations: Array<Record<string, any>>; recommendation_source: string; created_at: string };
const navy = rgb(.055,.16,.22), teal = rgb(.02,.55,.58), amber = rgb(.96,.55,.06), green = rgb(.08,.58,.38);
const ink = rgb(.08,.14,.18), muted = rgb(.39,.47,.51), line = rgb(.86,.9,.91), pale = rgb(.95,.98,.98);
function clean(value: unknown) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
function clip(value: unknown, max: number) { const text = clean(value); return text.length > max ? `${text.slice(0,max-1)}…` : text; }
function wrap(value: unknown, font: PDFFont, size: number, width: number) {
  const rows: string[] = []; let row = "";
  clean(value).split(" ").filter(Boolean).forEach(word => { const next = row ? `${row} ${word}` : word; if (font.widthOfTextAtSize(next,size) <= width) row = next; else { if (row) rows.push(row); row = word; } });
  if (row) rows.push(row); return rows;
}
function drawWrap(page: PDFPage, value: unknown, x: number, y: number, width: number, font: PDFFont, size: number, max = 3, color = ink, lead = size + 2) {
  wrap(value,font,size,width).slice(0,max).forEach((row,index) => page.drawText(row,{x,y:y-index*lead,size,font,color}));
}
function label(page: PDFPage, value: string, x: number, y: number, bold: PDFFont) { page.drawText(value.toUpperCase(),{x,y,size:7,font:bold,color:teal}); }
function header(page: PDFPage, title: string, subtitle: string, bold: PDFFont, regular: PDFFont) {
  page.drawRectangle({x:0,y:795,width:595,height:47,color:navy});
  page.drawText("NKH DASHBOARD",{x:32,y:816,size:10,font:bold,color:rgb(1,1,1)});
  page.drawText(title,{x:32,y:758,size:22,font:bold,color:ink});
  page.drawText(subtitle,{x:32,y:740,size:8,font:regular,color:muted});
  page.drawLine({start:{x:32,y:726},end:{x:563,y:726},thickness:1,color:line});
}
function money(value: unknown, currency: unknown) { return `${clean(currency || "LKR")} ${Math.round(Number(value || 0)).toLocaleString()}`; }
function fileName(value: unknown) { return clean(value).replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"") || "hotel"; }

export async function GET(request: NextRequest) {
  try {
    if (!isMasterSession(readServerSession(request))) return NextResponse.json({error:"Master access required."},{status:403});
    const id = request.nextUrl.searchParams.get("reportId") || "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({error:"Invalid report."},{status:400});
    const rows = await supabaseAdmin<Saved[]>(`nkh_occupancy_reports?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
    const saved = rows[0]; if (!saved) return NextResponse.json({error:"Report not found."},{status:404});
    const property = saved.property_snapshot || {}, metrics = saved.metrics || {}, name = clean(property.property_name || "Hotel");
    const pdf = await PDFDocument.create(); pdf.setTitle(`${name} Occupancy Analysis`); pdf.setAuthor("NKH Dashboard");
    const regular = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const p1 = pdf.addPage([595,842]);
    header(p1,"Occupancy Analysis",`${name}  |  ${saved.date_from} to ${saved.date_to}  |  ${metrics.nights || 0} stay dates`,bold,regular);
    const cards = [
      ["OCCUPANCY",`${metrics.occupancy || 0}%`],["SOLD / AVAILABLE",`${metrics.soldRoomNights || 0} / ${metrics.availableRoomNights || 0}`],
      ["RECORDED REVENUE",money(metrics.recordedRevenue,metrics.currency)],["ADR / REVPAR",`${money(metrics.adr,metrics.currency)} / ${money(metrics.revpar,metrics.currency)}`],
    ];
    cards.forEach((card,index)=>{const x=32+(index%2)*271,y=index<2?650:576;p1.drawRectangle({x,y,width:260,height:58,color:pale,borderColor:line,borderWidth:.7});label(p1,card[0],x+12,y+39,bold);p1.drawText(clip(card[1],38),{x:x+12,y:y+16,size:14,font:bold,color:ink});});
    label(p1,"INVENTORY QUALITY",32,550,bold);
    drawWrap(p1,`${metrics.inventory || 0} rooms · ${metrics.blockedRoomNights || 0} blocked room nights · ${metrics.pendingReservations || 0} pending reservations · ${metrics.cancelledGroups || 0} cancellations · ${metrics.revenueCoverage || 0}% revenue coverage`,32,533,531,regular,8.5,3);
    label(p1,"DAILY OCCUPANCY",32,494,bold);
    const daily = (metrics.daily || []) as Array<Record<string,any>>, step=Math.max(1,Math.ceil(daily.length/35)), shown=daily.filter((_,i)=>i%step===0||i===daily.length-1);
    shown.forEach((item,index)=>{const width=500/Math.max(1,shown.length),x=45+index*width,height=Math.max(2,Number(item.occupancy||0)*1.45);p1.drawRectangle({x,y:320,width:Math.max(2,width-2),height,color:Number(item.occupancy)>=80?green:Number(item.occupancy)>=50?teal:amber});});
    p1.drawLine({start:{x:32,y:320},end:{x:563,y:320},thickness:.7,color:line});
    p1.drawText(saved.date_from,{x:32,y:304,size:7,font:regular,color:muted});p1.drawText(saved.date_to,{x:505,y:304,size:7,font:regular,color:muted});
    const sections:Array<[string,Array<Record<string,any>>,string]>=[
      ["ROOM TYPES",metrics.roomTypes||[],"roomType"],["BOOKING SOURCES",metrics.sourceMix||[],"source"],["WEEKDAY PATTERN",metrics.weekdays||[],"weekday"],
    ];
    sections.forEach((section,column)=>{const x=32+column*179;label(p1,section[0],x,270,bold);section[1].slice(0,6).forEach((item,index)=>{const y=249-index*28;p1.drawText(clip(item[section[2]],24),{x,y,size:8,font:bold,color:ink});p1.drawText(`${item.occupancy ?? item.share ?? 0}%`,{x:x+128,y,size:8,font:bold,color:teal});p1.drawLine({start:{x,y:y-8},end:{x:x+160,y:y-8},thickness:.45,color:line});});});
    p1.drawText("Blocked rooms are removed from available inventory. Cancelled and pending bookings are not counted as occupied.",{x:32,y:24,size:6.7,font:regular,color:muted});

    const p2=pdf.addPage([595,842]);header(p2,"Top 10 Recommendations",`${name} · ${saved.recommendation_source === "ai" ? "AI-reviewed occupancy action plan" : "occupancy action plan"}`,bold,regular);
    (saved.recommendations||[]).slice().sort((a,b)=>Number(a.rank||99)-Number(b.rank||99)).slice(0,10).forEach((item,index)=>{
      const col=index<5?0:1,row=index%5,x=32+col*271,y=681-row*112;
      p2.drawRectangle({x,y,width:260,height:98,color:pale,borderColor:line,borderWidth:.65});
      p2.drawCircle({x:x+19,y:y+76,size:11,color:index===0?amber:teal});
      p2.drawText(String(item.rank||index+1),{x:x+(Number(item.rank||index+1)>9?13:16),y:y+73,size:7.5,font:bold,color:rgb(1,1,1)});
      p2.drawText(clip(item.title,34),{x:x+38,y:y+78,size:9,font:bold,color:ink});
      p2.drawText(`${clip(item.timeframe,15)} · ${clip(item.impact,7)} impact`,{x:x+38,y:y+64,size:6.7,font:bold,color:teal});
      drawWrap(p2,item.action,x+13,y+45,234,regular,7.4,2,ink,9);
      drawWrap(p2,item.reason,x+13,y+20,234,regular,6.5,2,muted,8);
    });
    p2.drawText(`Generated ${new Date(saved.created_at).toLocaleDateString("en-GB")} · NKH Dashboard · Internal management analysis`,{x:282,y:24,size:6.5,font:regular,color:muted});
    const bytes=await pdf.save();
    return new NextResponse(Buffer.from(bytes),{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="${fileName(name)}-occupancy-analysis.pdf"`,"Cache-Control":"private, no-store"}});
  } catch(error) {
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to create occupancy PDF."},{status:500});
  }
}
