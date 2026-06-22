"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const supabase = createClient();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"email" | "github" | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? (typeof window !== "undefined" ? window.location.origin : "")}/auth/callback`;

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading("email");
    try {
      if (mode === "signup") {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo },
        });
        if (err) throw err;
        // Email confirmation is required → no session yet.
        if (!data.session) {
          setSentTo(email);
          return;
        }
        window.location.href = "/";
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        // Server gating routes to /onboarding (profile / 2FA) or the app.
        window.location.href = "/";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Что-то пошло не так");
    } finally {
      setLoading(null);
    }
  }

  async function signInGithub() {
    setLoading("github");
    await supabase.auth.signInWithOAuth({ provider: "github", options: { redirectTo } });
  }

  // ── Email-sent confirmation screen ──────────────────────────────────────────
  if (sentTo) {
    return (
      <Shell>
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/15 text-2xl">
            ✉️
          </div>
          <h2 className="mb-2 text-lg font-medium text-white">Проверьте почту</h2>
          <p className="text-sm text-white/50">
            Мы отправили ссылку для подтверждения на<br />
            <span className="text-white/80">{sentTo}</span>
          </p>
          <button
            onClick={() => { setSentTo(null); setMode("signin"); }}
            className="mt-6 text-xs text-white/40 transition-colors hover:text-white"
          >
            Назад ко входу
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <h2 className="mb-6 text-center text-lg font-medium text-white">
        {mode === "signup" ? "Создать аккаунт" : "С возвращением"}
      </h2>

      <form onSubmit={handleEmail} className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs text-white/50">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-white/50">Пароль</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={inputCls}
          />
        </div>

        {error && <p className="rounded-lg bg-red-500/10 p-3 text-xs text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading !== null}
          className="mt-1 w-full rounded-xl bg-white py-2.5 text-sm font-medium text-black transition-colors hover:bg-white/90 disabled:opacity-50"
        >
          {loading === "email"
            ? "Секунду…"
            : mode === "signup"
            ? "Зарегистрироваться"
            : "Войти"}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-[11px] text-white/30">
        <span className="h-px flex-1 bg-white/10" /> или <span className="h-px flex-1 bg-white/10" />
      </div>

      <button
        onClick={signInGithub}
        disabled={loading !== null}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-50"
      >
        {loading === "github" ? (
          <Spinner />
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
          </svg>
        )}
        Продолжить с GitHub
      </button>

      <div className="mt-6 text-center">
        <button
          onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(null); }}
          className="text-xs text-white/40 transition-colors hover:text-white"
        >
          {mode === "signup" ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Создать"}
        </button>
      </div>
    </Shell>
  );
}

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-white/20";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#09090B] p-4">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-white">Nox</h1>
        <p className="mt-2 text-sm text-white/40">Your space. Your people.</p>
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
        {children}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
