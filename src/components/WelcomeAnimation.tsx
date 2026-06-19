"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── Audio engine ─────────────────────────────────────────────────────────────
function useAudio() {
  const ctx = useRef<AudioContext | null>(null);

  const get = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    if (!ctx.current) {
      try {
        ctx.current = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      } catch { return null; }
    }
    if (ctx.current.state === "suspended") void ctx.current.resume();
    return ctx.current;
  }, []);

  const whoosh = useCallback(() => {
    const c = get(); if (!c) return;
    const sr = c.sampleRate;
    const buf = c.createBuffer(1, Math.floor(sr * 0.55), sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++)
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.5) * 0.9;
    const src = c.createBufferSource();
    const filt = c.createBiquadFilter();
    const gain = c.createGain();
    filt.type = "bandpass"; filt.frequency.value = 550; filt.Q.value = 0.6;
    gain.gain.setValueAtTime(0.55, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.55);
    src.buffer = buf;
    src.connect(filt); filt.connect(gain); gain.connect(c.destination);
    src.start();
  }, [get]);

  const ding = useCallback((freq: number) => {
    const c = get(); if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine"; osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.22, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 2.2);
    osc.connect(gain); gain.connect(c.destination);
    osc.start(); osc.stop(c.currentTime + 2.2);
  }, [get]);

  const chime = useCallback(() => {
    const c = get(); if (!c) return;
    // C major arpeggio: C5 E5 G5 C6
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      const t = c.currentTime + i * 0.13;
      osc.type = "sine"; osc.frequency.value = f;
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 2.8);
      osc.connect(gain); gain.connect(c.destination);
      osc.start(t); osc.stop(t + 2.8);
    });
  }, [get]);

  return { whoosh, ding, chime };
}

// ─── Particle canvas ──────────────────────────────────────────────────────────
const P_COLORS = ["#a78bfa","#818cf8","#7c3aed","#60a5fa","#38bdf8","#c4b5fd","#93c5fd","#fff"];

function runParticles(canvas: HTMLCanvasElement, onDone: () => void) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  const particles = Array.from({ length: 220 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 15;
    return {
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      r: 1 + Math.random() * 4,
      alpha: 0.8 + Math.random() * 0.2,
      decay: 0.005 + Math.random() * 0.007,
      color: P_COLORS[Math.floor(Math.random() * P_COLORS.length)],
    };
  });

  let raf = 0;
  function animate() {
    ctx!.clearRect(0, 0, canvas.width, canvas.height);
    let any = false;
    for (const p of particles) {
      if (p.alpha <= 0) continue;
      any = true;
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.96; p.vy *= 0.96;
      p.alpha -= p.decay;
      ctx!.save();
      ctx!.globalAlpha = Math.max(0, p.alpha);
      ctx!.shadowBlur = 8;
      ctx!.shadowColor = p.color;
      ctx!.beginPath();
      ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx!.fillStyle = p.color;
      ctx!.fill();
      ctx!.restore();
    }
    if (any) raf = requestAnimationFrame(animate);
    else onDone();
  }
  raf = requestAnimationFrame(animate);
  return () => cancelAnimationFrame(raf);
}

// ─── Component ────────────────────────────────────────────────────────────────
export function WelcomeAnimation({ onDone }: { onDone?: () => void }) {
  const already = typeof window !== "undefined" && !!localStorage.getItem("nox_welcome_seen");
  const [gone,  setGone]  = useState(already);
  const [phase, setPhase] = useState(0);         // 0-black 1-logo 2-tagline 3-features 4-outro 5-canvas
  const [pills, setPills] = useState(0);         // how many feature pills visible
  const [enjoy, setEnjoy] = useState(false);
  const [fading, setFading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { whoosh, ding, chime } = useAudio();

  const finish = useCallback(() => {
    setFading(true);
    setTimeout(() => {
      localStorage.setItem("nox_welcome_seen", "1");
      setGone(true);
      onDone?.();
    }, 700);
  }, [onDone]);

  useEffect(() => {
    if (gone) return;
    const ts: ReturnType<typeof setTimeout>[] = [];
    const t = (ms: number, fn: () => void) => ts.push(setTimeout(fn, ms));

    t(350,  () => { setPhase(1); whoosh(); });
    t(1600, () => setPhase(2));
    t(2600, () => { setPills(1); ding(349.23); });   // F4
    t(3050, () => { setPills(2); ding(440);    });   // A4
    t(3500, () => { setPills(3); ding(523.25); });   // C5
    t(5200, () => { setPhase(4); whoosh(); });
    t(5900, () => {
      setPhase(5);
      if (canvasRef.current) {
        runParticles(canvasRef.current, () => {});
      }
    });
    t(6900, () => { setEnjoy(true); chime(); });
    t(9200, () => finish());

    return () => ts.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gone]);

  if (gone) return null;

  const logoVisible  = phase >= 1 && phase < 4;
  const enjoyVisible = phase >= 5 && enjoy;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden select-none"
      style={{
        background: "rgb(4, 4, 8)",
        opacity: fading ? 0 : 1,
        transition: "opacity 0.65s cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      {/* Particle canvas */}
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" />

      {/* ── LOGO PHASE ────────────────────────────────────────────────── */}
      <div
        className="absolute flex flex-col items-center gap-6"
        style={{
          opacity: logoVisible ? 1 : 0,
          transform: logoVisible ? "scale(1) translateY(0)" : "scale(0.93) translateY(10px)",
          transition: "opacity 0.7s ease, transform 0.7s cubic-bezier(0.16,1,0.3,1)",
          pointerEvents: logoVisible ? "auto" : "none",
        }}
      >
        {/* Glow orb */}
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            width: 280, height: 280,
            background: "radial-gradient(circle, #7c3aed88 0%, #3b82f655 40%, transparent 70%)",
            opacity: phase >= 1 ? 1 : 0,
            transition: "opacity 1.2s ease",
          }}
        />

        {/* Logo mark */}
        <div className="relative z-10 flex flex-col items-center gap-5">
          <div
            className="flex h-24 w-24 items-center justify-center rounded-[28px]"
            style={{
              background: "linear-gradient(145deg, #1e1b4b 0%, #3730a3 60%, #1e1b4b 100%)",
              border: "1px solid rgba(167,139,250,0.25)",
              boxShadow: "0 0 80px #7c3aed50, 0 0 180px #7c3aed28, inset 0 1px 0 rgba(255,255,255,0.1)",
            }}
          >
            <span
              className="text-5xl font-black text-white"
              style={{ fontFamily: "var(--font-geist-sans)", textShadow: "0 0 30px #a78bfa" }}
            >
              N
            </span>
          </div>
          <span
            className="text-[44px] font-black tracking-[0.25em] text-white"
            style={{ fontFamily: "var(--font-geist-sans)", textShadow: "0 0 40px rgba(167,139,250,0.4)" }}
          >
            NOX
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            opacity: phase >= 2 ? 1 : 0,
            transform: phase >= 2 ? "translateY(0)" : "translateY(12px)",
            transition: "opacity 0.6s ease 0.1s, transform 0.6s cubic-bezier(0.16,1,0.3,1) 0.1s",
          }}
        >
          <p className="text-[11px] font-semibold tracking-[0.42em] uppercase text-white/35">
            Your space. Your people.
          </p>
        </div>

        {/* Feature pills */}
        <div className="mt-1 flex flex-col gap-3 items-center">
          {[
            { icon: "💬", text: "Real-time messaging" },
            { icon: "📹", text: "Voice & video calls"  },
            { icon: "🔔", text: "Smart notifications"  },
          ].map(({ icon, text }, i) => (
            <div
              key={text}
              className="flex items-center gap-3 rounded-full px-5 py-2.5 backdrop-blur-sm"
              style={{
                border: "1px solid rgba(255,255,255,0.09)",
                background: "rgba(255,255,255,0.04)",
                opacity: pills > i ? 1 : 0,
                transform: pills > i ? "translateY(0) scale(1)" : "translateY(14px) scale(0.95)",
                transition: "opacity 0.5s ease, transform 0.5s cubic-bezier(0.16,1,0.3,1)",
              }}
            >
              <span className="text-[18px] leading-none">{icon}</span>
              <span className="text-sm font-medium text-white/65">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── ENJOY IT PHASE ────────────────────────────────────────────── */}
      <div
        className="absolute flex flex-col items-center gap-4"
        style={{
          opacity: enjoyVisible ? 1 : 0,
          transform: enjoyVisible ? "scale(1) translateY(0)" : "scale(0.93) translateY(16px)",
          transition: "opacity 0.8s ease, transform 0.8s cubic-bezier(0.16,1,0.3,1)",
          pointerEvents: enjoyVisible ? "auto" : "none",
        }}
      >
        <p
          className="text-[10px] font-semibold uppercase text-white/25"
          style={{ letterSpacing: "0.5em" }}
        >
          welcome to nox
        </p>

        <h1
          className="text-[clamp(52px,12vw,112px)] font-black leading-none"
          style={{
            background: "linear-gradient(90deg,#c4b5fd,#818cf8,#60a5fa,#38bdf8,#c4b5fd)",
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            animation: enjoyVisible ? "nox-gradient-sweep 3s linear infinite" : "none",
            fontFamily: "var(--font-geist-sans)",
            textShadow: "none",
          }}
        >
          Enjoy&nbsp;it!
        </h1>

        {/* Breathing dots */}
        <div className="mt-3 flex gap-3">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-violet-400/50"
              style={{ animation: `nox-pulse-dot 1.6s ease-in-out ${i * 0.35}s infinite` }}
            />
          ))}
        </div>
      </div>

      {/* Skip button */}
      <button
        onClick={finish}
        className="absolute bottom-8 right-8 text-[11px] font-medium uppercase tracking-widest text-white/18 transition-colors hover:text-white/40"
        style={{ letterSpacing: "0.3em" }}
      >
        skip
      </button>
    </div>
  );
}
