"use client";

import { CirclePlus } from "lucide-react";

type MobileQuickActionProps = {
  onClick: () => void;
  hidden?: boolean;
};

export default function MobileQuickAction({
  onClick,
  hidden = false,
}: MobileQuickActionProps) {
  if (hidden) return null;

  return (
    <button
      type="button"
      className="mobile-quick-action"
      aria-label="Create quick task"
      title="Quick Action"
      onClick={onClick}
    >
      <CirclePlus
        size={23}
        strokeWidth={2.35}
        aria-hidden="true"
      />
    </button>
  );
}
