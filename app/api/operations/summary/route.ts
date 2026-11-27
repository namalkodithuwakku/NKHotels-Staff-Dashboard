import {NextRequest,NextResponse} from "next/server";
import {authorizeNKH} from "../../../lib/nkhAuthorization";
import {supabaseAdmin} from "../../../lib/supabaseAdmin";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
const limit=500;
type Property={id:string;property_name:string;calendar_source_mode:string|null;calendar_sheet_code:string|null};
type Booking={property_id:string;check_in:string;check_out:string};
type Sync={property_id:string;last_status:string;last_completed_at:string|null};
type Task={id:string;subject:string;status:string;priority:string;assigned_name_snapshot:string|null;due_at:string|null};
type Audit={property_id:string|null;audit_status:string;severity:string};
type Roster={shift_date:string;start_time:string|null;end_time:string|null;status:string;staff:{display_name:string}|null};
type Shift={clocked_in_at:string;clocked_out_at:string|null;status:string;staff:{display_name:string}|null};
async function read<T>(query:string){try{const rows=await supabaseAdmin<T[]>(query+"&limit="+limit);return {rows,limited:rows.length>=limit};}catch{return null;}}
function day(date:Date){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Colombo",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);}
export async function GET(request:NextRequest){
 const auth=await authorizeNKH(request,"operations.read");
 if(!auth.ok)return NextResponse.json({error:"Operations access unavailable."},{status:auth.status,headers});
 if(auth.role!=="master")return NextResponse.json({error:"Master access required."},{status:403,headers});
 const now=new Date(),today=day(now),end=day(new Date(now.getTime()+6*86400000));
 const properties=await read<Property>("nkh_properties?select=id,property_name,calendar_source_mode,calendar_sheet_code&client_status=in.(Active,Onboarding)&order=property_name.asc");
 const connected=properties?.rows.filter(p=>p.calendar_source_mode==="supabase"||Boolean(p.calendar_sheet_code))||[];
 const ids=connected.map(p=>p.id).join(",");
 const empty={rows:[],limited:false};
 const [bookings,sync,tasks,audits,roster,shifts]=await Promise.all([
 properties?(ids?read<Booking>(`nkh_calendar_bookings?select=property_id,check_in,check_out&property_id=in.(${ids})&booking_status=neq.Cancelled&or=(and(check_in.gte.${today},check_in.lte.${end}),and(check_out.gte.${today},check_out.lte.${end}))&order=check_in.asc,id.asc`):Promise.resolve(empty)):Promise.resolve(null),
 properties?(ids?read<Sync>(`nkh_calendar_sync_state?select=property_id,last_status,last_completed_at&property_id=in.(${ids})&order=property_id.asc`):Promise.resolve(empty)):Promise.resolve(null),
 read<Task>("nkh_tasks?select=id,subject,status,priority,assigned_name_snapshot,due_at&archived_at=is.null&status=in.(Pending,In%20Progress)&order=due_at.asc.nullslast,id.asc"),
 read<Audit>("nkh_reservation_audit_events?select=property_id,audit_status,severity&audit_status=in.(Waiting,Needs%20Staff%20Action,Unable%20to%20Match)&order=due_at.asc,id.asc"),
 read<Roster>(`nkh_roster_entries?select=shift_date,start_time,end_time,status,staff:nkh_staff(display_name)&shift_date=eq.${today}&status=eq.Scheduled&order=start_time.asc,id.asc`),
 read<Shift>("nkh_shift_sessions?select=clocked_in_at,clocked_out_at,status,staff:nkh_staff(display_name)&status=eq.Active&clocked_out_at=is.null&order=clocked_in_at.asc,id.asc")
 ]);
 const hotels=properties?.rows.map(p=>{const configured=connected.some(x=>x.id===p.id);const b=bookings?.rows.filter(x=>x.property_id===p.id);const record=sync?.rows.find(x=>x.property_id===p.id);return {name:p.property_name,mode:p.calendar_source_mode,configured,arrivals:configured&&b?b.filter(x=>x.check_in===today).length:null,departures:configured&&b?b.filter(x=>x.check_out===today).length:null,nextArrivals:configured&&b?b.filter(x=>x.check_in>today).length:null,nextDepartures:configured&&b?b.filter(x=>x.check_out>today).length:null,sync:record?{status:record.last_status,completed:record.last_completed_at}:null};})??null;
 return NextResponse.json({today,end,asOf:now.toISOString(),hotels,calendarLimited:Boolean(properties?.limited||bookings?.limited||sync?.limited),syncAvailable:sync!==null,tasks:tasks?{count:tasks.rows.length,urgent:tasks.rows.filter(x=>["High","Urgent","Critical"].includes(x.priority)).length,overdue:tasks.rows.filter(x=>x.due_at&&Date.parse(x.due_at)<now.getTime()).length,unassigned:tasks.rows.filter(x=>!x.assigned_name_snapshot).length,items:tasks.rows.slice(0,12),limited:tasks.limited}:null,audits:audits?{waiting:audits.rows.filter(x=>x.audit_status==="Waiting").length,action:audits.rows.filter(x=>x.audit_status==="Needs Staff Action").length,unmatched:audits.rows.filter(x=>x.audit_status==="Unable to Match").length,limited:audits.limited}:null,roster,shifts},{headers});
}
