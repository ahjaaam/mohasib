"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

const FONT = "var(--font-jakarta), sans-serif";
const NAVY: React.CSSProperties["color"] = "#0D1526";
const GOLD: React.CSSProperties["color"] = "#C8924A";

// ── Scroll animation hook ─────────────────────────────────────────────────────

function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, style: { opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)", transition: "opacity 0.45s ease-out, transform 0.45s ease-out" } as React.CSSProperties };
}

// ── Demo Form ─────────────────────────────────────────────────────────────────

function DemoForm({ onSuccess }: { onSuccess?: () => void }) {
  const supabase = createClient();
  const [form, setForm] = useState({ nom: "", email: "", telephone: "", entreprise: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email) return;
    setLoading(true);
    await supabase.from("demo_requests").insert(form);
    setLoading(false);
    setDone(true);
    onSuccess?.();
  }

  if (done) return (
    <div style={{ textAlign: "center", padding: "32px 0" }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
      <p style={{ fontSize: 16, fontWeight: 600, color: "#FFFFFF", fontFamily: FONT, margin: "0 0 8px" }}>Demande reçue !</p>
      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", fontFamily: FONT, margin: 0 }}>On vous rappelle sous 24h.</p>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {[
        { key: "nom", placeholder: "Votre nom", type: "text" },
        { key: "email", placeholder: "Email professionnel", type: "email" },
        { key: "telephone", placeholder: "Téléphone (optionnel)", type: "tel" },
        { key: "entreprise", placeholder: "Nom de l'entreprise (optionnel)", type: "text" },
      ].map(({ key, placeholder, type }) => (
        <input
          key={key}
          type={type}
          placeholder={placeholder}
          value={(form as any)[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          style={{
            padding: "12px 16px", borderRadius: 10, fontFamily: FONT,
            border: "1px solid rgba(0,0,0,0.12)", backgroundColor: "#FFFFFF",
            color: "#0A0A0A", fontSize: 14, outline: "none",
            width: "100%", boxSizing: "border-box",
          }}
        />
      ))}
      <button
        type="submit"
        disabled={loading}
        style={{
          marginTop: 4, padding: "13px", borderRadius: 10,
          backgroundColor: GOLD, border: "none", cursor: loading ? "wait" : "pointer",
          color: "#FFFFFF", fontSize: 14, fontWeight: 600, fontFamily: FONT,
          opacity: loading ? 0.7 : 1, transition: "opacity 0.2s",
        }}
      >
        {loading ? "Envoi…" : "Demander une démo →"}
      </button>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", textAlign: "center", margin: 0, fontFamily: FONT }}>
        Rappel sous 24h · Aucun engagement
      </p>
    </form>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function HomePageClient() {
  const supabase = createClient();
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistDone, setWaitlistDone] = useState(false);

  async function handleWaitlist(e: React.FormEvent) {
    e.preventDefault();
    if (!waitlistEmail) return;
    await supabase.from("fiduciaire_waitlist").insert({ email: waitlistEmail, source: "homepage_accountant" });
    setWaitlistDone(true);
  }

  const pricingFade    = useFadeIn();
  const accountantFade = useFadeIn();

  return (
    <div style={{ fontFamily: FONT, backgroundColor: "#FFFFFF", color: "#0A0A0A" }}>

      {/* ── NAVBAR ──────────────────────────────────────────────────────────── */}
      <style>{`
        .nav-inner { max-width: 1230px; margin: 0 auto; padding: 0 32px; height: 100%; display: flex; align-items: center; justify-content: space-between; }
        @media (max-width: 640px) { .nav-inner { padding: 0 20px; } }
        .page-section { padding: 80px 32px; }
        @media (max-width: 640px) { .page-section { padding: 56px 20px; } }
      `}</style>
      <nav style={{ backgroundColor: "#FFFFFF", height: 74 }}>
        <div className="nav-inner">
          <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
            <Image src="/logo2.png" alt="Mohasib" width={168} height={50.4} style={{ objectFit: "contain" }} />
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Link href="/auth/login" style={{ fontSize: 14, color: "#6B7280", textDecoration: "none", fontFamily: FONT }}>
              Se connecter
            </Link>
            <Link href="/auth/signup" style={{ fontSize: 13, fontWeight: 600, color: "#FFFFFF", backgroundColor: NAVY, padding: "9px 20px", borderRadius: 9999, textDecoration: "none", fontFamily: FONT }}>
              Essai gratuit
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section className="page-section" style={{ backgroundColor: "#FFFFFF" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr", gap: 48 }} className="hero-grid">
          <style>{`@media (min-width: 900px) { .hero-grid { grid-template-columns: 1fr 420px !important; align-items: start; } }`}</style>

          {/* Left: copy */}
          <div style={{ paddingTop: 16 }}>
            <h1 style={{ fontFamily: FONT, fontSize: "clamp(36px, 5.5vw, 64px)", fontWeight: 700, lineHeight: 1.08, letterSpacing: "-1.5px", color: "#0A0A0A", margin: "0 0 24px", maxWidth: 620 }}>
              La Comptabilité Marocaine,<br />
              <span style={{ color: GOLD }}>Enfin Intelligente.</span>
            </h1>

            <p style={{ fontSize: 18, color: "#4B5563", lineHeight: 1.7, margin: "0 0 36px", maxWidth: 500, fontFamily: FONT }}>
              Mohasib automatise vos factures, calcule votre TVA et gère votre paie. IA comptable disponible 24h/24 en français ou en darija.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 28 }}>
              <Link href="/auth/signup" style={{ fontSize: 15, fontWeight: 600, color: "#FFFFFF", backgroundColor: NAVY, padding: "14px 28px", borderRadius: 9999, textDecoration: "none", fontFamily: FONT }}>
                Commencer gratuitement
              </Link>
              <a href="#tarifs" style={{ fontSize: 15, fontWeight: 500, color: "#0A0A0A", border: "1px solid rgba(0,0,0,0.18)", backgroundColor: "transparent", padding: "14px 28px", borderRadius: 9999, textDecoration: "none", fontFamily: FONT }}>
                Voir les tarifs
              </a>
            </div>

            <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0, fontFamily: FONT }}>
              14 jours gratuits · Aucune carte bancaire · Annulation libre
            </p>

            {/* Social proof */}
            <div style={{ marginTop: 48, paddingTop: 40, borderTop: "1px solid rgba(0,0,0,0.08)", display: "flex", flexWrap: "wrap", gap: 40 }}>
              {[
                { num: "4–6h", label: "économisées par semaine" },
                { num: "199 MAD", label: "vs 1 000+ MAD fiduciaire" },
                { num: "100%", label: "conforme DGI Maroc" },
              ].map((s, i) => (
                <div key={i}>
                  <div style={{ fontFamily: FONT, fontSize: 26, fontWeight: 700, color: "#0A0A0A", lineHeight: 1 }}>{s.num}</div>
                  <div style={{ fontSize: 13, color: "#6B7280", marginTop: 5, fontFamily: FONT }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: demo form card */}
          <div style={{ backgroundColor: NAVY, borderRadius: 20, padding: "36px 32px", boxShadow: "0 24px 64px rgba(13,21,38,0.18)" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: GOLD, letterSpacing: "1.5px", textTransform: "uppercase", fontFamily: FONT, margin: "0 0 8px" }}>
              Démo personnalisée
            </p>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#FFFFFF", margin: "0 0 6px", fontFamily: FONT }}>
              Voyez Mohasib En Action
            </h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", margin: "0 0 28px", fontFamily: FONT }}>
              Un expert vous montre comment Mohasib s&apos;adapte à votre activité.
            </p>
            <DemoForm />
          </div>
        </div>
      </section>

      {/* ── PRICING ─────────────────────────────────────────────────────────── */}
      <section id="tarifs" className="page-section" style={{ backgroundColor: "#ffffff" }}>
        <div style={{ maxWidth: 940, margin: "0 auto" }} ref={pricingFade.ref}>
          <div style={pricingFade.style}> 
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "2px", color: GOLD, textTransform: "uppercase", fontFamily: FONT, margin: "0 0 12px", textAlign: "center" }}>Tarifs</p>
            <h2 style={{ fontFamily: FONT, fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 700, color: "#0A0A0A", textAlign: "center", margin: "0 0 14px", letterSpacing: "-0.5px" }}>
              Simple. Transparent.
            </h2>
            <p style={{ fontSize: 16, color: "#6B7280", textAlign: "center", margin: "0 0 52px", fontFamily: FONT }}>
              Commencez gratuitement. Passez à un plan supérieur quand vous êtes prêt.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
              {/* Plan 1 */}
              <div style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 20, padding: "40px 36px" }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0A0A0A", margin: "0 0 24px", fontFamily: FONT }}>Mohasib Admin</h3>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                  <span style={{ fontFamily: FONT, fontSize: 40, fontWeight: 800, color: "#0A0A0A", letterSpacing: "-1px" }}>199 MAD</span>
                  <span style={{ fontSize: 14, color: "#6B7280", fontFamily: FONT }}>/mois</span>
                </div>
                <p style={{ fontSize: 13, color: "#9CA3AF", margin: "0 0 28px", fontFamily: FONT }}>
                  vs <s>800–1 500 MAD/mois</s> fiduciaire classique
                </p>
                <div style={{ height: 1, backgroundColor: "rgba(0,0,0,0.07)", marginBottom: 24 }} />
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", display: "flex", flexDirection: "column", gap: 11 }}>
                  {["Factures illimitées", "Mohasib AI illimité", "Import relevés bancaires", "Déclarations TVA auto", "Module paie & CNSS", "Export fiduciaire CGNC"].map(f => (
                    <li key={f} style={{ fontSize: 14, color: "#374151", fontFamily: FONT, display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ color: "#059669", fontWeight: 700, fontSize: 15 }}>✓</span>{f}
                    </li>
                  ))}
                </ul>
                <Link href="/auth/signup" style={{ display: "block", textAlign: "center", fontSize: 14, fontWeight: 600, color: NAVY, border: `1.5px solid ${NAVY}`, padding: "13px", borderRadius: 10, textDecoration: "none", fontFamily: FONT }}>
                  Commencer l&apos;essai gratuit
                </Link>
              </div>

              {/* Plan 2 */}
              <div style={{ backgroundColor: NAVY, borderRadius: 20, padding: "40px 36px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#FFFFFF", margin: 0, fontFamily: FONT }}>Mohasib + Comptable</h3>
                  <span style={{ fontSize: 11, fontWeight: 700, color: GOLD, backgroundColor: "rgba(200,146,74,0.2)", padding: "3px 10px", borderRadius: 9999, fontFamily: FONT }}>Recommandé</span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                  <span style={{ fontFamily: FONT, fontSize: 40, fontWeight: 800, color: "#FFFFFF", letterSpacing: "-1px" }}>399 MAD</span>
                  <span style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", fontFamily: FONT }}>/mois</span>
                </div>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: "0 0 28px", fontFamily: FONT }}>
                  Logiciel + comptable dédié humain
                </p>
                <div style={{ height: 1, backgroundColor: "rgba(255,255,255,0.1)", marginBottom: 24 }} />
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", display: "flex", flexDirection: "column", gap: 11 }}>
                  {["Tout de Mohasib Admin", "Comptable dédié sous 24h", "WhatsApp direct avec votre comptable", "Révision mensuelle des livres", "Validation TVA avant soumission", "Bilan annuel accompagné"].map(f => (
                    <li key={f} style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", fontFamily: FONT, display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ color: GOLD, fontWeight: 700, fontSize: 15 }}>✓</span>{f}
                    </li>
                  ))}
                </ul>
                <Link href="/auth/signup" style={{ display: "block", textAlign: "center", fontSize: 14, fontWeight: 600, color: "#FFFFFF", backgroundColor: GOLD, padding: "13px", borderRadius: 10, textDecoration: "none", fontFamily: FONT }}>
                  Commencer avec un comptable
                </Link>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textAlign: "center", margin: "12px 0 0", fontFamily: FONT }}>14 jours gratuits — aucune carte bancaire</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ACCOUNTANT COMMUNITY ────────────────────────────────────────────── */}
      <section id="comptables" className="page-section" style={{ backgroundColor: "#0D1526" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }} ref={accountantFade.ref}>
          <div style={{ ...accountantFade.style, display: "grid", gridTemplateColumns: "1fr", gap: 48, alignItems: "center" }} className="accountant-grid">
            <style>{`@media (min-width: 768px) { .accountant-grid { grid-template-columns: 1fr 420px !important; } }`}</style>

            {/* Left */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "2px", color: GOLD, textTransform: "uppercase", fontFamily: FONT, margin: "0 0 12px" }}>Pour les fiduciaires</p>
              <h2 style={{ fontFamily: FONT, fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 700, color: "#FFFFFF", margin: "0 0 20px", letterSpacing: "-0.5px", lineHeight: 1.15 }}>
                Vous Êtes Comptable ?<br />Rejoignez Notre Réseau.
              </h2>
              <p style={{ fontSize: 16, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, margin: "0 0 32px", maxWidth: 480, fontFamily: FONT }}>
                Mohasib construit un réseau de comptables partenaires au Maroc. Accédez à de nouveaux clients, utilisez nos outils, et faites partie de la révolution digitale de la comptabilité marocaine.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {["Clients qualifiés envoyés directement", "Outils de collaboration avec vos clients", "Dashboard fiduciaire centralisé", "Accès prioritaire aux nouvelles fonctionnalités"].map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: GOLD, fontWeight: 700 }}>✓</span>
                    <span style={{ fontSize: 15, color: "rgba(255,255,255,0.7)", fontFamily: FONT }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: waitlist */}
            <div style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "36px 32px" }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#FFFFFF", margin: "0 0 8px", fontFamily: FONT }}>Rejoindre la liste d&apos;attente</h3>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", margin: "0 0 24px", fontFamily: FONT }}>Soyez parmi les premiers comptables partenaires Mohasib.</p>
              {waitlistDone ? (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>✓</div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: "#FFFFFF", fontFamily: FONT, margin: "0 0 6px" }}>Vous êtes sur la liste !</p>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: 0, fontFamily: FONT }}>On vous contacte dès l&apos;ouverture du programme.</p>
                </div>
              ) : (
                <form onSubmit={handleWaitlist} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <input
                    type="email"
                    placeholder="votre@cabinet.ma"
                    value={waitlistEmail}
                    onChange={e => setWaitlistEmail(e.target.value)}
                    required
                    style={{ padding: "13px 16px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.12)", backgroundColor: "#FFFFFF", color: "#0A0A0A", fontSize: 14, fontFamily: FONT, outline: "none", width: "100%", boxSizing: "border-box" }}
                  />
                  <button type="submit" style={{ padding: "13px", borderRadius: 10, backgroundColor: GOLD, border: "none", cursor: "pointer", color: "#FFFFFF", fontSize: 14, fontWeight: 600, fontFamily: FONT }}>
                    Rejoindre le réseau →
                  </button>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textAlign: "center", margin: 0, fontFamily: FONT }}>Aucun frais · Programme partenaires gratuit</p>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer style={{ backgroundColor: "#0A0A0A", padding: "56px 32px 36px" }} className="footer-outer">
        <style>{`@media (max-width: 640px) { .footer-outer { padding: 40px 20px 28px !important; } }`}</style>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 32 }}>
            <Image src="/logo2.png" alt="Mohasib" width={100} height={30} style={{ objectFit: "contain", opacity: 0.7 }} />
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
              {[["Tarifs", "#tarifs"], ["Comptables", "#comptables"], ["Contact", "mailto:contact@mohasib.ma"]].map(([label, href]) => (
                <a key={label} href={href} style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", textDecoration: "none", fontFamily: FONT, transition: "color 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.75)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
                >{label}</a>
              ))}
            </div>
          </div>
          <div style={{ height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginBottom: 24 }} />
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontFamily: FONT }}>© 2026 Mohasib. Fait au Maroc 🇲🇦</span>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontFamily: FONT }}>contact@mohasib.ma</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
