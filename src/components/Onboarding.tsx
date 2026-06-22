"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  // One stable client for the whole flow. Creating it per-render churns the
  // useCallback identities below and re-fires the enrol effect endlessly.
  const supabase = useMemo(() => createClient(), []);
  const [step, setStep] = useState<Step>(initialStep);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Profile step
  const [name, setName] = useState(initialName);
  const [username, setUsername] = useState(initialUsername);

  // MFA state
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  // Ensures enrol/challenge kicks off exactly once per security step.
  const mfaInit = useRef(false);

  // ── Profile ────────────────────────────────────────────────────────────────
  async function saveProfile() {
    if (!name.trim()) { setError("Введите имя"); return; }
    // Locked usernames come from signup and are already valid. GitHub users may
    // optionally pick one here.
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

    // Profile done → security step. Existing verified factor → challenge, else enrol.
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const hasVerified = (factors?.totp ?? []).some((f) => f.status === "verified");
    setBusy(false);
    setStep(hasVerified ? "mfa-challenge" : "mfa-enroll");
  }

  // ── Enrol a fresh TOTP factor ────────────────────────────────────────────────
  const startEnroll = useCallback(async () => {
    setError(null);
    // Drop any half-finished factors so enrol never collides.
    const { data: factors } = await supabase.auth.mfa.listFactors();
    for (const f of factors?.all ?? []) {
      if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error: enrErr } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    if (enrErr || !data) { setError(enrErr?.message ?? "Не удалось включить 2FA"); return; }
    setFactorId(data.id);
    setQr(data.totp.qr_code);
    setSecret(data.totp.secret);
  }, [supabase]);

  // ── Pick the verified factor for a returning-user challenge ──────────────────
  const startChallenge = useCallback(async () => {
    setError(null);
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totp = (factors?.totp ?? []).find((f) => f.status === "verified");
    if (!totp) {
      // No verified factor → enrol instead. Re-arm the guard for the new step.
      mfaInit.current = false;
      setStep("mfa-enroll");
      return;
    }
    setFactorId(totp.id);
  }, [supabase]);

  // Kick off the right MFA setup once we land on a security step — exactly once.
  useEffect(() => {
    if (step !== "mfa-enroll" && step !== "mfa-challenge") return;
    if (mfaInit.current) return;
    mfaInit.current = true;
    if (step === "mfa-enroll") startEnroll();
    else startChallenge();
  }, [step, startEnroll, startChallenge]);

  // ── Verify the 6-digit code (shared by enrol + challenge) ────────────────────
  async function verifyCode() {
    if (!factorId || code.trim().length < 6) { setError("Введите 6-значный код"); return; }
    setBusy(true); setError(null);
    const { data: ch, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
    if (cErr || !ch) { setError(cErr?.message ?? "Ошибка"); setBusy(false); return; }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId, challengeId: ch.id, code: code.trim(),
    });
    if (vErr) { setError("Неверный код. Попробуйте ещё раз."); setBusy(false); return; }
    // Session is now aal2 — full nav so server gating sees the elevated cookie.
    window.location.href = "/";
  }

  // Escape hatch: onboarding is mandatory, so the only way out is to sign out.
  async function signOutAndLeave() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const securityActive = step === "mfa-enroll" || step === "mfa-challenge";

  return (
    <div className="flex min-h-[100dvh] w-screen items-center justify-center bg-[#09090B] p-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
        {/* Stepper */}
        <div className="mb-8 flex items-center justify-center gap-3 text-xs">
          <StepDot label="Профиль" active={step === "profile"} done={securityActive} />
          <span className="h-px w-8 bg-white/15" />
          <StepDot label="Безопасность" active={securityActive} done={false} />
        </div>

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

        {step === "mfa-enroll" && (
          <>
            <h2 className="mb-1 text-center text-lg font-medium">Двухфакторная защита</h2>
            <p className="mb-6 text-center text-xs text-white/40">
              Отсканируйте QR-код в Google Authenticator или Authy, затем введите 6-значный код.
            </p>
            <div className="flex flex-col items-center gap-4">
              {qr ? (
                <img
                  src={qr}
                  alt="QR-код 2FA"
                  className="h-44 w-44 rounded-lg bg-white p-2"
                />
              ) : (
                <div className="flex h-44 w-44 items-center justify-center rounded-lg border border-white/10">
                  <Spinner />
                </div>
              )}
              {secret && (
                <p className="break-all text-center font-mono text-[11px] text-white/40">
                  Или вручную: {secret}
                </p>
              )}
              <CodeInput value={code} onChange={setCode} onEnter={verifyCode} />
              {error && <ErrorBox>{error}</ErrorBox>}
              <PrimaryButton onClick={verifyCode} disabled={busy || !factorId}>
                {busy ? "Проверяем…" : "Подтвердить и войти"}
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

function StepDot({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
          done
            ? "border-green-500 bg-green-500 text-black"
            : active
            ? "border-white bg-white text-black"
            : "border-white/20 text-white/40"
        }`}
      >
        {done ? "✓" : ""}
      </span>
      <span className={active || done ? "text-white" : "text-white/40"}>{label}</span>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
