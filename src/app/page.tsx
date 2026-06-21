import { AppLayout } from "@/components/layout/AppLayout";
import { WelcomeAnimation } from "@/components/WelcomeAnimation";
import { Landing } from "@/components/Landing";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  // Logged-out visitors see the marketing landing; members get the app.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return <Landing />;

  return (
    <>
      <WelcomeAnimation />
      <AppLayout />
    </>
  );
}
