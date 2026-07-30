import { NextRequest, NextResponse } from "next/server";
import { readServerSession } from "../../lib/serverSession";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

type Property = { id: string; client_code: string; property_name: string; calendar_source_mode: string; currency_code: string | null };
type Room = { room_name: string; room_type: string | null };
type Booking = { room_name: string; room_type: string | null; booking_source: string; booking_status: string; check_in: string; check_out: string };
const DAY = 86_400_000;
function validMonth(value: string) { return /^\d{4}-\d{2}$/.test(value); }
function iso(date: Date) { return date.toISOString().slice(0,10); }
function blocked(booking: Booking) { return booking.booking_status === "Blocked" || booking.booking_source === "Blocked"; }
function sold(booking: Booking) { return !blocked(booking) && !["Cancelled","Pending"].includes(booking.booking_status); }
function covers(booking: Booking,date: string) { return booking.check_in <= date && booking.check_out > date; }

export async function GET(request: NextRequest) {
  try {
    if (!readServerSession(request)) return NextResponse.json({error:"Please sign in again."},{status:401});
    const requested = String(request.nextUrl.searchParams.get("propertyId") || "");
    const suppliedMonth = String(request.nextUrl.searchParams.get("month") || "");
    const now = new Date(), month = validMonth(suppliedMonth) ? suppliedMonth : `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    const properties = await supabaseAdmin<Property[]>("nkh_properties?select=id,client_code,property_name,calendar_source_mode,currency_code&client_status=in.(Active,Onboarding)&order=property_name.asc");
    const property = requested ? properties.find(item=>item.id===requested) : properties[0];
    if (requested && !property) return NextResponse.json({error:"The selected property is no longer available."},{status:404});
    if (!property) return NextResponse.json({success:true,properties:[],property:null,month,dates:[],categories:[],totals:[]});
    const [year,number]=month.split("-").map(Number), from=`${month}-01`, next=new Date(Date.UTC(year,number,1)), to=`${next.getUTCFullYear()}-${String(next.getUTCMonth()+1).padStart(2,"0")}-01`;
    const dates:string[]=[]; for(let cursor=new Date(`${from}T00:00:00Z`);cursor<new Date(`${to}T00:00:00Z`);cursor=new Date(cursor.getTime()+DAY)) dates.push(iso(cursor));
    const id=encodeURIComponent(property.id);
    const [rooms,bookings]=await Promise.all([
      supabaseAdmin<Room[]>(`nkh_calendar_rooms?property_id=eq.${id}&select=room_name,room_type&order=sort_order.asc,room_name.asc`),
      supabaseAdmin<Booking[]>(`nkh_calendar_bookings?property_id=eq.${id}&check_in=lt.${to}&check_out=gt.${from}&select=room_name,room_type,booking_source,booking_status,check_in,check_out`),
    ]);
    const categoryRooms=new Map<string,string[]>();
    rooms.forEach(room=>{const type=room.room_type?.trim()||"Unassigned rooms";categoryRooms.set(type,[...(categoryRooms.get(type)||[]),room.room_name]);});
    const buildDay=(roomNames:string[],date:string)=>{
      const relevant=bookings.filter(booking=>roomNames.includes(booking.room_name)&&covers(booking,date));
      const blockedCount=new Set(relevant.filter(blocked).map(item=>item.room_name)).size;
      const soldCount=new Set(relevant.filter(sold).map(item=>item.room_name)).size;
      const sellable=Math.max(0,roomNames.length-blockedCount),available=Math.max(0,sellable-soldCount);
      return {date,total:roomNames.length,sellable,sold:soldCount,available,blocked:blockedCount,occupancy:sellable?Math.round(soldCount/sellable*100):0,availability:sellable?Math.round(available/sellable*100):0};
    };
    const categories=[...categoryRooms].map(([roomType,names])=>({roomType,roomCount:names.length,roomNames:names,days:dates.map(date=>buildDay(names,date))}));
    const allRooms=rooms.map(room=>room.room_name),totals=dates.map(date=>buildDay(allRooms,date));
    return NextResponse.json({success:true,properties,property,month,dates,categories,totals,syncNote:property.calendar_source_mode==="google_sheet"?"Inventory reflects the latest Google Sheet sync.":"Inventory is live from the Dashboard calendar."});
  } catch(error) {
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to load occupancy inventory."},{status:500});
  }
}
