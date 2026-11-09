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
  // Challenge before profile queries: profile RLS correctly rejects AAL1
  // sessions when this user has a verified factor.
  const { data: aal, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError) throw assuranceError;
  if (aal?.currentLevel !== "aal2" && aal?.nextLevel === "aal2") return { step: "mfa-challenge", displayName:null };
  const { data: profile, error } = await supabase.from("profiles").select("display_name").eq("id",userId).maybeSingle();
  if (error) throw error;
  if (!profile) throw new Error("Profile has not been provisioned");
  const displayName: string | null = profile.display_name;
  return { step: displayName?.trim() ? "done" : "profile", displayName };
}
