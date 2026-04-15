"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ChevronDown, Menu, X } from "lucide-react";

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
    q: "Mohasib est-il conforme à la fiscalité marocaine ?",
    a: "Oui — TVA (7 %, 10 %, 14 %, 20 %), IS, IR, CNSS. Le plan comptable CGNC est intégré. Les déclarations sont au format DGI.",
  },
  {
    q: "Puis-je essayer gratuitement ?",
    a: "Oui — 14 jours gratuits, aucune carte bancaire requise. Vous accédez à toutes les fonctionnalités du plan choisi.",
  },
  {
    q: "Mes données financières sont-elles sécurisées ?",
    a: "Vos données sont chiffrées et hébergées sur des serveurs sécurisés. Nous ne partageons jamais vos informations financières avec des tiers.",
  },
];

// ─── FAQ Item ─────────────────────────────────────────────────────────────────

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[rgba(0,0,0,0.08)]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left"
      >
        <span style={{ fontSize: 16, fontWeight: 500, color: "#0A0A0A", fontFamily: "var(--font-inter, Inter, sans-serif)" }}>
          {q}
        </span>
        <ChevronDown
          size={18}
          style={{
            color: "#6B7280",
            flexShrink: 0,
            marginLeft: 16,
            transition: "transform 0.2s",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>
      {open && (
        <p style={{ fontSize: 15, color: "#6B7280", lineHeight: 1.7, paddingBottom: 20, fontFamily: "var(--font-inter, Inter, sans-serif)" }}>
          {a}
        </p>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function HomePageClient() {
  const supabase = createClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleWaitlist(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    await supabase.from("fiduciaire_waitlist").insert({ email });
    setSubmitted(true);
  }

  const serif = "var(--font-playfair, 'Instrument Serif', Georgia, serif)";
  const sans = "var(--font-inter, Inter, sans-serif)";

  return (
    <div style={{ fontFamily: sans, backgroundColor: "#FFFFFF", color: "#0A0A0A" }}>

      {/* ── NAVBAR ──────────────────────────────────────────────────────────── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        backgroundColor: "#FFFFFF",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
        height: 56,
        display: "flex", alignItems: "center",
      }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto", width: "100%",
          padding: "0 48px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          {/* Logo */}
          <span style={{ fontWeight: 700, fontSize: 18, color: "#0A0A0A", fontFamily: sans }}>
            Mohasib
          </span>

          {/* Center nav — desktop */}
          <div className="hidden md:flex" style={{ gap: 32 }}>
            {["Fonctionnalités", "Tarifs", "À propos"].map(label => (
              <a
                key={label}
                href={label === "Tarifs" ? "#tarifs" : label === "Fonctionnalités" ? "#fonctionnalites" : "#"}
                style={{ fontSize: 14, color: "#6B7280", textDecoration: "none", fontFamily: sans }}
                onMouseEnter={e => (e.currentTarget.style.color = "#0A0A0A")}
                onMouseLeave={e => (e.currentTarget.style.color = "#6B7280")}
              >
                {label}
              </a>
            ))}
          </div>

          {/* Right actions */}
          <div className="hidden md:flex" style={{ alignItems: "center", gap: 20 }}>
            <Link href="/auth/login" style={{ fontSize: 14, color: "#6B7280", textDecoration: "none", fontFamily: sans }}>
              Se connecter
            </Link>
            <Link
              href="/auth/signup"
              style={{
                fontSize: 13, fontWeight: 500, color: "#FFFFFF",
                backgroundColor: "#0D1526",
                padding: "8px 18px", borderRadius: 9999,
                textDecoration: "none", fontFamily: sans,
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              Commencer
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#0A0A0A", padding: 4 }}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div style={{
            position: "absolute", top: 56, left: 0, right: 0,
            backgroundColor: "#FFFFFF",
            borderBottom: "1px solid rgba(0,0,0,0.08)",
            padding: "16px 24px 24px",
            display: "flex", flexDirection: "column", gap: 16,
          }}>
            {["Fonctionnalités", "Tarifs", "À propos"].map(label => (
              <a key={label} href="#" onClick={() => setMobileOpen(false)}
                style={{ fontSize: 15, color: "#374151", textDecoration: "none" }}>
                {label}
              </a>
            ))}
            <div style={{ borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <Link href="/auth/login" style={{ fontSize: 14, color: "#6B7280", textDecoration: "none" }}>Se connecter</Link>
              <Link href="/auth/signup" style={{
                fontSize: 14, fontWeight: 500, color: "#FFFFFF",
                backgroundColor: "#0D1526", padding: "10px 20px",
                borderRadius: 9999, textDecoration: "none", textAlign: "center",
              }}>Commencer</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── SECTION 1: HERO ─────────────────────────────────────────────────── */}
      <section style={{ padding: "120px 48px 100px", backgroundColor: "#FFFFFF" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h1 style={{
            fontFamily: serif,
            fontSize: "clamp(42px, 6vw, 72px)",
            fontWeight: 600,
            lineHeight: 1.1,
            letterSpacing: "-2px",
            color: "#0A0A0A",
            maxWidth: 700,
            margin: 0,
          }}>
            La comptabilité marocaine,<br />enfin intelligente.
          </h1>

          <p style={{
            fontSize: 18, color: "#6B7280", maxWidth: 560,
            lineHeight: 1.7, marginTop: 24, fontFamily: sans,
          }}>
            Mohasib automatise vos factures, calcule votre TVA, et répond à vos questions comptables en temps réel. Conçu pour les entrepreneurs marocains.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 40, alignItems: "center" }}>
            <Link
              href="/auth/signup"
              style={{
                fontSize: 15, fontWeight: 500, color: "#FFFFFF",
                backgroundColor: "#0D1526",
                padding: "14px 28px", borderRadius: 9999,
                textDecoration: "none", fontFamily: sans,
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              Commencer gratuitement
            </Link>
            <a
              href="#fonctionnalites"
              style={{
                fontSize: 15, color: "#0A0A0A",
                backgroundColor: "transparent",
                border: "1px solid rgba(0,0,0,0.2)",
                padding: "14px 28px", borderRadius: 9999,
                textDecoration: "none", fontFamily: sans,
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.4)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.2)")}
            >
              Voir comment ça marche
            </a>
          </div>

          <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 16, fontFamily: sans }}>
            Essai 14 jours · Aucune carte bancaire · Annulation libre
          </p>
        </div>
      </section>
      <div style={{ height: 1, backgroundColor: "rgba(0,0,0,0.08)", maxWidth: "100%" }} />

      {/* ── SECTION 2: STATS ─────────────────────────────────────────────────── */}
      <section style={{ padding: "48px", backgroundColor: "#FFFFFF" }}>
        <div style={{
          maxWidth: 800, margin: "0 auto",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexWrap: "wrap", gap: 0,
        }}>
          {[
            { num: "4–6h", label: "perdues par semaine sur la comptabilité" },
            { num: "800–1500 MAD", label: "coût mensuel d'un fiduciaire classique" },
            { num: "47%", label: "des TPE pénalisées par la DGI chaque année" },
          ].map((stat, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center" }}>
              <div style={{ padding: "0 40px", textAlign: "center" }}>
                <div style={{ fontFamily: serif, fontSize: 36, fontWeight: 700, color: "#0A0A0A", lineHeight: 1.1 }}>
                  {stat.num}
                </div>
                <div style={{ fontSize: 13, color: "#6B7280", maxWidth: 140, marginTop: 8, lineHeight: 1.4, fontFamily: sans }}>
                  {stat.label}
                </div>
              </div>
              {i < 2 && (
                <div style={{ width: 1, height: 64, backgroundColor: "rgba(0,0,0,0.1)", flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── SECTION 3: PROBLEM ───────────────────────────────────────────────── */}
      <section style={{ padding: "100px 48px", backgroundColor: "#FFFFFF" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <p style={{ fontSize: 11, letterSpacing: "2px", color: "#C8924A", fontWeight: 600, textTransform: "uppercase", fontFamily: sans, margin: 0 }}>
            Le problème
          </p>
          <h2 style={{
            fontFamily: serif,
            fontSize: "clamp(28px, 4vw, 48px)",
            fontWeight: 600,
            lineHeight: 1.2,
            color: "#0A0A0A",
            marginTop: 12,
            marginBottom: 48,
          }}>
            La comptabilité au Maroc est<br />un problème non résolu.
          </h2>

          {[
            {
              title: "Le système fiscal est complexe.",
              body: "TVA à 4 taux différents, IS, IR, CNSS — même les comptables expérimentés trouvent le système difficile. Pour un entrepreneur sans formation comptable, c'est incompréhensible.",
            },
            {
              title: "Les factures sont un chaos.",
              body: "La majorité des TPE marocaines envoient des factures non conformes. Résultat : paiements refusés, dépenses non déductibles, litiges.",
            },
            {
              title: "Le Maroc se digitalise. Les outils n'ont pas suivi.",
              body: "Aucun logiciel comptable n'est conçu pour le marché marocain. Tout le monde utilise Excel et espère ne pas se tromper.",
            },
          ].map((item, i) => (
            <div key={i}>
              {i > 0 && <div style={{ height: 1, backgroundColor: "rgba(0,0,0,0.08)", margin: "0" }} />}
              <div style={{ padding: "36px 0" }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: "#0A0A0A", margin: "0 0 8px", fontFamily: sans }}>
                  {item.title}
                </h3>
                <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.7, margin: 0, fontFamily: sans }}>
                  {item.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SECTION 4: SOLUTION (DARK) ───────────────────────────────────────── */}
      <section id="fonctionnalites" style={{ padding: "100px 48px", backgroundColor: "#0D1526" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p style={{ fontSize: 11, letterSpacing: "2px", color: "#C8924A", fontWeight: 600, textTransform: "uppercase", fontFamily: sans, margin: "0 0 12px" }}>
            La solution
          </p>
          <h2 style={{
            fontFamily: serif,
            fontSize: "clamp(28px, 4vw, 52px)",
            fontWeight: 600,
            lineHeight: 1.15,
            color: "#FFFFFF",
            maxWidth: 600,
            margin: "0 0 64px",
          }}>
            Mohasib fait tout ce que<br />vous évitez de faire.
          </h2>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 0,
          }}>
            {[
              {
                icon: "◧",
                title: "Facturation conforme en 2 minutes",
                desc: "ICE, TVA, mentions légales — tout est intégré et conforme au droit marocain.",
              },
              {
                icon: "✦",
                title: "Mohasib AI, votre comptable 24h/24",
                desc: "Posez vos questions en français ou darija. Réponses basées sur vos données réelles.",
              },
              {
                icon: "⬇",
                title: "Import de relevés bancaires",
                desc: "Uploadez votre relevé CIH ou Attijariwafa. L'IA extrait toutes les transactions.",
              },
              {
                icon: "📋",
                title: "Déclaration TVA en un clic",
                desc: "Calcul automatique, document DGI-ready, historique de toutes vos déclarations.",
              },
              {
                icon: "👤",
                title: "Comptable dédié sur WhatsApp",
                desc: "Pack + Comptable : un vrai comptable assigné à votre compte sous 24h.",
              },
              {
                icon: "↗",
                title: "Export fiduciaire complet",
                desc: "Journal des ventes, grand livre, balance — en format CGNC marocain.",
              },
            ].map((f, i) => (
              <div key={i} style={{
                padding: "32px 24px",
                borderTop: i >= 2 ? "1px solid rgba(255,255,255,0.08)" : "none",
                borderLeft: i % 2 === 1 ? "1px solid rgba(255,255,255,0.08)" : "none",
              }}>
                <div style={{ fontSize: 20, color: "#C8924A", marginBottom: 12 }}>{f.icon}</div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "#FFFFFF", margin: "0 0 8px", fontFamily: sans }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, margin: 0, fontFamily: sans }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 5: AI DEMO ───────────────────────────────────────────────── */}
      <section style={{ padding: "100px 48px", backgroundColor: "#FFFFFF" }}>
        <div style={{
          maxWidth: 1100, margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 64,
          alignItems: "start",
        }}>
          {/* Left */}
          <div>
            <p style={{ fontSize: 11, letterSpacing: "2px", color: "#C8924A", fontWeight: 600, textTransform: "uppercase", fontFamily: sans, margin: "0 0 12px" }}>
              Mohasib AI
            </p>
            <h2 style={{
              fontFamily: serif,
              fontSize: "clamp(28px, 4vw, 48px)",
              fontWeight: 600,
              lineHeight: 1.2,
              color: "#0A0A0A",
              maxWidth: 500,
              margin: 0,
            }}>
              Une question comptable ?<br />Posez-la.
            </h2>
            <p style={{ fontSize: 16, color: "#6B7280", lineHeight: 1.7, marginTop: 20, maxWidth: 400, fontFamily: sans }}>
              En français ou en darija. Réponses instantanées basées sur vos vraies données.
            </p>
            <Link
              href="/auth/signup"
              style={{
                display: "inline-block", marginTop: 32,
                fontSize: 14, fontWeight: 500, color: "#FFFFFF",
                backgroundColor: "#0D1526",
                padding: "12px 24px", borderRadius: 9999,
                textDecoration: "none", fontFamily: sans,
              }}
            >
              Essayer gratuitement
            </Link>
          </div>

          {/* Right — static chat */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              {
                user: "Combien je dois en TVA ce mois ?",
                ai: "Votre TVA collectée est 9 900 MAD.\nTVA déductible : 2 600 MAD.\nTVA nette due : 7 300 MAD avant le 20 mai.",
              },
              {
                user: "Qui ne m'a pas encore payé ?",
                ai: "2 factures en attente :\n• Pharma3 SA — 10 200 MAD (15j)\n• Immo Derb Omar — 26 400 MAD",
              },
            ].map((pair, i) => (
              <div key={i} style={{
                backgroundColor: "#FAFAF6",
                border: "1px solid rgba(0,0,0,0.06)",
                borderRadius: 12,
                overflow: "hidden",
              }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#0A0A0A", textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: sans }}>
                    Vous
                  </span>
                  <p style={{ fontSize: 14, color: "#374151", margin: "6px 0 0", fontFamily: sans }}>
                    &ldquo;{pair.user}&rdquo;
                  </p>
                </div>
                <div style={{ padding: "16px 20px" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#C8924A", textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: sans }}>
                    Mohasib AI
                  </span>
                  <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.6, margin: "6px 0 0", whiteSpace: "pre-line", fontFamily: sans }}>
                    {pair.ai}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 6: PRICING ───────────────────────────────────────────────── */}
      <section id="tarifs" style={{ padding: "100px 48px", backgroundColor: "#FAFAF6" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <p style={{ fontSize: 11, letterSpacing: "2px", color: "#C8924A", fontWeight: 600, textTransform: "uppercase", fontFamily: sans, margin: "0 0 12px" }}>
            Tarifs
          </p>
          <h2 style={{
            fontFamily: serif,
            fontSize: "clamp(28px, 4vw, 48px)",
            fontWeight: 600,
            color: "#0A0A0A",
            margin: "0 0 56px",
          }}>
            Simple. Transparent.
          </h2>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 24,
          }}>
            {/* Card 1 */}
            <div style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid rgba(0,0,0,0.1)",
              borderRadius: 16,
              padding: 40,
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "#0A0A0A", margin: "0 0 24px", fontFamily: sans }}>
                Mohasib Admin
              </h3>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
                <span style={{ fontFamily: serif, fontSize: 36, fontWeight: 700, color: "#0A0A0A" }}>199 MAD</span>
                <span style={{ fontSize: 14, color: "#6B7280", fontFamily: sans }}>/mois</span>
              </div>
              <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 4px", fontFamily: sans }}>
                Pour les entrepreneurs autonomes
              </p>
              <p style={{ fontSize: 12, color: "#9CA3AF", margin: "0 0 28px", fontFamily: sans }}>
                vs <s>800–1500 MAD/mois</s> fiduciaire
              </p>
              <div style={{ height: 1, backgroundColor: "rgba(0,0,0,0.08)", marginBottom: 28 }} />
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  "Factures illimitées",
                  "Mohasib AI illimité",
                  "Import relevés bancaires",
                  "Déclarations TVA",
                  "Export fiduciaire",
                ].map(f => (
                  <li key={f} style={{ fontSize: 14, color: "#374151", fontFamily: sans, display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: "#059669", fontWeight: 700 }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/auth/signup"
                style={{
                  display: "block", textAlign: "center",
                  fontSize: 14, fontWeight: 500, color: "#0D1526",
                  border: "1px solid #0D1526",
                  padding: "12px", borderRadius: 9999,
                  textDecoration: "none", fontFamily: sans,
                }}
              >
                Commencer l&apos;essai gratuit
              </Link>
            </div>

            {/* Card 2 */}
            <div style={{
              backgroundColor: "#0D1526",
              borderRadius: 16,
              padding: 40,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "#FFFFFF", margin: 0, fontFamily: sans }}>
                  Mohasib + Comptable
                </h3>
                <span style={{
                  fontSize: 11, fontWeight: 600, color: "#C8924A",
                  backgroundColor: "rgba(200,146,74,0.2)",
                  padding: "3px 10px", borderRadius: 9999, fontFamily: sans,
                }}>
                  Recommandé
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
                <span style={{ fontFamily: serif, fontSize: 36, fontWeight: 700, color: "#FFFFFF" }}>399 MAD</span>
                <span style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", fontFamily: sans }}>/mois</span>
              </div>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", margin: "0 0 28px", fontFamily: sans }}>
                Logiciel + comptable dédié
              </p>
              <div style={{ height: 1, backgroundColor: "rgba(255,255,255,0.1)", marginBottom: 28 }} />
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  "Tout de Mohasib Admin",
                  "Comptable dédié assigné sous 24h",
                  "WhatsApp direct avec votre comptable",
                  "Révision mensuelle de vos livres",
                  "Validation TVA avant soumission",
                ].map(f => (
                  <li key={f} style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", fontFamily: sans, display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: "#C8924A", fontWeight: 700 }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/auth/signup"
                style={{
                  display: "block", textAlign: "center",
                  fontSize: 14, fontWeight: 500, color: "#FFFFFF",
                  backgroundColor: "#C8924A",
                  padding: "12px", borderRadius: 9999,
                  textDecoration: "none", fontFamily: sans,
                }}
              >
                Commencer avec un comptable
              </Link>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", textAlign: "center", margin: "12px 0 0", fontFamily: sans }}>
                14 jours gratuits — aucune carte bancaire
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 7: FAQ ───────────────────────────────────────────────────── */}
      <section style={{ padding: "100px 48px", backgroundColor: "#FFFFFF" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <h2 style={{
            fontFamily: serif,
            fontSize: "clamp(28px, 4vw, 42px)",
            fontWeight: 600,
            color: "#0A0A0A",
            margin: "0 0 48px",
          }}>
            Questions fréquentes
          </h2>
          {FAQS.map((faq, i) => <FAQItem key={i} q={faq.q} a={faq.a} />)}
        </div>
      </section>

      {/* ── SECTION 8: FINAL CTA (DARK) ─────────────────────────────────────── */}
      <section style={{ padding: "120px 48px", backgroundColor: "#0D1526", textAlign: "center" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <h2 style={{
            fontFamily: serif,
            fontSize: "clamp(32px, 5vw, 56px)",
            fontWeight: 600,
            color: "#FFFFFF",
            lineHeight: 1.15,
            margin: 0,
          }}>
            Prenez le contrôle de<br />votre comptabilité.
          </h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.55)", marginTop: 16, lineHeight: 1.7, fontFamily: sans }}>
            Rejoignez les entrepreneurs marocains<br />qui gagnent du temps avec Mohasib.
          </p>

          <Link
            href="/auth/signup"
            style={{
              display: "inline-block", marginTop: 40,
              fontSize: 16, fontWeight: 500, color: "#FFFFFF",
              backgroundColor: "#C8924A",
              padding: "16px 36px", borderRadius: 9999,
              textDecoration: "none", fontFamily: sans,
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#B8823A")}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#C8924A")}
          >
            Commencer gratuitement →
          </Link>

          {/* Email waitlist */}
          <div style={{ marginTop: 40 }}>
            {submitted ? (
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", fontFamily: sans }}>
                ✓ On vous tient au courant !
              </p>
            ) : (
              <form onSubmit={handleWaitlist} style={{ display: "flex", gap: 8, maxWidth: 400, margin: "0 auto", justifyContent: "center" }}>
                <input
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{
                    flex: 1, padding: "12px 16px",
                    borderRadius: 9999, border: "1px solid rgba(255,255,255,0.15)",
                    backgroundColor: "rgba(255,255,255,0.07)",
                    color: "#FFFFFF", fontSize: 14, fontFamily: sans,
                    outline: "none",
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: "12px 20px", borderRadius: 9999,
                    backgroundColor: "rgba(255,255,255,0.12)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    color: "#FFFFFF", fontSize: 14, cursor: "pointer", fontFamily: sans,
                  }}
                >
                  →
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer style={{ backgroundColor: "#0A0A0A", padding: "60px 48px 40px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 32 }}>
            <span style={{ fontWeight: 700, fontSize: 18, color: "#FFFFFF", fontFamily: sans }}>
              Mohasib
            </span>
            <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
              {["Fonctionnalités", "Tarifs", "Contact", "LinkedIn"].map(link => (
                <a key={link} href="#" style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", textDecoration: "none", fontFamily: sans }}
                  onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
                >
                  {link}
                </a>
              ))}
            </div>
          </div>

          <div style={{ height: 1, backgroundColor: "rgba(255,255,255,0.1)", marginBottom: 28 }} />

          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontFamily: sans }}>
              © 2026 Mohasib. Fait au Maroc 🇲🇦
            </span>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontFamily: sans }}>
              contact@mohasib.ma
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}
