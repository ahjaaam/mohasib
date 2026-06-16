"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import PublicNavbar from "@/components/PublicNavbar";
import PublicFooter from "@/components/PublicFooter";

const FONT = "var(--font-jakarta), sans-serif";
const NAVY: React.CSSProperties["color"] = "#0D1526";
const GOLD: React.CSSProperties["color"] = "#C8924A";

const APP_VIDEOS = [
  {
    title: "Créer et envoyer une facture",
    description: "Découvrez le flux complet de facturation dans Mohasib AI.",
    src: "", // TODO: add video link
  },
  {
    title: "Préparer une déclaration TVA",
    description: "Voyez comment Mohasib aide à calculer et vérifier la TVA.",
    src: "", // TODO: add video link
  },
  {
    title: "Organiser les documents",
    description: "Importez, classez et retrouvez vos pièces comptables.",
    src: "", // TODO: add video link
  },
];

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
            padding: "12px 16px", borderRadius: 5, fontFamily: FONT,
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
          marginTop: 4, padding: "13px", borderRadius: 5,
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
        .page-section { padding: 80px 32px; }
        .video-showcase-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
        .video-frame { aspect-ratio: 16 / 9; width: 100%; overflow: hidden; border: 1px solid rgba(13,21,38,0.10); background: #0D1526; }
        @media (max-width: 640px) { .page-section { padding: 56px 20px; } }
        @media (max-width: 900px) { .video-showcase-grid { grid-template-columns: 1fr; } }
      `}</style>
      <PublicNavbar showBorder={false} />

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
          Gérez votre comptabilité avec Mohasib AI. Créez des factures conformes, suivez vos dépenses et déclarez votre TVA en toute simplicité.
          </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 28 }}>
              <a
                href="/inscription"
                style={{ fontSize: 15, fontWeight: 600, color: "#FFFFFF", backgroundColor: NAVY, padding: "14px 28px", borderRadius: 5, textDecoration: "none", fontFamily: FONT, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
              >
                Créer un compte
              </a>
              <a
                href="https://wa.me/212777884056"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 15, fontWeight: 500, color: "rgb(37, 211, 102)", border: "1px solid #25D366", backgroundColor: "transparent", padding: "14px 28px", borderRadius: 5, textDecoration: "none", fontFamily: FONT, display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="rgb(37, 211, 102)" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Nous contacter
              </a>
            </div>

            {/* Social proof */}
            <div style={{ marginTop: 48, paddingTop: 40, borderTop: "1px solid rgba(0,0,0,0.08)", display: "flex", flexWrap: "wrap", gap: 40 }}>
              {[
               /*  { num: "4–6h de travail", label: "Économisées par semaine" }, */
               /* { num: "100%", label: "Conforme DGI Maroc" }, */
              ].map((s, i) => (
                <div key={i}>
                  <div style={{ fontFamily: FONT, fontSize: 26, fontWeight: 700, color: "#0A0A0A", lineHeight: 1 }}>{s.num}</div>
                  <div style={{ fontSize: 13, color: "#6B7280", marginTop: 5, fontFamily: FONT }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: demo form card */}
          <div style={{ backgroundColor: NAVY, borderRadius: 0, padding: "30px 22px", boxShadow: "0 24px 64px rgba(13,21,38,0.18)" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: GOLD, letterSpacing: "1.5px", textTransform: "uppercase", fontFamily: FONT, margin: "0 0 8px" }}>
              Démo personnalisée
            </p>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#FFFFFF", margin: "0 0 6px", fontFamily: FONT }}>
              Voyez Mohasib En Action
            </h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", margin: "0 0 28px", fontFamily: FONT }}>
              Nous vous montrerons comment Mohasib s&apos;adapte à votre activité.
            </p>
            <DemoForm />
          </div>
        </div>
      </section>

      {/* ── VIDEO SHOWCASE ─────────────────────────────────────────────────── */}
      <section className="page-section" style={{ backgroundColor: "#FFFFFF", paddingTop: 74 }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ textAlign: "left", marginBottom: 38 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: GOLD, letterSpacing: "1.5px", textTransform: "uppercase", fontFamily: FONT, margin: "0 0 10px" }}>
              Tutoriels vidéo
            </p>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 700, color: NAVY, margin: "0 0 12px", fontFamily: FONT }}>
              Découvrez Mohasib en quelques minutes
            </h2>
            <p style={{ fontSize: 15, color: "#6B7280", lineHeight: 1.6, maxWidth: 620, margin: 0, fontFamily: FONT }}>
              Trois présentations courtes pour comprendre les workflows essentiels et démarrer plus vite.
            </p>
          </div>

          <div className="video-showcase-grid">
            {APP_VIDEOS.map((video, index) => (
              <article key={video.title} style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, overflow: "hidden" }}>
                <div className="video-frame">
                  {video.src ? (
                    <video controls preload="metadata" style={{ width: "100%", height: "100%", display: "block", objectFit: "cover" }}>
                      <source src={video.src} />
                    </video>
                  ) : (
                    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.72)", fontFamily: FONT, fontSize: 13, fontWeight: 700, letterSpacing: "1px" }}>
                      VIDEO {index + 1}
                    </div>
                  )}
                </div>
                <div style={{ padding: "16px 16px 18px" }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: NAVY, margin: "0 0 6px", fontFamily: FONT }}>
                    {video.title}
                  </h3>
                  <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5, margin: 0, fontFamily: FONT }}>
                    {video.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {false && (
      <section className="page-section" style={{ backgroundColor: "#FAFAF6" }}>
        <style>{`
          .pricing-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; max-width: 900px; margin: 0 auto; }
          @media (max-width: 720px) { .pricing-grid { grid-template-columns: 1fr; } }
          .feat-group-label { font-size: 10px; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; color: rgba(13,21,38,0.35); margin: 20px 0 8px; font-family: var(--font-jakarta), sans-serif; }
          .feat-group-label-light { font-size: 10px; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; color: rgba(13,21,38,0.35); margin: 20px 0 8px; font-family: var(--font-jakarta), sans-serif; }
        `}</style>

        {/* Section header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: GOLD, letterSpacing: "1.5px", textTransform: "uppercase", fontFamily: FONT, margin: "0 0 10px" }}>Tarifs</p>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 700, color: "#0A0A0A", margin: "0 0 14px", letterSpacing: "-0.8px", fontFamily: FONT }}>
            Choisissez le plan adapté<br />à votre activité
          </h2>
          <p style={{ fontSize: 15, color: "#6B7280", margin: 0, fontFamily: FONT }}>
            Entrepreneur solo ou cabinet comptable — Mohasib s&apos;adapte à votre métier.
          </p>
        </div>

        <div className="pricing-grid">

          {/* ── Pro plan ── */}
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: 0, border: "1.5px solid rgba(0,0,0,0.09)", padding: "28px 24px", display: "flex", flexDirection: "column" }}>
            <div style={{ marginBottom: 20 }}>
              <span style={{ display: "inline-block", fontSize: 10, fontWeight: 700, letterSpacing: "1.4px", textTransform: "uppercase", color: GOLD, fontFamily: FONT, marginBottom: 8 }}>
                Entrepreneur / PME
              </span>
              <h3 style={{ fontSize: 24, fontWeight: 700, color: NAVY, margin: "0 0 6px", fontFamily: FONT }}>Business Pro</h3>
              <p style={{ fontSize: 13, color: "#6B7280", margin: 0, fontFamily: FONT, lineHeight: 1.5 }}>
                Tout ce qu&apos;il faut pour gérer votre comptabilité en autonomie.
              </p>
            </div>

            <div style={{ height: 1, backgroundColor: "rgba(0, 0, 0, 0.07)", margin: "0 0 18px" }} />

            <ul style={{ listStyle: "none", margin: 0, padding: 0, flex: 1 }}>
              {[
                { group: "Documents & facturation", items: [
                  "Boîte de réception — reçus automatiques Gmail / Outlook",
                  "Facturation rapide, envoi email & WhatsApp",
                  "Archivage de documents",
                ]},
                { group: "Comptabilité", items: [
                  "Clients & fournisseurs",
                  "Transactions bancaires",
                  "Déclaration TVA — fichier EDI SIMPL",
                  "La Paie — bulletins & déclaration CNSS",
                  "Exports comptables",
                ]},
              ].map(({ group, items }) => (
                <li key={group}>
                  <div className="feat-group-label-light">{group}</div>
                  {items.map(item => (
                    <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 7 }}>
                      <span style={{ width: 16, height: 16, borderRadius: "50%", backgroundColor: "rgba(200,146,74,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                        <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2 4-4" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </span>
                      <span style={{ fontSize: 13, color: "#374151", fontFamily: FONT, lineHeight: 1.45 }}>{item}</span>
                    </div>
                  ))}
                </li>
              ))}
            </ul>

            <Link
              href="/inscription"
              style={{ marginTop: 24, display: "block", textAlign: "center", padding: "13px", borderRadius: 6, border: `1.5px solid ${NAVY}`, color: NAVY, backgroundColor: "transparent", fontSize: 14, fontWeight: 600, textDecoration: "none", fontFamily: FONT, transition: "all 0.15s" }}
            >
              Créer un compte Pro →
            </Link>
          </div>

          {/* ── Comptable Pro plan ── */}
          <div style={{ backgroundColor: "#ffffff", borderRadius: 0, border: `1.5px solid ${NAVY}`, padding: "28px 24px", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
            {/* Gold glow top-right */}
            <div style={{ position: "absolute", top: -60, right: -60, width: 180, height: 180, borderRadius: "50%", background: "rgba(200,146,74,0.12)", pointerEvents: "none" }} />

            <div style={{ marginBottom: 20 }}>
              <span style={{ display: "inline-block", fontSize: 10, fontWeight: 700, letterSpacing: "1.4px", textTransform: "uppercase", color: GOLD, fontFamily: FONT, marginBottom: 8 }}>
                Cabinet comptable
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <h3 style={{ fontSize: 24, fontWeight: 700, color: NAVY, margin: 0, fontFamily: FONT }}>Comptable Pro</h3>
              </div>
              <p style={{ fontSize: 13, color: "#6B7280", margin: 0, fontFamily: FONT, lineHeight: 1.5 }}>
                Gérez tous vos dossiers clients depuis un seul tableau de bord.
              </p>
            </div>

            <div style={{ height: 1, backgroundColor: "rgba(0, 0, 0, 0.07)", margin: "0 0 18px" }} />

            <ul style={{ listStyle: "none", margin: 0, padding: 0, flex: 1 }}>
              {/* Cabinet-level */}
              <li>
                <div className="feat-group-label">Espace cabinet</div>
                {[
                  "Boîte de réception globale — routing IA des emails",
                  "Calendrier comptable & fiscal",
                  "Gestion des dossiers clients",
                  "Paramètres du cabinet",
                ].map(item => (
                  <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 7 }}>
                    <span style={{ width: 16, height: 16, borderRadius: "50%", backgroundColor: "rgba(200,146,74,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                      <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2 4-4" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                    <span style={{ fontSize: 13, color: "rgba(10, 8, 8, 0.8)", fontFamily: FONT, lineHeight: 1.45 }}>{item}</span>
                  </div>
                ))}
              </li>

              {/* Per-dossier */}
              <li>
                <div className="feat-group-label">Par dossier client</div>
                {[
                  "Boîte de réception + reçus automatiques",
                  "Factures clients",
                  "Clients & fournisseurs",
                  "Transactions bancaires",
                  "Saisie comptable automatique (IA)",
                  "Déclaration TVA — fichier EDI",
                  "Grand Livre CGNC",
                  "Export CGNC",
                  "Bilan & CPC",
                  "Paie — bulletins & déclaration CNSS",
                  "Archive documents",
                ].map(item => (
                  <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 7 }}>
                    <span style={{ width: 16, height: 16, borderRadius: "50%", backgroundColor: "rgba(200,146,74,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                      <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2 4-4" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                    <span style={{ fontSize: 13, color: "rgba(0, 0, 0, 0.8)", fontFamily: FONT, lineHeight: 1.45 }}>{item}</span>
                  </div>
                ))}
              </li>
            </ul>

            <a
              href="https://wa.me/212777884056"
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginTop: 24, display: "block", textAlign: "center", padding: "13px", borderRadius: 6, backgroundColor: GOLD, border: "none", color: "#FFFFFF", fontSize: 14, fontWeight: 600, textDecoration: "none", fontFamily: FONT }}
            >
              Demander une démo →
            </a>
          </div>

        </div>
      </section>
      )}

      <PublicFooter />

    </div>
  );
}
