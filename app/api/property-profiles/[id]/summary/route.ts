import { NextRequest, NextResponse } from "next/server";
import { authorizeNKH } from "../../../../lib/nkhAuthorization";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
export const dynamic = "force-dynamic";
const headers = {"Cache-Control":"private, no-store"};
type Property = {id:string;package_name:string|null;calendar_source_mode:string|null;calendar_sheet_code:string|null};
type Sync = {last_completed_at:string|null;last_status:string;rooms_synced:number;bookings_synced:number};
type Task = {assigned_staff_id:string|null;status:string};
type Staff = {id:string;display_name:string};
export async function GET(request: NextRequest, context: {params:Promise<{id:string}>}) {
  const auth=await authorizeNKH(request,"finance.read");
  if(!auth.ok)return NextResponse.json({error:"Property management access unavailable."},{status:auth.status,headers});
  const {id}=await context.params;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return NextResponse.json({error:"Invalid property."},{status:400,headers});
  try {
    const rows=await supabaseAdmin<Property[]>(`nkh_properties?select=id,package_name,calendar_source_mode,calendar_sheet_code&id=eq.${id}&limit=1`);
    if(!rows.length)return NextResponse.json({error:"Property not found."},{status:404,headers});
    const p=rows[0];
    const [sync,ota,tasks]=await Promise.allSettled([
      supabaseAdmin<Sync[]>(`nkh_calendar_sync_state?property_id=eq.${id}&select=last_completed_at,last_status,rooms_synced,bookings_synced&limit=1`),
      supabaseAdmin<{id:string;needs_review:boolean}[]>(`nkh_ota_rate_profiles?property_id=eq.${id}&select=id,needs_review&limit=1000`),
      supabaseAdmin<Task[]>(`nkh_tasks?property_id=eq.${id}&archived_at=is.null&status=in.(Pending,In%20Progress)&select=assigned_staff_id,status&limit=1000`)
    ]);
    let responsibilities:null|{name:string;openTasks:number}[]=null;
    if(tasks.status==="fulfilled"){
      const counts=new Map<string,number>();
      for(const task of tasks.value)if(task.assigned_staff_id)counts.set(task.assigned_staff_id,(counts.get(task.assigned_staff_id)||0)+1);
      try {
        const staff=counts.size?await supabaseAdmin<Staff[]>(`nkh_staff?select=id,display_name&id=in.(${[...counts.keys()].join(",")})`):[];
        responsibilities=[...counts].map(([staffId,openTasks])=>({name:staff.find(x=>x.id===staffId)?.display_name||"Unknown staff",openTasks}));
      }catch{/* show unavailable, not zero */}
    }
    return NextResponse.json({packageName:p.package_name,calendar:{mode:p.calendar_source_mode,configured:p.calendar_source_mode==="supabase"||Boolean(p.calendar_sheet_code),sync:sync.status==="fulfilled"?sync.value[0]||null:null,syncAvailable:sync.status==="fulfilled"},ota:ota.status==="fulfilled"?{count:ota.value.length,review:ota.value.filter(x=>x.needs_review).length,limited:ota.value.length>=1000}:null,responsibilities,openTasks:tasks.status==="fulfilled"?tasks.value.length:null,unassigned:tasks.status==="fulfilled"?tasks.value.filter(x=>!x.assigned_staff_id).length:null,taskLimited:tasks.status==="fulfilled"&&tasks.value.length>=1000},{headers});
  }catch{return NextResponse.json({error:"Property summary unavailable."},{status:503,headers});}
}
