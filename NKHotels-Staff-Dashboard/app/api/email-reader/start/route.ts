import { after, NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { canManageProperties, readServerSession } from "../../../lib/serverSession";

type NamedRow = { id: string; property_name?: string; display_name?: string };
type CreatedTask = { id: string };

const GOOGLE_WEBAPP_URL = process.env.GOOGLE_WEBAPP_URL;

async function first<T>(path: string) {
  const rows = await supabaseAdmin<T[]>(path);
  return rows[0] || null;
}

function cleanPriority(value: unknown) {
  const clean = String(value || "Normal").trim();
  return ["Normal", "High", "Urgent", "Critical"].includes(clean) ? clean : "Normal";
}

export async function POST(request: NextRequest) {
  try {
    const session = readServerSession(request);
    if (!canManageProperties(session)) {
      return NextResponse.json({ success: false, error: "Please sign in again." }, { status: 401 });
    }

    const body = await request.json();
    const emailId = String(body.emailId || "").trim();
    const propertyName = String(body.property || "").trim();
    const staffName = String(body.staffName || session?.name || "").trim();
    const taskType = String(body.taskType || body.category || "Other").trim() || "Other";
    const subject = String(body.aiTitle || body.subject || taskType).trim();
    if (!emailId || !subject) {
      return NextResponse.json({ success: false, error: "Email ID and task subject are required." }, { status: 400 });
    }

    const existing = await first<CreatedTask>(`nkh_tasks?select=id&source_email_id=eq.${encodeURIComponent(emailId)}&limit=1`);
    if (existing) {
      return NextResponse.json({ success: true, created: false, id: existing.id, taskId: existing.id });
    }

    const [property, staff] = await Promise.all([
      propertyName ? first<NamedRow>(`nkh_properties?select=id,property_name&property_name=eq.${encodeURIComponent(propertyName)}&limit=1`) : null,
      staffName ? first<NamedRow>(`nkh_staff?select=id,display_name&or=(display_name.eq.${encodeURIComponent(staffName)},google_staff_name.eq.${encodeURIComponent(staffName)})&limit=1`) : null,
    ]);

    const notes = [String(body.summary || "").trim(), String(body.action || "").trim()]
      .filter(Boolean)
      .filter((value, index, values) => values.indexOf(value) === index)
      .join("\n\n");

    const rows = await supabaseAdmin<CreatedTask[]>("nkh_tasks", {
      method: "POST",
      prefer: "return=representation",
      body: {
        status: "Pending",
        priority: cleanPriority(body.priority),
        intent: String(body.event || body.category || "").trim() || null,
        task_type: taskType,
        source: "Email",
        property_id: property?.id || null,
        property_name_snapshot: propertyName || null,
        booking_id: String(body.bookingId || "").trim() || null,
        subject,
        notes: notes || null,
        assigned_staff_id: staff?.id || null,
        assigned_name_snapshot: staffName || null,
        shift_label: String(body.shift || "").trim() || null,
        source_email_id: emailId,
        source_gmail_url: String(body.gmailLink || "").trim() || null,
        source_metadata: {
          from: String(body.from || "").trim() || null,
          to: String(body.to || "").trim() || null,
          received_at: String(body.time || "").trim() || null,
        },
        created_by_staff_id: staff?.id || null,
        created_by_name_snapshot: session?.name || staffName || null,
      },
    });

    const task = rows[0];
    await supabaseAdmin("nkh_task_events", {
      method: "POST",
      prefer: "return=minimal",
      body: {
        task_id: task.id,
        event_type: "Created from Email",
        to_status: "Pending",
        actor_staff_id: staff?.id || null,
        actor_name_snapshot: session?.name || staffName || null,
        event_data: { source_email_id: emailId },
      },
    });
    if (GOOGLE_WEBAPP_URL) {
      after(async () => {
        try {
          const params = new URLSearchParams({
            action: "markEmailTaskCreated",
            emailId,
            taskId: task.id,
            staffName: session?.name || staffName || "",
          });
          await fetch(`${GOOGLE_WEBAPP_URL}?${params.toString()}`, {
            method: "GET",
            cache: "no-store",
          });
        } catch (error) {
          console.error("Background email status update failed", error);
        }
      });
    }
    return NextResponse.json({ success: true, created: true, id: task.id, taskId: task.id });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to create email task." }, { status: 500 });
  }
}
