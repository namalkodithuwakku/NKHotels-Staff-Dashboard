"use client";

import { useState } from "react";
import { BadgePercent, BarChart3, BedDouble, FileSearch, Megaphone, Plus, ScanSearch } from "lucide-react";
import OtaAuditTool from "./OtaAuditTool";
import RevenuePlannerTool from "./RevenuePlannerTool";
import SocialMediaCreatorTool from "./SocialMediaCreatorTool";
import OtaPromotionsTool from "./OtaPromotionsTool";
import CompetitorAnalysisTool from "./CompetitorAnalysisTool";
import OccupancyAnalysisTool from "./OccupancyAnalysisTool";

type ToolKey = "ota-audit" | "ota-promotions" | "competitor-analysis" | "occupancy-analysis" | "revenue-planner" | "social-creator";
const tools: Array<{ key: ToolKey; name: string; description: string; icon: typeof FileSearch }> = [
  { key: "ota-audit", name: "OTA Booking Audit", description: "Compare OTA exports with the property calendar.", icon: FileSearch },
  { key: "ota-promotions", name: "OTA Promotions", description: "Simulate valid Booking.com stacks and payout.", icon: BadgePercent },
  { key: "competitor-analysis", name: "Competitor Analysis", description: "Research comparable hotels, public rates and market position.", icon: ScanSearch },
  { key: "occupancy-analysis", name: "Occupancy Analysis", description: "Analyze room nights, sources, weak dates and revenue performance.", icon: BedDouble },
  { key: "revenue-planner", name: "AI Revenue Planner", description: "Create a destination-aware revenue action plan.", icon: BarChart3 },
  { key: "social-creator", name: "Social Media Creator", description: "Create truthful hotel posts from real property details and photos.", icon: Megaphone },
];

export default function ReservationToolsWorkspace() {
  const [activeTool, setActiveTool] = useState<ToolKey>("ota-audit");
  return <section className="nkh-tools">
    <header className="nkh-tools-header">
      <div><small>NKH OPERATIONS INTELLIGENCE</small><h2>NKH Tools</h2><p>Focused operational tools for reservations, revenue and future hotel workflows.</p></div>
      <span>{tools.length} tools available</span>
    </header>
    <nav className="nkh-tool-picker" aria-label="Choose NKH tool">
      {tools.map(tool => {
        const Icon = tool.icon;
        return <button key={tool.key} className={activeTool === tool.key ? "active" : ""} onClick={() => setActiveTool(tool.key)}>
          <i><Icon size={20}/></i><span><strong>{tool.name}</strong><small>{tool.description}</small></span>
        </button>;
      })}
      <button className="future-tool" disabled><i><Plus size={20}/></i><span><strong>More tools coming</strong><small>The tools library can expand without crowding the main menu.</small></span></button>
    </nav>
    <div className="nkh-tool-stage">
      {activeTool === "ota-audit" ? <OtaAuditTool/> : activeTool === "ota-promotions" ? <OtaPromotionsTool/> : activeTool === "competitor-analysis" ? <CompetitorAnalysisTool/> : activeTool === "occupancy-analysis" ? <OccupancyAnalysisTool/> : activeTool === "revenue-planner" ? <RevenuePlannerTool/> : <SocialMediaCreatorTool/>}
    </div>
  </section>;
}
