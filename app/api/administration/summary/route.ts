import {NextRequest,NextResponse} from "next/server";
import {authorizeNKH} from "../../../lib/nkhAuthorization";
import {supabaseAdmin} from "../../../lib/supabaseAdmin";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
const limit=500;
async function read<T>(q:string){try{const rows=await supabaseAdmin<T[]>(q+"&limit="+limit);return {rows,limited:rows.length>=limit};}catch{return null;}}
type Staff={id:string;display_name:string;employment_status:string;access_level:string};
type Roster={staff_id:string;shift_date:string;status:string};
type Task={assigned_staff_id:string|null;completed_by_staff_id:string|null;status:string;due_at:string|null;completed_at:string|null};
type Academy={staff_id:string;status:string;assignment_type:string;assignment_date:string};
type Property={client_status:string};
function day(d:Date){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Colombo",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);}
export async function GET(request:NextRequest){
 const auth=await authorizeNKH(request,"administration.read");
 if(!auth.ok)return NextResponse.json({error:"Administration access unavailable."},{status:auth.status,headers});
 if(auth.role!=="master")return NextResponse.json({error:"Master access required."},{status:403,headers});
 const now=new Date(),today=day(now),end=day(new Date(now.getTime()+6*86400000)),start=day(new Date(now.getTime()-29*86400000));
 const since=new Date(start+"T00:00:00+05:30").toISOString();
 const [staff,roster,open,done,academy,properties]=await Promise.all([
 read<Staff>("nkh_staff?select=id,display_name,employment_status,access_level&order=display_name.asc,id.asc"),
 read<Roster>(`nkh_roster_entries?select=staff_id,shift_date,status&shift_date=gte.${today}&shift_date=lte.${end}&order=shift_date.asc,id.asc`),
 read<Task>("nkh_tasks?select=assigned_staff_id,completed_by_staff_id,status,due_at,completed_at&archived_at=is.null&status=in.(Pending,In%20Progress)&order=due_at.asc.nullslast,id.asc"),
 read<Task>(`nkh_tasks?select=assigned_staff_id,completed_by_staff_id,status,due_at,completed_at&archived_at=is.null&status=eq.Done&completed_at=gte.${encodeURIComponent(since)}&completed_at=lte.${encodeURIComponent(now.toISOString())}&order=completed_at.desc,id.asc`),
 read<Academy>(`nkh_academy_assignments?select=staff_id,status,assignment_type,assignment_date&assignment_date=gte.${start}&assignment_date=lte.${today}&order=assignment_date.desc,id.asc`),
 read<Property>("nkh_properties?select=client_status&order=id.asc")
 ]);
 const people=staff?.rows.map(s=>({name:s.display_name,role:s.access_level,status:s.employment_status,scheduled:roster?roster.rows.filter(r=>r.staff_id===s.id&&r.status==="Scheduled").length:null,open:open?open.rows.filter(t=>t.assigned_staff_id===s.id).length:null,overdue:open?open.rows.filter(t=>t.assigned_staff_id===s.id&&t.due_at&&Date.parse(t.due_at)<now.getTime()).length:null,completed:done?done.rows.filter(t=>t.completed_by_staff_id===s.id).length:null,academy:academy?{assigned:academy.rows.filter(a=>a.staff_id===s.id).length,completed:academy.rows.filter(a=>a.staff_id===s.id&&a.status==="Completed").length}:null}))??null;
 return NextResponse.json({today,end,start,asOf:now.toISOString(),people,roster:roster?{scheduled:roster.rows.filter(r=>r.shift_date===today&&r.status==="Scheduled").length,leave:roster.rows.filter(r=>r.shift_date===today&&r.status==="Leave").length,off:roster.rows.filter(r=>r.shift_date===today&&r.status==="Off").length}:null,clients:properties?{active:properties.rows.filter(p=>p.client_status==="Active").length,onboarding:properties.rows.filter(p=>p.client_status==="Onboarding").length,leads:properties.rows.filter(p=>p.client_status==="Lead").length}:null,coverage:Object.fromEntries(Object.entries({staff,roster,open,done,academy,properties}).map(([k,v])=>[k,v?{limited:v.limited}:null]))},{headers});
}
