"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * "Try the demo" — signs the visitor in anonymously and drops them into the app.
 * Requires Anonymous sign-ins enabled in Supabase + a channel flagged is_demo
 * with a trigger that auto-adds new users to it (see setup SQL). Until that's
 * configured, signInAnonymously errors and we show a graceful fallback.
 */
export function DemoButton({ className }: { className?: string }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(false);

  async function tryDemo() {
    setLoading(true);
    setErr(false);
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      setErr(true);
      setLoading(false);
      return;
    }
    window.location.href = "/";
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button onClick={tryDemo} disabled={loading} className={className}>
        {loading ? "Opening demo…" : "Try the demo — no signup"}
      </button>
      {err && (
        <span className="text-xs text-white/35">
          Demo isn&apos;t live yet — <a href="/login" className="underline hover:text-white/60">sign in</a> instead.
        </span>
      )}
    </div>
  );
}
