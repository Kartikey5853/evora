import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Logo from '../components/ui/Logo';

gsap.registerPlugin(ScrollTrigger);

/* ─── palette ─── */
const T1 = '#73E6CB';
const T2 = '#3EBB9E';
const T3 = '#00674F';
const tealGrad = `linear-gradient(135deg, ${T1} 0%, ${T2} 50%, ${T3} 100%)`;

/* ═══════════════════════════════════════════════════════════════
   EVORA LANDING PAGE
   ═══════════════════════════════════════════════════════════════ */
const Index = () => {
  const wrapRef = useRef<HTMLDivElement>(null);

  /* ── GSAP scroll animations ── */
  useEffect(() => {
    const ctx = gsap.context(() => {
      /* split sections children */
      gsap.utils.toArray<HTMLElement>('.ev-split').forEach((section) => {
        gsap.from(section.querySelectorAll(':scope > div > *'), {
          scrollTrigger: {
            trigger: section,
            start: 'top 80%',
            end: 'bottom 20%',
            toggleActions: 'play none none reverse',
          },
          opacity: 0,
          y: 50,
          duration: 1,
          stagger: 0.2,
          ease: 'power2.out',
        });
      });

      /* feature cards */
      gsap.utils.toArray<HTMLElement>('.ev-feature-card').forEach((card, i) => {
        gsap.from(card, {
          scrollTrigger: { trigger: card, start: 'top 85%', toggleActions: 'play none none reverse' },
          opacity: 0, y: 30, duration: 0.8, delay: i * 0.1, ease: 'power2.out',
        });
      });

      /* dashboard previews */
      gsap.utils.toArray<HTMLElement>('.ev-dash-preview').forEach((el, i) => {
        gsap.from(el, {
          scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none reverse' },
          opacity: 0, x: i % 2 === 0 ? -30 : 30, duration: 0.8, ease: 'power2.out',
        });
      });

      /* stat numbers */
      gsap.utils.toArray<HTMLElement>('.ev-stat').forEach((el) => {
        gsap.from(el, {
          scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none reverse' },
          opacity: 0, scale: 0.5, duration: 0.8, ease: 'back.out(1.7)',
        });
      });
    }, wrapRef);

    return () => ctx.revert();
  }, []);

  /* ── Power-flash + shake on mount ── */
  useEffect(() => {
    const flash = document.createElement('div');
    Object.assign(flash.style, {
      position: 'fixed', inset: '0',
      background: `radial-gradient(circle, rgba(115,230,203,0.3) 0%, transparent 70%)`,
      opacity: '0', pointerEvents: 'none', zIndex: '100',
      animation: 'ev-power-flash 1s ease-out forwards',
    });
    document.body.appendChild(flash);

    const hero = document.querySelector('.ev-hero') as HTMLElement | null;
    const shakeTimer = setTimeout(() => hero?.classList.add('ev-shake'), 800);
    const removeTimer = setTimeout(() => {
      flash.remove();
      hero?.classList.remove('ev-shake');
    }, 1300);

    return () => { clearTimeout(shakeTimer); clearTimeout(removeTimer); flash.remove(); };
  }, []);

  return (
    <div ref={wrapRef} className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ═══════ INLINE KEYFRAMES (scoped via unique names) ═══════ */}
      <style>{`
        /* grid drift */
        @keyframes ev-grid-move { 0%{transform:translate(0,0)} 100%{transform:translate(60px,60px)} }
        /* logo reveal */
        @keyframes ev-logo-reveal {
          0%{opacity:0;transform:scale(.5) rotateY(-90deg);filter:blur(20px)}
          50%{opacity:.5;transform:scale(1.1) rotateY(5deg)}
          100%{opacity:1;transform:scale(1) rotateY(0);filter:blur(0)}
        }
        /* glitch pseudo */
        @keyframes ev-glitch {
          0%,90%,100%{transform:translate(0,0);opacity:0}
          92%{transform:translate(-2px,2px);opacity:.7}
          94%{transform:translate(2px,-2px);opacity:.7}
          96%{transform:translate(-2px,-2px);opacity:.7}
        }
        /* glow pulse */
        @keyframes ev-pulse-glow {
          0%{opacity:0;transform:scale(.8)} 10%{opacity:1;transform:scale(1.2)}
          50%{opacity:.6;transform:scale(1)} 100%{opacity:0;transform:scale(.8)}
        }
        /* energy ring */
        @keyframes ev-ring-expand {
          0%{width:50px;height:50px;opacity:1;border-width:3px}
          100%{width:800px;height:800px;opacity:0;border-width:0}
        }
        /* lightning bolt */
        @keyframes ev-lightning {
          0%{opacity:0;transform:translateY(-50px)} 50%{opacity:1;transform:translateY(0)} 100%{opacity:0;transform:translateY(50px)}
        }
        /* fade-in-up */
        @keyframes ev-fade-up { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        /* charging bar */
        @keyframes ev-charge { 0%{width:0} 50%{width:100%} 100%{width:0} }
        /* bounce scroll indicator */
        @keyframes ev-bounce { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(10px)} }
        /* parallax text scroll */
        @keyframes ev-scroll-text { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        /* particles float */
        @keyframes ev-float { 0%,100%{transform:translateY(0) translateX(0)} 50%{transform:translateY(-30px) translateX(20px)} }
        /* emergency pulse */
        @keyframes ev-emg-pulse { 0%,100%{box-shadow:0 0 0 rgba(239,68,68,0)} 50%{box-shadow:0 0 20px rgba(239,68,68,.4)} }
        /* power flash */
        @keyframes ev-power-flash { 0%{opacity:0} 30%{opacity:1} 100%{opacity:0} }
        /* screen shake */
        @keyframes ev-screen-shake {
          0%,100%{transform:translate(0,0)}
          10%,30%,50%,70%,90%{transform:translate(-2px,2px)}
          20%,40%,60%,80%{transform:translate(2px,-2px)}
        }
        .ev-shake { animation: ev-screen-shake .5s ease-in-out; }
      `}</style>

      {/* ═══════════════ HERO ═══════════════ */}
      <section
        className="ev-hero relative flex items-center justify-center overflow-hidden"
        style={{ height: '100vh' }}
      >
        {/* animated grid bg */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(rgba(115,230,203,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(115,230,203,0.03) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
            animation: 'ev-grid-move 20s linear infinite',
          }}
        />

        {/* lightning bolts */}
        <div className="absolute inset-0 pointer-events-none">
          {[20, 40, 60, 80].map((left, i) => (
            <div
              key={i}
              className="absolute w-[2px] h-[100px]"
              style={{
                left: `${left}%`,
                top: '30%',
                background: `linear-gradient(180deg, ${T1}, transparent)`,
                opacity: 0,
                animation: `ev-lightning .3s ease-out`,
                animationDelay: `${0.5 + i * 0.1}s`,
                boxShadow: `0 0 10px ${T1}, 0 0 20px ${T1}`,
              }}
            />
          ))}
        </div>

        {/* energy particles */}
        {[
          { l: '10%', t: '20%', d: '0s' }, { l: '80%', t: '30%', d: '1s' },
          { l: '15%', t: '70%', d: '2s' }, { l: '85%', t: '60%', d: '3s' },
          { l: '50%', t: '15%', d: '1.5s' }, { l: '30%', t: '50%', d: '2.5s' },
          { l: '70%', t: '80%', d: '1.8s' },
        ].map((p, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full"
            style={{ left: p.l, top: p.t, background: T1, opacity: 0.6, animation: `ev-float 6s ease-in-out infinite`, animationDelay: p.d }}
          />
        ))}

        {/* logo container */}
        <div className="relative z-10 text-center">
          {/* energy burst rings */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {[0.2, 0.4, 0.6].map((d, i) => (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: 50, height: 50,
                  border: `3px solid ${T1}`,
                  top: '50%', left: '50%',
                  transform: 'translate(-50%,-50%)',
                  opacity: 0,
                  animation: `ev-ring-expand 2s ease-out`,
                  animationDelay: `${d}s`,
                }}
              />
            ))}
          </div>

          {/* glow */}
          <div
            className="absolute pointer-events-none"
            style={{
              inset: '-50%',
              background: `radial-gradient(circle, rgba(115,230,203,0.3) 0%, transparent 70%)`,
              filter: 'blur(80px)',
              opacity: 0,
              animation: 'ev-pulse-glow 4s ease-in-out infinite',
              animationDelay: '1s',
            }}
          />

          {/* EVORA text */}
          <h1
            className="ev-logo-text relative uppercase"
            style={{
              fontSize: 'clamp(5rem, 15vw, 12rem)',
              fontWeight: 900,
              letterSpacing: '-0.05em',
              background: tealGrad,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              opacity: 0,
              transform: 'scale(0.5)',
              animation: 'ev-logo-reveal 1.5s cubic-bezier(0.34,1.56,0.64,1) forwards',
              animationDelay: '0.3s',
            }}
          >
            EVORA
          </h1>

          {/* subtitle */}
          <p
            style={{
              fontSize: '1.5rem', color: `${T1}cc`, fontWeight: 300,
              letterSpacing: '0.2em', marginTop: '1rem',
              opacity: 0, transform: 'translateY(20px)',
              animation: 'ev-fade-up 1s ease-out forwards',
              animationDelay: '1.2s',
            }}
          >
            SMART EV CHARGING INFRASTRUCTURE
          </p>

          {/* charging bar */}
          <div
            className="mx-auto rounded-[10px] overflow-hidden"
            style={{
              width: 400, maxWidth: '90%', height: 6,
              background: `${T1}1a`, marginTop: '3rem',
              opacity: 0, animation: 'ev-fade-up 1s ease-out forwards', animationDelay: '1.5s',
            }}
          >
            <div
              className="h-full rounded-[10px]"
              style={{
                background: `linear-gradient(90deg, ${T1}, ${T2})`,
                animation: 'ev-charge 3s ease-in-out infinite',
                boxShadow: `0 0 20px ${T1}80`,
              }}
            />
          </div>

          {/* hero buttons */}
          <div
            className="flex gap-6 justify-center flex-wrap"
            style={{ marginTop: '3rem', opacity: 0, animation: 'ev-fade-up 1s ease-out forwards', animationDelay: '1.8s' }}
          >
            <Link
              to="/register"
              className="rounded-full font-semibold text-[1.1rem] transition-all duration-300 hover:-translate-y-0.5"
              style={{ background: `linear-gradient(135deg, ${T1}, ${T2})`, color: '#0a0a0a', padding: '1rem 2.5rem' }}
            >
              Book a Charger
            </Link>
            <Link
              to="/admin/register"
              className="rounded-full font-semibold text-[1.1rem] transition-all duration-300 hover:-translate-y-0.5"
              style={{ background: 'transparent', color: T1, padding: '1rem 2.5rem', border: `2px solid ${T1}` }}
            >
              Host a Station
            </Link>
          </div>
        </div>

        {/* scroll indicator */}
        <div className="absolute bottom-[50px] left-1/2" style={{ animation: 'ev-bounce 2s infinite' }}>
          <svg width="30" height="50" viewBox="0 0 30 50" fill="none">
            <rect x="1" y="1" width="28" height="46" rx="14" stroke={T1} strokeWidth="2" />
            <circle cx="15" cy="15" r="4" fill={T1}>
              <animate attributeName="cy" from="15" to="35" dur="1.5s" repeatCount="indefinite" />
            </circle>
          </svg>
        </div>
      </section>

      {/* ═══════════════ PARALLAX TEXT ═══════════════ */}
      <div
        className="overflow-hidden whitespace-nowrap py-8"
        style={{ background: `${T1}05`, borderTop: `1px solid ${T1}1a`, borderBottom: `1px solid ${T1}1a` }}
      >
        <div className="inline-block pr-8" style={{ animation: 'ev-scroll-text 20s linear infinite' }}>
          {[0, 1].map(k => (
            <span
              key={k}
              className="inline-block px-8 font-bold"
              style={{
                fontSize: 'clamp(2rem, 4vw, 3.5rem)',
                background: `linear-gradient(90deg, ${T1}, ${T2}, ${T1})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}
            >
              Real-time Slot Booking • Grace Logic • Emergency Priority • Intelligent Infrastructure •{' '}
            </span>
          ))}
        </div>
      </div>

      {/* ═══════════════ PROBLEM SECTION ═══════════════ */}
      <section
        className="ev-split flex items-center min-h-screen px-8 py-16"
        style={{ background: `linear-gradient(135deg, ${T3}1a 0%, transparent 100%)` }}
      >
        <div className="max-w-7xl mx-auto w-full grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2
              className="text-5xl md:text-6xl font-bold mb-6"
              style={{ background: tealGrad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
            >
              The Problem
            </h2>
            <p className="text-xl text-gray-300 mb-8 leading-relaxed">
              EV adoption is accelerating, but charging infrastructure is stuck in the past.
              Drivers face uncertainty, stations lose revenue, and the grid operates inefficiently.
            </p>
          </div>

          <div className="grid gap-6">
            {[
              {
                title: 'Long Waiting Times',
                desc: 'No visibility into charger availability leads to wasted time and frustration',
                icon: (
                  <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
                    <path d="M30 5L35 25L45 15L35 35L55 30L35 40L45 55L25 40L30 60L20 40L5 50L20 30L0 35L20 25L10 10L30 20L30 5Z" fill="url(#pg1)" />
                    <defs><linearGradient id="pg1" x1="0" y1="0" x2="60" y2="60"><stop stopColor={T1} /><stop offset="1" stopColor={T2} /></linearGradient></defs>
                  </svg>
                ),
              },
              {
                title: 'No Real-time Booking',
                desc: 'First-come-first-served creates chaos during peak hours',
                icon: (
                  <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
                    <circle cx="30" cy="30" r="25" stroke={T1} strokeWidth="4" />
                    <line x1="15" y1="15" x2="45" y2="45" stroke={T1} strokeWidth="4" strokeLinecap="round" />
                  </svg>
                ),
              },
              {
                title: 'No Emergency Priority',
                desc: 'Critical vehicles have no guaranteed access when needed most',
                icon: (
                  <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
                    <rect x="15" y="10" width="30" height="35" rx="3" stroke="#ef4444" strokeWidth="3" />
                    <path d="M20 25h20M20 30h20M20 35h15" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="42" cy="18" r="8" fill="#ef4444" />
                    <path d="M42 14v4M42 22h.01" stroke="white" strokeWidth="2" strokeLinecap="round" />
                    <path d="M25 45L30 55L35 45" fill="#ef4444" />
                  </svg>
                ),
              },
            ].map((c) => (
              <div
                key={c.title}
                className="ev-feature-card rounded-[20px] p-8 transition-all duration-300 hover:-translate-y-2"
                style={{
                  background: 'rgba(20,20,20,0.6)', border: `1px solid ${T1}33`,
                }}
              >
                <div className="mb-4">{c.icon}</div>
                <h3 className="text-2xl font-bold mb-2" style={{ color: T1 }}>{c.title}</h3>
                <p className="text-gray-400">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ COMMAND CENTER (Three Dashboards) ═══════════════ */}
      <section
        className="ev-split flex items-center min-h-screen px-8 py-16"
        style={{ background: `linear-gradient(135deg, transparent 0%, ${T1}0d 100%)` }}
      >
        <div className="max-w-7xl mx-auto w-full grid md:grid-cols-2 gap-12 items-center">
          {/* dashboards */}
          <div className="order-2 md:order-1">
            <div
              className="rounded-3xl p-12 backdrop-blur-[20px] transition-all duration-300"
              style={{ background: `${T1}0d`, border: `1px solid ${T1}1a` }}
            >
              <h2 className="text-4xl font-bold mb-8" style={{ color: T1 }}>
                Three Roles.<br />One Intelligent Network.
              </h2>

              <div className="space-y-6">
                {[
                  {
                    title: 'EV Owner Dashboard',
                    items: ['Live slot selection', 'Grace window management', 'Real-time QR charging', 'Release notifications', 'Emergency priority access'],
                    icon: (
                      <svg width="50" height="50" viewBox="0 0 50 50" fill="none">
                        <circle cx="25" cy="20" r="12" stroke={T1} strokeWidth="3" />
                        <path d="M25 32c-8 0-15 4-15 8v5h30v-5c0-4-7-8-15-8z" fill={T1} />
                      </svg>
                    ),
                  },
                  {
                    title: 'Station Host Dashboard',
                    items: ['Add & manage chargers', 'Dynamic pricing control', 'Peak hour analytics', 'Revenue tracking', 'Smart slot control'],
                    icon: (
                      <svg width="50" height="50" viewBox="0 0 50 50" fill="none">
                        <rect x="10" y="15" width="30" height="25" rx="2" stroke={T1} strokeWidth="3" />
                        <rect x="15" y="10" width="20" height="8" fill={T1} />
                        <path d="M18 25h14M18 30h14M18 35h10" stroke={T1} strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    ),
                  },
                  {
                    title: 'Admin Dashboard',
                    items: ['Network overview', 'Live charger status', 'Emergency override', 'Utilization analytics', 'Smart monitoring'],
                    icon: (
                      <svg width="50" height="50" viewBox="0 0 50 50" fill="none">
                        <circle cx="25" cy="25" r="18" stroke={T1} strokeWidth="3" />
                        <path d="M25 15v10l7 7" stroke={T1} strokeWidth="3" strokeLinecap="round" />
                        <path d="M15 10h-5M10 15v-5M40 10h-5M40 15v-5M15 40h-5M10 40v-5M40 40h-5M40 40v-5" stroke={T2} strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    ),
                  },
                ].map((d) => (
                  <div
                    key={d.title}
                    className="ev-dash-preview rounded-[20px] p-8 relative overflow-hidden transition-all duration-300 hover:bg-white/[0.03]"
                    style={{ background: `linear-gradient(135deg, rgba(20,20,20,0.9), ${T3}1a)`, border: `1px solid ${T1}33` }}
                  >
                    <div className="mb-3">{d.icon}</div>
                    <h3 className="text-2xl font-bold mb-3">{d.title}</h3>
                    <ul className="space-y-2 text-gray-300">
                      {d.items.map((item) => <li key={item}>✓ {item}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* text */}
          <div className="order-1 md:order-2">
            <h2 className="text-5xl md:text-6xl font-bold mb-6">
              Your Intelligent<br />
              <span style={{ background: tealGrad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Command Center
              </span>
            </h2>
            <p className="text-xl text-gray-300 leading-relaxed">
              Whether you're charging, hosting, or managing the network, EVORA gives you complete control with real-time insights and intelligent automation.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════ SLOT INTELLIGENCE ═══════════════ */}
      <section
        className="ev-split flex items-center min-h-screen px-8 py-16"
        style={{ background: `linear-gradient(135deg, ${T3}1a 0%, transparent 100%)` }}
      >
        <div className="max-w-7xl mx-auto w-full grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-5xl md:text-6xl font-bold mb-6">
              Advanced<br />
              <span style={{ background: tealGrad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Slot Intelligence
              </span>
            </h2>
            <p className="text-xl text-gray-300 mb-8 leading-relaxed">
              Our proprietary slot management system maximizes utilization while ensuring fairness and reliability.
            </p>

            {/* timeline */}
            <div className="space-y-4">
              {[
                { title: '10-Minute Micro-Slots', desc: 'Granular booking for optimal flexibility' },
                { title: 'Grace Release System', desc: 'Automatic no-show recovery without penalties' },
                { title: 'Dynamic Reallocation', desc: 'Freed slots instantly available to next user' },
              ].map((t) => (
                <div key={t.title} className="relative pl-12 pb-8">
                  <div className="absolute left-0 top-0 w-[2px] h-full" style={{ background: `linear-gradient(180deg, ${T1}, transparent)` }} />
                  <div className="absolute left-[-6px] top-0 w-[14px] h-[14px] rounded-full" style={{ background: T1, boxShadow: `0 0 15px ${T1}99` }} />
                  <h4 className="font-bold text-lg mb-1" style={{ color: T1 }}>{t.title}</h4>
                  <p className="text-gray-400">{t.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* slot flow glass card */}
          <div
            className="rounded-3xl p-12 backdrop-blur-[20px] transition-all duration-300"
            style={{ background: `${T1}0d`, border: `1px solid ${T1}1a` }}
          >
            <h3 className="text-2xl font-bold mb-6" style={{ color: T1 }}>Slot Flow Timeline</h3>
            <div className="space-y-8">
              {[
                { time: '9:00 AM', label: 'Booking', color: T1, bg: `${T1}33`, desc: 'User reserves charging slot' },
                { time: '9:10 AM', label: 'Grace Window', color: '#fbbf24', bg: 'rgba(251,191,36,0.2)', desc: '10-minute window to arrive or extend' },
                { time: '9:20 AM', label: 'Auto-Release', color: '#ef4444', bg: 'rgba(239,68,68,0.2)', desc: 'Slot freed for next user if no-show' },
              ].map((s) => (
                <div key={s.time}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xl">{s.time}</span>
                    <span className="text-sm px-3 py-1 rounded-full" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                  </div>
                  <p className="text-gray-400">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ EMERGENCY MODE ═══════════════ */}
      <section
        className="ev-split flex items-center min-h-screen px-8 py-16"
        style={{ background: `linear-gradient(135deg, transparent 0%, ${T1}0d 100%)` }}
      >
        <div className="max-w-7xl mx-auto w-full grid md:grid-cols-2 gap-12 items-center">
          {/* card */}
          <div className="order-2 md:order-1">
            <div
              className="rounded-3xl p-12 backdrop-blur-[20px]"
              style={{ background: `${T1}0d`, border: '1px solid rgba(239,68,68,0.3)' }}
            >
              {/* emergency badge */}
              <div
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 mb-6 font-bold"
                style={{
                  background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(220,38,38,0.1))',
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: '#ef4444',
                  animation: 'ev-emg-pulse 2s ease-in-out infinite',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 2L2 18h16L10 2z" stroke="#ef4444" strokeWidth="2" />
                  <path d="M10 8v4M10 14h.01" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
                </svg>
                EMERGENCY MODE ACTIVE
              </div>

              <h3 className="text-3xl font-bold mb-6">How It Works</h3>

              <div className="space-y-6">
                {[
                  { n: '1', title: 'Override Upcoming Bookings', desc: 'Emergency vehicles get instant priority access' },
                  { n: '2', title: 'Active Sessions Protected', desc: 'Currently charging vehicles remain unaffected' },
                  { n: '3', title: 'Infrastructure Optimized', desc: 'System automatically reallocates affected users' },
                ].map((s) => (
                  <div key={s.n} className="flex gap-4">
                    <div
                      className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-xl"
                      style={{ background: 'rgba(239,68,68,0.2)' }}
                    >
                      {s.n}
                    </div>
                    <div>
                      <h4 className="font-bold mb-2">{s.title}</h4>
                      <p className="text-gray-400">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* text */}
          <div className="order-1 md:order-2">
            <h2 className="text-5xl md:text-6xl font-bold mb-6">
              Priority When<br />
              <span style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                It Matters Most
              </span>
            </h2>
            <p className="text-xl text-gray-300 mb-8 leading-relaxed">
              Emergency vehicles need guaranteed access. Our intelligent priority system ensures critical infrastructure needs are met without disrupting the entire network.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════ SCALE & REVENUE ═══════════════ */}
      <section
        className="ev-split flex items-center min-h-screen px-8 py-16"
        style={{ background: `linear-gradient(135deg, ${T3}1a 0%, transparent 100%)` }}
      >
        <div className="max-w-7xl mx-auto w-full grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-5xl md:text-6xl font-bold mb-6">
              Built for<br />
              <span style={{ background: tealGrad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Scale &amp; Revenue
              </span>
            </h2>
            <p className="text-xl text-gray-300 mb-8 leading-relaxed">
              Enterprise-grade infrastructure meets intelligent monetization. From day one, EVORA is designed to grow with demand.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {[
              { val: '100%', label: 'Razorpay Integration' },
              { val: '24/7', label: 'Dynamic Pricing' },
              { val: '∞', label: 'Scalable Network' },
              { val: 'AI', label: 'Demand Prediction' },
            ].map((s) => (
              <div
                key={s.label}
                className="ev-stat rounded-3xl p-8 text-center backdrop-blur-[20px] transition-all duration-300 hover:-translate-y-1"
                style={{ background: `${T1}0d`, border: `1px solid ${T1}1a` }}
              >
                <div
                  className="font-extrabold"
                  style={{
                    fontSize: 'clamp(2.5rem, 5vw, 4rem)',
                    background: tealGrad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  }}
                >
                  {s.val}
                </div>
                <p className="text-gray-400 mt-2">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ VISION ═══════════════ */}
      <section
        className="ev-split flex items-center min-h-screen px-8 py-16"
        style={{ background: `linear-gradient(135deg, transparent 0%, ${T1}0d 100%)` }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-6xl md:text-8xl font-bold mb-8">
            <span style={{ background: tealGrad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Airbnb
            </span>
            <br />for EV Charging
          </h2>

          <p className="text-2xl text-gray-300 mb-12 leading-relaxed max-w-3xl mx-auto">
            Just as Airbnb democratized hospitality and Uber transformed transportation, EVORA is building
            the decentralized infrastructure layer for electric mobility. We're not just solving today's
            charging problems—we're creating tomorrow's energy network.
          </p>

          <div className="flex gap-6 justify-center flex-wrap mb-16">
            <Link
              to="/register"
              className="rounded-full font-semibold text-xl transition-all duration-300 hover:-translate-y-0.5"
              style={{ background: `linear-gradient(135deg, ${T1}, ${T2})`, color: '#0a0a0a', padding: '1rem 2rem' }}
            >
              Start Charging Smart
            </Link>
            <Link
              to="/admin/register"
              className="rounded-full font-semibold text-xl transition-all duration-300 hover:-translate-y-0.5"
              style={{ background: 'transparent', color: T1, padding: '1rem 2rem', border: `2px solid ${T1}` }}
            >
              Become a Host
            </Link>
          </div>

          <div
            className="inline-block rounded-3xl px-12 py-8 backdrop-blur-[20px]"
            style={{ background: `${T1}0d`, border: `1px solid ${T1}1a` }}
          >
            <p
              className="text-3xl font-bold"
              style={{ background: tealGrad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
            >
              Powering the Future of Electric Mobility
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer className="py-12 px-8 text-center" style={{ background: 'rgba(10,10,10,0.8)', borderTop: `1px solid ${T1}1a` }}>
        <div className="max-w-7xl mx-auto">
          <div className="mb-4">
            <Logo size="lg" />
          </div>
          <p className="text-gray-400">Smart EV Charging Infrastructure</p>
          <p className="mt-6 text-sm text-gray-500">© 2025 EVORA. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;