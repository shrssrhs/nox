import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveOnboardingStep } from "@/lib/auth/onboarding";
import { Onboarding } from "@/components/Onboarding";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { step, displayName } = await resolveOnboardingStep(supabase, user.id);
  if (step === "done") redirect("/");

  // Username-signups carry their handle in metadata; GitHub users don't (they
  // can pick one here). A locked username is the login credential — read-only.
  const meta = (user.user_metadata ?? {}) as { username?: string };

  return (
    <Onboarding
      initialStep={step}
      username={meta.username ?? ""}
      usernameLocked={Boolean(meta.username)}
      initialName={displayName ?? ""}
    />
  );
}
