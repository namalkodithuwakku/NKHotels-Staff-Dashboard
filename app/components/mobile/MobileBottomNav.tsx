"use client";

import type { ReactNode } from "react";

export type MobileTab = "timeline" | "today" | "performance" | "profile";

type MobileBottomNavProps = {
  activeTab: MobileTab;
  onChange: (tab: MobileTab) => void;
};

const items: Array<{
  key: MobileTab;
  label: string;
  icon: ReactNode;
}> = [
  {
    key: "timeline",
    label: "Timeline",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 10.5 12 4l8 6.5" />
        <path d="M6.5 9.5V20h11V9.5" />
        <path d="M10 20v-6h4v6" />
      </svg>
    ),
  },
  {
    key: "today",
    label: "Today",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M8 3v4M16 3v4M3 10h18" />
        <path d="M8 14h3M13 14h3M8 17h3" />
      </svg>
    ),
  },
  {
    key: "performance",
    label: "Performance",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
      </svg>
    ),
  },
  {
    key: "profile",
    label: "Profile",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
      </svg>
    ),
  },
];

export default function MobileBottomNav({
  activeTab,
  onChange,
}: MobileBottomNavProps) {
  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      {items.map((item) => {
        const active = activeTab === item.key;

        return (
          <button
            key={item.key}
            type="button"
            className={active ? "mobile-nav-item active" : "mobile-nav-item"}
            aria-current={active ? "page" : undefined}
            onClick={() => onChange(item.key)}
          >
            <span className="mobile-nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
