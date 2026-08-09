import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { canManageProperties, readServerSession } from "../../lib/serverSession";

type ReviewRow = {
  id: string;
  gmail_message_id: string;
  sender: string | null;
  subject: string | null;
  received_at: string | null;
  property_name_snapshot: string | null;
  booking_id: string | null;
  task_type: string | null;
  priority: string | null;
  ai_title: string | null;
  summary: string | null;
  recommended_action: string | null;
  status: string | null;
};

type NamedRow = { id: string; property_name?: string; display_name?: string };

async function first<T>(path: string) {
  const rows = await supabaseAdmin<T[]>(path);
  return rows[0] || null;
}

export async function GET(request: NextRequest) {
  try {
    const session = readServerSession(request);
    if (!canManageProperties(session)) {
      return NextResponse.json({ success: false, error: "Please sign in again." }, { status: 401 });
    }

    const rows = await supabaseAdmin<ReviewRow[]>(
      "nkh_email_inbox?select=id,gmail_message_id,sender,subject,received_at,property_name_snapshot,booking_id,task_type,priority,ai_title,summary,recommended_action,status&status=eq.Needs%20Review&order=received_at.desc&limit=100",
    );

    return NextResponse.json({
      success: true,
      items: rows.map(row => ({
        id: row.id,
        emailId: row.gmail_message_id,
        from: row.sender,
        subject: row.subject,
        time: row.received_at,
        property: row.property_name_snapshot,
        bookingId: row.booking_id,
        taskType: row.task_type || "Other",
        priority: row.priority || "Normal",
        title: row.ai_title || row.subject || "Email action",
        summary: row.summary || "",
        action: row.recommended_action || "Review and take the required operational action.",
      })),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to load AI email review." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = readServerSession(request);
    if (!canManageProperties(session)) {
      return NextResponse.json({ success: false, error: "Please sign in again." }, { status: 401 });
    }

    const body = await request.json();
    const inboxId = String(body.inboxId || "").trim();
    if (!inboxId) return NextResponse.json({ success: false, error: "Review item is required." }, { status: 400 });

    const email = await first<ReviewRow>(
      `nkh_email_inbox?select=id,gmail_message_id,sender,subject,received_at,property_name_snapshot,booking_id,task_type,priority,ai_title,summary,recommended_action,status&id=eq.${encodeURIComponent(inboxId)}&limit=1`,
    );
    if (!email) return NextResponse.json({ success: false, error: "Review item not found." }, { status: 404 });
    if (email.status !== "Needs Review") return NextResponse.json({ success: false, error: "This email has already been handled." }, { status: 409 });

    const existing = await first<{ id: string }>(
      `nkh_tasks?select=id&source_email_id=eq.${encodeURIComponent(email.gmail_message_id)}&limit=1`,
    );
    if (existing) {
      await supabaseAdmin(`nkh_email_inbox?id=eq.${encodeURIComponent(inboxId)}`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: { status: "Handled by AI Supervisor", task_id: existing.id, handled_by_name_snapshot: session?.name || "Staff", handled_at: new Date().toISOString() },
      });
      return NextResponse.json({ success: true, duplicate: true, taskId: existing.id });
    }

    const propertyName = String(email.property_name_snapshot || "").trim();
    const assignedName = String(body.assignedTo || session?.name || "").trim();
    const [property, staff] = await Promise.all([
      propertyName ? first<NamedRow>(`nkh_properties?select=id,property_name&property_name=eq.${encodeURIComponent(propertyName)}&limit=1`) : null,
      assignedName ? first<NamedRow>(`nkh_staff?select=id,display_name&or=(display_name.eq.${encodeURIComponent(assignedName)},google_staff_name.eq.${encodeURIComponent(assignedName)})&limit=1`) : null,
    ]);

    const priority = ["Normal", "High", "Urgent", "Critical"].includes(String(email.priority || "")) ? email.priority : "Normal";
    const notes = [email.summary, email.recommended_action].filter(Boolean).join("\n\n");
    const rows = await supabaseAdmin<Array<{ id: string }>>("nkh_tasks", {
      method: "POST",
      prefer: "return=representation",
      body: {
        status: "Pending",
        priority,
        intent: "AI Supervisor",
        task_type: String(email.task_type || "Other"),
        source: "AI Supervisor",
        property_id: property?.id || null,
        property_name_snapshot: propertyName || null,
        booking_id: email.booking_id || null,
        subject: String(email.ai_title || email.subject || "Email action"),
        notes: notes || null,
        assigned_staff_id: staff?.id || null,
        assigned_name_snapshot: assignedName || null,
        source_email_id: email.gmail_message_id,
        source_metadata: { review_inbox_id: email.id, approved_by: session?.name || null, source_received_at: email.received_at || null },
        created_by_staff_id: staff?.id || null,
        created_by_name_snapshot: session?.name || assignedName || null,
      },
    });

    const task = rows[0];
    await Promise.all([
      supabaseAdmin("nkh_task_events", {
        method: "POST",
        prefer: "return=minimal",
        body: { task_id: task.id, event_type: "Created from AI Email Review", to_status: "Pending", actor_staff_id: staff?.id || null, actor_name_snapshot: session?.name || assignedName || null },
      }),
      supabaseAdmin(`nkh_email_inbox?id=eq.${encodeURIComponent(inboxId)}`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: { status: "Handled by AI Supervisor", task_id: task.id, handled_by_staff_id: staff?.id || null, handled_by_name_snapshot: session?.name || assignedName || null, handled_at: new Date().toISOString() },
      }),
    ]);

    return NextResponse.json({ success: true, taskId: task.id });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to create task from review." }, { status: 500 });
  }
}
