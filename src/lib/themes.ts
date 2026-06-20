export type ColorTheme = "default" | "midnight" | "ocean" | "forest" | "rose" | "amoled";

export interface ThemeDef {
  label: string;
  swatch: string;
  bg: string;
  panel: string;
  surface: string;
  ownBg: string;
}

export const COLOR_THEMES: Record<ColorTheme, ThemeDef> = {
  default:  { label: "Default",  swatch: "#09090b", bg: "#09090b", panel: "#0d0d0f", surface: "#111113", ownBg: "rgba(255,255,255,0.10)" },
  midnight: { label: "Midnight", swatch: "#0b0b22", bg: "#04040e", panel: "#07071a", surface: "#0b0b22", ownBg: "rgba(99,102,241,0.22)"  },
  ocean:    { label: "Ocean",    swatch: "#0c1520", bg: "#050a10", panel: "#080f18", surface: "#0c1520", ownBg: "rgba(14,165,233,0.22)"  },
  forest:   { label: "Forest",   swatch: "#0d1a0d", bg: "#060e06", panel: "#091309", surface: "#0d1a0d", ownBg: "rgba(34,197,94,0.20)"   },
  rose:     { label: "Rose",     swatch: "#1b0c0e", bg: "#0e0507", panel: "#150809", surface: "#1b0c0e", ownBg: "rgba(244,63,94,0.22)"   },
  amoled:   { label: "AMOLED",  swatch: "#000000", bg: "#000000", panel: "#040404", surface: "#070707", ownBg: "rgba(255,255,255,0.08)" },
};

export function applyColorTheme(theme: ColorTheme): void {
  const t = COLOR_THEMES[theme];
  const root = document.documentElement;
  root.style.setProperty("--nox-bg",      t.bg);
  root.style.setProperty("--nox-panel",   t.panel);
  root.style.setProperty("--nox-surface", t.surface);
  root.style.setProperty("--nox-own-bg",  t.ownBg);
}
