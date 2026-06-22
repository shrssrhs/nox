// lib/auth/onboarding.ts — decides which onboarding step a logged-in user needs.
// Mandatory flow: profile (display_name) → TOTP 2FA → app.
import type { SupabaseClient } from "@supabase/supabase-js";

export type OnboardingStep = "profile" | "mfa-enroll" | "mfa-challenge" | "done";

export async function resolveOnboardingStep(
  supabase: SupabaseClient,
  userId: string
): Promise<{ step: OnboardingStep; displayName: string | null }> {
  // 1. Profile must have a display name (row is created by the DB trigger on signup).
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .single();
  const displayName: string | null = profile?.display_name ?? null;

  if (!displayName || !displayName.trim()) {
    return { step: "profile", displayName };
  }

  // 2. 2FA is mandatory. Read the assurance level off the session.
  //   nextLevel === 'aal1'                  → no verified factor → must enrol
  //   nextLevel === 'aal2', current 'aal1'  → enrolled but this session not elevated → challenge
  //   currentLevel === 'aal2'               → fully authenticated → done
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (aal?.currentLevel === "aal2") return { step: "done", displayName };
  if (aal?.nextLevel === "aal2") return { step: "mfa-challenge", displayName };
  return { step: "mfa-enroll", displayName };
}
