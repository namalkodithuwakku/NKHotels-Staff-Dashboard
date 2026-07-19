"use client";

import {
  Clock3,
  Zap,
} from "lucide-react";

type SuperModeControlProps = {
  shiftActive: boolean;
  active: boolean;
  isMine: boolean;
  activeStaffName: string;
  remainingLabel: string;
  loading?: boolean;
  actionLoading?: boolean;
  error?: string;
  onStart: () => void | Promise<void>;
  onExtend: () => void | Promise<void>;
  onEnd: () => void | Promise<void>;
};

export default function SuperModeControl({
  shiftActive,
  active,
  isMine,
  activeStaffName,
  remainingLabel,
  loading = false,
  actionLoading = false,
  error = "",
  onStart,
  onExtend,
  onEnd,
}: SuperModeControlProps) {
  if (shiftActive) {
    return null;
  }

  if (loading) {
    return (
      <div className="super-mode-row muted">
        Checking Super...
      </div>
    );
  }

  if (active && isMine) {
    return (
      <div className="super-mode-panel active">
        <div className="super-mode-status">
          <Zap
            size={15}
            strokeWidth={2.3}
          />

          <div>
            <strong>Super Active</strong>
            <span>
              {remainingLabel} remaining
            </span>
          </div>
        </div>

        <div className="super-mode-actions">
          <button
            type="button"
            disabled={actionLoading}
            onClick={() =>
              void onExtend()
            }
          >
            Extend 30m
          </button>

          <button
            type="button"
            className="end"
            disabled={actionLoading}
            onClick={() =>
              void onEnd()
            }
          >
            End
          </button>
        </div>

        {error && (
          <small>{error}</small>
        )}
      </div>
    );
  }

  if (active) {
    return (
      <div className="super-mode-panel occupied">
        <div className="super-mode-status">
          <Zap
            size={15}
            strokeWidth={2.3}
          />

          <div>
            <strong>
              {activeStaffName ||
                "Team member"}{" "}
              is on Super
            </strong>

            <span>
              {remainingLabel} remaining
            </span>
          </div>
        </div>

        {error && (
          <small>{error}</small>
        )}
      </div>
    );
  }

  return (
    <div className="super-mode-panel available">
      <button
        type="button"
        className="super-start-button"
        disabled={actionLoading}
        onClick={() =>
          void onStart()
        }
      >
        <Clock3
          size={15}
          strokeWidth={2.2}
        />
        Super
      </button>

      {error && (
        <small>{error}</small>
      )}
    </div>
  );
}
