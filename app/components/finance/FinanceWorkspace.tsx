"use client";
import { useEffect, useState } from "react";
const sources = [{id:"fees",name:"Service Fees 2026",description:"Monthly property fees and payments"},{id:"accounts",name:"Monthly Accounts",description:"Company income, expenses and balances"}] as const;
type State = { modifiedTime?: string; error?: string; loading?: boolean };
export default function FinanceWorkspace() {
  const [states,setStates] = useState<Record<string,State>>({});
  const [refresh,setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    for (const source of sources) {
      fetch("/api/finance/workbooks?source="+source.id,{cache:"no-store",signal:controller.signal})
        .then(async response => {const data=await response.json();return response.ok?{modifiedTime:data.modifiedTime}:{error:data.error||"Unavailable"};})
        .then(state=>{if(!controller.signal.aborted)setStates(previous=>({...previous,[source.id]:state}));})
        .catch(()=>{if(!controller.signal.aborted)setStates(previous=>({...previous,[source.id]:{error:"Connection unavailable"}}));});
    }
    return ()=>controller.abort();
  },[refresh]);
  return <section className="master-overview"><section className="home-welcome"><div><small>MASTER ACCESS · READ ONLY</small><h2>Finance Centre</h2><p>Original workbooks remain unchanged. Downloads are copies, not live edits.</p></div><button onClick={()=>{setStates({});setRefresh(value=>value+1);}}>Refresh</button></section><div className="master-quick-grid">{sources.map(source=>{const state=states[source.id];return <article key={source.id} className="rounded-xl border p-4"><h3 className="font-semibold">{source.name}</h3><p>{source.description}</p><p>{!state?"Checking connection…":state.error||("Updated: "+(state.modifiedTime?new Date(state.modifiedTime).toLocaleString():"Unknown"))}</p>{state&&!state.error&&<a className="underline" href={"/api/finance/workbooks?source="+source.id+"&download=1"}>Download read-only copy</a>}</article>;})}</div><p>Financial summaries and reconciliation are not yet enabled.</p></section>;
}
