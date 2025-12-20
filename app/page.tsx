import ExperienceBanner from "@/components/banner";
import LogoShowcase from "@/components/logo-showcase";

export default function Home() {
  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-12 lg:px-8 lg:py-16">
      <div className="pointer-events-none absolute inset-x-0 top-32 -z-10 mx-auto h-[32rem] w-[32rem] rounded-full bg-sky-500/10 blur-[180px]" />
      <ExperienceBanner />
      <LogoShowcase />
    </main>
  );
}
