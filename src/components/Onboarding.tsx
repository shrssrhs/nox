"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { OnboardingStep } from "@/lib/auth/onboarding";
import { isValidUsername, normalizeUsername } from "@/lib/auth/username";

type Step = Exclude<OnboardingStep, "done">;

export function Onboarding({
  initialStep,
  username: initialUsername,
  usernameLocked,
  initialName,
}: {
  initialStep: Step;
  username: string;
  usernameLocked: boolean;
  initialName: string;
}) {
  const supabase = createClient();
  const [step, setStep] = useState<Step>(initialStep);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Profile step
  const [name, setName] = useState(initialName);
  const [username, setUsername] = useState(initialUsername);

  // MFA challenge (only for users who already enrolled 2FA)
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const challengeInit = useRef(false);

  // ── Profile (mandatory) ──────────────────────────────────────────────────────
  async function saveProfile() {
    if (!name.trim()) { setError("Введите имя"); return; }
    const uname = usernameLocked ? initialUsername : normalizeUsername(username);
    if (!usernameLocked && uname && !isValidUsername(uname)) {
      setError("Юзернейм: 3–20 символов, латиница, цифры и _");
      return;
    }
    setBusy(true); setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Сессия истекла, войдите снова"); setBusy(false); return; }
    const { error: upErr } = await supabase
      .from("profiles")
      .update({ display_name: name.trim(), username: uname || null })
      .eq("id", user.id);
    if (upErr) { setError(upErr.message); setBusy(false); return; }

    // 2FA is optional — only stop for a challenge if a verified factor exists
    // and the session isn't elevated yet. Otherwise straight into the app.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2") {
      setBusy(false);
      setStep("mfa-challenge");
      return;
    }
    window.location.href = "/";
  }

  // ── MFA challenge (returning users with 2FA on) ──────────────────────────────
  const startChallenge = useCallback(async () => {
    setError(null);
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totp = (factors?.totp ?? []).find((f) => f.status === "verified");
    if (!totp) { window.location.href = "/"; return; } // no factor → nothing to do
    setFactorId(totp.id);
  }, [supabase]);

  useEffect(() => {
    if (step !== "mfa-challenge" || challengeInit.current) return;
    challengeInit.current = true;
    startChallenge();
  }, [step, startChallenge]);

  async function verifyCode() {
    if (!factorId || code.trim().length < 6) { setError("Введите 6-значный код"); return; }
    setBusy(true); setError(null);
    const { data: ch, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
    if (cErr || !ch) { setError(cErr?.message ?? "Ошибка"); setBusy(false); return; }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId, challengeId: ch.id, code: code.trim(),
    });
    if (vErr) { setError("Неверный код. Попробуйте ещё раз."); setBusy(false); return; }
    window.location.href = "/";
  }

  // Escape hatch: sign out and return to the landing page.
  async function signOutAndLeave() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div className="flex min-h-[100dvh] w-screen items-center justify-center bg-[#09090B] p-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
        {step === "profile" && (
          <>
            <h2 className="mb-1 text-center text-lg font-medium">Настройте профиль</h2>
            <p className="mb-6 text-center text-xs text-white/40">
              {usernameLocked ? `@${initialUsername}` : "Последний штрих"}
            </p>
            <div className="flex flex-col gap-4">
              <Field label="Имя в чате">
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex"
                  className={inputCls}
                />
              </Field>
              {usernameLocked ? (
                <Field label="Юзернейм (для входа)">
                  <input value={`@${initialUsername}`} readOnly disabled className={`${inputCls} opacity-50`} />
                </Field>
              ) : (
                <Field label="Юзернейм (необязательно)">
                  <input
                    value={username}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    placeholder="alex"
                    className={inputCls}
                  />
                </Field>
              )}
              {error && <ErrorBox>{error}</ErrorBox>}
              <PrimaryButton onClick={saveProfile} disabled={busy}>
                {busy ? "Сохраняем…" : "Продолжить"}
              </PrimaryButton>
            </div>
          </>
        )}

        {step === "mfa-challenge" && (
          <>
            <h2 className="mb-1 text-center text-lg font-medium">Подтвердите вход</h2>
            <p className="mb-6 text-center text-xs text-white/40">
              Введите 6-значный код из приложения-аутентификатора.
            </p>
            <div className="flex flex-col items-center gap-4">
              <CodeInput value={code} onChange={setCode} onEnter={verifyCode} />
              {error && <ErrorBox>{error}</ErrorBox>}
              <PrimaryButton onClick={verifyCode} disabled={busy || !factorId}>
                {busy ? "Проверяем…" : "Войти"}
              </PrimaryButton>
            </div>
          </>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={signOutAndLeave}
            className="text-xs text-white/40 transition-colors hover:text-white"
          >
            Выйти на главную
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-white/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-white/50">{label}</label>
      {children}
    </div>
  );
}

function CodeInput({
  value, onChange, onEnter,
}: { value: string; onChange: (v: string) => void; onEnter: () => void }) {
  return (
    <input
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      onKeyDown={(e) => { if (e.key === "Enter") onEnter(); }}
      placeholder="000000"
      className="w-40 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-center font-mono text-lg tracking-[0.4em] outline-none focus:border-white/20"
    />
  );
}

function PrimaryButton({
  children, onClick, disabled,
}: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="mt-1 w-full rounded-xl bg-white py-2.5 text-sm font-medium text-black transition-colors hover:bg-white/90 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return <p className="w-full rounded-lg bg-red-500/10 p-3 text-xs text-red-400">{children}</p>;
}
