import { ServiceUnavailable } from "@/components/ServiceUnavailable";
import { withDeadline } from "@/lib/request-budget";
import { redirect } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { Landing } from "@/components/Landing";
import { createClient } from "@/lib/supabase/server";
import { resolveOnboardingStep } from "@/lib/auth/onboarding";

export default async function Home() {
  // Logged-out visitors see the marketing landing; members get the app.
  const supabase = await createClient();
  let result;
  try { result = await withDeadline(supabase.auth.getUser()); } catch { return <ServiceUnavailable />; }
  const { data: { user }, error } = result;
  if (error && (error.status === 0 || (error.status ?? 0)>=500 || error.name === "AuthRetryableFetchError")) return <ServiceUnavailable />;

  if (!user) return <Landing />;

  // Profile setup is required; an enrolled MFA factor must be challenged.
  if (user.is_anonymous) redirect("/login?demo=unavailable");
  let step;
  try { ({ step } = await withDeadline(resolveOnboardingStep(supabase, user.id))); } catch { return <ServiceUnavailable />; }
  if (step !== "done") redirect("/onboarding");

  return <AppLayout />;
}
