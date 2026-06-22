// lib/auth/onboarding.ts — decides which onboarding step a logged-in user needs.
// Flow: profile (display_name) is mandatory. 2FA is OPTIONAL (managed in account
// settings), but if a user HAS enrolled a factor, every login must still elevate
// to aal2 via a code challenge.
import type { SupabaseClient } from "@supabase/supabase-js";

export type OnboardingStep = "profile" | "mfa-challenge" | "done";

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

  // 2. If 2FA is enrolled, this session must be elevated to aal2.
  //   currentLevel === 'aal2'              → fully authenticated → done
  //   nextLevel === 'aal2', current 'aal1' → has a factor, not elevated → challenge
  //   nextLevel === 'aal1'                 → no factor (2FA off) → done
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (aal?.currentLevel === "aal2") return { step: "done", displayName };
  if (aal?.nextLevel === "aal2") return { step: "mfa-challenge", displayName };
  return { step: "done", displayName };
}
