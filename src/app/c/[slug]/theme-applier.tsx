"use client";

import { useEffect } from "react";

export function ThemeApplier({ themeKey }: { themeKey: string }) {
  useEffect(() => {
    const root = document.documentElement;
    // Remove any existing theme classes
    const toRemove = [...root.classList].filter((c) => c.startsWith("theme-"));
    toRemove.forEach((c) => root.classList.remove(c));
    // Apply new theme (if not the default)
    if (themeKey && themeKey !== "ascnd") {
      root.classList.add(`theme-${themeKey}`);
    }
    return () => {
      const existing = [...root.classList].filter((c) => c.startsWith("theme-"));
      existing.forEach((c) => root.classList.remove(c));
    };
  }, [themeKey]);

  return null;
}
