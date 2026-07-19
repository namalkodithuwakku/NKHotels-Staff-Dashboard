type LegacyTask = Record<string, unknown>;

function value(task: LegacyTask, ...names: string[]) {
  for (const name of names) {
    const found = task[name];
    if (found !== undefined && found !== null && String(found).trim()) return String(found).trim();
  }
  return "";
}

function timestamp(input: string) {
  if (!input) return null;
  const match = input.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
  if (match) {
    let hour = Number(match[4]);
    if (match[6]?.toUpperCase() === "PM" && hour !== 12) hour += 12;
    if (match[6]?.toUpperCase() === "AM" && hour === 12) hour = 0;
    const parsed = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), hour, Number(match[5]));
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  const direct = new Date(input);
  return Number.isNaN(direct.getTime()) ? null : direct.toISOString();
}

function status(input: string) {
  const clean = input.toLowerCase();
  if (clean.includes("progress") || clean.includes("start")) return "In Progress";
  if (clean.includes("done") || clean.includes("complete")) return "Done";
  if (clean.includes("cancel")) return "Cancelled";
  if (clean.includes("ignore")) return "Ignored";
  return "Pending";
}

function priority(input: string) {
  const clean = input.toLowerCase();
  if (clean === "critical") return "Critical";
  if (clean === "urgent") return "Urgent";
  if (clean === "high") return "High";
  return "Normal";
}

export function mapLegacyTask(task: LegacyTask) {
  const legacyId = value(task, "id", "taskId", "taskID", "Task ID");
  if (!legacyId) return null;

  const taskType = value(task, "type", "taskType", "Task Type") || "Other";
  const subject = value(task, "subject", "Subject") || taskType;
  const currentStatus = status(value(task, "status", "Status"));
  const assignedName = value(task, "assignedTo", "assignedName", "Assigned To");
  const completedBy = value(task, "completedBy", "Completed By");

  return {
    legacy_task_id: legacyId,
    status: currentStatus,
    priority: priority(value(task, "priority", "Priority")),
    intent: value(task, "intent", "Intent") || null,
    task_type: taskType,
    source: value(task, "source", "Source") || "Google Sheets",
    property_name_snapshot: value(task, "property", "propertyName", "Property") || null,
    booking_id: value(task, "bookingId", "bookingID", "Booking ID") || null,
    subject,
    notes: value(task, "notes", "note", "Notes") || null,
    assigned_name_snapshot: assignedName || null,
    shift_label: value(task, "shift", "Shift") || null,
    started_at: timestamp(value(task, "startedTime", "acceptedTime", "Started Time", "Accepted Time")),
    completed_at: timestamp(value(task, "doneTime", "completedTime", "Done Time", "Completed Time")),
    completed_by_name_snapshot: completedBy || (currentStatus === "Done" ? assignedName || null : null),
    completion_note: value(task, "completionNote", "Completion Note") || null,
    created_by_name_snapshot: value(task, "createdBy", "Created By") || null,
    created_at: timestamp(value(task, "createdTime", "createdAt", "Created Time")) || new Date().toISOString(),
    source_metadata: { migrated_from: "Google Sheets" },
  };
}
