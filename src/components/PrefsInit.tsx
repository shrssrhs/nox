"use client";

import { useEffect } from "react";

export function PrefsInit() {
  useEffect(() => {
    // Apply saved appearance prefs
    const fontSize = localStorage.getItem("nox_font_size");
    if (fontSize) {
      try { document.body.setAttribute("data-font-size", JSON.parse(fontSize)); } catch {}
    }
    const compact = localStorage.getItem("nox_compact_mode");
    if (compact === "true") document.body.classList.add("nox-compact");

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
