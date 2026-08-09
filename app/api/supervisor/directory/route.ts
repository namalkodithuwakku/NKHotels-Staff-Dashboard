import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { isSupervisorRequestAuthorized } from "../../lib/supervisorAuth";

type StaffRow = { id:string; display_name:string|null; google_staff_name:string|null; access_level:string|null; phone:string|null; whatsapp_number:string|null; employment_status:string|null };
type PropertyRow = { id:string; property_name:string|null; client_code:string|null; status:string|null; language:string|null };

export async function GET(request: NextRequest) {
  if (!isSupervisorRequestAuthorized(request)) return NextResponse.json({ success:false, error:"Unauthorized" }, { status:401 });
  try {
    const [staff, properties] = await Promise.all([
      supabaseAdmin<StaffRow[]>("nkh_staff?select=id,display_name,google_staff_name,access_level,phone,whatsapp_number,employment_status&order=display_name.asc&limit=200"),
      supabaseAdmin<PropertyRow[]>("nkh_properties?select=id,property_name,client_code,status,language&order=property_name.asc&limit=500"),
    ]);
    return NextResponse.json({
      success:true,
      staff:staff.map(s=>({ id:s.id, name:s.display_name||s.google_staff_name||"", access:s.access_level||"", phone:s.phone||s.whatsapp_number||"", status:s.employment_status||"" })),
      properties:properties.map(p=>({ id:p.id, name:p.property_name||"", code:p.client_code||"", status:p.status||"", language:p.language||"" })),
    });
  } catch (error) {
    return NextResponse.json({ success:false, error:error instanceof Error ? error.message : "Unable to load supervisor directory." }, { status:500 });
  }
}
