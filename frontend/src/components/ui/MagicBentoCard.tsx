import { useRef, useEffect, useState, type ReactNode, type CSSProperties } from "react";

/* ─── Read --glow-rgb from CSS at runtime ─────────────── */
function getGlowRgbFromCSS(): string {
  if (typeof window === "undefined") return "16,185,129";
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--glow-rgb")
    .trim();
  return raw || "16,185,129";
}

/** Hook that re-reads --glow-rgb whenever data-theme changes */
function useThemeGlow(): string {
  const [glow, setGlow] = useState(getGlowRgbFromCSS);
  useEffect(() => {
    // re-read on mount (covers SSR hydration)
    setGlow(getGlowRgbFromCSS());
    const observer = new MutationObserver(() => setGlow(getGlowRgbFromCSS()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);
  return glow;
}

/* ─── Types ──────────────────────────────────────────────── */
interface MagicBentoCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: string;        // override e.g. "99,102,241"; leave undefined to auto-detect from theme
  enableParticles?: boolean;
  enableSpotlight?: boolean;
  style?: CSSProperties;
}

/* ─── Particle canvas (GSAP-optional, falls back to pure-JS) ── */
function ParticleCanvas({ color }: { color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      cvs.width = cvs.offsetWidth * 2;
      cvs.height = cvs.offsetHeight * 2;
      ctx.scale(2, 2);
    };
    resize();

    const particles: { x: number; y: number; vx: number; vy: number; r: number; a: number; decay: number }[] = [];

    const spawn = () => {
      if (particles.length > 35) return;
      particles.push({
        x: Math.random() * cvs.offsetWidth,
        y: Math.random() * cvs.offsetHeight,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -Math.random() * 0.4 - 0.1,
        r: Math.random() * 2 + 0.5,
        a: Math.random() * 0.5 + 0.2,
        decay: 0.003 + Math.random() * 0.003,
      });
    };

    const draw = () => {
      ctx.clearRect(0, 0, cvs.offsetWidth, cvs.offsetHeight);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.a -= p.decay;
        if (p.a <= 0) { particles.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color},${p.a})`;
        ctx.fill();
      }
      if (Math.random() > 0.6) spawn();
      animRef.current = requestAnimationFrame(draw);
    };

    // initial burst
    for (let i = 0; i < 12; i++) spawn();
    draw();

    const ro = new ResizeObserver(resize);
    ro.observe(cvs);

    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, [color]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
    />
  );
}

/* ─── Spotlight follower ────────────────────────────────── */
function useSpotlight(ref: React.RefObject<HTMLDivElement | null>, color: string) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handler = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      el.style.setProperty("--spot-x", `${x}px`);
      el.style.setProperty("--spot-y", `${y}px`);
    };

    el.addEventListener("mousemove", handler);
    return () => el.removeEventListener("mousemove", handler);
  }, [ref, color]);
}

/* ─── Main component ───────────────────────────────────── */
export default function MagicBentoCard({
  children,
  className = "",
  glowColor,
  enableParticles = true,
  enableSpotlight = true,
  style,
}: MagicBentoCardProps) {
  const themeGlow = useThemeGlow();
  const resolvedGlow = glowColor ?? themeGlow;
  const cardRef = useRef<HTMLDivElement>(null);
  useSpotlight(cardRef, resolvedGlow);

  return (
    <div      ref={cardRef}      className={`magic-bento-card group relative overflow-hidden rounded-2xl border
        border-border/50 bg-card
        transition-all duration-300
        hover:border-primary/30
        hover:shadow-[0_0_30px_rgba(${resolvedGlow},0.08)]
        ${className}`}
      style={
        {
          "--glow-rgb": resolvedGlow,
          ...style,
        } as CSSProperties
      }
    >
      {/* spotlight gradient */}
      {enableSpotlight && (
        <div
          className="pointer-events-none absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: `radial-gradient(350px circle at var(--spot-x, 50%) var(--spot-y, 50%), rgba(${resolvedGlow},0.08), transparent 60%)`,
          }}
        />
      )}

      {/* particles */}
      {enableParticles && <ParticleCanvas color={resolvedGlow} />}

      {/* border glow on hover */}
      <div
        className="pointer-events-none absolute inset-0 z-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          boxShadow: `inset 0 0 0 1px rgba(${resolvedGlow},0.15)`,
        }}
      />

      {/* content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
