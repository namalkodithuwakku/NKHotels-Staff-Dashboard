"use client";

import { useEffect, useMemo, useState } from "react";

import Sidebar from "../components/Sidebar";
import ThemeSwitcher from "../components/theme/ThemeSwitcher";

import { StaffSession } from "../hooks/useAuth";
import { useTasks } from "../hooks/useTasks";

import {
  createTask,
  fetchEmailReaderItems,
  fetchProperties,
} from "../lib/api";

import CEOHeader from "./master/CEOHeader";
import CompanyStats from "./master/CompanyStats";
import CompanyActivity from "./master/CompanyActivity";
import CEOBrief from "./master/CEOBrief";

const sources = [
  "Phone Call",
  "WhatsApp Group",
  "Email",
  "OTA",
  "Client Portal",
  "Master Dashboard",
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

function uniqueCount(values: string[]) {
  return new Set(
    values
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  ).size;
}

function isCompletedItem(item: any) {
  if (item?.type === "ai_email") {
    return false;
  }

  const status = String(item?.status || "")
    .trim()
    .toLowerCase();

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

  const directTime = new Date(raw).getTime();

  if (!Number.isNaN(directTime)) {
    return directTime;
  }

  const match = String(raw).match(
    /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/
  );

  if (!match) return 0;

  const [, dd, mm, yyyy, hh, min] = match;

  return new Date(
    Number(yyyy),
    Number(mm) - 1,
    Number(dd),
    Number(hh),
    Number(min)
  ).getTime();
}

export default function MasterDashboard({
  staff,
  onLogout,
}: {
  staff: StaffSession;
  onLogout: () => void;
}) {
  const {
    last24Tasks,
    stats,
    loading,
    error,
    reload,
  } = useTasks(
    staff.name,
    true,
    true
  );

  const [aiEmailItems, setAiEmailItems] =
    useState<any[]>([]);

  const [quickOpen, setQuickOpen] =
    useState(false);

  const [quickSource, setQuickSource] =
    useState("WhatsApp Group");

  const [quickTaskType, setQuickTaskType] =
    useState("Room Block");

  const [quickProperty, setQuickProperty] =
    useState("");

  const [
    quickPriorityHigh,
    setQuickPriorityHigh,
  ] = useState(false);

  const [quickNote, setQuickNote] =
    useState("");

  const [
    propertiesList,
    setPropertiesList,
  ] = useState<string[]>([]);

  const [
    savingQuickTask,
    setSavingQuickTask,
  ] = useState(false);

  const [quickError, setQuickError] =
    useState("");

  async function loadAIEmails() {
    try {
      const items =
        await fetchEmailReaderItems();

      setAiEmailItems(
        Array.isArray(items)
          ? items
          : []
      );
    } catch {
      setAiEmailItems([]);
    }
  }

  async function reloadAll() {
    await Promise.all([
      reload(),
      loadAIEmails(),
    ]);
  }

  useEffect(() => {
    void loadAIEmails();

    const timer = window.setInterval(
      () => {
        void loadAIEmails();
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
        setPropertiesList(
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

  const activityItems =
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
    ].sort((a: any, b: any) => {
      const aCompleted =
        isCompletedItem(a);

      const bCompleted =
        isCompletedItem(b);

      /*
       * Open items and AI emails
       * always stay above completed work.
       */
      if (aCompleted !== bCompleted) {
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
    last24Tasks,
    aiEmailItems,
  ]);

  const propertyCount = uniqueCount(
    activityItems.map(
      (task: any) =>
        task?.property || ""
    )
  );

  const staffCount = uniqueCount(
    last24Tasks.map(
      (task) =>
        task?.assignedTo || ""
    )
  );

  function closeQuickAction() {
    if (savingQuickTask) return;

    setQuickOpen(false);
    setQuickError("");
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

        shift: "Master",
      });

      setQuickOpen(false);
      setQuickSource("WhatsApp Group");
      setQuickTaskType("Room Block");
      setQuickProperty("");
      setQuickPriorityHigh(false);
      setQuickNote("");

      await reloadAll();
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
        shiftActive={true}
      />

      <section className="main">
        <CEOHeader staff={staff} />

        <div
          className="section-head"
          style={{
            marginBottom: 18,
            alignItems: "center",
          }}
        >
          <div>
            <h2>Master Controls</h2>

            <p>
              Create operational tasks and
              manage dashboard appearance.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <ThemeSwitcher />

            <button
              type="button"
              className="ghost"
              onClick={() =>
                setQuickOpen(true)
              }
            >
              ⚡ Quick Action
            </button>

            <button
              type="button"
              className="ghost"
              onClick={() =>
                void reloadAll()
              }
            >
              Refresh
            </button>
          </div>
        </div>

        <CompanyStats
          properties={propertyCount}
          staff={staffCount}
          urgent={stats.urgent}
          completed={stats.completed}
        />

        <section className="workspace">
          <CompanyActivity
            tasks={activityItems as any}
            staffName={staff.name}
            loading={loading}
            error={error}
            onReload={reloadAll}
          />

          <CEOBrief
            tasks={activityItems as any}
          />
        </section>
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
                  Create a tracked task from
                  the Master Dashboard.
                </p>
              </div>

              <button
                type="button"
                className="ghost"
                onClick={
                  closeQuickAction
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
                  disabled={
                    savingQuickTask
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
                  value={
                    quickTaskType
                  }
                  onChange={(event) =>
                    setQuickTaskType(
                      event.target.value
                    )
                  }
                  disabled={
                    savingQuickTask
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
                  value={
                    quickProperty
                  }
                  onChange={(event) =>
                    setQuickProperty(
                      event.target.value
                    )
                  }
                  disabled={
                    savingQuickTask
                  }
                >
                  <option value="">
                    Select property
                  </option>

                  {propertiesList.map(
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
                      event.target.checked
                    )
                  }
                  disabled={
                    savingQuickTask
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
                  placeholder="Example: Close Deluxe room tomorrow due to owner request"
                  value={quickNote}
                  onChange={(event) =>
                    setQuickNote(
                      event.target.value
                    )
                  }
                  disabled={
                    savingQuickTask
                  }
                />
              </label>

              {quickError && (
                <div className="brief-item red">
                  {quickError}
                </div>
              )}

              <button
                type="button"
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
    </main>
  );
}