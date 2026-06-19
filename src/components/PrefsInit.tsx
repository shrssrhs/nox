"use client";

import { useEffect } from "react";

export function PrefsInit() {
  useEffect(() => {
    const fontSize = localStorage.getItem("nox_font_size");
    if (fontSize) {
      try { document.body.setAttribute("data-font-size", JSON.parse(fontSize)); } catch {}
    }
    const compact = localStorage.getItem("nox_compact_mode");
    if (compact === "true") document.body.classList.add("nox-compact");
  }, []);
  return null;
}
