import {NextRequest,NextResponse} from "next/server";
import {authorizeNKH} from "../../../lib/nkhAuthorization";
import {supabaseAdmin} from "../../../lib/supabaseAdmin";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 const headers={"Cache-Control":"private, no-store"};
 const auth=await authorizeNKH(request,"executive.read");
 if(!auth.ok)return NextResponse.json({error:"Executive access unavailable."},{status:auth.status,headers});
 if(auth.role!=="master")return NextResponse.json({error:"Master access required."},{status:403,headers});
 try{
 const rows=await supabaseAdmin<{report_time:string;attention_count:number;urgent_count:number}[]>("nkh_ai_monitor_reports?select=report_time,attention_count,urgent_count&order=report_time.desc,id.desc&limit=1");
 return NextResponse.json({report:rows[0]||null},{headers});
 }catch{return NextResponse.json({error:"Monitor unavailable."},{status:503,headers});}
}
