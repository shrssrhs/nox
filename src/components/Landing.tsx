import Link from "next/link";
import { DemoButton } from "@/components/DemoButton";

// ─── Brand mark ───────────────────────────────────────────────────────────────
function Logo({ size = 36 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(145deg,#1e1b4b 0%,#3730a3 60%,#1e1b4b 100%)",
        border: "1px solid rgba(167,139,250,0.25)",
        boxShadow: "0 0 24px rgba(124,58,237,0.25)",
      }}
    >
      <span className="font-black text-white" style={{ fontSize: size * 0.5 }}>N</span>
    </div>
  );
}

// ─── Tiny app preview (pure CSS, no screenshot needed) ────────────────────────
function AppPreview() {
  return (
    <div
      className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10"
      style={{ background: "#0d0d10", boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}
    >
      {/* window bar */}
      <div className="flex items-center gap-1.5 border-b border-white/8 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
      </div>
      <div className="flex h-64">
        {/* sidebar */}
        <div className="w-28 flex-shrink-0 border-r border-white/8 p-2.5">
          <p className="mb-2 px-1 text-[8px] font-semibold uppercase tracking-wider text-white/25">Channels</p>
          <div className="mb-1 rounded-md bg-white/10 px-2 py-1.5 text-[10px] text-white">
            <span className="opacity-40">#</span> general
          </div>
          <div className="mb-1 flex flex-col gap-1 rounded-md px-2 py-1.5 text-[10px] text-white/45">
            <span><span className="opacity-40">#</span> hangout</span>
            {/* call presence stack */}
            <span className="flex items-center gap-1 pl-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="flex">
                <span className="h-3 w-3 rounded-full bg-violet-400/70 ring-2 ring-[#0d0d10]" />
                <span className="-ml-1 h-3 w-3 rounded-full bg-sky-400/70 ring-2 ring-[#0d0d10]" />
                <span className="-ml-1 h-3 w-3 rounded-full bg-pink-400/70 ring-2 ring-[#0d0d10]" />
              </span>
            </span>
          </div>
          <div className="rounded-md px-2 py-1.5 text-[10px] text-white/45"><span className="opacity-40">#</span> dev</div>
        </div>
        {/* messages */}
        <div className="flex flex-1 flex-col justify-end gap-2 p-3">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-full bg-white/10" />
            <span className="rounded-2xl rounded-tl-sm bg-white/5 px-3 py-1.5 text-[10px] text-white/80">welcome to our space 👋</span>
          </div>
          <div className="flex items-start justify-end gap-2">
            <span className="rounded-2xl rounded-tr-sm bg-violet-500/20 px-3 py-1.5 text-[10px] text-white">finally, somewhere that's *ours*</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-full bg-white/10" />
            <span className="rounded-2xl rounded-tl-sm bg-white/5 px-3 py-1.5 text-[10px] text-white/80">jump in the call 🎧</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Feature card ─────────────────────────────────────────────────────────────
function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-violet-300">
        {icon}
      </div>
      <h3 className="mb-1.5 text-base font-semibold text-white">{title}</h3>
      <p className="text-sm leading-relaxed text-white/45">{body}</p>
    </div>
  );
}

// ─── Landing page ─────────────────────────────────────────────────────────────
export function Landing() {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden" style={{ background: "#09090b" }}>
      {/* ambient glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 -z-0 h-[420px] w-[820px] -translate-x-1/2 blur-[120px]"
        style={{ background: "radial-gradient(ellipse at center, rgba(124,58,237,0.22), transparent 70%)" }}
      />

      <div className="relative z-10 mx-auto max-w-5xl px-6">
        {/* nav */}
        <nav className="flex items-center justify-between py-6">
          <div className="flex items-center gap-2.5">
            <Logo size={32} />
            <span className="text-lg font-bold tracking-tight text-white">Nox</span>
          </div>
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-white/60 transition-colors hover:text-white"
          >
            Sign in
          </Link>
        </nav>

        {/* hero */}
        <header className="flex flex-col items-center pt-16 pb-12 text-center md:pt-24">
          <span className="mb-6 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs font-medium tracking-wide text-white/50">
            Your space. Your people.
          </span>
          <h1
            className="max-w-3xl text-[clamp(38px,7vw,68px)] font-black leading-[1.05] tracking-tight text-white"
          >
            A home for{" "}
            <span
              style={{
                background: "linear-gradient(90deg,#c4b5fd,#818cf8,#60a5fa)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              your people.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/50 md:text-lg">
            A fast, private place to chat, call, and hang out with your circle — channels, DMs,
            and video in one cozy app that&apos;s actually yours.
          </p>

          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
            <Link
              href="/login"
              className="rounded-xl px-7 py-3.5 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
              style={{
                background: "linear-gradient(145deg,#4338ca,#6d28d9)",
                boxShadow: "0 8px 30px rgba(109,40,217,0.4)",
              }}
            >
              Create your space — it&apos;s free
            </Link>
            <DemoButton className="rounded-xl border border-white/12 px-7 py-3.5 text-sm font-semibold text-white/70 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-60" />
          </div>

          <div className="mt-16 flex w-full justify-center">
            <AppPreview />
          </div>
        </header>

        {/* features */}
        <section className="grid gap-4 py-16 sm:grid-cols-2">
          <Feature
            title="Real-time channels & DMs"
            body="Topic channels and private messages that arrive the instant they're sent. Reactions, replies, pins, markdown and file sharing built in."
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            }
          />
          <Feature
            title="Voice & video — see who's in"
            body="Hop into a call with a tap. Just like Discord, you can see who's already in the call from the sidebar before you even join."
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            }
          />
          <Feature
            title="Broadcast channels"
            body="Lock a channel to owner-only so just you can post — perfect for announcements, drops, and one-to-many updates without the noise."
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 11l18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
              </svg>
            }
          />
          <Feature
            title="Yours to control"
            body="Your space, your rules. No feeds, no ads, no algorithm deciding what your people see — just the room you built for them."
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            }
          />
        </section>

        {/* final CTA */}
        <section className="flex flex-col items-center rounded-3xl border border-white/8 bg-white/[0.02] px-6 py-16 text-center">
          <Logo size={44} />
          <h2 className="mt-6 max-w-md text-3xl font-bold leading-tight text-white">
            Bring your people home.
          </h2>
          <p className="mt-3 max-w-sm text-sm text-white/45">
            Spin up your space in seconds and invite your circle.
          </p>
          <Link
            href="/login"
            className="mt-8 rounded-xl px-7 py-3.5 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
            style={{
              background: "linear-gradient(145deg,#4338ca,#6d28d9)",
              boxShadow: "0 8px 30px rgba(109,40,217,0.4)",
            }}
          >
            Get started
          </Link>
        </section>

        {/* footer */}
        <footer className="flex flex-col items-center gap-2 py-10 text-center">
          <div className="flex items-center gap-2 opacity-60">
            <Logo size={20} />
            <span className="text-sm font-semibold text-white/60">Nox</span>
          </div>
          <p className="text-xs text-white/25">Your space. Your people.</p>
        </footer>
      </div>
    </div>
  );
}
