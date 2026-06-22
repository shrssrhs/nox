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

  return (
    <Onboarding
      initialStep={step}
      email={user.email ?? ""}
      initialName={displayName ?? ""}
    />
  );
}
