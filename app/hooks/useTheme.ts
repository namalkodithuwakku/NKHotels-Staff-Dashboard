"use client";

import { createContext, useContext } from "react";

export type ThemeMode = "light" | "dark" | "system";

export type ThemeContextValue = {
  theme: ThemeMode;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemeMode) => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return context;
}