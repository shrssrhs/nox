import { redirect } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { WelcomeAnimation } from "@/components/WelcomeAnimation";
import { Landing } from "@/components/Landing";
import { createClient } from "@/lib/supabase/server";
import { resolveOnboardingStep } from "@/lib/auth/onboarding";

export default async function Home() {
  // Logged-out visitors see the marketing landing; members get the app.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return <Landing />;

  // First-run / 2FA gate: profile setup and TOTP are mandatory before the app.
  const { step } = await resolveOnboardingStep(supabase, user.id);
  if (step !== "done") redirect("/onboarding");

  return (
    <>
      <WelcomeAnimation />
      <AppLayout />
    </>
  );
}
