import { useState } from "react";
import {
  CircleAlert,
  MailOpen,
  MailX,
} from "lucide-react";
import { Task } from "../types/tasks";

import {
  startEmailTask,
  ignoreAIEmail,
  updateTaskStatus,
} from "../lib/api";

type TimelineItem = Task & {
  time?: string;
  color?: string;

  aiTitle?: string;
  summary?: string;
  action?: string;
  category?: string;
  taskType?: string;
  confidence?: number | string;

  gmailLink?: string;
  body?: string;
  from?: string;
  to?: string;
  subject?: string;
  emailId?: string;
  attachmentNames?: string;
};

function getItemId(task: TimelineItem, index: number) {
  return String(
    task.id ||
      task.emailId ||
      `item-${index}`
  );
}

function shortId(id: string) {
  return id
    ? id.slice(-4).toUpperCase()
    : "-";
}

function normalizedStatus(task: TimelineItem) {
  if (task.type === "ai_email") {
    return "ai_email";
  }

  const status = String(
    task.status || ""
  ).toLowerCase();

  if (
    status.includes("done") ||
    status.includes("completed")
  ) {
    return "completed";
  }

  if (status.includes("progress")) {
    return "progress";
  }

  if (status.includes("waiting")) {
    return "waiting";
  }

  if (status.includes("escalated")) {
    return "escalated";
  }

  if (
    String(task.priority || "")
      .toLowerCase() === "high"
  ) {
    return "urgent";
  }

  return "pending";
}

function statusLabel(status: string) {
  if (status === "ai_email") return "AI Email";
  if (status === "completed") return "✓ Completed";
  if (status === "progress") return "In Progress";
  if (status === "waiting") return "Waiting";
  if (status === "escalated") return "Escalated";
  if (status === "urgent") return "Urgent";

  return "Pending";
}

function taskColor(status: string) {
  if (status === "ai_email") return "amber";
  if (status === "completed") return "green";
  if (status === "progress") return "blue";
  if (status === "waiting") return "purple";
  if (status === "escalated") return "red";
  if (status === "urgent") return "red";

  return "red";
}

function taskTime(task: TimelineItem) {
  const raw =
    task.type === "ai_email"
      ? task.time || ""
      : task.createdTime || "";

  const date = new Date(raw);

  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const match = String(raw).match(
    /\d{2}\/\d{2}\/\d{4}\s+(\d{2}:\d{2})/
  );

  return match
    ? match[1]
    : "--:--";
}

function cleanEmailAddress(value?: string) {
  const text = String(value || "").trim();

  if (!text) return "-";

  const emailMatch = text.match(
    /<([^>]+)>/
  );

  if (emailMatch?.[1]) {
    return emailMatch[1].trim();
  }

  return text;
}

function cleanEmailBody(body?: string) {
  let text = String(body || "")
    .replace(/\r/g, "")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/##-.*?-##/gi, "")
    .replace(/-{5,}/g, "")
    .trim();

  if (!text) {
    return "Email body is unavailable.";
  }

  const lines = text
    .split("\n")
    .map((line) => line.trim());

  const cleaned: string[] = [];

  let footerStarted = false;

  for (const line of lines) {
    if (!line) {
      if (
        cleaned.length > 0 &&
        cleaned[cleaned.length - 1] !== ""
      ) {
        cleaned.push("");
      }

      continue;
    }

    const lower = line.toLowerCase();

    if (
      lower.includes("© copyright") ||
      lower.includes("copyright booking.com") ||
      lower.includes("edit preferences") ||
      lower.includes("privacy & cookie statement") ||
      lower.includes("email_opened_tracking_pixel") ||
      lower.includes("this email was delivered to:") ||
      lower.startsWith("right now you’re subscribed") ||
      lower.startsWith("right now you're subscribed")
    ) {
      footerStarted = true;
    }

    if (footerStarted) {
      continue;
    }

    const trackingNoise =
      lower.includes("utm_campaign=") ||
      lower.includes("utm_source=") ||
      lower.includes("utm_medium=") ||
      lower.includes("email_opened_tracking") ||
      lower.includes("_s=") ||
      lower.includes("_e=");

    if (trackingNoise) {
      continue;
    }

    const rawUrl =
      line.startsWith("https://") ||
      line.startsWith("http://");

    if (
      rawUrl &&
      (
        lower.includes("tracking") ||
        lower.includes("utm_")
      )
    ) {
      continue;
    }

    cleaned.push(line);
  }

  text = cleaned
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text ||
    "Email body is unavailable.";
}

function splitEmailParagraphs(body?: string) {
  return cleanEmailBody(body)
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function getAttachmentList(
  attachmentNames?: string
) {
  return String(attachmentNames || "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

export default function Timeline({
  tasks,
  staffName,
  onChanged,
  canWork,
}: {
  tasks: TimelineItem[];
  staffName: string;
  onChanged: () => void | Promise<void>;
  canWork: boolean;
}) {
  const [updatingId, setUpdatingId] =
    useState("");

  const [
    completedNow,
    setCompletedNow,
  ] = useState<string[]>([]);

  const [
    expandedId,
    setExpandedId,
  ] = useState("");

  async function changeStatus(
    taskId: string,
    status: string
  ) {
    if (!canWork || !taskId) return;

    let completionNote = "";
    if (status === "Done") {
      const note = window.prompt(
        "Completion note (optional)\n\nAdd a short result for the client, or leave blank for a general completion message.",
        ""
      );
      if (note === null) return;
      completionNote = note.trim();
    }

    try {
      setUpdatingId(taskId);

      if (status === "Done") {
        setCompletedNow((previous) => [
          ...previous,
          taskId,
        ]);
      }

      if (status === "Done") {
        const params = new URLSearchParams({ taskId, status, staffName, completionNote });
        const response = await fetch(`/api/tasks/update?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
        });
        const text = await response.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error("Task update returned invalid JSON.");
        }
        if (!response.ok || data?.success === false) {
          throw new Error(data?.error || "Failed to complete task");
        }
      } else {
        await updateTaskStatus(taskId, status, staffName);
      }

      window.setTimeout(() => {
        void onChanged();
        setUpdatingId("");
      }, status === "Done" ? 900 : 300);
    } catch (error: any) {
      alert(
        error?.message ||
          "Failed to update task"
      );

      setUpdatingId("");

      setCompletedNow((previous) =>
        previous.filter(
          (id) => id !== taskId
        )
      );
    }
  }

  async function handleStartEmailTask(
    task: TimelineItem,
    emailId: string
  ) {
    if (!canWork || !emailId) return;

    try {
      setUpdatingId(emailId);

      await startEmailTask({
        emailId,
        staffName,
        property: task.property,
        taskType: task.taskType,
        category: task.category,
        priority: task.priority,
        aiTitle: task.aiTitle,
        subject: task.subject,
        summary: task.summary,
        action: task.action,
        event: task.event,
        bookingId: task.bookingId,
        gmailLink: task.gmailLink,
        from: task.from,
        to: task.to,
        time: task.time,
      });

      await onChanged();
    } catch (error: any) {
      alert(
        error?.message ||
          "Failed to create email task"
      );
    } finally {
      setUpdatingId("");
    }
  }

  async function handleIgnoreAIEmail(
    emailId: string
  ) {
    if (!canWork || !emailId) return;

    const reason =
      window.prompt(
        "Reason for ignoring this email:",
        "No action required"
      );

    if (reason === null) return;

    try {
      setUpdatingId(emailId);

      await ignoreAIEmail({
        emailId,
        staffName,
        reason:
          reason.trim() ||
          "No action required",
      });

      await onChanged();
    } catch (error: any) {
      alert(
        error?.message ||
          "Failed to ignore AI email"
      );
    } finally {
      setUpdatingId("");
    }
  }

  return (
    <div className="timeline">
      {!canWork && (
        <div className="view-only-banner">
          View only — task actions are enabled
          only during your roster shift.
        </div>
      )}

      {tasks.map((task, index) => {
        const itemId =
          getItemId(task, index);

        const reactKey = `${
          task.type || "task"
        }-${itemId}-${index}`;

        const isAIEmail =
          task.type === "ai_email";

        const temporaryCompleted =
          completedNow.includes(itemId);

        const status =
          temporaryCompleted
            ? "completed"
            : normalizedStatus(task);

        const color =
          taskColor(status);

        const isUpdating =
          updatingId === itemId;

        const isCompleted =
          status === "completed";

        const isExpanded =
          expandedId === itemId;

        const attachments =
          getAttachmentList(
            task.attachmentNames
          );

        return (
          <article
            key={reactKey}
            className={`task ${color} task-status-${status} ${
              isCompleted
                ? "task-completed"
                : ""
            } ${
              !canWork
                ? "task-view-only"
                : ""
            }`}
          >
            <div className="time-block">
              <span>{taskTime(task)}</span>
              <i />
            </div>

            <div className="task-content">
              {isAIEmail ? (
                <div className="ai-email-card">
                  <div className="ai-email-header">
                    <div className="ai-email-heading">
                      <span
                        className="status-dot amber"
                        aria-hidden="true"
                      />

                      <div className="ai-email-heading-copy">
                        <strong>
                          {task.aiTitle ||
                            task.category ||
                            task.taskType ||
                            task.subject ||
                            "Email Notification"}
                        </strong>

                        <span>
                          Operations Inbox
                        </span>
                      </div>
                    </div>

                    <em className="status-badge amber">
                      AI Summary
                    </em>
                  </div>

                  <div className="ai-email-address-grid">
                    <div className="ai-email-address-item">
                      <span className="ai-email-address-label">
                        From
                      </span>

                      <strong
                        className="ai-email-address-value"
                        title={cleanEmailAddress(
                          task.from
                        )}
                      >
                        {cleanEmailAddress(
                          task.from
                        )}
                      </strong>
                    </div>

                    <div className="ai-email-address-item">
                      <span className="ai-email-address-label">
                        To
                      </span>

                      <strong
                        className="ai-email-address-value"
                        title={cleanEmailAddress(
                          task.to
                        )}
                      >
                        {cleanEmailAddress(
                          task.to
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className="ai-email-summary-row">
                    <div className="ai-email-summary-card">
                      <span className="ai-email-section-label">
                        Summary
                      </span>

                      <p>
                        {task.summary ||
                          "Review this email."}
                      </p>
                    </div>
                  </div>

                  <div className="ai-email-action-row">
                    <button
                      type="button"
                      className="ai-email-expand-button"
                      aria-label={
                        isExpanded
                          ? "Close original email"
                          : "Preview original email"
                      }
                      title={
                        isExpanded
                          ? "Close original email"
                          : "Preview original email"
                      }
                      onClick={() =>
                        setExpandedId(
                          isExpanded
                            ? ""
                            : itemId
                        )
                      }
                    >
                      {isExpanded ? (
                        <MailX
                          size={17}
                          strokeWidth={2.1}
                          aria-hidden="true"
                        />
                      ) : (
                        <MailOpen
                          size={17}
                          strokeWidth={2.1}
                          aria-hidden="true"
                        />
                      )}

                      <span>
                        {isExpanded
                          ? "Close Email"
                          : "View Email"}
                      </span>
                    </button>

                    <div className="ai-email-action-spacer" />

                    <button
                      type="button"
                      className="ai-email-ignore-button"
                      disabled={
                        !canWork ||
                        isUpdating
                      }
                      onClick={() =>
                        handleIgnoreAIEmail(
                          itemId
                        )
                      }
                    >
                      {isUpdating
                        ? "..."
                        : "Ignore"}
                    </button>

                    <button
                      type="button"
                      className="ai-email-approve-button"
                      disabled={
                        !canWork ||
                        isUpdating
                      }
                      onClick={() =>
                        handleStartEmailTask(
                          task,
                          itemId
                        )
                      }
                    >
                      {isUpdating
                        ? "..."
                        : "Create Task"}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="ai-email-expanded">
                      <div className="ai-email-expanded-section">
                        <span className="ai-email-section-label">
                          Original Email
                        </span>

                        <div className="ai-email-body">
                          {splitEmailParagraphs(
                            task.body
                          ).map(
                            (
                              paragraph,
                              paragraphIndex
                            ) => (
                              <p
                                key={`${itemId}-paragraph-${paragraphIndex}`}
                              >
                                {paragraph}
                              </p>
                            )
                          )}
                        </div>
                      </div>

                      <div className="ai-email-expanded-section">
                        <span className="ai-email-section-label">
                          Attachments
                        </span>

                        {attachments.length >
                        0 ? (
                          <div className="ai-email-attachments">
                            {attachments.map(
                              (
                                attachment,
                                attachmentIndex
                              ) => (
                                <span
                                  className="ai-email-attachment"
                                  key={`${itemId}-attachment-${attachmentIndex}`}
                                >
                                  📎 {attachment}
                                </span>
                              )
                            )}
                          </div>
                        ) : (
                          <span className="ai-email-empty-text">
                            No attachments
                          </span>
                        )}
                      </div>

                      {task.gmailLink && (
                        <a
                          className="ai-email-gmail-link"
                          href={task.gmailLink}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open in Gmail →
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="desktop-task-card-layout">
  <div className="desktop-task-card">
    <div className="desktop-task-top-row">
      <div className="desktop-task-title-group">
        <strong className="desktop-task-type">
          {task.type ||
            task.event ||
            "Task"}
        </strong>

        {!isCompleted &&
          String(
            task.priority || ""
          ).toLowerCase() === "high" && (
            <CircleAlert
              className="desktop-urgent-icon"
              size={17}
              strokeWidth={2.4}
              aria-label="Urgent task"
            />
          )}
      </div>

      <strong className="desktop-task-property">
        {task.property ||
          "Unknown Property"}
      </strong>
    </div>

    <div className="desktop-task-second-row">
      <span>
        {task.assignedTo ||
          "Unassigned"}
      </span>

      <span>
        {task.source || "-"}
      </span>
    </div>

    <div
      className="desktop-task-subject"
      title={
        task.subject ||
        task.notes ||
        "-"
      }
    >
      {task.subject ||
        task.notes ||
        "-"}
    </div>

    <div className="desktop-task-action-row">
      {isCompleted ? (
        <div className="completed-chip">
          <span>✓</span>
          Completed
        </div>
      ) : (
        <>
          {status !== "progress" && (
            <button
              disabled={
                isUpdating ||
                !canWork
              }
              onClick={() =>
                changeStatus(
                  itemId,
                  "In Progress"
                )
              }
            >
              {isUpdating
                ? "..."
                : "Start"}
            </button>
          )}

          <button
            disabled={
              isUpdating ||
              !canWork
            }
            className="complete"
            onClick={() =>
              changeStatus(
                itemId,
                "Done"
              )
            }
          >
            {isUpdating
              ? "..."
              : "Done"}
          </button>
        </>
      )}
    </div>
  </div>
</div>

                  <div className="mobile-task-card-layout">
                    <div className="mobile-task-header">
                      <div className="mobile-task-heading">
                        <span
                          className={`status-dot ${color}`}
                        />

                        <strong>
                          {task.type ||
                            task.event ||
                            "Task"}
                        </strong>
                      </div>

                      <div className="mobile-task-header-side">
                        <em
                          className={`status-badge ${color}`}
                        >
                          {statusLabel(status)}
                        </em>

                        <span className="task-id">
                          #{shortId(itemId)}
                        </span>
                      </div>
                    </div>

                    <div className="mobile-task-info-grid">
                      <div className="mobile-task-info-item">
                        <span>Property</span>
                        <strong>
                          {task.property ||
                            "Unknown Property"}
                        </strong>
                      </div>

                      <div className="mobile-task-info-item">
                        <span>Source</span>
                        <strong>
                          {task.source || "-"}
                        </strong>
                      </div>

                      <div className="mobile-task-info-item">
                        <span>Assigned</span>
                        <strong>
                          {task.assignedTo ||
                            "Unassigned"}
                        </strong>
                      </div>

                      <div className="mobile-task-info-item">
                        <span>Priority</span>
                        <strong>
                          {task.priority ||
                            "Normal"}
                        </strong>
                      </div>
                    </div>

                    <div
                      className="mobile-task-subject"
                      title={
                        task.subject ||
                        task.notes ||
                        "-"
                      }
                    >
                      {task.subject ||
                        task.notes ||
                        "-"}
                    </div>

                    <div className="mobile-task-actions">
                      {isCompleted ? (
                        <div className="completed-chip">
                          <span>✓</span>
                          Completed
                        </div>
                      ) : (
                        <>
                          {status !==
                            "progress" && (
                            <button
                              disabled={
                                isUpdating ||
                                !canWork
                              }
                              onClick={() =>
                                changeStatus(
                                  itemId,
                                  "In Progress"
                                )
                              }
                            >
                              {isUpdating
                                ? "..."
                                : "Start"}
                            </button>
                          )}

                          <button
                            disabled={
                              isUpdating ||
                              !canWork
                            }
                            className="complete"
                            onClick={() =>
                              changeStatus(
                                itemId,
                                "Done"
                              )
                            }
                          >
                            {isUpdating
                              ? "..."
                              : "Done"}
                          </button>

                          <button
                            disabled={!canWork}
                            className="more"
                          >
                            •••
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
