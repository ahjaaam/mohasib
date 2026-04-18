"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import {
  FileText, Sparkles, Receipt, Calendar, Users, Download,
  Clock, Banknote, AlertTriangle, ChevronDown, Check, Menu, X,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────
const SERIF = "var(--font-serif), 'Georgia', serif";
const NAVY = "#0D1526";
const GOLD = "#C8924A";
const CREAM = "#FAFAF6";
const MUTED = "#6B7280";

// ── FadeIn ────────────────────────────────────────────────────────────────────
function FadeIn({
  children, delay = 0, className = "", style = {},
}: {
  children: React.ReactNode; delay?: number; className?: string; style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(24px)",
      transition: `opacity 0.6s ease-out ${delay}s, transform 0.6s ease-out ${delay}s`,
      ...style,
    }}>{children}</div>
  );
}

// ── CountUp ───────────────────────────────────────────────────────────────────
function CountUp({ to, suffix = "", duration = 1400 }: { to: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setStarted(true); obs.disconnect(); } },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    if (!started) return;
    let t0: number | null = null;
    const step = (ts: number) => {
      if (!t0) t0 = ts;
      const p = Math.min((ts - t0) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(Math.floor(e * to));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [started, to, duration]);
  return <span ref={ref}>{val}{suffix}</span>;
}

// ── Chat mockup ───────────────────────────────────────────────────────────────
const CHAT = [
  { role: "ai",   text: "Bonjour ! Comment puis-je vous aider ?" },
  { role: "user", text: "Combien je dois en TVA ce mois ?" },
  { role: "ai",   text: "Basé sur vos factures d'avril :\n• TVA collectée : 9 900 MAD\n• TVA déductible : 2 600 MAD\n• TVA nette due : 7 300 MAD\nÉchéance : 20 mai 2026 ⚠️" },
  { role: "user", text: "Qui ne m'a pas encore payé ?" },
  { role: "ai",   text: "2 factures en attente :\n• Pharma3 SA — 10 200 MAD (15j)\n• Immo Derb Omar — 26 400 MAD (retard)" },
];

function ChatMockup() {
  const [shown, setShown] = useState(1);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    if (shown >= CHAT.length) {
      const t = setTimeout(() => setShown(1), 2500);
      return () => clearTimeout(t);
    }
    setTyping(true);
    const t = setTimeout(() => { setTyping(false); setShown(v => v + 1); }, 1600);
    return () => clearTimeout(t);
  }, [shown]);

  return (
    <div style={{ background: "#19274A", borderRadius: 16, padding: 20, width: "100%", maxWidth: 400 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: NAVY, flexShrink: 0 }}>M</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "white" }}>Mohasib AI</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Vos données en temps réel</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#10B981" }} />
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>En ligne</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 220 }}>
        {CHAT.slice(0, shown).map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              background: m.role === "user" ? GOLD : "rgba(255,255,255,0.08)",
              color: "white",
              padding: "10px 14px",
              borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
              fontSize: 12.5,
              lineHeight: 1.65,
              maxWidth: "88%",
              whiteSpace: "pre-line",
            }}>{m.text}</div>
          </div>
        ))}
        {typing && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ background: "rgba(255,255,255,0.08)", padding: "12px 14px", borderRadius: "14px 14px 14px 4px" }}>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.45)", animation: `typing-dot 1.2s ${i * 0.18}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Dashboard mockup ──────────────────────────────────────────────────────────
function DashboardMockup() {
  const NAV_ITEMS = ["Tableau de bord", "Factures", "Clients", "Transactions", "TVA"];
  const KPIS = [
    { label: "CA ce mois", value: "52 400 MAD", color: NAVY },
    { label: "Factures en attente", value: "8", color: GOLD },
    { label: "TVA due", value: "7 300 MAD", color: "#DC2626" },
  ];
  const ROWS = [
    { name: "Pharma3 SA", amount: "10 200 MAD", status: "Envoyée" },
    { name: "Immo Derb Omar", amount: "26 400 MAD", status: "En retard" },
    { name: "Tech Solutions", amount: "8 800 MAD", status: "Payée" },
  ];
  return (
    <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid rgba(0,0,0,0.12)", boxShadow: "0 25px 60px rgba(0,0,0,0.18)", display: "flex", height: 360, userSelect: "none" }}>
      {/* Sidebar */}
      <div style={{ width: 164, background: NAVY, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "14px 14px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <Image src="/logo.png" alt="Mohasib" width={90} height={28} style={{ height: "auto" }} />
        </div>
        <div style={{ paddingTop: 6 }}>
          {NAV_ITEMS.map((item, i) => (
            <div key={i} style={{
              padding: "7px 14px", fontSize: 11, color: i === 0 ? GOLD : "rgba(255,255,255,0.42)",
              background: i === 0 ? "rgba(200,146,74,0.1)" : "transparent",
              borderLeft: `2px solid ${i === 0 ? GOLD : "transparent"}`,
              marginBottom: 1,
            }}>{item}</div>
          ))}
        </div>
      </div>
      {/* Main */}
      <div style={{ flex: 1, background: CREAM, padding: 14, position: "relative", overflow: "hidden" }}>
        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
          {KPIS.map((k, i) => (
            <div key={i} style={{ background: "white", borderRadius: 8, padding: "9px 11px", border: "1px solid rgba(0,0,0,0.08)" }}>
              <div style={{ fontSize: 8.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 5 }}>{k.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>
        {/* Table */}
        <div style={{ background: "white", borderRadius: 8, border: "1px solid rgba(0,0,0,0.08)", overflow: "hidden" }}>
          <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontSize: 10, fontWeight: 600, color: NAVY }}>Factures récentes</div>
          {ROWS.map((r, i) => (
            <div key={i} style={{ padding: "7px 12px", fontSize: 10, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: i < 2 ? "1px solid rgba(0,0,0,0.04)" : "none" }}>
              <span style={{ color: "#374151" }}>{r.name}</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontWeight: 600, color: NAVY }}>{r.amount}</span>
                <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 99, background: r.status === "Payée" ? "#D1FAE5" : r.status === "En retard" ? "#FEE2E2" : "#FEF3C7", color: r.status === "Payée" ? "#065F46" : r.status === "En retard" ? "#991B1B" : "#92400E" }}>{r.status}</span>
              </div>
            </div>
          ))}
        </div>
        {/* AI chat bubble */}
        <div style={{ position: "absolute", bottom: 14, right: 14, background: GOLD, borderRadius: 20, padding: "6px 12px", fontSize: 10, color: "white", fontWeight: 600, boxShadow: "0 4px 14px rgba(200,146,74,0.45)", whiteSpace: "nowrap" }}>
          💬 Mohasib AI
        </div>
      </div>
    </div>
  );
}

// ── Navbar ────────────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  const links = [
    { label: "Fonctionnalités", href: "#features" },
    { label: "Tarifs", href: "#pricing" },
    { label: "Pour les fiduciaires", href: "#footer" },
  ];
  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      background: scrolled ? "rgba(255,255,255,0.93)" : "rgba(255,255,255,0.98)",
      backdropFilter: scrolled ? "blur(14px)" : "none",
      borderBottom: scrolled ? "1px solid rgba(0,0,0,0.08)" : "1px solid transparent",
      transition: "all 0.3s ease",
    }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px", height: 60, display: "flex", alignItems: "center", gap: 32 }}>
        {/* Logo */}
        <Link href="/" style={{ textDecoration: "none", flexShrink: 0 }}>
          <Image src="/logo.png" alt="Mohasib" width={110} height={36} style={{ height: "auto" }} />
        </Link>
        {/* Center links */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center", gap: 32 }} className="hidden md:flex">
          {links.map(l => (
            <a key={l.label} href={l.href} style={{ fontSize: 14, color: MUTED, textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.color = NAVY)}
              onMouseLeave={e => (e.currentTarget.style.color = MUTED)}>
              {l.label}
            </a>
          ))}
        </div>
        {/* Right actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }} className="hidden md:flex">
          <Link href="/auth/login" style={{ fontSize: 14, color: MUTED, textDecoration: "none", padding: "8px 4px" }}>Se connecter</Link>
          <Link href="/auth/signup" style={{ fontSize: 13.5, fontWeight: 600, background: NAVY, color: "white", padding: "8px 18px", borderRadius: 9999, textDecoration: "none", transition: "opacity 0.2s" }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
            Commencer gratuitement
          </Link>
        </div>
        {/* Hamburger */}
        <button className="md:hidden" onClick={() => setOpen(v => !v)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: NAVY, padding: 4 }}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {/* Mobile menu */}
      {open && (
        <div style={{ background: "white", borderTop: "1px solid rgba(0,0,0,0.07)", padding: "16px 24px 20px" }} className="md:hidden">
          {links.map(l => (
            <a key={l.label} href={l.href} onClick={() => setOpen(false)} style={{ display: "block", padding: "10px 0", fontSize: 15, color: NAVY, textDecoration: "none", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>{l.label}</a>
          ))}
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <Link href="/auth/login" style={{ textAlign: "center", padding: "10px", fontSize: 14, color: MUTED, textDecoration: "none", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8 }}>Se connecter</Link>
            <Link href="/auth/signup" style={{ textAlign: "center", padding: "10px", fontSize: 14, fontWeight: 600, background: NAVY, color: "white", textDecoration: "none", borderRadius: 8 }}>Commencer gratuitement</Link>
          </div>
        </div>
      )}
    </nav>
  );
}

// ── FAQ Item ──────────────────────────────────────────────────────────────────
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
      <button onClick={() => setOpen(v => !v)} style={{ width: "100%", textAlign: "left", padding: "18px 0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", cursor: "pointer", gap: 16 }}>
        <span style={{ fontSize: 15, fontWeight: 500, color: NAVY, lineHeight: 1.4 }}>{q}</span>
        <ChevronDown size={18} color={GOLD} style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.3s ease" }} />
      </button>
      <div style={{ overflow: "hidden", maxHeight: open ? 400 : 0, transition: "max-height 0.35s ease", opacity: open ? 1 : 0, transition2: "opacity 0.25s" } as React.CSSProperties}>
        <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.7, paddingBottom: 18 }}>{a}</p>
      </div>
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", color: GOLD, marginBottom: 14 }}>
      {children}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function HomePageClient() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [waitlistDone, setWaitlistDone] = useState(false);
  const [waitlistLoading, setWaitlistLoading] = useState(false);

  async function handleWaitlist(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setWaitlistLoading(true);
    await supabase.from("waitlist").insert({ email, source: "homepage" });
    setWaitlistLoading(false);
    setWaitlistDone(true);
  }

  const features = [
    {
      icon: FileText, title: "Facturation intelligente",
      desc: "Créez des factures conformes en 2 minutes. ICE, TVA, mentions légales intégrés. Envoyez par WhatsApp ou email en un clic.",
      badge: { label: "Le plus utilisé", color: GOLD, textColor: "white" },
    },
    {
      icon: Sparkles, title: "Mohasib AI",
      desc: "Posez n'importe quelle question en français ou darija. Obtenez une réponse immédiate basée sur vos données réelles.",
      badge: { label: "Nouveau", color: "#D1FAE5", textColor: "#065F46" },
    },
    {
      icon: Receipt, title: "Import de relevés bancaires",
      desc: "Uploadez votre relevé PDF Attijariwafa, CIH ou BMCE. L'IA extrait toutes les transactions automatiquement.",
    },
    {
      icon: Calendar, title: "Déclarations TVA automatiques",
      desc: "Calculez votre TVA en un clic. Générez le document DGI-ready. Ne manquez plus jamais une échéance.",
    },
    {
      icon: Users, title: "Gestion clients",
      desc: "Répertoire complet avec historique et délais de paiement. Relancez les mauvais payeurs automatiquement.",
    },
    {
      icon: Download, title: "Export fiduciaire",
      desc: "Journal des ventes, grand livre, balance — en format CGNC marocain. Un clic pour votre fiduciaire.",
    },
  ];

  const steps = [
    { n: "01", title: "Créez votre compte", desc: "Inscription gratuite. Entrez votre ICE et infos entreprise." },
    { n: "02", title: "Ajoutez vos clients", desc: "Créez vos clients en quelques secondes ou importez-les." },
    { n: "03", title: "Gérez au quotidien", desc: "Factures, dépenses, questions AI — tout en un seul endroit." },
    { n: "04", title: "Restez conforme", desc: "TVA calculée, déclarations générées, fiduciaire toujours à jour." },
  ];

  const testimonials = [
    { quote: "Avant Mohasib, je passais 2 heures chaque dimanche sur mes factures. Maintenant c'est 15 minutes.", name: "Youssef B.", role: "Consultant freelance, Casablanca", initials: "YB" },
    { quote: "Mon fiduciaire était impressionné par le fichier export. Des données parfaitement organisées.", name: "Fatima Z.", role: "E-commerce, Rabat", initials: "FZ" },
    { quote: "399 MAD par mois avec un vrai comptable contre 1200 MAD avant. Le calcul était vite fait.", name: "Mehdi A.", role: "Architecte indépendant, Marrakech", initials: "MA" },
  ];

  const faqs = [
    { q: "Mohasib remplace-t-il mon fiduciaire ?", a: "Non — Mohasib complète votre fiduciaire et automatise les tâches répétitives. Avec le Pack + Comptable, vous avez les deux : l'IA et un comptable humain dédié." },
    { q: "Comment fonctionne le comptable dédié ?", a: "Après votre inscription au Pack + Comptable, nous vous assignons un comptable de notre réseau sous 24h. Vous avez son WhatsApp direct, il révise vos livres chaque mois et valide vos déclarations TVA." },
    { q: "Mohasib gère-t-il la fiscalité marocaine ?", a: "Oui — TVA (7%, 10%, 14%, 20%), IS, IR, CNSS. Le plan comptable CGNC est intégré. Les déclarations sont au format DGI." },
    { q: "Puis-je essayer avant de payer ?", a: "Oui — 14 jours gratuits, aucune carte bancaire requise. Vous accédez à toutes les fonctionnalités du plan choisi." },
    { q: "Mes données sont-elles sécurisées ?", a: "Vos données sont chiffrées et hébergées sur des serveurs sécurisés. Nous ne partageons jamais vos informations financières avec des tiers." },
    { q: "Compatible avec mon logiciel comptable ?", a: "Les exports Mohasib sont en Excel et PDF au format CGNC — compatibles avec Sage, Ciel, et tous les logiciels utilisés par les fiduciaires marocains." },
  ];

  const footerLinks = {
    "Produit": ["Fonctionnalités", "Tarifs", "Mohasib AI", "Pour les fiduciaires", "Changelog"],
    "Support": ["Centre d'aide", "Nous contacter", "+212 6XX XXX XXX", "contact@mohasib.ma"],
    "Légal": ["Politique de confidentialité", "Conditions d'utilisation", "Mentions légales"],
  };

  return (
    <>
      <style>{`
        @keyframes typing-dot {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-3px); }
        }
        @keyframes hero-up {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes hero-mockup {
          from { opacity: 0; transform: perspective(1000px) rotateX(3deg) scale(0.96); }
          to   { opacity: 1; transform: perspective(1000px) rotateX(3deg) scale(1); }
        }
        .feature-card:hover {
          border-color: ${GOLD} !important;
          transform: translateY(-3px);
          box-shadow: 0 8px 28px rgba(0,0,0,0.09) !important;
        }
        .cta-primary:hover { opacity: 0.88 !important; }
        .cta-outline:hover { background: rgba(13,21,38,0.05) !important; }
        .pricing-cta-outline:hover { background: rgba(13,21,38,0.04) !important; }
      `}</style>

      <Navbar />

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section style={{
        minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", paddingTop: 90, paddingBottom: 60, paddingLeft: 24, paddingRight: 24,
        background: `white url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cpath d='M0 0h40v40H0z' fill='none'/%3E%3Cpath d='M0 0h1v40H0zM0 0h40v1H0z' fill='rgba(0,0,0,0.045)'/%3E%3C/svg%3E")`,
      }}>
        <div style={{ maxWidth: 760, textAlign: "center", animation: "hero-up 0.7s ease-out both" }}>
          {/* Pill badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: NAVY, color: GOLD, borderRadius: 9999, padding: "5px 15px", fontSize: 12, fontWeight: 600, marginBottom: 28 }}>
            ✦ Conçu pour le marché marocain 🇲🇦
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily: SERIF, fontSize: "clamp(34px, 5vw, 62px)", fontWeight: 600,
            color: NAVY, lineHeight: 1.14, letterSpacing: "-0.5px",
            margin: "0 0 22px",
          }}>
            La comptabilité intelligente<br />pour les entrepreneurs marocains
          </h1>

          {/* Subheadline */}
          <p style={{ fontSize: "clamp(15px, 2vw, 18px)", color: MUTED, maxWidth: 520, margin: "0 auto 36px", lineHeight: 1.65 }}>
            Créez vos factures, suivez votre TVA, et posez vos questions comptables à Mohasib AI — en français, en arabe, ou en darija.
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
            <Link href="/auth/signup" className="cta-primary" style={{
              background: NAVY, color: "white", padding: "13px 26px", borderRadius: 10,
              fontSize: 15, fontWeight: 600, textDecoration: "none", transition: "opacity 0.2s", display: "inline-block",
            }}>Commencer gratuitement →</Link>
            <a href="#features" className="cta-outline" style={{
              border: `1.5px solid ${NAVY}`, color: NAVY, padding: "13px 26px", borderRadius: 10,
              fontSize: 15, fontWeight: 500, textDecoration: "none", transition: "background 0.2s", display: "inline-block",
            }}>Voir les fonctionnalités ▾</a>
          </div>

          {/* Trust line */}
          <div style={{ display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap", fontSize: 12, color: MUTED, marginBottom: 56 }}>
            {["✓ Essai 14 jours gratuit", "✓ Aucune carte bancaire", "✓ Annulation à tout moment"].map(t => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>

        {/* Dashboard mockup */}
        <div style={{ width: "100%", maxWidth: 860, margin: "0 auto", animation: "hero-mockup 0.9s 0.25s ease-out both", transform: "perspective(1000px) rotateX(3deg)" }}>
          <DashboardMockup />
        </div>
      </section>

      {/* ── PROBLEM ───────────────────────────────────────────────────────── */}
      <section style={{ background: CREAM, padding: "90px 24px" }}>
        <div style={{ maxWidth: 1060, margin: "0 auto" }}>
          <FadeIn style={{ textAlign: "center", marginBottom: 52 }}>
            <SectionLabel>Le problème</SectionLabel>
            <h2 style={{ fontFamily: SERIF, fontSize: "clamp(26px, 3.5vw, 42px)", color: NAVY, fontWeight: 600, lineHeight: 1.2, margin: "0 auto 0", maxWidth: 540 }}>
              La comptabilité vous coûte trop cher et prend trop de temps
            </h2>
          </FadeIn>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px,1fr))", gap: 20, marginBottom: 48 }}>
            {[
              { icon: Clock, num: "4–6", suffix: "h", label: "par semaine perdues sur la comptabilité", sub: "Temps moyen d'un entrepreneur marocain sur l'admin financier" },
              { icon: Banknote, prefix: "", num: 1200, suffix: " MAD", label: "par mois pour un fiduciaire", sub: "Pour des tâches que l'IA peut automatiser en secondes" },
              { icon: AlertTriangle, num: 47, suffix: "%", label: "des TPE pénalisées par la DGI", sub: "Pour des erreurs de déclaration qui auraient pu être évitées" },
            ].map((s, i) => {
              const Icon = s.icon;
              return (
                <FadeIn key={i} delay={i * 0.1}>
                  <div style={{ background: "white", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 16, padding: "28px 26px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                    <Icon size={22} color={GOLD} style={{ marginBottom: 16 }} />
                    <div style={{ fontSize: "clamp(32px,4vw,42px)", fontWeight: 700, color: NAVY, lineHeight: 1, marginBottom: 8, fontFamily: SERIF }}>
                      {typeof s.num === "number" ? <CountUp to={s.num} suffix={s.suffix} /> : `${s.num}${s.suffix}`}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: NAVY, marginBottom: 6 }}>{s.label}</div>
                    <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.6 }}>{s.sub}</div>
                  </div>
                </FadeIn>
              );
            })}
          </div>
          <FadeIn style={{ textAlign: "center" }}>
            <p style={{ fontFamily: SERIF, fontSize: "clamp(16px,2vw,20px)", color: MUTED, fontStyle: "italic" }}>
              Il y a une meilleure façon de gérer votre comptabilité.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────────── */}
      <section id="features" style={{ background: "white", padding: "90px 24px" }}>
        <div style={{ maxWidth: 1060, margin: "0 auto" }}>
          <FadeIn style={{ textAlign: "center", marginBottom: 52 }}>
            <SectionLabel>La solution</SectionLabel>
            <h2 style={{ fontFamily: SERIF, fontSize: "clamp(26px,3.5vw,42px)", color: NAVY, fontWeight: 600, lineHeight: 1.2, margin: 0 }}>
              Tout ce dont vous avez besoin,<br />dans un seul outil
            </h2>
          </FadeIn>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px,1fr))", gap: 16 }}>
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <FadeIn key={i} delay={i * 0.07}>
                  <div className="feature-card" style={{ background: "white", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 16, padding: "24px", transition: "all 0.25s ease", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", height: "100%", cursor: "default" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                      <Icon size={22} color={GOLD} />
                      {f.badge && (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 99, background: f.badge.color, color: f.badge.textColor }}>{f.badge.label}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: NAVY, marginBottom: 8 }}>{f.title}</div>
                    <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.65 }}>{f.desc}</div>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── AI SHOWCASE ───────────────────────────────────────────────────── */}
      <section style={{ background: NAVY, padding: "90px 24px" }}>
        <div style={{ maxWidth: 1060, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px,1fr))", gap: 64, alignItems: "center" }}>
          {/* Left */}
          <FadeIn>
            <SectionLabel>Mohasib AI</SectionLabel>
            <h2 style={{ fontFamily: SERIF, fontSize: "clamp(26px,3.5vw,42px)", color: "white", fontWeight: 600, lineHeight: 1.2, margin: "0 0 20px" }}>
              Votre comptable,<br />disponible 24h/24
            </h2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.6)", lineHeight: 1.7, marginBottom: 28 }}>
              Posez vos questions comptables en français, en arabe ou en darija. Mohasib connaît la fiscalité marocaine et vos chiffres en temps réel.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
              {["Calcul TVA instantané", "Alertes déclarations DGI", "Conseils fiscaux personnalisés"].map(b => (
                <div key={b} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "rgba(255,255,255,0.85)" }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(200,146,74,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Check size={12} color={GOLD} />
                  </div>
                  {b}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: GOLD, opacity: 0.85 }}>✦ Alimenté par Claude AI d'Anthropic</div>
          </FadeIn>
          {/* Right */}
          <FadeIn delay={0.15}>
            <ChatMockup />
          </FadeIn>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────────────────── */}
      <section id="pricing" style={{ background: CREAM, padding: "90px 24px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <FadeIn style={{ textAlign: "center", marginBottom: 52 }}>
            <SectionLabel>Tarifs</SectionLabel>
            <h2 style={{ fontFamily: SERIF, fontSize: "clamp(26px,3.5vw,42px)", color: NAVY, fontWeight: 600, lineHeight: 1.2, margin: "0 0 10px" }}>Simple et transparent</h2>
            <p style={{ fontSize: 16, color: MUTED }}>Choisissez la formule qui vous convient</p>
          </FadeIn>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px,1fr))", gap: 20, alignItems: "center" }}>
            {/* Solo */}
            <FadeIn delay={0.05}>
              <div style={{ background: "white", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 20, padding: "32px 28px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 4 }}>Mohasib Solo</div>
                <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>Pour les entrepreneurs autonomes</div>
                <div style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 42, fontWeight: 700, color: NAVY, fontFamily: SERIF }}>199</span>
                  <span style={{ fontSize: 14, color: MUTED }}> MAD/mois</span>
                </div>
                <div style={{ fontSize: 12, color: MUTED, textDecoration: "line-through", marginBottom: 20 }}>Fiduciaire classique : 800–1500 MAD/mois</div>
                <div style={{ borderTop: "1px solid rgba(0,0,0,0.07)", paddingTop: 20, marginBottom: 24 }}>
                  {["Factures illimitées", "Clients illimités", "Mohasib AI illimité", "Import relevés bancaires", "Calcul TVA automatique", "Export fiduciaire CGNC", "Alertes déclarations DGI", "Envoi WhatsApp des factures"].map(f => (
                    <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "#374151", marginBottom: 10 }}>
                      <Check size={14} color={GOLD} style={{ flexShrink: 0 }} /> {f}
                    </div>
                  ))}
                </div>
                <Link href="/auth/signup" className="pricing-cta-outline" style={{ display: "block", textAlign: "center", padding: "12px", border: `1.5px solid ${NAVY}`, borderRadius: 10, fontSize: 14, fontWeight: 600, color: NAVY, textDecoration: "none", transition: "background 0.2s", marginBottom: 12 }}>
                  Commencer l'essai gratuit
                </Link>
                <p style={{ textAlign: "center", fontSize: 12, color: MUTED, margin: 0 }}>14 jours gratuits — aucune carte bancaire</p>
              </div>
            </FadeIn>

            {/* + Comptable (featured) */}
            <FadeIn delay={0.12}>
              <div style={{ background: NAVY, border: `2px solid ${GOLD}`, borderRadius: 20, padding: "32px 28px", boxShadow: "0 20px 48px rgba(13,21,38,0.28)", transform: "scale(1.03)", position: "relative" }}>
                <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: GOLD, color: NAVY, fontSize: 11, fontWeight: 700, padding: "4px 16px", borderRadius: 9999, whiteSpace: "nowrap" }}>
                  Recommandé
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "white", marginBottom: 4 }}>Mohasib + Comptable</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 20 }}>Pour les entrepreneurs qui veulent un vrai comptable</div>
                <div style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 42, fontWeight: 700, color: "white", fontFamily: SERIF }}>399</span>
                  <span style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}> MAD/mois</span>
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 20 }}>199 MAD logiciel + 200 MAD comptable dédié</div>
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 20, marginBottom: 24 }}>
                  {["Tout de Mohasib Solo", "Comptable dédié assigné sous 24h", "Accès WhatsApp direct à votre comptable", "Révision mensuelle de vos livres", "Validation TVA avant soumission DGI", "Assistance clôture annuelle", "Comptable disponible pour vos questions"].map(f => (
                    <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "rgba(255,255,255,0.85)", marginBottom: 10 }}>
                      <Check size={14} color={GOLD} style={{ flexShrink: 0 }} /> {f}
                    </div>
                  ))}
                </div>
                <Link href="/auth/signup" style={{ display: "block", textAlign: "center", padding: "13px", background: GOLD, borderRadius: 10, fontSize: 14, fontWeight: 700, color: NAVY, textDecoration: "none", marginBottom: 12, transition: "opacity 0.2s" }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")}
                  onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
                  Commencer avec un comptable
                </Link>
                <p style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.4)", margin: 0 }}>14 jours gratuits — aucune carte bancaire</p>
              </div>
            </FadeIn>
          </div>

          <FadeIn style={{ textAlign: "center", marginTop: 36 }}>
            <p style={{ fontSize: 13.5, color: MUTED }}>
              Vous êtes fiduciaire ou cabinet comptable ?{" "}
              <a href="#footer" style={{ color: GOLD, fontWeight: 600, textDecoration: "none" }}>→ Mohasib Pro arrive bientôt — Rejoindre la liste d'attente</a>
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section style={{ background: "white", padding: "90px 24px" }}>
        <div style={{ maxWidth: 1060, margin: "0 auto" }}>
          <FadeIn style={{ textAlign: "center", marginBottom: 60 }}>
            <SectionLabel>Comment ça marche</SectionLabel>
            <h2 style={{ fontFamily: SERIF, fontSize: "clamp(26px,3.5vw,42px)", color: NAVY, fontWeight: 600, lineHeight: 1.2, margin: 0 }}>
              Opérationnel en 5 minutes
            </h2>
          </FadeIn>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 0, position: "relative" }}>
            {/* Dotted connector */}
            <div className="hidden md:block" style={{ position: "absolute", top: 26, left: "12.5%", right: "12.5%", borderTop: "2px dashed rgba(0,0,0,0.1)", zIndex: 0 }} />
            {steps.map((s, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div style={{ textAlign: "center", padding: "0 20px", position: "relative", zIndex: 1 }}>
                  <div style={{ width: 52, height: 52, borderRadius: "50%", background: "white", border: `2px solid rgba(0,0,0,0.1)`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
                    <span style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600, color: GOLD }}>{s.n}</span>
                  </div>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: NAVY, marginBottom: 8 }}>{s.title}</div>
                  <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>{s.desc}</div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ──────────────────────────────────────────────────── */}
      <section style={{ background: CREAM, padding: "90px 24px" }}>
        <div style={{ maxWidth: 1060, margin: "0 auto" }}>
          <FadeIn style={{ textAlign: "center", marginBottom: 52 }}>
            <SectionLabel>Ils nous font confiance</SectionLabel>
            <h2 style={{ fontFamily: SERIF, fontSize: "clamp(26px,3.5vw,42px)", color: NAVY, fontWeight: 600, lineHeight: 1.2, margin: 0 }}>
              Des entrepreneurs marocains<br />qui gagnent du temps
            </h2>
          </FadeIn>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 20, marginBottom: 24 }}>
            {testimonials.map((t, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div style={{ background: "white", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 16, padding: "26px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  <div style={{ fontSize: 14, color: GOLD, marginBottom: 14, letterSpacing: 1 }}>★★★★★</div>
                  <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.7, marginBottom: 20, fontStyle: "italic" }}>"{t.quote}"</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "white", flexShrink: 0 }}>{t.initials}</div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: NAVY }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: MUTED }}>{t.role}</div>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
          <FadeIn style={{ textAlign: "center" }}>
            <p style={{ fontSize: 12, color: MUTED, fontStyle: "italic" }}>* Témoignages illustratifs. Vos résultats peuvent varier.</p>
          </FadeIn>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section style={{ background: "white", padding: "90px 24px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <FadeIn style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontFamily: SERIF, fontSize: "clamp(26px,3.5vw,42px)", color: NAVY, fontWeight: 600, lineHeight: 1.2, margin: 0 }}>
              Questions fréquentes
            </h2>
          </FadeIn>
          {faqs.map((f, i) => (
            <FadeIn key={i} delay={i * 0.05}>
              <FAQItem q={f.q} a={f.a} />
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────────────── */}
      <section style={{ background: NAVY, padding: "100px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <FadeIn>
            <h2 style={{ fontFamily: SERIF, fontSize: "clamp(28px,4vw,48px)", color: GOLD, fontWeight: 600, lineHeight: 1.2, margin: "0 0 18px" }}>
              Prêt à reprendre le contrôle<br />de votre comptabilité ?
            </h2>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.65)", marginBottom: 36, lineHeight: 1.6 }}>
              Rejoignez les entrepreneurs marocains qui gagnent 4 à 6 heures par semaine.
            </p>

            {/* Email form */}
            {waitlistDone ? (
              <div style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 12, padding: "16px 24px", color: "#6EE7B7", fontSize: 15, fontWeight: 500, marginBottom: 32 }}>
                ✓ Vous êtes sur la liste ! Nous vous contactons très bientôt.
              </div>
            ) : (
              <form onSubmit={handleWaitlist} style={{ display: "flex", gap: 10, maxWidth: 460, margin: "0 auto 32px", flexWrap: "wrap", justifyContent: "center" }}>
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  style={{ flex: 1, minWidth: 200, padding: "12px 16px", borderRadius: 10, border: "none", fontSize: 14, outline: "none", background: "white", color: NAVY }}
                />
                <button type="submit" disabled={waitlistLoading} style={{ padding: "12px 22px", borderRadius: 10, background: GOLD, color: NAVY, fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
                  {waitlistLoading ? "…" : "Rejoindre →"}
                </button>
              </form>
            )}

            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
              <Link href="/auth/signup" style={{ padding: "13px 26px", background: GOLD, borderRadius: 10, fontSize: 15, fontWeight: 700, color: NAVY, textDecoration: "none" }}>
                Commencer gratuitement
              </Link>
              <a href="#features" style={{ padding: "13px 26px", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: 10, fontSize: 15, fontWeight: 500, color: "white", textDecoration: "none" }}>
                Voir les fonctionnalités
              </a>
            </div>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: 0 }}>🔒 Aucun spam. Juste les updates importantes.</p>
          </FadeIn>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer id="footer" style={{ background: "#0A1020", padding: "60px 24px 0" }}>
        <div style={{ maxWidth: 1060, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 40, paddingBottom: 48 }}>
            {/* Brand */}
            <div>
              <Image src="/logo.png" alt="Mohasib" width={110} height={36} style={{ height: "auto", marginBottom: 14 }} />
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.7, margin: "0 0 16px" }}>AI accounting for Moroccan SMEs</p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", margin: "0 0 20px" }}>Fait avec ❤️ au Maroc 🇲🇦</p>
            </div>
            {/* Links */}
            {Object.entries(footerLinks).map(([col, links]) => (
              <div key={col}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 16 }}>{col}</div>
                {links.map(l => (
                  <div key={l} style={{ marginBottom: 10 }}>
                    <a href="#" style={{ fontSize: 13.5, color: "rgba(255,255,255,0.4)", textDecoration: "none", transition: "color 0.2s" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.85)")}
                      onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}>
                      {l}
                    </a>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "20px 0", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>© 2025 Mohasib. Tous droits réservés.</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Propulsé par Claude AI d'Anthropic</span>
          </div>
        </div>
      </footer>
    </>
  );
}
