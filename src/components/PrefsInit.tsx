"use client";

import { useEffect } from "react";

export function PrefsInit() {
  useEffect(() => {
    const root = document.documentElement;
    // Restore font size
    const fontSize = localStorage.getItem("nox_font_size");
    if (fontSize) {
      try {
        const val = JSON.parse(fontSize) as string;
        const sizes: Record<string, string> = { sm: "11px", lg: "16px" };
        if (sizes[val]) root.style.setProperty("--nox-font-size", sizes[val]);
      } catch {}
    }
    // Restore compact mode
    const compact = localStorage.getItem("nox_compact_mode");
    if (compact === "true") {
      root.style.setProperty("--nox-gap", "0.375rem");
      root.style.setProperty("--nox-padding", "0.75rem 1.5rem");
    }

    // Register service worker for background notifications
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {});
    }
  }, []);
  return null;
}

/** Send a notification via the service worker (works when tab is backgrounded). */
export function swNotify(title: string, body: string, tag?: string) {
  if (typeof navigator === "undefined") return;
  if (Notification.permission !== "granted") return;
  if (document.hasFocus()) return;

  // Prefer SW notification (shows even in background)
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: "NOX_NOTIFY",
      title,
      body,
      tag: tag ?? "nox-msg",
    });
  } else {
    try { new Notification(title, { body, silent: false }); } catch {}
  }
}
