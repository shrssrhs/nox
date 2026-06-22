"use client";
import { useEffect, useState } from "react";

// Tracks the on-screen keyboard via the VisualViewport API (iOS Safari / Android).
// Without this, focusing an input makes Safari scroll the whole page up and shove
// a `position: fixed` bottom bar off-screen. We instead:
//   • pin a CSS var `--app-height` to the *visible* viewport height, and
//   • report whether the keyboard is currently open (so the caller can hide the
//     bottom nav and drop its padding while typing).
export function useKeyboardViewport(enabled: boolean) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;

    const apply = () => {
      document.documentElement.style.setProperty("--app-height", `${vv.height}px`);
      // Keyboard counts as open when the visible area is meaningfully shorter.
      setKeyboardOpen(window.innerHeight - vv.height > 120);
      // Stop Safari from scrolling the body up under the keyboard.
      window.scrollTo(0, 0);
    };

    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      document.documentElement.style.removeProperty("--app-height");
    };
  }, [enabled]);

  return keyboardOpen;
}
