"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const saved = localStorage.getItem("theme") as Theme | null;

    const initial =
      saved ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light");

    applyTheme(initial);
  }, []);

  function applyTheme(next: Theme) {
    setTheme(next);

    document.documentElement.setAttribute("data-theme", next);

    localStorage.setItem("theme", next);
  }

  return (
    <div className="theme-switcher">
      <button
        type="button"
        className={theme === "light" ? "active" : ""}
        onClick={() => applyTheme("light")}
        aria-label="Light mode"
      >
        ☀️ Light
      </button>

      <button
        type="button"
        className={theme === "dark" ? "active" : ""}
        onClick={() => applyTheme("dark")}
        aria-label="Dark mode"
      >
        🌙 Dark
      </button>
    </div>
  );
}