"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, CircleDollarSign, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";

type Property = { id: string; client_code: string; property_name: string };
type Day = { date: string; occupiedRooms: number; availableRooms: number; occupancyPercent: number; forecastOccupancy: number; level: string };
type Rate = { date: string; roomTypeId: string; roomType: string; baseRate: number; suggestedRate: number; changePercent: number; forecastOccupancy: number; demandLevel: string; reason: string };
type OtaAction = { date: string; action: string; scope: string; occupancy: number; priority: string };
type Dashboard = {
  currency: string;
  dataQuality: { pickupHistory: string; rateCoverage: number; forecastConfidence: string };
  pickup: Array<{ days: number; pickup: number | null; available: boolean }>;
  forecast: Day[];
  highDemandPeriods: Array<{ from: string; to: string; level: string; reason: string }>;
  lowDemandPeriods: Array<{ from: string; to: string; level: string; reason: string }>;
  rateSuggestions: Rate[];
  otaActions: OtaAction[];
};
type Payload = { properties: Property[]; metrics?: { inventory: number; averageOccupancy: number; bookedRevenue: number; currency: string }; dashboard?: Dashboard; error?: string };

function key(date: Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;}
function parse(value:string){const [y,m,d]=value.split("-").map(Number);return new Date(y,m-1,d,12);}
function monthKey(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;}
function shiftMonth(value:string,amount:number){const [y,m]=value.split("-").map(Number);return monthKey(new Date(y,m-1+amount,1,12));}
function monthRange(value:string){const [y,m]=value.split("-").map(Number);return {from:key(new Date(y,m-1,1,12)),to:key(new Date(y,m,0,12))};}
function monday(value:Date){const copy=new Date(value);const day=copy.getDay();copy.setDate(copy.getDate()-(day===0?6:day-1));return copy;}
function shiftDays(value:string,days:number){const date=parse(value);date.setDate(date.getDate()+days);return key(date);}
function niceDate(value:string){return parse(value).toLocaleDateString("en-GB",{day:"2-digit",month:"short"});}
function niceDay(value:string){return parse(value).toLocaleDateString("en-GB",{weekday:"short",day:"numeric"});}
function money(value:number,currency:string){return value?`${currency} ${value.toLocaleString()}`:"Setup rate";}

export default function RevenueDashboard(){
  const today=key(new Date()), [properties,setProperties]=useState<Property[]>([]), [propertyId,setPropertyId]=useState("");
  const [view,setView]=useState<"month"|"week">("month"), [month,setMonth]=useState(monthKey(new Date())), [weekStart,setWeekStart]=useState(key(monday(new Date())));
  const [data,setData]=useState<Payload|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState("");
  const [roomType,setRoomType]=useState("");
  const range=useMemo(()=>view==="month"?monthRange(month):{from:weekStart,to:shiftDays(weekStart,6)},[view,month,weekStart]);
  const load=useCallback(async()=>{
    if(!propertyId)return;
    setLoading(true);setError("");
    try{const response=await fetch(`/api/reservation-tools/revenue-plan?propertyId=${encodeURIComponent(propertyId)}&from=${range.from}&to=${range.to}`,{cache:"no-store"});const payload=await response.json();if(!response.ok)throw new Error(payload.error||"Unable to load revenue dashboard.");setData(payload);}
    catch(reason){setError(reason instanceof Error?reason.message:"Unable to load revenue dashboard.");}
    finally{setLoading(false);}
  },[propertyId,range.from,range.to]);
  useEffect(()=>{fetch("/api/reservation-tools/revenue-plan",{cache:"no-store"}).then(response=>response.json()).then((payload:Payload)=>{setProperties(payload.properties||[]);setPropertyId(payload.properties?.[0]?.id||"");}).catch(()=>setError("Unable to load properties."));},[]);
  useEffect(()=>{void load();},[load]);
  const dashboard=data?.dashboard, metrics=data?.metrics;
  const roomTypes=useMemo(()=>Array.from(new Map((dashboard?.rateSuggestions||[]).map(item=>[item.roomTypeId,item.roomType]))),[dashboard]);
  useEffect(()=>{if(roomTypes.length&&!roomTypes.some(([id])=>id===roomType))setRoomType(roomTypes[0][0]);},[roomTypes,roomType]);
  const dayRates=useMemo(()=>new Map((dashboard?.rateSuggestions||[]).filter(item=>item.roomTypeId===roomType).map(item=>[item.date,item])),[dashboard,roomType]);
  const pickup7=dashboard?.pickup.find(item=>item.days===7);
  const actions=useMemo(()=>{
    if(!dashboard)return[];
    return dashboard.otaActions.filter(item=>item.action!=="Keep open").map(item=>({date:item.date,title:item.action,detail:item.scope,kind:"ota"}))
      .concat(dashboard.rateSuggestions.filter(item=>item.roomTypeId===roomType&&item.changePercent!==0).map(item=>({date:item.date,title:`${item.changePercent>0?"Increase":"Reduce"} ${item.roomType} rate to ${money(item.suggestedRate,dashboard.currency)}`,detail:item.reason,kind:"rate"})))
      .sort((a,b)=>a.date.localeCompare(b.date)).slice(0,12);
  },[dashboard,roomType]);
  function goToday(){setMonth(monthKey(new Date()));setWeekStart(key(monday(new Date())));}
  function step(amount:number){if(view==="month")setMonth(value=>shiftMonth(value,amount));else setWeekStart(value=>shiftDays(value,amount*7));}
  return <section className="live-revenue-manager">
    <header className="revenue-dash-hero"><div><small>LIVE COMMERCIAL DESK</small><h2>Revenue Manager</h2><p>Daily rates, demand, pickup and OTA actions your team can apply.</p></div><span><i/>Decision support active</span></header>
    <section className="revenue-dash-controls">
      <select value={propertyId} onChange={event=>setPropertyId(event.target.value)}>{properties.map(item=><option key={item.id} value={item.id}>{item.property_name} · {item.client_code}</option>)}</select>
      <div className="revenue-view-switch"><button className={view==="month"?"active":""} onClick={()=>setView("month")}>Month</button><button className={view==="week"?"active":""} onClick={()=>setView("week")}>Week</button></div>
      <div className="revenue-period-nav"><button onClick={()=>step(-1)}><ChevronLeft size={17}/></button><strong>{view==="month"?parse(`${month}-01`).toLocaleDateString("en-GB",{month:"long",year:"numeric"}):`${niceDate(range.from)} – ${niceDate(range.to)}`}</strong><button onClick={()=>step(1)}><ChevronRight size={17}/></button></div>
      <button className="revenue-today" onClick={goToday}>Today</button>
      <button className="revenue-refresh" onClick={()=>void load()} disabled={loading}><RefreshCw size={17}/></button>
    </section>
    {error&&<div className="inventory-error">{error}</div>}
    {loading&&!dashboard?<div className="inventory-loading"><RefreshCw/>Loading revenue desk…</div>:dashboard&&metrics&&<>
      <div className="revenue-live-kpis">
        <article><CircleDollarSign/><div><small>BOOKED REVENUE</small><strong>{money(metrics.bookedRevenue,metrics.currency)}</strong><span>Selected {view}</span></div></article>
        <article><CalendarDays/><div><small>AVERAGE OCCUPANCY</small><strong>{metrics.averageOccupancy}%</strong><span>{metrics.inventory} rooms</span></div></article>
        <article><TrendingUp/><div><small>7-DAY PICKUP</small><strong>{pickup7?.available?`+${pickup7.pickup||0}`:"—"}</strong><span>{pickup7?.available?"Room nights":"Building history"}</span></div></article>
        <article><TrendingDown/><div><small>DATES TO WORK</small><strong>{dashboard.lowDemandPeriods.length}</strong><span>Low-demand windows</span></div></article>
      </div>
      <section className="revenue-rate-calendar">
        <header><div><small>DAILY REVENUE CALENDAR</small><h3>Demand and suggested rates</h3></div><select value={roomType} onChange={event=>setRoomType(event.target.value)}>{roomTypes.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></header>
        <div className={`revenue-day-grid ${view}`}>{dashboard.forecast.map(day=>{const rate=dayRates.get(day.date);return <article key={day.date} className={`demand-${day.level.toLowerCase()} ${day.date===today?"today":""}`}><header><small>{niceDay(day.date)}</small>{day.date===today&&<b>TODAY</b>}</header><strong>{day.forecastOccupancy}%</strong><span>{day.occupiedRooms} sold · {day.availableRooms} left</span><footer><small>SELL RATE</small><b>{money(rate?.suggestedRate||0,dashboard.currency)}</b>{rate?.changePercent!==0&&<em>{rate&&rate.changePercent>0?"+":""}{rate?.changePercent}%</em>}</footer></article>})}</div>
      </section>
      <div className="revenue-work-grid">
        <section className="revenue-action-queue"><header><div><small>WHAT TO DO</small><h3>Staff action queue</h3></div><span>{actions.length} actions</span></header>{actions.length?actions.map((item,index)=><article key={`${item.date}-${item.title}-${index}`}><b>{index+1}</b><div><small>{niceDate(item.date)} · {item.kind==="ota"?"OTA CONTROL":"RATE UPDATE"}</small><h4>{item.title}</h4><p>{item.detail}</p></div></article>):<div className="revenue-calm"><strong>No urgent changes</strong><p>Hold current rates and continue monitoring pickup.</p></div>}</section>
        <aside className="revenue-guides"><header><small>REVENUE MANAGER GUIDE</small><h3>How to act</h3></header><article><b>Below 30%</b><p>Keep channels open, check visibility and use a controlled offer.</p></article><article><b>30–60%</b><p>Protect the base rate, improve conversion and monitor pickup.</p></article><article><b>60–80%</b><p>Increase rates gradually and remove unnecessary discounts.</p></article><article><b>80–90%</b><p>Restrict deep promotions and consider minimum-stay rules.</p></article><article><b>Above 90%</b><p>Close discounts, protect remaining rooms and sell at peak value.</p></article></aside>
      </div>
    </>}
  </section>;
}
