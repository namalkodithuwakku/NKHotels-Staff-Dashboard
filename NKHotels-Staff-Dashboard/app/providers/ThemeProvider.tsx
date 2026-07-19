"use client";

import { useEffect, useMemo, useState } from "react";
import { ThemeContext, ThemeMode } from "../hooks/useTheme";

const STORAGE_KEY = "nkh-theme";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<ThemeMode>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  function applyTheme(mode: ThemeMode) {
    const finalTheme = mode === "system" ? getSystemTheme() : mode;

    document.documentElement.setAttribute("data-theme", finalTheme);
    setResolvedTheme(finalTheme);
  }

  function setTheme(mode: ThemeMode) {
    setThemeState(mode);
    localStorage.setItem(STORAGE_KEY, mode);
    applyTheme(mode);
  }

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    const startTheme = saved || "system";

    setThemeState(startTheme);
    applyTheme(startTheme);

    const media = window.matchMedia("(prefers-color-scheme: dark)");

    function handleSystemChange() {
      if ((localStorage.getItem(STORAGE_KEY) || "system") === "system") {
        applyTheme("system");
      }
    }

    media.addEventListener("change", handleSystemChange);

    return () => {
      media.removeEventListener("change", handleSystemChange);
    };
  }, []);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [theme, resolvedTheme]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}