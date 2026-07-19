"use client";

import {
  Clock3,
  ShieldCheck,
  Zap,
} from "lucide-react";

type OperationsStatusTabsProps = {
  currentStaffName: string;

  currentUserOnShift: boolean;
  activeShiftStaffName?: string;

  superActive: boolean;
  superIsMine: boolean;
  superStaffName?: string;
  superRemainingLabel?: string;

  loading?: boolean;
  actionLoading?: boolean;

  onStartSuper: () => void | Promise<void>;
  onExtendSuper: () => void | Promise<void>;
  onEndSuper: () => void | Promise<void>;
};

export default function OperationsStatusTabs({
  currentStaffName,
  currentUserOnShift,
  activeShiftStaffName = "",

  superActive,
  superIsMine,
  superStaffName = "",
  superRemainingLabel = "",

  loading = false,
  actionLoading = false,

  onStartSuper,
  onExtendSuper: _onExtendSuper,
  onEndSuper,
}: OperationsStatusTabsProps) {
  const cleanShiftName =
    String(
      activeShiftStaffName || ""
    ).trim();

  const otherShiftActive =
    !currentUserOnShift &&
    Boolean(cleanShiftName);

  const shiftClass =
    currentUserOnShift
      ? "active"
      : otherShiftActive
      ? "covered"
      : "inactive";

  const shiftLabel =
    currentUserOnShift
      ? "Shift Active"
      : otherShiftActive
      ? `${cleanShiftName} · On Shift`
      : "Shift Inactive";

  const superClass =
    superActive
      ? "active"
      : currentUserOnShift
      ? "inactive"
      : "available";

  const superLabel =
    superActive
      ? superIsMine
        ? "Super Active"
        : `${
            superStaffName ||
            "Team Member"
          } · Super`
      : currentUserOnShift
      ? "Super Inactive"
      : "Super Available";

  return (
    <div className="operations-status-tabs">
      <div
        className={`operations-status-tab shift ${shiftClass}`}
        title={
          currentUserOnShift
            ? `${currentStaffName} is currently on shift`
            : otherShiftActive
            ? `${cleanShiftName} is currently on shift`
            : "No active shift detected"
        }
      >
        <span className="operations-status-icon">
          {currentUserOnShift ? (
            <ShieldCheck
              size={17}
              strokeWidth={2.35}
            />
          ) : (
            <Clock3
              size={17}
              strokeWidth={2.2}
            />
          )}
        </span>

        <span className="operations-status-copy">
          <strong>{shiftLabel}</strong>

          <small>
            {currentUserOnShift
              ? "Scheduled responsibility"
              : otherShiftActive
              ? "Team coverage active"
              : "No roster coverage"}
          </small>
        </span>
      </div>

      <div
        className={`operations-status-tab super ${superClass}`}
      >
        <button
          type="button"
          className="operations-super-main"
          disabled={
            loading ||
            actionLoading ||
            currentUserOnShift ||
            (superActive &&
              !superIsMine)
          }
          title={
            currentUserOnShift
              ? "Super is unavailable during your scheduled shift"
              : superActive &&
                !superIsMine
              ? `${
                  superStaffName ||
                  "Another team member"
                } is already on Super`
              : superIsMine
              ? "Super is active"
              : "Start a 30-minute Super session"
          }
          onClick={() => {
            if (
              !superActive &&
              !currentUserOnShift
            ) {
              void onStartSuper();
            }
          }}
        >
          <span className="operations-status-icon">
            <Zap
              size={17}
              strokeWidth={2.35}
            />
          </span>

          <span className="operations-status-copy">
            <strong>{superLabel}</strong>

            <small>
              {loading
                ? "Checking..."
                : superActive
                ? `${superRemainingLabel} remaining`
                : currentUserOnShift
                ? "Scheduled shift has control"
                : "30-minute task access"}
            </small>
          </span>
        </button>

        {superActive &&
          superIsMine && (
            <div className="operations-super-actions">
              <button
                type="button"
                className="end"
                disabled={actionLoading}
                onClick={() =>
                  void onEndSuper()
                }
                title="End Super"
              >
                End
              </button>
            </div>
          )}
      </div>
    </div>
  );
}
