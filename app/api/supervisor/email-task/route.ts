import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { AI_SUPERVISOR_NAME, isSupervisorRequestAuthorized } from "../../lib/supervisorAuth";

type NamedRow = { id: string; property_name?: string; display_name?: string };
type ExistingTask = { id: string; status?: string };
type InboxRow = { id: string };

async function first<T>(path: string) {
  const rows = await supabaseAdmin<T[]>(path);
  return rows[0] || null;
}

function cleanPriority(value: unknown) {
  const clean = String(value || "Normal").trim();
  return ["Normal", "High", "Urgent", "Critical"].includes(clean) ? clean : "Normal";
}

export async function POST(request: NextRequest) {
  if (!isSupervisorRequestAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const emailId = String(body.emailId || "").trim();
    const propertyName = String(body.property || "").trim();
    const assignedName = String(body.assignedTo || "").trim();
    const taskType = String(body.taskType || body.category || "Other").trim() || "Other";
    const subject = String(body.title || body.aiTitle || body.subject || taskType).trim();

    if (!emailId || !subject) {
      return NextResponse.json({ success: false, error: "emailId and title are required." }, { status: 400 });
    }

    const existing = await first<ExistingTask>(
      `nkh_tasks?select=id,status&source_email_id=eq.${encodeURIComponent(emailId)}&limit=1`
    );
    if (existing) {
      return NextResponse.json({ success: true, created: false, duplicate: true, taskId: existing.id, status: existing.status || null });
    }

    const [property, assignedStaff, inbox] = await Promise.all([
      propertyName
        ? first<NamedRow>(`nkh_properties?select=id,property_name&property_name=eq.${encodeURIComponent(propertyName)}&limit=1`)
        : null,
      assignedName
        ? first<NamedRow>(`nkh_staff?select=id,display_name&or=(display_name.eq.${encodeURIComponent(assignedName)},google_staff_name.eq.${encodeURIComponent(assignedName)})&limit=1`)
        : null,
      first<InboxRow>(`nkh_email_inbox?select=id&gmail_message_id=eq.${encodeURIComponent(emailId)}&limit=1`),
    ]);

    const notes = [
      String(body.summary || "").trim(),
      String(body.action || "").trim(),
      String(body.note || "").trim(),
    ]
      .filter(Boolean)
      .filter((value, index, values) => values.indexOf(value) === index)
      .join("\n\n");

    const rows = await supabaseAdmin<Array<{ id: string; status?: string }>>("nkh_tasks", {
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
        assigned_staff_id: assignedStaff?.id || null,
        assigned_name_snapshot: assignedName || null,
        shift_label: String(body.shift || "").trim() || null,
        source_email_id: emailId,
        source_gmail_url: String(body.gmailLink || "").trim() || null,
        source_metadata: {
          from: String(body.from || "").trim() || null,
          to: String(body.to || "").trim() || null,
          received_at: String(body.time || "").trim() || null,
          supervisor: AI_SUPERVISOR_NAME,
          reason: String(body.reason || "").trim() || null,
        },
        created_by_staff_id: null,
        created_by_name_snapshot: AI_SUPERVISOR_NAME,
      },
    });

    const task = rows[0];
    await supabaseAdmin("nkh_task_events", {
      method: "POST",
      prefer: "return=minimal",
      body: {
        task_id: task.id,
        event_type: "Created by AI Supervisor from Email",
        to_status: "Pending",
        actor_staff_id: null,
        actor_name_snapshot: AI_SUPERVISOR_NAME,
        event_data: {
          source_email_id: emailId,
          assigned_to: assignedName || null,
          property: propertyName || null,
        },
      },
    });

    if (inbox?.id) {
      const handledAt = new Date().toISOString();
      await Promise.all([
        supabaseAdmin(`nkh_email_inbox?id=eq.${encodeURIComponent(inbox.id)}`, {
          method: "PATCH",
          prefer: "return=minimal",
          body: {
            status: "Task Created",
            task_id: task.id,
            handled_by_staff_id: null,
            handled_by_name_snapshot: AI_SUPERVISOR_NAME,
            handled_at: handledAt,
          },
        }),
        supabaseAdmin("nkh_email_audit", {
          method: "POST",
          prefer: "return=minimal",
          body: {
            email_inbox_id: inbox.id,
            gmail_message_id: emailId,
            action: "Task Created by AI Supervisor",
            actor_staff_id: null,
            actor_name_snapshot: AI_SUPERVISOR_NAME,
            task_id: task.id,
            details: {
              task_type: taskType,
              property: propertyName || null,
              assigned_to: assignedName || null,
            },
          },
        }),
      ]);
    }

    return NextResponse.json({ success: true, created: true, duplicate: false, taskId: task.id, task });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create AI supervisor email task." },
      { status: 500 }
    );
  }
}
