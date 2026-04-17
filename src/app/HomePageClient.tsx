"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

const FONT = "var(--font-jakarta), sans-serif";
const NAVY: React.CSSProperties["color"] = "#0D1526";
const GOLD: React.CSSProperties["color"] = "#C8924A";


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
            padding: "12px 16px", borderRadius: 0, fontFamily: FONT,
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
          marginTop: 4, padding: "13px", borderRadius: 0,
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
            <Link href="/auth/login" style={{ fontSize: 13, fontWeight: 600, color: "#FFFFFF", backgroundColor: NAVY, padding: "9px 20px", borderRadius: 5, textDecoration: "none", fontFamily: FONT }}>
              Se Connecter
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

            <p style={{ fontSize: 14, color: "#4B5563", lineHeight: 1.5, margin: "0 0 36px", maxWidth: 500, fontFamily: FONT }}>
              Mohasib automatise vos factures, calcule votre TVA et gère votre paie. IA comptable disponible 24h/24 en français ou en darija.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 28 }}>
              <Link href="/auth/signup" style={{ fontSize: 15, fontWeight: 600, color: "#FFFFFF", backgroundColor: NAVY, padding: "14px 28px", borderRadius: 5, textDecoration: "none", fontFamily: FONT }}>
                Commencer Gratuitement
              </Link>
              <a href="#tarifs" style={{ fontSize: 15, fontWeight: 500, color: "#0A0A0A", border: "1px solid rgba(0,0,0,0.18)", backgroundColor: "transparent", padding: "14px 28px", borderRadius: 5, textDecoration: "none", fontFamily: FONT }}>
                Voir les tarifs
              </a>
            </div>

            <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0, fontFamily: FONT }}>
              ☑️ 14 jours gratuits · ☑️ Aucune carte bancaire · ☑️ Annulation libre
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
          <div style={{ backgroundColor: NAVY, borderRadius: 10, padding: "30px 22px", boxShadow: "0 24px 64px rgba(13,21,38,0.18)" }}>
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

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer style={{ backgroundColor: "#ffffff", padding: "56px 32px 36px" }} className="footer-outer">
        <style>{`@media (max-width: 640px) { .footer-outer { padding: 40px 20px 28px !important; } }`}</style>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 32 }}>
            <Image src="/logo2.png" alt="Mohasib" width={100} height={30} style={{ objectFit: "contain", opacity: 0.7 }} />
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
              <Link href="https://www.linkedin.com/company/mohasibai/" style={{ fontSize: 14, color: "hsla(0, 0%, 24%, 0.40)", textDecoration: "none", fontFamily: FONT }}>
                LinkedIn
              </Link>
              <Link href="https://www.instagram.com/mohasibai/" style={{ fontSize: 14, color: "hsla(0, 0%, 24%, 0.40)", textDecoration: "none", fontFamily: FONT }}>
                Instagram
              </Link>
              <Link href="https://www.facebook.com/mohasibai" style={{ fontSize: 14, color: "hsla(0, 0%, 24%, 0.40)", textDecoration: "none", fontFamily: FONT }}>
                Facebook
              </Link> 
            <Link href="#" style={{ fontSize: 14, color: "hsla(0, 0%, 24%, 0.40)", textDecoration: "none", fontFamily: FONT }}>
                YouTube
              </Link> 
            </div>
          </div>
          <div style={{ height: 1, backgroundColor: "hsla(0, 0%, 78%, 0.40)", marginBottom: 24 }} />
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 13, color: "hsla(0, 0%, 24%, 0.40)", fontFamily: FONT }}>© 2026 Mohasib Chat.</span>
            <span style={{ fontSize: 13, color: "hsla(0, 0%, 24%, 0.40)", fontFamily: FONT }}>contact@mohasibai.com</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
