import { ServiceUnavailable } from "@/components/ServiceUnavailable";
import { withDeadline } from "@/lib/request-budget";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveOnboardingStep } from "@/lib/auth/onboarding";
import { Onboarding } from "@/components/Onboarding";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createClient();
  let result;
  try { result = await withDeadline(supabase.auth.getUser()); } catch { return <ServiceUnavailable />; }
  const { data: { user } } = result;
  if (!user) redirect("/login");

  if (user.is_anonymous) redirect("/login?demo=unavailable");
  let resolution;
  try { resolution = await withDeadline(resolveOnboardingStep(supabase,user.id)); } catch { return <ServiceUnavailable />; }
  const { step, displayName } = resolution;
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
