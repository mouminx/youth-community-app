export const THEME_KEYS = [
  "ascnd",
  "sky-high",
  "high-tide",
  "ruby",
  "evergreen",
  "saffron",
  "bloom",
  "tangerine",
] as const;

export type ThemeKey = (typeof THEME_KEYS)[number];
