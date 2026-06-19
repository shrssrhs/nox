import { AppLayout } from "@/components/layout/AppLayout";
import { WelcomeAnimation } from "@/components/WelcomeAnimation";

export default function Home() {
  return (
    <>
      <WelcomeAnimation />
      <AppLayout />
    </>
  );
}