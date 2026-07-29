import { supabaseAdmin } from "./supabaseAdmin";

const TASK_EMAIL_TYPE = "Task Identification";

type PropertyEmailRow = {
  id: string;
  property_id: string;
  email: string | null;
  contact_type: string;
  is_primary: boolean;
};

function cleanEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function getPropertyIdentificationEmails() {
  const rows = await supabaseAdmin<PropertyEmailRow[]>(
    "nkh_property_contacts?select=id,property_id,email,contact_type,is_primary&email=not.is.null"
  );
  const selected = new Map<string, { email: string; priority: number }>();

  for (const row of rows) {
    const email = cleanEmail(row.email);
    if (!email) continue;
    const priority = row.contact_type === TASK_EMAIL_TYPE ? 3 : row.is_primary ? 2 : 1;
    const current = selected.get(row.property_id);
    if (!current || priority > current.priority) {
      selected.set(row.property_id, { email, priority });
    }
  }

  return new Map(
    Array.from(selected.entries()).map(([propertyId, item]) => [propertyId, item.email])
  );
}

export async function savePropertyIdentificationEmail(propertyId: string, value: unknown) {
  const email = cleanEmail(value);
  if (email && !validEmail(email)) {
    throw new Error("Enter a valid property reservations email address.");
  }

  const existing = await supabaseAdmin<PropertyEmailRow[]>(
    `nkh_property_contacts?property_id=eq.${encodeURIComponent(propertyId)}&contact_type=eq.${encodeURIComponent(TASK_EMAIL_TYPE)}&select=id,property_id,email,contact_type,is_primary&limit=1`
  );

  if (!email) {
    if (existing[0]) {
      await supabaseAdmin(
        `nkh_property_contacts?id=eq.${encodeURIComponent(existing[0].id)}`,
        { method: "DELETE", prefer: "return=minimal" }
      );
    }
    return null;
  }

  const duplicates = await supabaseAdmin<Array<{ property_id: string }>>(
    `nkh_property_contacts?email=ilike.${encodeURIComponent(email)}&property_id=neq.${encodeURIComponent(propertyId)}&select=property_id&limit=1`
  );
  if (duplicates.length) {
    throw new Error("This task identification email is already assigned to another property.");
  }

  const body = {
    property_id: propertyId,
    contact_type: TASK_EMAIL_TYPE,
    contact_name: "Reservations / Task Email",
    email,
    preferred_channel: "Email",
    is_primary: true,
    notes: "Used by the NKH email-to-task engine to identify this property.",
  };

  if (existing[0]) {
    await supabaseAdmin(
      `nkh_property_contacts?id=eq.${encodeURIComponent(existing[0].id)}`,
      { method: "PATCH", prefer: "return=minimal", body }
    );
  } else {
    await supabaseAdmin("nkh_property_contacts", {
      method: "POST",
      prefer: "return=minimal",
      body,
    });
  }

  return email;
}
