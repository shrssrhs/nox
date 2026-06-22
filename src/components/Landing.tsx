"use client";
import { useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { DemoButton } from "@/components/DemoButton";

// ─── Brand mark ───────────────────────────────────────────────────────────────
function Logo({ size = 36 }: { size?: number }) {
  return (
    <div
      style={{
        width: size, height: size, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: Math.round(size * 0.3),
        background: "linear-gradient(145deg,#1a1a1d 0%,#242428 55%,#161618 100%)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 0 24px rgba(255,255,255,0.06)",
      }}
    >
      <span style={{ fontWeight: 900, color: "white", fontSize: size * 0.5, lineHeight: 1 }}>N</span>
    </div>
  );
}

// ─── Wireframe ring ───────────────────────────────────────────────────────────
function WireframeRing() {
  const spokes = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return { x1: 300 + Math.cos(a) * 168, y1: 300 + Math.sin(a) * 168, x2: 300 + Math.cos(a) * 288, y2: 300 + Math.sin(a) * 288 };
  });
  return (
    <svg
      className="nox-ring pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      style={{ width: 600, height: 600, opacity: 0.09 }}
      viewBox="0 0 600 600"
      fill="none"
    >
      <circle cx="300" cy="300" r="288" stroke="white" strokeWidth="1" strokeDasharray="5 9" />
      <circle cx="300" cy="300" r="228" stroke="white" strokeWidth="0.6" strokeDasharray="2 14" />
      <circle cx="300" cy="300" r="168" stroke="white" strokeWidth="0.4" strokeDasharray="1 18" />
      {spokes.map((s, i) => (
        <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="white" strokeWidth="0.5" strokeOpacity="0.5" />
      ))}
    </svg>
  );
}

// ─── App preview (CSS mockup — no screenshot needed) ─────────────────────────
function AppPreview() {
  return (
    <div style={{
      background: "#0d0d10",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 20,
      overflow: "hidden",
      boxShadow: "0 50px 140px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.05) inset, 0 1px 0 rgba(255,255,255,0.1) inset",
      width: "100%",
      maxWidth: 540,
    }}>
      {/* Title bar */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 6 }}>
        {[0.14, 0.1, 0.07].map((op, i) => (
          <span key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: `rgba(255,255,255,${op})`, display: "inline-block" }} />
        ))}
        <span style={{ flex: 1, textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.2)", fontWeight: 500, marginRight: 28 }}>
          Nox — general
        </span>
      </div>

      <div style={{ display: "flex", height: 300 }}>
        {/* Sidebar */}
        <div style={{ width: 136, flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.06)", padding: "14px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
          <p style={{ fontSize: 8, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", paddingLeft: 6, marginBottom: 4 }}>Channels</p>
          {/* Active */}
          <div style={{ background: "rgba(255,255,255,0.09)", borderRadius: 8, padding: "6px 8px", fontSize: 10, color: "white", fontWeight: 500 }}>
            <span style={{ opacity: 0.35 }}>#</span> general
          </div>
          {/* With call presence */}
          <div style={{ borderRadius: 8, padding: "6px 8px", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
            <div><span style={{ opacity: 0.35 }}>#</span> hangout</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, paddingLeft: 8, marginTop: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 8px #34d399", display: "inline-block" }} />
              {[0.5, 0.35, 0.22].map((op, i) => (
                <span key={i} style={{ width: 13, height: 13, borderRadius: "50%", background: `rgba(255,255,255,${op})`, border: "2px solid #0d0d10", marginLeft: i > 0 ? -5 : 0, display: "inline-block" }} />
              ))}
            </div>
          </div>
          <div style={{ borderRadius: 8, padding: "6px 8px", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
            <span style={{ opacity: 0.35 }}>#</span> dev
          </div>
          {/* User bar */}
          <div style={{ marginTop: "auto", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,0.12)", display: "inline-block", flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>You</p>
              <p style={{ fontSize: 8, color: "rgba(255,255,255,0.25)" }}>Online</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "12px 14px", gap: 10 }}>
          {/* Channel header */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 10 }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}># general</span>
          </div>
          {/* Messages */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", marginBottom: 3, fontWeight: 600 }}>alex</p>
                <span style={{ background: "rgba(255,255,255,0.05)", borderRadius: "14px 14px 14px 4px", padding: "6px 10px", fontSize: 10, color: "rgba(255,255,255,0.75)", display: "inline-block" }}>
                  welcome to our space 👋
                </span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "flex-end", gap: 8 }}>
              <span style={{ background: "rgba(255,255,255,0.1)", borderRadius: "14px 14px 4px 14px", padding: "6px 10px", fontSize: 10, color: "white", display: "inline-block" }}>
                finally, somewhere that&apos;s <em>ours</em>
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />
              <span style={{ background: "rgba(255,255,255,0.05)", borderRadius: "14px 14px 14px 4px", padding: "6px 10px", fontSize: 10, color: "rgba(255,255,255,0.75)", display: "inline-block" }}>
                jump in the call 🎧
              </span>
            </div>
          </div>
          {/* Input */}
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "7px 12px", fontSize: 10, color: "rgba(255,255,255,0.2)" }}>
            Message #general…
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Landing ──────────────────────────────────────────────────────────────────
export function Landing() {
  const rootRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  // Current (smoothed) and target pointer values
  const ptr = useRef({ x: 0, y: 0, tx: 0, ty: 0, scroll: 0 });

  // rAF loop: lerp pointer → write CSS vars to .nox-landing
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onMouse = (e: MouseEvent) => {
      ptr.current.tx = (e.clientX / window.innerWidth) * 2 - 1;
      ptr.current.ty = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      ptr.current.tx = (t.clientX / window.innerWidth) * 2 - 1;
      ptr.current.ty = (t.clientY / window.innerHeight) * 2 - 1;
    };
    const onScroll = () => { ptr.current.scroll = window.scrollY; };

    window.addEventListener("mousemove", onMouse, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });

    function tick() {
      const p = ptr.current;
      p.x += (p.tx - p.x) * 0.055;
      p.y += (p.ty - p.y) * 0.055;
      root!.style.setProperty("--mx", p.x.toFixed(4));
      root!.style.setProperty("--my", p.y.toFixed(4));
      root!.style.setProperty("--sy", p.scroll.toFixed(1));
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Scroll-reveal via IntersectionObserver
  useEffect(() => {
    const els = rootRef.current?.querySelectorAll(".nox-reveal") ?? [];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
        }
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Per-card 3D tilt on hover
  const onCardMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const c = e.currentTarget;
    const r = c.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * 2;
    const y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    c.style.transform = `perspective(700px) rotateY(${x * 9}deg) rotateX(${y * -7}deg) scale(1.025)`;
    (c.style as CSSStyleDeclaration & { borderColor: string }).borderColor = `rgba(255,255,255,${0.08 + Math.abs(x) * 0.06 + Math.abs(y) * 0.06})`;
  }, []);
  const onCardLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = "";
    (e.currentTarget.style as CSSStyleDeclaration & { borderColor: string }).borderColor = "";
  }, []);

  return (
    <div
      ref={rootRef}
      className="nox-landing relative min-h-screen w-full overflow-x-hidden"
      style={{ background: "#09090b", color: "white" }}
    >
      {/* Film grain overlay */}
      <div className="nox-grain" />

      {/* Parallax orb — top-right */}
      <div
        className="nox-orb"
        style={{
          width: 720, height: 720,
          top: -220, right: -180,
          background: "radial-gradient(circle, rgba(255,255,255,0.052) 0%, transparent 68%)",
          transform: "translate(calc(var(--mx) * -28px), calc(var(--my) * -22px))",
        }}
      />
      {/* Parallax orb — bottom-left */}
      <div
        className="nox-orb"
        style={{
          width: 480, height: 480,
          bottom: 80, left: -160,
          background: "radial-gradient(circle, rgba(255,255,255,0.028) 0%, transparent 70%)",
          transform: "translate(calc(var(--mx) * 18px), calc(var(--my) * 14px))",
        }}
      />

      {/* ── NAV ───────────────────────────────────────────────────────────── */}
      <nav
        className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-6 py-5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Logo size={30} />
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", color: "white" }}>Nox</span>
        </div>
        <Link
          href="/login"
          style={{
            fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.45)",
            padding: "8px 16px", borderRadius: 10, transition: "color 0.2s",
          }}
          className="hover:text-white"
        >
          Sign in →
        </Link>
      </nav>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-6 pb-4 pt-20 text-center md:pt-28">

        {/* Eyebrow */}
        <div
          className="nox-reveal"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 999,
            padding: "6px 16px", marginBottom: 28,
            background: "rgba(255,255,255,0.03)", backdropFilter: "blur(8px)",
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 8px #34d399", display: "inline-block" }} />
          <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.05em", color: "rgba(255,255,255,0.45)" }}>
            Your space. Your people.
          </span>
        </div>

        {/* Headline with shimmer */}
        <h1
          className="nox-reveal d1"
          style={{
            maxWidth: 760,
            fontSize: "clamp(44px,8.5vw,92px)",
            fontWeight: 900,
            lineHeight: 0.94,
            letterSpacing: "-0.035em",
            fontFamily: "var(--font-geist-sans)",
            marginBottom: 28,
          }}
        >
          <span
            style={{
              background: "linear-gradient(90deg, #fff 0%, #fff 32%, #9ca3af 50%, #fff 68%, #fff 100%)",
              backgroundSize: "400% auto",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              animation: "nox-shimmer 6s linear infinite",
              display: "inline",
            }}
          >
            A home for
          </span>
          <br />
          <span style={{ color: "rgba(255,255,255,0.88)" }}>your&nbsp;people.</span>
        </h1>

        {/* Sub */}
        <p
          className="nox-reveal d2"
          style={{
            maxWidth: 440,
            fontSize: "clamp(14px,1.6vw,17px)",
            lineHeight: 1.65,
            color: "rgba(255,255,255,0.38)",
            fontFamily: "var(--font-geist-sans)",
            marginBottom: 36,
          }}
        >
          Fast, private, and entirely yours — channels, voice calls,
          and DMs without the noise, feeds, or ads.
        </p>

        {/* CTAs */}
        <div
          className="nox-reveal d3"
          style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "center" }}
        >
          <Link
            href="/login"
            style={{
              background: "white", color: "black",
              borderRadius: 14, padding: "14px 28px",
              fontSize: 13, fontWeight: 600,
              transition: "transform 0.2s, box-shadow 0.2s",
              display: "inline-block",
            }}
            className="hover:scale-[1.04] hover:shadow-[0_0_36px_rgba(255,255,255,0.22)] active:scale-[0.97]"
          >
            Create your space — free
          </Link>
          <DemoButton
            className="rounded-xl border border-white/10 px-7 py-3.5 text-sm font-semibold text-white/55 backdrop-blur-sm transition-all hover:bg-white/[0.07] hover:text-white disabled:opacity-50"
          />
        </div>

        {/* 3D floating app preview */}
        <div
          className="nox-scene relative mt-16 w-full"
          style={{ maxWidth: 600, margin: "60px auto 0" }}
        >
          {/* Wireframe ring in the background */}
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 0 }}>
            <WireframeRing />
          </div>

          {/* Soft glow below the card */}
          <div style={{
            position: "absolute", left: "50%", top: "50%",
            transform: "translate(-50%, -50%)",
            width: 520, height: 180,
            background: "rgba(255,255,255,0.038)",
            borderRadius: "50%",
            filter: "blur(70px)",
            zIndex: 1,
            pointerEvents: "none",
          }} />

          {/* Stage — tilts with mouse */}
          <div
            className="nox-stage relative"
            style={{ zIndex: 2, transformOrigin: "center 55%" }}
          >
            <AppPreview />
          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────────── */}
      <section
        className="relative z-10 mx-auto px-6 py-28"
        style={{ maxWidth: 960 }}
      >
        {/* Section label */}
        <p
          className="nox-reveal mb-10 text-center"
          style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)" }}
        >
          Everything you need
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          {([
            {
              d: "",
              icon: (
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              ),
              title: "Real-time channels & DMs",
              body: "Messages that arrive the instant they're sent. Reactions, replies, pins, markdown, and file sharing built in.",
            },
            {
              d: "d1",
              icon: (
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              ),
              title: "Voice & video calls",
              body: "See who's in the call from the sidebar before you join. Hop in with one tap — no new window, no waiting.",
            },
            {
              d: "d2",
              icon: (
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 11l18-5v12L3 14v-3z" />
                  <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
                </svg>
              ),
              title: "Broadcast channels",
              body: "Lock a channel to owner-only for drops, announcements, and one-to-many updates without the noise.",
            },
            {
              d: "d3",
              icon: (
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              ),
              title: "Yours to control",
              body: "No feeds, no ads, no algorithm. Your space, your rules — just the room you built for your people.",
            },
          ] as const).map(({ d, icon, title, body }) => (
            <div
              key={title}
              className={`nox-reveal nox-tilt ${d}`}
              style={{
                borderRadius: 20,
                border: "1px solid rgba(255,255,255,0.07)",
                background: "rgba(255,255,255,0.02)",
                padding: 24,
                backdropFilter: "blur(8px)",
                cursor: "default",
              }}
              onMouseMove={onCardMove}
              onMouseLeave={onCardLeave}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: "rgba(255,255,255,0.05)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "rgba(255,255,255,0.55)",
                marginBottom: 16,
              }}>
                {icon}
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "white", marginBottom: 8 }}>{title}</h3>
              <p style={{ fontSize: 13, lineHeight: 1.65, color: "rgba(255,255,255,0.36)" }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────────────── */}
      <section
        className="relative z-10 mx-auto mb-8 px-6"
        style={{ maxWidth: 960 }}
      >
        <div
          className="nox-reveal"
          style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            borderRadius: 28,
            border: "1px solid rgba(255,255,255,0.07)",
            background: "linear-gradient(160deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
            backdropFilter: "blur(16px)",
            padding: "80px 32px",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Inner glow */}
          <div style={{
            position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
            width: 400, height: 1,
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)",
          }} />

          <Logo size={52} />
          <h2
            className="nox-reveal d1"
            style={{
              marginTop: 24, maxWidth: 360,
              fontSize: "clamp(28px,4vw,40px)",
              fontWeight: 900, lineHeight: 1.15,
              letterSpacing: "-0.025em",
              color: "white",
              fontFamily: "var(--font-geist-sans)",
            }}
          >
            Bring your people home.
          </h2>
          <p
            className="nox-reveal d2"
            style={{ marginTop: 12, maxWidth: 300, fontSize: 14, color: "rgba(255,255,255,0.38)", lineHeight: 1.6 }}
          >
            Spin up your space in seconds. Invite your circle. It&apos;s free.
          </p>
          <Link
            href="/login"
            className="nox-reveal d3 hover:scale-[1.04] hover:shadow-[0_0_44px_rgba(255,255,255,0.18)] active:scale-[0.97]"
            style={{
              marginTop: 32,
              background: "white", color: "black",
              borderRadius: 14, padding: "14px 32px",
              fontSize: 13, fontWeight: 600,
              transition: "transform 0.2s, box-shadow 0.2s",
              display: "inline-block",
            }}
          >
            Get started
          </Link>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer
        className="relative z-10 flex flex-col items-center gap-2 pb-12 pt-6 text-center"
        style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.4 }}>
          <Logo size={18} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>Nox</span>
        </div>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.18)" }}>Your space. Your people.</p>
      </footer>
    </div>
  );
}
