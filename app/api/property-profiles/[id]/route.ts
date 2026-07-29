import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { canManageProperties, readServerSession } from "../../../lib/serverSession";
import { savePropertyIdentificationEmail } from "../../../lib/propertyIdentificationEmail";
import { normalizeGoogleSheetCode } from "../../../lib/googleSheetCode";

const allowed = ["property_name", "legal_name", "preferred_language", "client_status", "package_name", "notes", "description", "address_line_1", "address_line_2", "city", "country", "timezone", "currency_code", "check_in_time", "check_out_time", "total_rooms", "website_url", "map_url", "logo_url", "calendar_sheet_code"];

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    if (!canManageProperties(readServerSession(request))) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const { id } = await context.params;
    const input = await request.json();
    const update = Object.fromEntries(allowed.filter(key => Object.prototype.hasOwnProperty.call(input, key)).map(key => [key, input[key] === "" ? null : input[key]]));
    if (Object.prototype.hasOwnProperty.call(update, "calendar_sheet_code")) {
      update.calendar_sheet_code = normalizeGoogleSheetCode(update.calendar_sheet_code);
    }
    const hasTaskEmail = Object.prototype.hasOwnProperty.call(input, "task_email");
    if (!Object.keys(update).length && !hasTaskEmail) return NextResponse.json({ error: "No supported fields were supplied." }, { status: 400 });
    const data = Object.keys(update).length
      ? await supabaseAdmin<Record<string, unknown>[]>(`nkh_properties?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", prefer: "return=representation", body: update })
      : await supabaseAdmin<Record<string, unknown>[]>(`nkh_properties?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
    if (!data.length) return NextResponse.json({ error: "Property not found." }, { status: 404 });
    const taskEmail = hasTaskEmail
      ? await savePropertyIdentificationEmail(id, input.task_email)
      : undefined;
    return NextResponse.json({
      ...data[0],
      ...(hasTaskEmail ? { task_email: taskEmail } : {}),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update property." }, { status: 500 });
  }
}
