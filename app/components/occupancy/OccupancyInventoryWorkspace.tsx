"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, ChevronLeft, ChevronRight, Expand, Minimize, RefreshCw } from "lucide-react";

type Property={id:string;client_code:string;property_name:string;calendar_source_mode:string};
type Day={date:string;total:number;sellable:number;sold:number;available:number;blocked:number;occupancy:number;availability:number};
type Category={roomType:string;roomCount:number;roomNames:string[];days:Day[]};
type Payload={properties:Property[];property:Property|null;month:string;dates:string[];categories:Category[];totals:Day[];syncNote:string};
function monthKey(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;}
function shiftMonth(value:string,amount:number){const [year,month]=value.split("-").map(Number),date=new Date(year,month-1+amount,1);return monthKey(date);}
function monthLabel(value:string){const [year,month]=value.split("-").map(Number);return new Date(year,month-1,1).toLocaleDateString("en-US",{month:"long",year:"numeric"});}
function dayLabel(value:string){return new Date(`${value}T00:00:00`).toLocaleDateString("en-US",{weekday:"short"});}
async function data(response:Response){const text=await response.text();try{return JSON.parse(text);}catch{throw new Error(response.ok?"Unreadable inventory response.":`Request failed (${response.status}).`);}}
function availabilityClass(day:Day){if(!day.sellable)return "closed";if(day.available===0)return "sold-out";if(day.availability<=25)return "critical";if(day.availability<=50)return "tight";return "open";}
function soldClass(day:Day){if(!day.sellable)return "closed";if(day.occupancy>=80)return "sold-high";if(day.occupancy>=50)return "sold-medium";return "sold-low";}

export default function OccupancyInventoryWorkspace(){
  const [payload,setPayload]=useState<Payload>({properties:[],property:null,month:monthKey(),dates:[],categories:[],totals:[],syncNote:""});
  const [propertyId,setPropertyId]=useState(""),[month,setMonth]=useState(monthKey()),[mode,setMode]=useState<"numbers"|"percentage">("numbers");
  const [loading,setLoading]=useState(true),[error,setError]=useState(""),[fullscreen,setFullscreen]=useState(false),[selected,setSelected]=useState<{category:string;day:Day}|null>(null);
  const shell=useRef<HTMLDivElement>(null);
  const months=useMemo(()=>Array.from({length:25},(_,index)=>shiftMonth(monthKey(),index-12)),[]);
  async function load(nextProperty=propertyId,nextMonth=month){
    setLoading(true);setError("");
    try{
      const query=new URLSearchParams({month:nextMonth});if(nextProperty)query.set("propertyId",nextProperty);
      const response=await fetch(`/api/occupancy-inventory?${query}`,{cache:"no-store"}),result=await data(response);
      if(!response.ok||!result.success)throw new Error(result.error||"Unable to load inventory.");
      setPayload(result);if(!nextProperty&&result.property)setPropertyId(result.property.id);
    }catch(reason){setError(reason instanceof Error?reason.message:"Unable to load inventory.");}
    finally{setLoading(false);}
  }
  useEffect(()=>{void load("",month);},[]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{const listener=()=>setFullscreen(document.fullscreenElement===shell.current);document.addEventListener("fullscreenchange",listener);return()=>document.removeEventListener("fullscreenchange",listener);},[]);
  function chooseProperty(value:string){setPropertyId(value);setSelected(null);void load(value,month);}
  function chooseMonth(value:string){setMonth(value);setSelected(null);void load(propertyId,value);}
  async function toggleFullscreen(){if(!shell.current)return;if(document.fullscreenElement)await document.exitFullscreen();else await shell.current.requestFullscreen();}
  const today=monthKey();
  return <div className={`inventory-workspace ${fullscreen?"is-fullscreen":""}`} ref={shell}>
    <header className="inventory-hero"><div><small>LIVE ROOM INVENTORY</small><h2>Occupancy</h2><p>Channel-manager style availability and sold inventory by room category.</p></div><div className="inventory-live"><i/>Supabase inventory</div></header>
    <section className="inventory-toolbar">
      <label>Property<select value={propertyId} onChange={event=>chooseProperty(event.target.value)}>{payload.properties.map(property=><option value={property.id} key={property.id}>{property.property_name} · {property.client_code}</option>)}</select></label>
      <div className="inventory-month-nav"><button onClick={()=>chooseMonth(shiftMonth(month,-1))}><ChevronLeft size={17}/></button><select value={month} onChange={event=>chooseMonth(event.target.value)}>{months.map(value=><option key={value} value={value}>{monthLabel(value)}</option>)}</select><button onClick={()=>chooseMonth(shiftMonth(month,1))}><ChevronRight size={17}/></button><button className="today" onClick={()=>chooseMonth(today)}>Today</button></div>
      <div className="inventory-mode"><button className={mode==="numbers"?"active":""} onClick={()=>setMode("numbers")}>Numbers</button><button className={mode==="percentage"?"active":""} onClick={()=>setMode("percentage")}>%</button></div>
      <button className="inventory-icon-button" onClick={()=>void load()} title="Refresh"><RefreshCw size={17}/></button>
      <button className="inventory-icon-button" onClick={()=>void toggleFullscreen()} title="Full screen">{fullscreen?<Minimize size={17}/>:<Expand size={17}/>}</button>
    </section>
    <div className="inventory-status"><span><Building2 size={15}/>{payload.property?.property_name||"No property"}</span><p>{payload.syncNote}</p><strong>{monthLabel(month)}</strong></div>
    {error&&<div className="inventory-error">{error}</div>}
    {loading?<div className="inventory-loading"><RefreshCw className="spin"/><strong>Loading room inventory…</strong></div>:!payload.categories.length?<div className="inventory-empty"><Building2/><h3>No room categories available</h3><p>Add or sync rooms before using the occupancy inventory.</p></div>:<div className="inventory-chart-wrap"><div className="inventory-chart" style={{"--inventory-days":payload.dates.length} as React.CSSProperties}>
      <div className="inventory-corner"><strong>Room category</strong><small>{mode==="numbers"?"Room counts":"Inventory %"}</small></div>
      <div className="inventory-date-head">{payload.dates.map(date=><div key={date} className={`${dayLabel(date).startsWith("S")?"weekend":""} ${date===new Date().toISOString().slice(0,10)?"today":""}`}><small>{dayLabel(date)}</small><strong>{Number(date.slice(-2))}</strong></div>)}</div>
      {payload.categories.map(category=><div className="inventory-category" key={category.roomType}>
        <div className="inventory-category-name"><strong>{category.roomType}</strong><small>{category.roomCount} rooms</small><span title={category.roomNames.join(", ")}>{category.roomNames.join(" · ")}</span></div>
        <div className="inventory-category-grid">
          <div className="inventory-row-label available"><strong>Available</strong><small>Remaining</small></div><div className="inventory-values">{category.days.map(day=><button onClick={()=>setSelected({category:category.roomType,day})} key={day.date} className={`${availabilityClass(day)} ${day.date===new Date().toISOString().slice(0,10)?"today":""}`} title={`${category.roomType} · ${day.date} · ${day.available} available · ${day.sold} sold${day.blocked?` · ${day.blocked} blocked`:""}`}><strong>{mode==="numbers"?day.available:`${day.availability}%`}</strong>{day.blocked>0&&<small>B{day.blocked}</small>}</button>)}</div>
          <div className="inventory-row-label sold"><strong>Sold</strong><small>Occupied</small></div><div className="inventory-values">{category.days.map(day=><button onClick={()=>setSelected({category:category.roomType,day})} key={day.date} className={`${soldClass(day)} ${day.date===new Date().toISOString().slice(0,10)?"today":""}`}><strong>{mode==="numbers"?day.sold:`${day.occupancy}%`}</strong></button>)}</div>
        </div>
      </div>)}
      <div className="inventory-category inventory-total"><div className="inventory-category-name"><strong>PROPERTY TOTAL</strong><small>{payload.totals[0]?.total||0} rooms</small></div><div className="inventory-category-grid">
        <div className="inventory-row-label available"><strong>Available</strong></div><div className="inventory-values">{payload.totals.map(day=><button key={day.date} className={availabilityClass(day)} onClick={()=>setSelected({category:"Property total",day})}><strong>{mode==="numbers"?day.available:`${day.availability}%`}</strong>{day.blocked>0&&<small>B{day.blocked}</small>}</button>)}</div>
        <div className="inventory-row-label sold"><strong>Sold</strong></div><div className="inventory-values">{payload.totals.map(day=><button key={day.date} className={soldClass(day)} onClick={()=>setSelected({category:"Property total",day})}><strong>{mode==="numbers"?day.sold:`${day.occupancy}%`}</strong></button>)}</div>
      </div></div>
    </div></div>}
    <div className="inventory-legend"><span><i className="open"/>Good availability</span><span><i className="tight"/>Limited</span><span><i className="critical"/>Critical</span><span><i className="sold-out"/>Sold out</span><span><i className="closed"/>No sellable rooms</span><small>B = blocked rooms</small></div>
    {selected&&<div className="inventory-detail-backdrop" onClick={()=>setSelected(null)}><article onClick={event=>event.stopPropagation()}><button onClick={()=>setSelected(null)}>×</button><small>INVENTORY DETAIL</small><h3>{selected.category}</h3><p>{new Date(`${selected.day.date}T00:00:00`).toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</p><dl><div><dt>Total rooms</dt><dd>{selected.day.total}</dd></div><div><dt>Available</dt><dd>{selected.day.available}</dd></div><div><dt>Sold</dt><dd>{selected.day.sold}</dd></div><div><dt>Blocked</dt><dd>{selected.day.blocked}</dd></div><div><dt>Occupancy</dt><dd>{selected.day.occupancy}%</dd></div><div><dt>Availability</dt><dd>{selected.day.availability}%</dd></div></dl><footer>Read-only inventory · booking edits remain in Calendars</footer></article></div>}
  </div>;
}
