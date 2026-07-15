"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Sidebar from "../components/Sidebar";
import Stats from "../components/Stats";
import Timeline from "../components/Timeline";
import AIPanel from "../components/AIPanel";
import LiveClock from "../components/LiveClock";
import ThemeSwitcher from "../components/theme/ThemeSwitcher";
import MobileHeader from "../components/mobile/MobileHeader";
import MobileBottomNav, { MobileTab } from "../components/mobile/MobileBottomNav";
import MobileToday from "../components/mobile/MobileToday";
import MobilePerformance from "../components/mobile/MobilePerformance";
import MobileProfile from "../components/mobile/MobileProfile";
import MobileQuickAction from "../components/mobile/MobileQuickAction";
import OperationsStatusTabs from "../components/status/OperationsStatusTabs";
import ConfirmDialog from "../components/ui/ConfirmDialog";

import {
  createTask,
  fetchProperties,
  fetchEmailReaderItems,
} from "../lib/api";

import { useTasks } from "../hooks/useTasks";
import { useShift } from "../hooks/useShift";
import { useSuperMode } from "../hooks/useSuperMode";
import { StaffSession } from "../hooks/useAuth";

const sources = [
  "Phone Call",
  "WhatsApp Group",
  "Email",
  "OTA",
  "Client Portal",
  "Staff Dashboard",
];

const taskTypes = [
  "FIT Booking",
  "TA Inquiry",
  "TA Booking",
  "TA Follow-up",
  "Room Block",
  "Rate Update",
  "Booking Info",
  "Promotions",
  "OTA Issue",
  "Guest Message",
  "Other",
];

function statusMatch(
  status: string,
  filter: string
) {
  const normalized =
    String(status || "").toLowerCase();

  if (filter === "all") return true;

  if (filter === "pending") {
    return normalized.includes("pending");
  }

  if (filter === "progress") {
    return normalized.includes("progress");
  }

  if (filter === "done") {
    return (
      normalized.includes("done") ||
      normalized.includes("completed")
    );
  }

  return true;
}

function isCompletedItem(item: any) {
  if (item?.type === "ai_email") {
    return false;
  }

  const status = String(
    item?.status || ""
  ).toLowerCase();

  return (
    status.includes("done") ||
    status.includes("completed")
  );
}

function getTaskTimeValue(item: any) {
  const raw =
    item?.type === "ai_email"
      ? item?.time
      : item?.doneTime ||
        item?.createdTime ||
        item?.sentTime;

  if (!raw) return 0;

  const direct =
    new Date(raw).getTime();

  if (!Number.isNaN(direct)) {
    return direct;
  }

  const match = String(raw).match(
    /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/
  );

  if (!match) return 0;

  const [
    ,
    dd,
    mm,
    yyyy,
    hh,
    min,
  ] = match;

  return new Date(
    Number(yyyy),
    Number(mm) - 1,
    Number(dd),
    Number(hh),
    Number(min)
  ).getTime();
}

export default function TeamDashboard({
  staff,
  onLogout,
}: {
  staff: StaffSession;
  onLogout: () => void;
}) {
  const { shift } =
    useShift(staff.name);

  const canWork =
    shift?.canWork === true;

  const superMode = useSuperMode({
    staffName: staff.name,
    staffPhone:
      (staff as any).phone ||
      (staff as any).whatsapp ||
      "",
    shiftActive: canWork,
  });

  const canUseTasks =
    superMode.canUseTasks;

  const {
    last24Tasks,
    shiftTasks,
    stats,
    performance,
    loading,
    error,
    reload,
  } = useTasks(
    staff.name,
    canUseTasks,
    false,
    shift?.shift,
    shift?.scheduledStart,
    shift?.scheduledEnd
  );

  const [
    aiEmailItems,
    setAiEmailItems,
  ] = useState<any[]>([]);

  const [
    aiEmailError,
    setAiEmailError,
  ] = useState("");

  const [filter, setFilter] =
    useState("all");

  const [search, setSearch] =
    useState("");

  const [
    quickOpen,
    setQuickOpen,
  ] = useState(false);

  const [
    quickSource,
    setQuickSource,
  ] = useState("WhatsApp Group");

  const [
    quickTaskType,
    setQuickTaskType,
  ] = useState("Room Block");

  const [
    quickProperty,
    setQuickProperty,
  ] = useState("");

  const [
    quickPriorityHigh,
    setQuickPriorityHigh,
  ] = useState(false);

  const [
    quickNote,
    setQuickNote,
  ] = useState("");

  const [
    properties,
    setProperties,
  ] = useState<string[]>([]);

  const [
    savingQuickTask,
    setSavingQuickTask,
  ] = useState(false);

  const [
    quickError,
    setQuickError,
  ] = useState("");

  const [mobileTab, setMobileTab] =
    useState<MobileTab>("timeline");
  const [
    superDialog,
    setSuperDialog,
  ] = useState<
    "start" | "extend" | "end" | null
  >(null);

  const shiftStatus =
    shift?.status || "Checking";

  const nextShift =
    shift?.nextShift || "";

  /*
   * Current shift API only guarantees the logged-in staff result.
   * These optional names allow the UI to show another active shift
   * as soon as the backend returns one of these fields.
   */
  const activeShiftStaffName =
    canWork
      ? staff.name
      : String(
          (shift as any)?.activeStaffName ||
          (shift as any)?.onShiftStaffName ||
          (shift as any)?.currentShiftStaff ||
          ""
        ).trim();

  async function reloadAIEmails() {
    try {
      setAiEmailError("");

      const items =
        await fetchEmailReaderItems();

      setAiEmailItems(
        Array.isArray(items)
          ? items
          : []
      );
    } catch (error: any) {
      setAiEmailError(
        error?.message ||
          "Failed to load AI email items"
      );

      setAiEmailItems([]);
    }
  }

  async function refreshAll() {
    await Promise.all([
      reload(),
      reloadAIEmails(),
    ]);
  }

  useEffect(() => {
    void reloadAIEmails();

    const timer = window.setInterval(
      () => {
        void reloadAIEmails();
      },
      20000
    );

    return () =>
      window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!quickOpen) return;

    setQuickError("");

    fetchProperties()
      .then((list) => {
        setProperties(
          Array.isArray(list)
            ? list
            : []
        );
      })
      .catch((error) => {
        setQuickError(
          error?.message ||
            "Failed to load properties"
        );
      });
  }, [quickOpen]);

  const timelineItems =
    useMemo(() => {
      const normalTasks =
        Array.isArray(last24Tasks)
          ? last24Tasks
          : [];

      const aiItems =
        Array.isArray(aiEmailItems)
          ? aiEmailItems
          : [];

      return [
        ...normalTasks,
        ...aiItems,
      ];
    }, [
      last24Tasks,
      aiEmailItems,
    ]);

  const filteredTasks =
    useMemo(() => {
      return timelineItems
        .filter((task: any) => {
          const isAIEmail =
            task.type === "ai_email";

          const text = [
            task.id,
            task.status,
            task.type,
            task.source,
            task.property,
            task.bookingId,
            task.subject,
            task.notes,
            task.summary,
            task.action,
            task.category,
            task.taskType,
            task.priority,
            task.from,
            task.to,
            task.attachmentNames,
          ]
            .join(" ")
            .toLowerCase();

          const searchOk =
            text.includes(
              search
                .trim()
                .toLowerCase()
            );

          let statusOk = true;

          if (isAIEmail) {
            if (filter === "all") {
              statusOk = true;
            } else if (
              filter === "urgent"
            ) {
              const priority =
                String(
                  task.priority || ""
                ).toLowerCase();

              statusOk =
                priority === "high" ||
                priority === "critical" ||
                priority === "urgent";
            } else {
              statusOk = false;
            }
          } else {
            if (filter === "urgent") {
              const priority =
                String(
                  task.priority || ""
                ).toLowerCase();

              statusOk =
                priority === "high" ||
                priority === "critical" ||
                priority === "urgent";
            } else {
              statusOk = statusMatch(
                task.status || "",
                filter
              );
            }
          }

          return (
            searchOk &&
            statusOk
          );
        })
        .sort((a: any, b: any) => {
          const aCompleted =
            isCompletedItem(a);

          const bCompleted =
            isCompletedItem(b);

          /*
           * Open items, AI emails,
           * pending and in-progress tasks
           * always stay above completed work.
           */
          if (
            aCompleted !== bCompleted
          ) {
            return aCompleted
              ? 1
              : -1;
          }

          /*
           * Inside each group,
           * newest appears first.
           */
          return (
            getTaskTimeValue(b) -
            getTaskTimeValue(a)
          );
        });
    }, [
      timelineItems,
      filter,
      search,
    ]);

  const mobileCounts = useMemo(() => {
    let urgent = 0;
    let pending = 0;
    let active = 0;
    let done = 0;

    timelineItems.forEach((item: any) => {
      if (item?.type === "ai_email") {
        // AI emails are awaiting approval, so they belong in Pending.
        pending++;
        return;
      }

      const status = String(item?.status || "").toLowerCase();
      const priority = String(item?.priority || "").toLowerCase();

      const isDone =
        status.includes("done") ||
        status.includes("completed");

      const isActive = status.includes("progress");

      const isUrgent =
        priority === "high" ||
        priority === "urgent" ||
        priority === "critical";

      if (isDone) {
        done++;
      } else if (isActive) {
        active++;
      } else {
        pending++;

        if (isUrgent) {
          urgent++;
        }
      }
    });

    return {
      urgent,
      pending,
      active,
      done,
    };
  }, [timelineItems]);

  function requestStartSuper() {
    if (canWork) return;
    setSuperDialog("start");
  }

  function requestExtendSuper() {
    if (!superMode.isMine) return;
    setSuperDialog("extend");
  }

  function requestEndSuper() {
    if (!superMode.isMine) return;
    setSuperDialog("end");
  }

  async function confirmSuperAction() {
    const action = superDialog;

    if (!action) return;

    try {
      if (action === "start") {
        await superMode.start();
      }

      if (action === "extend") {
        await superMode.extend();
      }

      if (action === "end") {
        await superMode.end(
          "Ended by staff"
        );
      }

      setSuperDialog(null);
    } catch {
      /*
       * useSuperMode already displays
       * the backend error.
       */
    }
  }

  async function createQuickTask() {
    if (!quickProperty.trim()) {
      setQuickError(
        "Please select a property."
      );

      return;
    }

    try {
      setSavingQuickTask(true);
      setQuickError("");

      await createTask({
        taskType: quickTaskType,
        source: quickSource,
        property: quickProperty,
        note: quickNote,
        subject: quickTaskType,

        priority:
          quickPriorityHigh
            ? "High"
            : "Normal",

        staffName: staff.name,

        staffPhone:
          (staff as any).phone ||
          (staff as any).whatsapp ||
          "",

        shift:
          shift?.shift || "",
      });

      setQuickOpen(false);
      setQuickNote("");
      setQuickPriorityHigh(false);
      setQuickProperty("");

      await refreshAll();
    } catch (error: any) {
      setQuickError(
        error?.message ||
          "Failed to create task"
      );
    } finally {
      setSavingQuickTask(false);
    }
  }

  return (
    <main className="os">
      <Sidebar
        staff={staff}
        onLogout={onLogout}
        shiftActive={canWork}
      />

      <section className="main desktop-dashboard">
        <header className="hero polished-hero">
          <div>
            <p>N K Hotel OS</p>

            <h1>
              OPERATIONS DASHBOARD
            </h1>

            <span className="sub">
              {canWork
                ? `Good Day, ${
                    staff.name
                  } · ${
                    shift?.shift ||
                    "Active Shift"
                  } • Running Normally`
                : nextShift
                ? `Good Day, ${staff.name} · View Only • Next Shift: ${nextShift}`
                : `Good Day, ${staff.name} · View Only • ${shiftStatus}`}
            </span>
          </div>

          <div className="top-actions">
            <ThemeSwitcher />

            <div className="clock-status-group">
              <LiveClock />

              <OperationsStatusTabs
                currentStaffName={
                  staff.name
                }
                currentUserOnShift={
                  canWork
                }
                activeShiftStaffName={
                  activeShiftStaffName
                }
                superActive={
                  superMode.status.active
                }
                superIsMine={
                  superMode.isMine
                }
                superStaffName={
                  superMode.status.staffName
                }
                superRemainingLabel={
                  superMode.remainingLabel
                }
                loading={
                  superMode.loading
                }
                actionLoading={
                  superMode.actionLoading
                }
onStartSuper={
  requestStartSuper
}
onExtendSuper={
  requestExtendSuper
}
onEndSuper={
  requestEndSuper
}
              />
            </div>
          </div>
        </header>

        <Stats stats={stats} />

        <section className="workspace">
          <div className="queue">
            <div className="section-head">
              <div>
                <h2>
                  Live Operations
                </h2>

                <p>
                  {loading
                    ? "Loading..."
                    : `${filteredTasks.length} of ${timelineItems.length} items shown · AI ${aiEmailItems.length}`}
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                }}
              >
                <button
                  className="ghost"
                  onClick={() =>
                    setQuickOpen(true)
                  }
                >
                  ⚡ Quick Action
                </button>

                <button
                  className="ghost"
                  onClick={() =>
                    void refreshAll()
                  }
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="premium-toolbar compact-toolbar">
              <div className="premium-tabs">
                {[
                  ["all", "All"],
                  ["urgent", "Urgent"],
                  ["pending", "Pending"],
                  ["progress", "Active"],
                  ["done", "Done"],
                ].map(
                  ([key, label]) => (
                    <button
                      key={key}
                      className={
                        filter === key
                          ? "premium-tab active"
                          : "premium-tab"
                      }
                      onClick={() =>
                        setFilter(key)
                      }
                    >
                      {label}
                    </button>
                  )
                )}
              </div>

              <div className="premium-search-wrap compact-search">
                <span>Search</span>

                <input
                  className="premium-search"
                  placeholder="Property, guest, booking..."
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                />
              </div>
            </div>

            {error && (
              <div className="brief-item red">
                {error}
              </div>
            )}

            {aiEmailError && (
              <div className="brief-item amber">
                {aiEmailError}
              </div>
            )}

            {!loading &&
              filteredTasks.length ===
                0 && (
                <div className="brief-item blue">
                  No matching items found.
                </div>
              )}

            <div className="timeline-scroll">
              <Timeline
                tasks={
                  filteredTasks as any
                }
                staffName={staff.name}
                onChanged={refreshAll}
                canWork={canUseTasks}
              />
            </div>
          </div>

          <AIPanel
            tasks={
              filteredTasks as any
            }
            shiftTasks={shiftTasks}
            performance={performance}
            shiftActive={canUseTasks}
            shift={shift}
          />
        </section>
      </section>

      <section className="mobile-super-app">
        <MobileHeader
          staffName={staff.name}
          shiftLabel={shift?.shift || ""}
          canWork={canWork}
          onRefresh={refreshAll}
          refreshing={loading}
          superActive={
            superMode.status.active
          }
          superIsMine={
            superMode.isMine
          }
          superStaffName={
            superMode.status.staffName
          }
          superRemainingLabel={
            superMode.remainingLabel
          }
          superLoading={
            superMode.loading
          }
          superActionLoading={
            superMode.actionLoading
          }
          onStartSuper={
  requestStartSuper
}
onExtendSuper={
  requestExtendSuper
}
onEndSuper={
  requestEndSuper
}
        />

        <div className="mobile-app-scroll">
          {mobileTab === "timeline" && (
            <section className="mobile-timeline-page">
              <div className="mobile-compact-stats">
                <article className="mobile-stat-card urgent">
                  <span>Urgent</span>
                  <strong>{mobileCounts.urgent}</strong>
                </article>

                <article className="mobile-stat-card pending">
                  <span>Pending</span>
                  <strong>{mobileCounts.pending}</strong>
                </article>

                <article className="mobile-stat-card active">
                  <span>Active</span>
                  <strong>{mobileCounts.active}</strong>
                </article>

                <article className="mobile-stat-card done">
                  <span>Done</span>
                  <strong>{mobileCounts.done}</strong>
                </article>
              </div>

              <section className="mobile-timeline-shell">
                <div className="mobile-timeline-heading">
                  <div>
                    <h2>Live Timeline</h2>
                    <p>
                      {loading
                        ? "Refreshing operations..."
                        : `${filteredTasks.length} items · ${aiEmailItems.length} AI emails`}
                    </p>
                  </div>

                  <span className="mobile-count-pill">
                    {canWork
                      ? "Shift Active"
                      : superMode.isMine
                      ? `Super ${superMode.remainingLabel}`
                      : superMode.status.active
                      ? `${superMode.status.staffName} on Super`
                      : "View Only"}
                  </span>
                </div>

                <div className="premium-toolbar compact-toolbar">
                  <div className="premium-tabs">
                    {[
                      ["all", "All"],
                      ["urgent", "Urgent"],
                      ["pending", "Pending"],
                      ["progress", "Active"],
                      ["done", "Done"],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        className={
                          filter === key
                            ? "premium-tab active"
                            : "premium-tab"
                        }
                        onClick={() => setFilter(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                </div>

                {superMode.showExtendNotice && (
                  <div className="super-expiry-notice">
                    <div>
                      <strong>
                        Super ends in {
                          superMode.remainingLabel
                        }
                      </strong>
                      <span>
                        Extend now to keep task access.
                      </span>
                    </div>

                    <div>
                      <button
                        type="button"
                        disabled={
                          superMode.actionLoading
                        }
                        onClick={
                       requestExtendSuper
                       }
                      >
                        Extend 30m
                      </button>

                      <button
                        type="button"
                        className="end"
                        disabled={
                          superMode.actionLoading
                        }
                        onClick={
                     requestEndSuper
                     }
                      >
                        End
                      </button>
                    </div>
                  </div>
                )}

                {error && <div className="brief-item red">{error}</div>}
                {aiEmailError && (
                  <div className="brief-item amber">{aiEmailError}</div>
                )}

                {!loading && filteredTasks.length === 0 && (
                  <div className="brief-item blue">No matching items found.</div>
                )}

                <div className="timeline-scroll">
                  <Timeline
                    tasks={filteredTasks as any}
                    staffName={staff.name}
                    onChanged={refreshAll}
                    canWork={canUseTasks}
                  />
                </div>
              </section>
            </section>
          )}

          {mobileTab === "today" && <MobileToday />}

          {mobileTab === "performance" && (
            <MobilePerformance
              stats={stats}
              performance={performance}
            />
          )}

          {mobileTab === "profile" && (
            <MobileProfile
              staff={staff}
              shift={shift}
              onLogout={onLogout}
            />
          )}
        </div>

        <MobileBottomNav
          activeTab={mobileTab}
          onChange={setMobileTab}
        />

        <MobileQuickAction
          hidden={mobileTab !== "timeline"}
          onClick={() => setQuickOpen(true)}
        />
      </section>

      {quickOpen && (
        <div className="modal-overlay">
          <div
            className="glass-card"
            style={{
              width:
                "min(560px, 100%)",
            }}
          >
            <div className="section-head">
              <div>
                <h2>Quick Action</h2>

                <p>
                  Create a tracked task
                  from phone or WhatsApp
                  requests.
                </p>
              </div>

              <button
                className="ghost"
                onClick={() =>
                  setQuickOpen(false)
                }
                disabled={
                  savingQuickTask
                }
              >
                Close
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gap: 14,
                marginTop: 18,
              }}
            >
              <label>
                <strong>Source</strong>

                <select
                  value={quickSource}
                  onChange={(event) =>
                    setQuickSource(
                      event.target.value
                    )
                  }
                >
                  {sources.map(
                    (item) => (
                      <option
                        key={item}
                        value={item}
                      >
                        {item}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                <strong>Task</strong>

                <select
                  value={quickTaskType}
                  onChange={(event) =>
                    setQuickTaskType(
                      event.target.value
                    )
                  }
                >
                  {taskTypes.map(
                    (item) => (
                      <option
                        key={item}
                        value={item}
                      >
                        {item}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                <strong>
                  Property
                </strong>

                <select
                  value={quickProperty}
                  onChange={(event) =>
                    setQuickProperty(
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    Select property
                  </option>

                  {properties.map(
                    (property) => (
                      <option
                        key={property}
                        value={property}
                      >
                        {property}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontWeight: 900,
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    quickPriorityHigh
                  }
                  onChange={(event) =>
                    setQuickPriorityHigh(
                      event.target
                        .checked
                    )
                  }
                  style={{
                    width: 18,
                    height: 18,
                  }}
                />

                High Priority
              </label>

              <label>
                <strong>Note</strong>

                <textarea
                  placeholder="Example: Close Deluxe room tomorrow due owner request"
                  value={quickNote}
                  onChange={(event) =>
                    setQuickNote(
                      event.target.value
                    )
                  }
                />
              </label>

              {quickError && (
                <div className="brief-item red">
                  {quickError}
                </div>
              )}

              <button
                className="ghost"
                onClick={() =>
                  void createQuickTask()
                }
                disabled={
                  savingQuickTask ||
                  !quickProperty.trim()
                }
              >
                {savingQuickTask
                  ? "Creating..."
                  : "✨ Create Task"}
              </button>
            </div>
          </div>
        </div>
      )}

<ConfirmDialog
        open={superDialog !== null}
        title={
          superDialog === "start"
            ? "Enable Super?"
            : superDialog === "extend"
            ? "Extend Super?"
            : "End Super?"
        }
        message={
          superDialog === "start"
            ? "You are about to take after-hours operational responsibility."
            : superDialog === "extend"
            ? "Your Super session will be extended by another 30 minutes."
            : "Task actions will become unavailable immediately."
        }
        confirmLabel={
          superDialog === "start"
            ? "Start Super"
            : superDialog === "extend"
            ? "Extend 30 Minutes"
            : "End Super"
        }
        cancelLabel={
          superDialog === "end"
            ? "Keep Active"
            : "Cancel"
        }
        tone={
          superDialog === "end"
            ? "danger"
            : "amber"
        }
        loading={
          superMode.actionLoading
        }
        details={
          superDialog === "start"
            ? [
                "Task actions will be enabled for 30 minutes.",
                "Other team members will see you as the active Super user.",
                "You can extend or end the session at any time.",
              ]
            : superDialog === "extend"
            ? [
                "Another 30 minutes will be added.",
                "Your current Super responsibility will continue.",
              ]
            : [
                "Start, Done, Approve and Ignore actions will be blocked.",
                "Other team members will see Super as available.",
              ]
        }
        onCancel={() => {
          if (
            !superMode.actionLoading
          ) {
            setSuperDialog(null);
          }
        }}
        onConfirm={
          confirmSuperAction
        }
      />
    </main>
  );
}
