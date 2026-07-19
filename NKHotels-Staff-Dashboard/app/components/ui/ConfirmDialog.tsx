"use client";

import {
  AlertTriangle,
  X,
  Zap,
} from "lucide-react";

export type ConfirmDialogTone =
  | "amber"
  | "danger"
  | "neutral";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ConfirmDialogTone;
  loading?: boolean;
  details?: string[];
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "amber",
  loading = false,
  details = [],
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  const Icon =
    tone === "danger"
      ? AlertTriangle
      : Zap;

  return (
    <div
      className="confirm-dialog-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
            event.currentTarget &&
          !loading
        ) {
          onCancel();
        }
      }}
    >
      <section
        className={`confirm-dialog-card ${tone}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
      >
        <button
          type="button"
          className="confirm-dialog-close"
          aria-label="Close dialog"
          disabled={loading}
          onClick={onCancel}
        >
          <X
            size={17}
            strokeWidth={2.2}
          />
        </button>

        <div className="confirm-dialog-icon">
          <Icon
            size={22}
            strokeWidth={2.25}
          />
        </div>

        <div className="confirm-dialog-copy">
          <span className="confirm-dialog-kicker">
            N K HOTEL OS
          </span>

          <h2 id="confirm-dialog-title">
            {title}
          </h2>

          <p id="confirm-dialog-message">
            {message}
          </p>
        </div>

        {details.length > 0 && (
          <div className="confirm-dialog-details">
            {details.map((detail) => (
              <div key={detail}>
                <span />
                <p>{detail}</p>
              </div>
            ))}
          </div>
        )}

        <div className="confirm-dialog-actions">
          <button
            type="button"
            className="confirm-dialog-cancel"
            disabled={loading}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            className="confirm-dialog-confirm"
            disabled={loading}
            onClick={() =>
              void onConfirm()
            }
          >
            {loading
              ? "Please wait..."
              : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
