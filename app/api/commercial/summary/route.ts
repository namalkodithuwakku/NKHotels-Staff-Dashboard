import {NextRequest,NextResponse} from "next/server";
import {authorizeNKH} from "../../../lib/nkhAuthorization";
import {supabaseAdmin} from "../../../lib/supabaseAdmin";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
const limit=500;
async function read<T>(query:string){try{const rows=await supabaseAdmin<T[]>(query+"&limit="+limit);return {rows,limited:rows.length>=limit};}catch{return null;}}
type Property={id:string;property_name:string;client_status:string};
type Rate={property_id:string|null;needs_review:boolean;updated_at:string};
type Report={property_id:string;created_at:string};
type Competitor=Report&{research_status:string;check_in:string;check_out:string};
type Occupancy=Report&{date_from:string;date_to:string};
type Snapshot={property_id:string;captured_at:string;period_start:string;period_end:string;inventory:number;occupied_room_nights:number};
export async function GET(request:NextRequest){
 const auth=await authorizeNKH(request,"revenue.read");
 if(!auth.ok)return NextResponse.json({error:"Commercial access unavailable."},{status:auth.status,headers});
 if(auth.role!=="master")return NextResponse.json({error:"Master access required."},{status:403,headers});
 const [properties,rates,competitors,occupancy,snapshots]=await Promise.all([
 read<Property>("nkh_properties?select=id,property_name,client_status&client_status=in.(Active,Onboarding,Lead)&order=property_name.asc,id.asc"),
 read<Rate>("nkh_ota_rate_profiles?select=property_id,needs_review,updated_at&order=updated_at.desc,id.asc"),
 read<Competitor>("nkh_competitor_reports?select=property_id,created_at,research_status,check_in,check_out&order=created_at.desc,id.asc"),
 read<Occupancy>("nkh_occupancy_reports?select=property_id,created_at,date_from,date_to&order=created_at.desc,id.asc"),
 read<Snapshot>("nkh_revenue_snapshots?select=property_id,captured_at,period_start,period_end,inventory,occupied_room_nights&order=captured_at.desc,id.asc")
 ]);
 const hotels=properties?.rows.filter(p=>p.client_status!=="Lead").map(p=>{
 const rr=rates?.rows.filter(x=>x.property_id===p.id);
 const snap=snapshots?.rows.find(x=>x.property_id===p.id);
 return {name:p.property_name,status:p.client_status,rates:rr?{count:rr.length,review:rr.filter(x=>x.needs_review).length}:null,competitor:competitors?.rows.find(x=>x.property_id===p.id)||null,occupancy:occupancy?.rows.find(x=>x.property_id===p.id)||null,snapshot:snap||null};
 })??null;
 return NextResponse.json({asOf:new Date().toISOString(),hotels,coverage:{properties:properties?{limited:properties.limited}:null,rates:rates?{limited:rates.limited,unlinked:rates.rows.filter(x=>!x.property_id).length}:null,competitors:competitors?{limited:competitors.limited}:null,occupancy:occupancy?{limited:occupancy.limited}:null,snapshots:snapshots?{limited:snapshots.limited}:null},pipeline:properties?{leads:properties.rows.filter(x=>x.client_status==="Lead").length,onboarding:properties.rows.filter(x=>x.client_status==="Onboarding").length,active:properties.rows.filter(x=>x.client_status==="Active").length,limited:properties.limited}:null},{headers});
}
