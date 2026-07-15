"use client";

import {
  Clock3,
  Zap,
} from "lucide-react";

type MobileHeaderProps = {
  staffName: string;
  shiftLabel?: string;
  canWork: boolean;
  onRefresh: () => void | Promise<void>;
  refreshing?: boolean;

  superActive?: boolean;
  superIsMine?: boolean;
  superStaffName?: string;
  superRemainingLabel?: string;
  superLoading?: boolean;
  superActionLoading?: boolean;
  onStartSuper?: () => void | Promise<void>;
  onExtendSuper?: () => void | Promise<void>;
  onEndSuper?: () => void | Promise<void>;
};

export default function MobileHeader({
  staffName,
  shiftLabel,
  canWork,
  onRefresh,
  refreshing = false,

  superActive = false,
  superIsMine = false,
  superStaffName = "",
  superRemainingLabel = "",
  superLoading = false,
  superActionLoading = false,
  onStartSuper,
  onExtendSuper: _onExtendSuper,
  onEndSuper,
}: MobileHeaderProps) {
  return (
    <header className="mobile-app-header">
      <div className="mobile-header-left">
        <div className="mobile-logo-wrap">
          <img
            src="/favicon.ico"
            alt="N K Hotel OS"
            className="mobile-logo"
          />
        </div>

        <div className="mobile-header-brand">
          <span className="mobile-header-kicker">
            N K HOTEL OS
          </span>

          <strong>OPERATIONS</strong>
        </div>
      </div>

      <div className="mobile-header-user">
        <div className="mobile-user-copy">
          <strong>{staffName}</strong>

          <span>
            <i
              className={
                canWork
                  ? "mobile-status-dot active"
                  : superIsMine
                  ? "mobile-status-dot super"
                  : "mobile-status-dot"
              }
            />

            {canWork
              ? shiftLabel ||
                "Shift Active"
              : superIsMine
              ? `Super · ${superRemainingLabel}`
              : superActive
              ? `${superStaffName} on Super`
              : "View Only"}
          </span>

          {!canWork && (
            <div className="mobile-super-inline">
              {!superActive && (
                <button
                  type="button"
                  disabled={
                    superLoading ||
                    superActionLoading
                  }
                  onClick={() =>
                    void onStartSuper?.()
                  }
                  aria-label="Start Super"
                  title="Start Super"
                >
                  <Clock3
                    size={14}
                    strokeWidth={2.2}
                  />
                  Super
                </button>
              )}

              {superIsMine && (
                <>
                  <button
                    type="button"
                    className="end"
                    disabled={
                      superActionLoading
                    }
                    onClick={() =>
                      void onEndSuper?.()
                    }
                  >
                    End
                  </button>
                </>
              )}

              {superActive &&
                !superIsMine && (
                  <span>
                    <Zap
                      size={13}
                      strokeWidth={2.2}
                    />
                    {superRemainingLabel}
                  </span>
                )}
            </div>
          )}
        </div>

        <button
          type="button"
          className="mobile-icon-button"
          aria-label="Refresh timeline"
          title="Refresh"
          disabled={refreshing}
          onClick={() =>
            void onRefresh()
          }
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M20 6v5h-5" />
            <path d="M4 18v-5h5" />
            <path d="M18.5 9A7 7 0 0 0 6.3 6.3L4 8" />
            <path d="M5.5 15A7 7 0 0 0 17.7 17.7L20 16" />
          </svg>
        </button>
      </div>
    </header>
  );
}
