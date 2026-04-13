"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Clock, Banknote, AlertTriangle, FileText, Wand2, Receipt,
  Calendar, Users, Download, ChevronDown, Menu, X, Check,
  ArrowRight, CheckCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Phase { shown: number; typing: boolean; }

// ─── Chat animation data ──────────────────────────────────────────────────────

const CHAT_MESSAGES = [
  { role: "ai",   text: "Bonjour ! Comment puis-je vous aider ?" },
  { role: "user", text: "Combien je dois en TVA ce mois ?" },
  { role: "ai",   text: "Basé sur vos factures d'avril :\n• TVA collectée : 9 900 MAD\n• TVA déductible : 2 600 MAD\n• TVA nette due : 7 300 MAD\nÉchéance : 20 mai 2026 ⚠️" },
  { role: "user", text: "Qui ne m'a pas encore payé ?" },
  { role: "ai",   text: "2 factures en attente :\n• Pharma3 SA — 10 200 MAD (15j)\n• Immo Derb Omar — 26 400 MAD (retard)" },
];

const CHAT_PHASES: Phase[] = [
  { shown: 1, typing: false },
  { shown: 1, typing: true  },
  { shown: 2, typing: false },
  { shown: 2, typing: true  },
  { shown: 3, typing: false },
  { shown: 3, typing: true  },
  { shown: 4, typing: false },
  { shown: 4, typing: true  },
  { shown: 5, typing: false },
  { shown: 5, typing: false },
  { shown: 0, typing: false },
];
const CHAT_DELAYS = [1800, 900, 700, 1500, 1800, 700, 700, 1500, 1800, 2800, 400];

// ─── FAQ data ─────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: "Mohasib remplace-t-il mon fiduciaire ?",
    a: "Non — Mohasib complète votre fiduciaire et automatise les tâches répétitives. Avec le Pack + Comptable, vous avez les deux : l'IA et un comptable humain dédié.",
  },
  {
    q: "Comment fonctionne le comptable dédié ?",
    a: "Après votre inscription au Pack + Comptable, nous vous assignons un comptable de notre réseau sous 24h. Vous avez son WhatsApp direct, il révise vos livres chaque mois et valide vos déclarations TVA.",
  },
  {
    q: "Mohasib gère-t-il la fiscalité marocaine ?",
    a: "Oui — TVA (7 %, 10 %, 14 %, 20 %), IS, IR, CNSS. Le plan comptable CGNC est intégré. Les déclarations sont au format DGI.",
  },
  {
    q: "Puis-je essayer avant de payer ?",
    a: "Oui — 14 jours gratuits, aucune carte bancaire requise. Vous accédez à toutes les fonctionnalités du plan choisi.",
  },
  {
    q: "Mes données sont-elles sécurisées ?",
    a: "Vos données sont chiffrées et hébergées sur des serveurs sécurisés. Nous ne partageons jamais vos informations financières avec des tiers.",
  },
  {
    q: "Compatible avec mon logiciel comptable ?",
    a: "Les exports Mohasib sont en Excel et PDF au format CGNC — compatibles avec Sage, Ciel, et tous les logiciels utilisés par les fiduciaires marocains.",
  },
];

// ─── Scroll-fade hook ─────────────────────────────────────────────────────────

function useFadeIn(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

// ─── AnimateIn wrapper ────────────────────────────────────────────────────────

function AnimateIn({ children, delay = 0, className = "" }: {
  children: React.ReactNode; delay?: number; className?: string;
}) {
  const { ref, visible } = useFadeIn();
  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(22px)",
      transition: `opacity 0.55s ease-out ${delay}s, transform 0.55s ease-out ${delay}s`,
    }}>
      {children}
    </div>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11.5px] font-semibold uppercase tracking-[2px] text-[#C8924A] mb-3">
      {children}
    </p>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "#features", label: "Fonctionnalités" },
    { href: "#pricing", label: "Tarifs" },
    { href: "#fiduciaires", label: "Pour les fiduciaires" },
  ];

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-200"
      style={{
        background: scrolled ? "rgba(255,255,255,0.92)" : "white",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(0,0,0,0.07)" : "1px solid transparent",
        animation: "slideDown 0.35s ease-out",
      }}
    >
      <div className="max-w-6xl mx-auto px-5 md:px-8 h-[60px] flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="text-[20px] font-bold text-[#0D1526] tracking-tight select-none">
          Mohasib
        </Link>

        {/* Center nav — desktop */}
        <nav className="hidden md:flex items-center gap-7">
          {links.map((l) => (
            <a key={l.href} href={l.href}
              className="text-[13.5px] text-[#6B7280] hover:text-[#0D1526] transition-colors">
              {l.label}
            </a>
          ))}
        </nav>

        {/* Right — desktop */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/auth/login" className="text-[13.5px] text-[#6B7280] hover:text-[#0D1526] transition-colors">
            Se connecter
          </Link>
          <Link href="/auth/signup"
            className="px-4 py-2 rounded-full text-[13px] font-semibold bg-[#0D1526] text-white hover:text-[#C8924A] transition-colors">
            Commencer gratuitement
          </Link>
        </div>

        {/* Hamburger */}
        <button className="md:hidden text-[#0D1526]" onClick={() => setOpen(!open)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-white border-t border-[rgba(0,0,0,0.07)] px-5 py-4 flex flex-col gap-4">
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}
              className="text-[14px] text-[#374151] hover:text-[#0D1526]">
              {l.label}
            </a>
          ))}
          <hr className="border-[rgba(0,0,0,0.07)]" />
          <Link href="/auth/login" className="text-[14px] text-[#6B7280]">Se connecter</Link>
          <Link href="/auth/signup" className="btn bg-[#0D1526] text-white justify-center py-2.5 rounded-lg text-[13.5px] font-semibold">
            Commencer gratuitement
          </Link>
        </div>
      )}
    </header>
  );
}

// ─── Dashboard mockup ─────────────────────────────────────────────────────────

function DashboardMockup() {
  return (
    <div className="relative w-full max-w-[700px] mx-auto mt-12 rounded-xl overflow-hidden select-none"
      style={{
        boxShadow: "0 25px 60px rgba(0,0,0,0.16)",
        transform: "perspective(1000px) rotateX(3deg)",
        animation: "mockupIn 0.7s ease-out 0.4s both",
      }}>
      <div className="flex" style={{ minHeight: 360 }}>
        {/* Sidebar */}
        <div className="w-[150px] flex-shrink-0 bg-[#0D1526] flex flex-col py-4 px-3">
          <div className="text-white font-bold text-[13px] px-2 mb-5">Mohasib</div>
          {["Tableau de bord","Factures","Clients","Transactions","TVA","Export"].map((item, i) => (
            <div key={item} className={`px-2 py-[7px] rounded-lg text-[11px] mb-0.5 ${i === 0 ? "bg-[rgba(200,146,74,0.15)] text-[#C8924A] font-medium" : "text-white/40"}`}>
              {item}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 bg-[#FAFAF6] p-4 min-w-0">
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: "CA ce mois", value: "47 200", sub: "+12 % vs mois dernier" },
              { label: "Factures", value: "8", sub: "en attente" },
              { label: "TVA due", value: "7 300", sub: "Échéance 20 mai" },
            ].map((k) => (
              <div key={k.label} className="bg-white rounded-lg p-3 border border-[rgba(0,0,0,0.07)]">
                <div className="text-[9.5px] text-[#9CA3AF] uppercase tracking-wide mb-1">{k.label}</div>
                <div className="text-[15px] font-bold text-[#1A1A2E]">{k.value}</div>
                <div className="text-[9px] text-[#9CA3AF] mt-0.5">{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg border border-[rgba(0,0,0,0.07)] overflow-hidden">
            <div className="px-3 py-2 border-b border-[rgba(0,0,0,0.05)]">
              <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wide">Factures récentes</span>
            </div>
            {[
              { n: "F-031", c: "Pharma3 SA",     a: "10 200", s: "Payée",      sc: "text-[#059669] bg-[#D1FAE5]" },
              { n: "F-032", c: "Atlas Bâtiment", a: "8 500",  s: "En attente", sc: "text-[#92400E] bg-[#FEF3C7]" },
              { n: "F-033", c: "Immo Derb Omar", a: "26 400", s: "En retard",  sc: "text-[#991B1B] bg-[#FEE2E2]" },
            ].map((r) => (
              <div key={r.n} className="flex items-center gap-2 px-3 py-2 border-b border-[rgba(0,0,0,0.04)] last:border-0">
                <span className="text-[9.5px] text-[#9CA3AF] w-10">{r.n}</span>
                <span className="text-[10px] font-medium flex-1 text-[#1A1A2E] truncate">{r.c}</span>
                <span className="text-[10px] font-semibold text-[#1A1A2E]">{r.a} MAD</span>
                <span className={`text-[8.5px] font-semibold px-1.5 py-0.5 rounded-full ${r.sc}`}>{r.s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI badge */}
      <div className="absolute bottom-3 right-3 bg-[#C8924A] text-white text-[10px] font-semibold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
        <Wand2 size={11} /> Mohasib AI
      </div>

      {/* Top bar chrome */}
      <div className="absolute top-0 left-0 right-0 h-[28px] bg-[#0A1020] flex items-center px-3 gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
        <div className="flex-1 mx-3 h-4 bg-[rgba(255,255,255,0.06)] rounded text-[8px] text-white/30 flex items-center justify-center">
          app.mohasib.ma
        </div>
      </div>
    </div>
  );
}

// ─── Chat mockup ──────────────────────────────────────────────────────────────

function ChatMockup() {
  const [phaseIdx, setPhaseIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let idx = 0;
    function tick() {
      idx = (idx + 1) % CHAT_PHASES.length;
      setPhaseIdx(idx);
      timerRef.current = setTimeout(tick, CHAT_DELAYS[idx]);
    }
    timerRef.current = setTimeout(tick, CHAT_DELAYS[0]);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const { shown, typing } = CHAT_PHASES[phaseIdx];

  return (
    <div className="rounded-2xl overflow-hidden border border-[rgba(255,255,255,0.08)]"
      style={{ background: "#19274A", boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[rgba(255,255,255,0.07)]">
        <div className="w-7 h-7 rounded-full bg-[#C8924A] flex items-center justify-center">
          <Wand2 size={13} className="text-white" />
        </div>
        <div>
          <div className="text-[12px] font-semibold text-white">Mohasib AI</div>
          <div className="text-[10px] text-[rgba(255,255,255,0.4)] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] inline-block" /> En ligne
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="p-4 space-y-3 min-h-[280px]">
        {CHAT_MESSAGES.slice(0, shown).map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            style={{ animation: "fadeUp 0.3s ease-out" }}>
            <div
              className="max-w-[85%] text-[12px] leading-relaxed px-3.5 py-2.5 rounded-xl"
              style={{
                background: msg.role === "ai" ? "rgba(255,255,255,0.07)" : "#C8924A",
                color: "white",
                whiteSpace: "pre-line",
              }}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {typing && (
          <div className="flex justify-start" style={{ animation: "fadeUp 0.3s ease-out" }}>
            <div className="flex items-center gap-1 px-3.5 py-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.07)" }}>
              <div className="dot" /><div className="dot" /><div className="dot" />
            </div>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 bg-[rgba(255,255,255,0.06)] rounded-xl px-3 py-2.5 border border-[rgba(255,255,255,0.08)]">
          <span className="text-[11.5px] text-[rgba(255,255,255,0.25)] flex-1">Posez une question…</span>
          <ArrowRight size={14} className="text-[#C8924A]" />
        </div>
      </div>
    </div>
  );
}

// ─── Count-up stat ────────────────────────────────────────────────────────────

function StatNumber({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setStarted(true); obs.disconnect(); }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    const duration = 1200;
    const steps = 50;
    const inc = target / steps;
    let i = 0;
    const t = setInterval(() => {
      i++;
      setCount(Math.min(Math.round(inc * i), target));
      if (i >= steps) clearInterval(t);
    }, duration / steps);
    return () => clearInterval(t);
  }, [started, target]);

  return <span ref={ref}>{count}{suffix}</span>;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function HomePageClient() {
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistDone, setWaitlistDone] = useState(false);
  const [waitlistLoading, setWaitlistLoading] = useState(false);

  async function handleWaitlist(e: FormEvent) {
    e.preventDefault();
    if (!waitlistEmail) return;
    setWaitlistLoading(true);
    try {
      const supabase = createClient();
      await supabase.from("fiduciaire_waitlist").insert([{ email: waitlistEmail, user_id: null }]);
    } catch { /* silent — RLS may block anonymous; user can fix later */ }
    setWaitlistLoading(false);
    setWaitlistDone(true);
    setWaitlistEmail("");
  }

  const heroStyle = { animation: "fadeUp 0.6s ease-out both" };
  const serif = { fontFamily: "'Instrument Serif', Georgia, serif" };

  return (
    <div className="bg-white text-[#1A1A2E] overflow-x-hidden">
      <style>{`
        @keyframes slideDown { from { transform: translateY(-60px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes mockupIn { from { transform: perspective(1000px) rotateX(6deg) scale(0.96); opacity: 0; } to { transform: perspective(1000px) rotateX(3deg) scale(1); opacity: 1; } }
        .feature-card:hover { border-color: #C8924A; transform: translateY(-2px); }
        .feature-card { transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s; }
        .feature-card:hover { box-shadow: 0 8px 24px rgba(200,146,74,0.12); }
      `}</style>

      <Navbar />

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section id="hero" className="relative min-h-screen flex flex-col items-center justify-center pt-[60px] pb-12 px-5 overflow-hidden"
        style={{
          background: "white",
          backgroundImage: "linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}>
        {/* Gradient overlay to fade grid at edges */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 80% 60% at 50% 40%, transparent 40%, white 100%)" }} />

        <div className="relative z-10 flex flex-col items-center text-center max-w-3xl mx-auto" style={heroStyle}>
          {/* Pill badge */}
          <div className="inline-flex items-center gap-2 bg-[#0D1526] text-[#C8924A] text-[12px] font-medium px-4 py-1.5 rounded-full mb-7"
            style={{ animation: "fadeUp 0.5s ease-out 0.05s both" }}>
            ✦ Conçu pour le marché marocain 🇲🇦
          </div>

          {/* Headline */}
          <h1 className="font-serif font-semibold leading-[1.13] mb-5"
            style={{ ...serif, fontSize: "clamp(36px,5vw,62px)", letterSpacing: "-1px", animation: "fadeUp 0.5s ease-out 0.12s both" }}>
            La comptabilité intelligente<br />
            pour les entrepreneurs marocains
          </h1>

          {/* Sub */}
          <p className="text-[#6B7280] mb-8 max-w-[500px] leading-relaxed"
            style={{ fontSize: "clamp(15px,2vw,18px)", animation: "fadeUp 0.5s ease-out 0.2s both" }}>
            Créez vos factures, suivez votre TVA, et posez vos questions comptables à Mohasib AI — en français, en arabe, ou en darija.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-6"
            style={{ animation: "fadeUp 0.5s ease-out 0.28s both" }}>
            <Link href="/auth/signup"
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-[#0D1526] text-white text-[14px] font-semibold hover:opacity-90 transition-opacity">
              Commencer gratuitement <ArrowRight size={15} />
            </Link>
            <a href="#features"
              className="flex items-center gap-2 px-6 py-3 rounded-lg border border-[rgba(0,0,0,0.15)] text-[#0D1526] text-[14px] font-medium hover:border-[#0D1526] transition-colors">
              ▶ Voir la démo
            </a>
          </div>

          {/* Trust line */}
          <div className="flex flex-wrap items-center justify-center gap-5 text-[12px] text-[#9CA3AF]"
            style={{ animation: "fadeUp 0.5s ease-out 0.34s both" }}>
            <span>✓ Essai 14 jours gratuit</span>
            <span>✓ Aucune carte bancaire</span>
            <span>✓ Annulation à tout moment</span>
          </div>
        </div>

        <DashboardMockup />
      </section>

      {/* ── PROBLEM ───────────────────────────────────────────────────────── */}
      <section className="py-20 px-5" style={{ background: "#FAFAF6" }}>
        <div className="max-w-5xl mx-auto">
          <AnimateIn className="text-center mb-12">
            <SectionLabel>Le problème</SectionLabel>
            <h2 className="font-serif text-[28px] md:text-[36px] font-semibold leading-tight"
              style={{ ...serif, letterSpacing: "-0.5px" }}>
              La comptabilité vous coûte trop cher<br className="hidden md:block" /> et prend trop de temps
            </h2>
          </AnimateIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            {[
              { icon: Clock, value: "4–6h", label: "par semaine perdues sur la comptabilité", sub: "Temps moyen d'un entrepreneur marocain sur l'admin financier", countTo: null },
              { icon: Banknote, value: "800–1500 MAD", label: "par mois pour un fiduciaire", sub: "Pour des tâches que l'IA peut automatiser en secondes", countTo: null },
              { icon: AlertTriangle, value: null, label: "des TPE pénalisées par la DGI", sub: "Pour des erreurs de déclaration qui auraient pu être évitées", countTo: 47 },
            ].map((s, i) => (
              <AnimateIn key={i} delay={i * 0.1}>
                <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-6"
                  style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  <s.icon size={22} className="text-[#C8924A] mb-4" />
                  <div className="text-[36px] font-bold text-[#0D1526] leading-none mb-2"
                    style={{ letterSpacing: "-1px" }}>
                    {s.countTo !== null ? <StatNumber target={s.countTo} suffix="%" /> : s.value}
                  </div>
                  <div className="text-[13.5px] font-semibold text-[#1A1A2E] mb-1">{s.label}</div>
                  <div className="text-[12px] text-[#9CA3AF] leading-relaxed">{s.sub}</div>
                </div>
              </AnimateIn>
            ))}
          </div>

          <AnimateIn className="text-center">
            <p className="text-[15px] text-[#6B7280] italic" style={serif}>
              "Il y a une meilleure façon de gérer votre comptabilité."
            </p>
          </AnimateIn>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────────── */}
      <section id="features" className="py-20 px-5 bg-white">
        <div className="max-w-5xl mx-auto">
          <AnimateIn className="text-center mb-12">
            <SectionLabel>La solution</SectionLabel>
            <h2 className="font-serif text-[28px] md:text-[36px] font-semibold leading-tight"
              style={{ ...serif, letterSpacing: "-0.5px" }}>
              Tout ce dont vous avez besoin,<br className="hidden md:block" /> dans un seul outil
            </h2>
          </AnimateIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: FileText, title: "Facturation intelligente",
                desc: "Créez des factures conformes en 2 minutes. ICE, TVA, mentions légales intégrés. Envoyez par WhatsApp ou email en un clic.",
                badge: { label: "Le plus utilisé", color: "bg-[#FEF3C7] text-[#92400E]" },
              },
              {
                icon: Wand2, title: "Mohasib AI",
                desc: "Posez n'importe quelle question en français ou darija. Obtenez une réponse immédiate basée sur vos données réelles.",
                badge: { label: "Nouveau", color: "bg-[#D1FAE5] text-[#065F46]" },
              },
              {
                icon: Receipt, title: "Import de relevés bancaires",
                desc: "Uploadez votre relevé PDF Attijariwafa, CIH ou BMCE. L'IA extrait toutes les transactions automatiquement.",
                badge: null,
              },
              {
                icon: Calendar, title: "Déclarations TVA automatiques",
                desc: "Calculez votre TVA en un clic. Générez le document DGI-ready. Ne manquez plus jamais une échéance.",
                badge: null,
              },
              {
                icon: Users, title: "Gestion clients",
                desc: "Répertoire complet avec historique et délais de paiement. Relancez les mauvais payeurs automatiquement.",
                badge: null,
              },
              {
                icon: Download, title: "Export fiduciaire",
                desc: "Journal des ventes, grand livre, balance — en format CGNC marocain. Un clic pour votre fiduciaire.",
                badge: null,
              },
            ].map((f, i) => (
              <AnimateIn key={i} delay={i * 0.07}>
                <div className="feature-card bg-white border border-[rgba(0,0,0,0.09)] rounded-xl p-6 h-full">
                  <div className="flex items-start justify-between mb-3">
                    <f.icon size={22} className="text-[#C8924A]" />
                    {f.badge && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${f.badge.color}`}>
                        {f.badge.label}
                      </span>
                    )}
                  </div>
                  <h3 className="text-[14px] font-semibold text-[#1A1A2E] mb-2">{f.title}</h3>
                  <p className="text-[12.5px] text-[#6B7280] leading-relaxed">{f.desc}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI SHOWCASE ───────────────────────────────────────────────────── */}
      <section className="py-20 px-5" style={{ background: "#0D1526" }}>
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Left */}
          <AnimateIn>
            <SectionLabel>Mohasib AI</SectionLabel>
            <h2 className="font-serif text-[28px] md:text-[38px] font-semibold leading-tight text-white mb-5"
              style={{ ...serif, letterSpacing: "-0.5px" }}>
              Votre comptable,<br />disponible 24h/24
            </h2>
            <p className="text-[rgba(255,255,255,0.6)] text-[14.5px] leading-relaxed mb-7">
              Posez vos questions comptables en français, en arabe ou en darija. Mohasib connaît la fiscalité marocaine et vos chiffres en temps réel.
            </p>
            <ul className="space-y-3 mb-7">
              {["Calcul TVA instantané", "Alertes déclarations DGI", "Conseils fiscaux personnalisés"].map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-[13.5px] text-white/80">
                  <CheckCircle size={15} className="text-[#C8924A] flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-[11.5px] text-[#C8924A]">✦ Alimenté par Claude AI d'Anthropic</p>
          </AnimateIn>

          {/* Right — chat */}
          <AnimateIn delay={0.15}>
            <ChatMockup />
          </AnimateIn>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-20 px-5" style={{ background: "#FAFAF6" }}>
        <div className="max-w-4xl mx-auto">
          <AnimateIn className="text-center mb-12">
            <SectionLabel>Tarifs</SectionLabel>
            <h2 className="font-serif text-[28px] md:text-[36px] font-semibold leading-tight"
              style={{ ...serif, letterSpacing: "-0.5px" }}>
              Simple et transparent
            </h2>
            <p className="text-[#6B7280] mt-2 text-[15px]">Choisissez la formule qui vous convient</p>
          </AnimateIn>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
            {/* Solo */}
            <AnimateIn delay={0.05}>
              <div className="bg-white border border-[rgba(0,0,0,0.09)] rounded-2xl p-8"
                style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
                <h3 className="text-[17px] font-bold text-[#1A1A2E] mb-1">Mohasib Solo</h3>
                <p className="text-[12.5px] text-[#9CA3AF] mb-4">Pour les entrepreneurs autonomes</p>
                <div className="mb-1">
                  <span className="text-[40px] font-bold text-[#0D1526]" style={{ letterSpacing: "-1.5px" }}>199</span>
                  <span className="text-[15px] font-medium text-[#0D1526]"> MAD</span>
                  <span className="text-[13px] text-[#9CA3AF]">/mois</span>
                </div>
                <p className="text-[11.5px] text-[#9CA3AF] line-through mb-5">Fiduciaire classique : 800–1500 MAD/mois</p>
                <hr className="border-[rgba(0,0,0,0.07)] mb-5" />
                <ul className="space-y-2.5 mb-7">
                  {["Factures illimitées","Clients illimités","Mohasib AI illimité","Import relevés bancaires","Calcul TVA automatique","Export fiduciaire CGNC","Alertes déclarations DGI","Envoi WhatsApp des factures"].map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-[13px] text-[#374151]">
                      <Check size={14} className="text-[#C8924A] flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link href="/auth/signup"
                  className="block w-full text-center py-2.5 rounded-lg border border-[#0D1526] text-[#0D1526] text-[13.5px] font-semibold hover:bg-[#0D1526] hover:text-white transition-colors">
                  Commencer l'essai gratuit
                </Link>
                <p className="text-center text-[11px] text-[#9CA3AF] mt-3">14 jours gratuits — aucune carte bancaire</p>
              </div>
            </AnimateIn>

            {/* Pro */}
            <AnimateIn delay={0.12}>
              <div className="relative rounded-2xl p-8"
                style={{
                  background: "#0D1526", border: "2px solid #C8924A",
                  transform: "scale(1.03)", boxShadow: "0 20px 40px rgba(13,21,38,0.3)",
                }}>
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#C8924A] text-[#0D1526] text-[11px] font-bold px-4 py-1.5 rounded-full">
                  Recommandé
                </div>
                <h3 className="text-[17px] font-bold text-white mb-1">Mohasib + Comptable</h3>
                <p className="text-[12.5px] text-[rgba(255,255,255,0.5)] mb-4">Pour les entrepreneurs qui veulent un vrai comptable</p>
                <div className="mb-1">
                  <span className="text-[40px] font-bold text-white" style={{ letterSpacing: "-1.5px" }}>399</span>
                  <span className="text-[15px] font-medium text-white"> MAD</span>
                  <span className="text-[13px] text-[rgba(255,255,255,0.5)]">/mois</span>
                </div>
                <p className="text-[11.5px] text-[rgba(255,255,255,0.4)] mb-5">199 MAD logiciel + 200 MAD comptable dédié</p>
                <hr className="border-[rgba(255,255,255,0.12)] mb-5" />
                <ul className="space-y-2.5 mb-7">
                  {["Tout de Mohasib Solo","Comptable dédié assigné sous 24h","Accès WhatsApp direct à votre comptable","Révision mensuelle de vos livres","Validation TVA avant soumission DGI","Assistance clôture annuelle","Comptable disponible pour vos questions"].map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-[13px] text-white/80">
                      <Check size={14} className="text-[#C8924A] flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link href="/auth/signup"
                  className="block w-full text-center py-2.5 rounded-lg bg-[#C8924A] text-[#0D1526] text-[13.5px] font-bold hover:bg-[#d9a96b] transition-colors">
                  Commencer avec un comptable
                </Link>
                <p className="text-center text-[11px] text-[rgba(255,255,255,0.4)] mt-3">14 jours gratuits — aucune carte bancaire</p>
              </div>
            </AnimateIn>
          </div>

          <AnimateIn className="text-center mt-8">
            <p className="text-[13px] text-[#6B7280]">
              Vous êtes fiduciaire ou cabinet comptable ?{" "}
              <a href="#" className="text-[#C8924A] hover:underline">
                → Mohasib Pro arrive bientôt — Rejoindre la liste d'attente
              </a>
            </p>
          </AnimateIn>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section className="py-20 px-5 bg-white">
        <div className="max-w-5xl mx-auto">
          <AnimateIn className="text-center mb-14">
            <SectionLabel>Comment ça marche</SectionLabel>
            <h2 className="font-serif text-[28px] md:text-[36px] font-semibold"
              style={{ ...serif, letterSpacing: "-0.5px" }}>
              Opérationnel en 5 minutes
            </h2>
          </AnimateIn>

          <div className="relative grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Dotted connector — desktop only */}
            <div className="hidden md:block absolute top-7 left-[12.5%] right-[12.5%] h-px border-t-2 border-dashed border-[rgba(0,0,0,0.1)]" />

            {[
              { n: "01", title: "Créez votre compte", desc: "Inscription gratuite. Entrez votre ICE et infos entreprise." },
              { n: "02", title: "Ajoutez vos clients", desc: "Créez vos clients en quelques secondes ou importez-les." },
              { n: "03", title: "Gérez au quotidien", desc: "Factures, dépenses, questions AI — tout en un seul endroit." },
              { n: "04", title: "Restez conforme", desc: "TVA calculée, déclarations générées, fiduciaire toujours à jour." },
            ].map((s, i) => (
              <AnimateIn key={i} delay={i * 0.1} className="text-center relative">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white border-2 border-[rgba(0,0,0,0.08)] mb-4 relative z-10"
                  style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                  <span className="font-serif text-[18px] font-semibold text-[#C8924A]" style={serif}>{s.n}</span>
                </div>
                <h3 className="text-[14px] font-semibold text-[#1A1A2E] mb-1.5">{s.title}</h3>
                <p className="text-[12.5px] text-[#6B7280] leading-relaxed">{s.desc}</p>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ──────────────────────────────────────────────────── */}
      <section className="py-20 px-5" style={{ background: "#FAFAF6" }}>
        <div className="max-w-5xl mx-auto">
          <AnimateIn className="text-center mb-12">
            <SectionLabel>Ils nous font confiance</SectionLabel>
            <h2 className="font-serif text-[28px] md:text-[36px] font-semibold leading-tight"
              style={{ ...serif, letterSpacing: "-0.5px" }}>
              Des entrepreneurs marocains<br className="hidden md:block" /> qui gagnent du temps
            </h2>
          </AnimateIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
            {[
              { initials: "YB", name: "Youssef B.", role: "Consultant freelance, Casablanca", quote: "Avant Mohasib, je passais 2 heures chaque dimanche sur mes factures. Maintenant c'est 15 minutes." },
              { initials: "FZ", name: "Fatima Z.", role: "E-commerce, Rabat", quote: "Mon fiduciaire était impressionné par le fichier export. Des données parfaitement organisées." },
              { initials: "MA", name: "Mehdi A.", role: "Architecte indépendant, Marrakech", quote: "399 MAD par mois avec un vrai comptable contre 1200 MAD avant. Le calcul était vite fait." },
            ].map((t, i) => (
              <AnimateIn key={i} delay={i * 0.1}>
                <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-6 h-full"
                  style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  <div className="text-[#C8924A] text-[14px] mb-3">⭐⭐⭐⭐⭐</div>
                  <p className="text-[13.5px] text-[#374151] leading-relaxed mb-5 italic">"{t.quote}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#0D1526] flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0">
                      {t.initials}
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-[#1A1A2E]">{t.name}</div>
                      <div className="text-[11px] text-[#9CA3AF]">{t.role}</div>
                    </div>
                  </div>
                </div>
              </AnimateIn>
            ))}
          </div>

          <p className="text-center text-[11.5px] text-[#9CA3AF] italic">
            * Témoignages illustratifs. Vos résultats peuvent varier.
          </p>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section className="py-20 px-5 bg-white">
        <div className="max-w-[680px] mx-auto">
          <AnimateIn className="text-center mb-10">
            <h2 className="font-serif text-[28px] md:text-[34px] font-semibold"
              style={{ ...serif, letterSpacing: "-0.5px" }}>
              Questions fréquentes
            </h2>
          </AnimateIn>

          <div className="divide-y divide-[rgba(0,0,0,0.07)]">
            {FAQS.map((faq, i) => (
              <div key={i}>
                <button
                  className="w-full text-left flex items-center justify-between py-4 gap-4"
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                >
                  <span className="text-[14px] font-medium text-[#1A1A2E]">{faq.q}</span>
                  <ChevronDown size={16} className="text-[#9CA3AF] flex-shrink-0 transition-transform duration-200"
                    style={{ transform: faqOpen === i ? "rotate(180deg)" : "rotate(0deg)" }} />
                </button>
                <div style={{
                  maxHeight: faqOpen === i ? "300px" : "0",
                  overflow: "hidden",
                  transition: "max-height 0.3s ease-in-out",
                }}>
                  <p className="pb-4 text-[13.5px] text-[#6B7280] leading-relaxed">{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────────────── */}
      <section className="py-24 px-5 text-center" style={{ background: "#0D1526" }}>
        <div className="max-w-xl mx-auto">
          <AnimateIn>
            <h2 className="font-serif text-[28px] md:text-[40px] font-semibold leading-tight text-[#C8924A] mb-4"
              style={{ ...serif, letterSpacing: "-0.5px" }}>
              Prêt à reprendre le contrôle<br />de votre comptabilité ?
            </h2>
            <p className="text-[rgba(255,255,255,0.6)] text-[15px] mb-9">
              Rejoignez les entrepreneurs marocains qui gagnent 4 à 6 heures par semaine.
            </p>

            {/* Email form */}
            {waitlistDone ? (
              <div className="flex items-center justify-center gap-2 text-[#C8924A] text-[14px] font-semibold mb-8 bg-[rgba(200,146,74,0.1)] border border-[rgba(200,146,74,0.2)] rounded-xl px-5 py-4">
                <CheckCircle size={17} /> Vous êtes sur la liste ! Nous vous contactons très bientôt.
              </div>
            ) : (
              <form onSubmit={handleWaitlist} className="flex flex-col sm:flex-row gap-2 mb-8">
                <input
                  type="email" required placeholder="votre@email.com"
                  value={waitlistEmail} onChange={(e) => setWaitlistEmail(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-lg bg-white text-[#1A1A2E] text-[13.5px] outline-none placeholder:text-[#9CA3AF]"
                />
                <button type="submit" disabled={waitlistLoading}
                  className="px-5 py-3 rounded-lg bg-[#C8924A] text-[#0D1526] text-[13.5px] font-bold hover:bg-[#d9a96b] transition-colors whitespace-nowrap disabled:opacity-60">
                  {waitlistLoading ? "…" : "Rejoindre →"}
                </button>
              </form>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3 mb-3">
              <Link href="/auth/signup"
                className="px-6 py-3 rounded-lg bg-[#C8924A] text-[#0D1526] text-[13.5px] font-bold hover:bg-[#d9a96b] transition-colors">
                Commencer gratuitement
              </Link>
              <a href="#features"
                className="px-6 py-3 rounded-lg border border-[rgba(255,255,255,0.2)] text-white text-[13.5px] font-medium hover:border-white transition-colors">
                Voir une démo
              </a>
            </div>
            <p className="text-[11.5px] text-[rgba(255,255,255,0.3)]">🔒 Aucun spam. Juste les updates importantes.</p>
          </AnimateIn>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer style={{ background: "#0A1020" }}>
        <div className="max-w-5xl mx-auto px-5 py-14 grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="text-[20px] font-bold text-[#C8924A] mb-2">Mohasib</div>
            <p className="text-[12px] text-[rgba(255,255,255,0.35)] mb-1">AI accounting for Moroccan SMEs</p>
            <p className="text-[12px] text-[rgba(255,255,255,0.35)] mb-4">Fait avec ❤️ au Maroc 🇲🇦</p>
            <div className="flex items-center gap-3">
              {["LinkedIn", "Instagram", "Twitter"].map((s) => (
                <a key={s} href="#" className="text-[12px] text-[rgba(255,255,255,0.35)] hover:text-white transition-colors">{s}</a>
              ))}
            </div>
          </div>

          {/* Product */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[1.5px] text-[rgba(255,255,255,0.25)] mb-4">Produit</p>
            {["Fonctionnalités", "Tarifs", "Mohasib AI", "Pour les fiduciaires", "Changelog"].map((l) => (
              <a key={l} href="#" className="block text-[12.5px] text-[rgba(255,255,255,0.45)] hover:text-white mb-2 transition-colors">{l}</a>
            ))}
          </div>

          {/* Support */}
          <div id="fiduciaires">
            <p className="text-[11px] font-semibold uppercase tracking-[1.5px] text-[rgba(255,255,255,0.25)] mb-4">Support</p>
            {["Centre d'aide", "Nous contacter"].map((l) => (
              <a key={l} href="#" className="block text-[12.5px] text-[rgba(255,255,255,0.45)] hover:text-white mb-2 transition-colors">{l}</a>
            ))}
            <p className="text-[12.5px] text-[rgba(255,255,255,0.45)] mb-2">WhatsApp : +212 6XX XXX XXX</p>
            <p className="text-[12.5px] text-[rgba(255,255,255,0.45)]">contact@mohasib.ma</p>
          </div>

          {/* Legal */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[1.5px] text-[rgba(255,255,255,0.25)] mb-4">Légal</p>
            {["Politique de confidentialité", "Conditions d'utilisation", "Mentions légales"].map((l) => (
              <a key={l} href="#" className="block text-[12.5px] text-[rgba(255,255,255,0.45)] hover:text-white mb-2 transition-colors">{l}</a>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-[rgba(255,255,255,0.07)] max-w-5xl mx-auto px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[12px] text-[rgba(255,255,255,0.3)]">© 2025 Mohasib. Tous droits réservés.</p>
          <p className="text-[12px] text-[rgba(255,255,255,0.3)]">Propulsé par Claude AI d&apos;Anthropic</p>
        </div>
      </footer>
    </div>
  );
}
