"use client";

import { useState } from "react";
import PublicNavbar from "@/components/PublicNavbar";
import PublicFooter from "@/components/PublicFooter";
import DemoRequestModal from "@/components/DemoRequestModal";
import { appUrl } from "@/lib/public-urls";

const FONT = "var(--font-jakarta), sans-serif";

const PRODUCT_TABS = [
  "Achats",
  "TVA & Déclarations",
  "Suivi des échéances",
  "La paie",
  "Mohasib Agent",
  "Archive",
];

export default function HomePageClient() {
  const [demoOpen, setDemoOpen] = useState(false);
  const [activeProductTab, setActiveProductTab] = useState(0);
  const productPreview =
    activeProductTab === 0
      ? {
          src: "/images/mohasib-inbox-demo.mp4",
          alt: "Démonstration animée des achats Mohasib pour importer et traiter les factures fournisseurs",
          width: 1784,
          height: 1080,
        }
      : activeProductTab === 1
        ? {
            src: "/images/mohasib-vat-demo.mp4",
            alt: "Démonstration animée de la déclaration de TVA Mohasib avec les lignes DGI et l’historique des déclarations",
            width: 1784,
            height: 1080,
          }
        : activeProductTab === 2
          ? {
              src: "/images/mohasib-payment-tracking-demo.mp4",
              alt: "Démonstration animée du suivi des échéances Mohasib avec encaissements clients et paiements fournisseurs",
              width: 1780,
              height: 1080,
            }
          : activeProductTab === 3
            ? {
                src: "/images/mohasib-payroll-demo.mp4",
                alt: "Démonstration animée de la gestion de la paie Mohasib avec les employés, congés, heures, bulletins et CNSS",
                width: 1784,
                height: 1080,
              }
            : activeProductTab === 4
              ? {
                  src: "/images/mohasib-assistant-demo.mp4",
                  alt: "Démonstration animée de l’assistant Mohasib répondant aux questions comptables dans le contexte de l’entreprise",
                  width: 1784,
                  height: 1080,
                }
              : {
                  src: "/images/mohasib-archive-demo.mp4",
                  alt: "Démonstration animée de l’archive Mohasib pour rechercher, classer et prévisualiser les documents et pièces justificatives",
                  width: 1788,
                  height: 1080,
                };

  return (
    <div className="public-site" style={{ fontFamily: FONT }}>
      <style>{`
        .home-hero {
          position: relative;
          display: flex;
          min-height: 0;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          padding: 112px 27px 96px;
          background: #FFFFFF;
        }
        .home-hero-content {
          position: relative;
          z-index: 3;
          width: min(100%, 1180px);
          margin: 0 auto;
          text-align: center;
        }
        .home-hero .public-eyebrow {
          color: var(--gold);
        }
        .home-hero-title {
          max-width: 1160px;
          margin: 0 auto 26px;
          color: #0A0A0A;
          font-size: clamp(46px, 4.2vw, 58px);
          font-weight: 600;
          letter-spacing: -3px;
          line-height: 0.98;
        }
        .home-hero-description {
          max-width: 610px;
          margin: 0 auto 34px;
          color: #4B5563;
          font-family: ${FONT};
          font-size: 16px;
          line-height: 1.65;
        }
        .home-hero-actions {
          display: flex;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .home-hero-cta {
          background: linear-gradient(160deg, #2a3348 0%, #0a0a0a 100%);
          border-color: transparent;
          font-weight: 500;
        }
        .home-hero-cta:hover {
          background: linear-gradient(160deg, #1e2536 0%, #000000 100%);
          border-color: transparent;
        }
        .home-demo-action {
          border-color: #B9B6AE;
          color: #0D1526;
          cursor: pointer;
          font-weight: 500;
        }
        .home-demo-action:hover {
          border-color: var(--gold);
          background: var(--gold);
          color: #FFFFFF;
        }
        .home-receipt-field {
          position: absolute;
          top: 0;
          right: 0;
          left: 0;
          height: 560px;
          z-index: 1;
          pointer-events: none;
        }
        .home-scattered-receipt {
          position: absolute;
          width: var(--receipt-width);
          opacity: var(--receipt-opacity, 0.82);
          transform: rotate(var(--receipt-rotation));
          filter:
            drop-shadow(0 18px 18px rgba(13, 21, 38, 0.15))
            drop-shadow(0 5px 5px rgba(13, 21, 38, 0.08));
        }
        .home-scattered-receipt img {
          width: 100%;
          height: auto;
          animation: receipt-drift var(--receipt-duration, 7s) ease-in-out var(--receipt-delay, 0s) infinite;
          will-change: transform;
        }
        .home-scattered-mark {
          opacity: 1;
          scale: 0.8;
        }
        .home-scattered-mark img {
          filter: grayscale(0.30);
        }
        .home-receipt-one {
          --receipt-width: 152px;
          --receipt-rotation: -18deg;
          --receipt-opacity: 0.6;
          --receipt-duration: 7.2s;
          top: 13%;
          left: 1.5%;
        }
        .home-receipt-two {
          --receipt-width: 142px;
          --receipt-rotation: 14deg;
          --receipt-duration: 8.1s;
          --receipt-delay: -3s;
          bottom: 8%;
          left: 10%;
        }
        .home-receipt-three {
          --receipt-width: 106px;
          --receipt-rotation: -8deg;
          --receipt-duration: 6.5s;
          --receipt-delay: -1.5s;
          top: 3%;
          left: 24%;
        }
        .home-receipt-four {
          --receipt-width: 147px;
          --receipt-rotation: 17deg;
          --receipt-duration: 7.8s;
          --receipt-delay: -2.4s;
          top: 10%;
          right: 1%;
        }
        .home-receipt-five {
          --receipt-width: 148px;
          --receipt-rotation: -13deg;
          --receipt-duration: 8.5s;
          --receipt-delay: -4s;
          right: 9%;
          bottom: 10%;
        }
        .home-receipt-six {
          --receipt-width: 102px;
          --receipt-rotation: 9deg;
          --receipt-duration: 6.8s;
          --receipt-delay: -2s;
          top: 3%;
          right: 23%;
        }
        .home-receipt-seven {
          --receipt-width: 46px;
          --receipt-rotation: 25deg;
          --receipt-duration: 7.6s;
          --receipt-delay: -5s;
          top: 48%;
          right: 15%;
        }
        .home-receipt-eight {
          --receipt-width: 108px;
          --receipt-rotation: 11deg;
          --receipt-opacity: 0.34;
          --receipt-duration: 8.7s;
          --receipt-delay: -1.2s;
          top: 5%;
          left: 12%;
        }
        .home-receipt-nine {
          --receipt-width: 98px;
          --receipt-rotation: -16deg;
          --receipt-opacity: 0.3;
          --receipt-duration: 7.9s;
          --receipt-delay: -4.6s;
          top: 5%;
          right: 12%;
        }
        .home-receipt-ten {
          --receipt-width: 86px;
          --receipt-rotation: -9deg;
          --receipt-opacity: 0.38;
          --receipt-duration: 9.2s;
          --receipt-delay: -3.5s;
          bottom: -8%;
          left: 27%;
        }
        .home-receipt-eleven {
          --receipt-width: 92px;
          --receipt-rotation: 14deg;
          --receipt-opacity: 0.36;
          --receipt-duration: 8.3s;
          --receipt-delay: -5.8s;
          right: 27%;
          bottom: -7%;
        }
        .home-receipt-twelve {
          --receipt-width: 76px;
          --receipt-rotation: 20deg;
          --receipt-opacity: 0.22;
          --receipt-duration: 7.4s;
          --receipt-delay: -2.7s;
          top: 34%;
          left: 16%;
        }
        .home-receipt-thirteen {
          --receipt-width: 72px;
          --receipt-rotation: -23deg;
          --receipt-opacity: 0.2;
          --receipt-duration: 8.9s;
          --receipt-delay: -6.2s;
          top: 33%;
          right: 17%;
        }
        .home-receipt-fourteen {
          --receipt-width: 62px;
          --receipt-rotation: -6deg;
          --receipt-opacity: 0.18;
          --receipt-duration: 9.5s;
          --receipt-delay: -4.1s;
          top: 5%;
          left: 42%;
        }
        .home-receipt-fifteen {
          --receipt-width: 58px;
          --receipt-rotation: 8deg;
          --receipt-opacity: 0.16;
          --receipt-duration: 8.1s;
          --receipt-delay: -1.8s;
          top: 5%;
          right: 41%;
        }
        .home-receipt-sixteen {
          --receipt-width: 82px;
          --receipt-rotation: 24deg;
          --receipt-opacity: 0.28;
          --receipt-duration: 9.1s;
          --receipt-delay: -5.1s;
          bottom: -4%;
          left: 3%;
        }
        .home-receipt-seventeen {
          --receipt-width: 78px;
          --receipt-rotation: -19deg;
          --receipt-opacity: 0.27;
          --receipt-duration: 7.7s;
          --receipt-delay: -3.9s;
          right: 3%;
          bottom: -3%;
        }
        .home-receipt-eighteen {
          --receipt-width: 64px;
          --receipt-rotation: -10deg;
          --receipt-duration: 7.5s;
          --receipt-delay: -2.6s;
          top: 55%;
          left: 2%;
        }
        .home-hero-examples-intro {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: fit-content;
          max-width: calc(100% - 24px);
          margin: 72px auto 0;
          font-family: var(--font-inter), sans-serif;
          font-size: 12px;
          font-weight: 400;
          line-height: 1.5;
          color: #464646;
        }
        .home-hero-examples-arrow {
          flex: 0 0 auto;
          width: 15px;
          height: 15px;
          color: #5f5f5f;
        }
        .home-hero-tabs {
          position: relative;
          z-index: 2;
          display: inline-flex;
          align-items: stretch;
          max-width: 100%;
          margin: 18px auto 0;
          background: #FFFFFF;
          border: 1px solid #e7e4de;
          border-bottom: none;
          border-radius: 12px 12px 0 0;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .home-hero-tabs::-webkit-scrollbar {
          display: none;
        }
        .home-hero-tab {
          flex-shrink: 0;
          padding: 12px 20px;
          font-family: var(--font-inter), sans-serif;
          font-size: 13px;
          font-weight: 400;
          color: #6B7280;
          background: transparent;
          border: none;
          border-right: 1px solid #fffefc;
          cursor: pointer;
          white-space: nowrap;
          transition: color 0.15s ease;
        }
        .home-hero-tab:last-child {
          border-right: none;
        }
        .home-hero-tab:hover {
          color: #0c1526;
        }
        .home-hero-tab.is-active {
          background: #ffffff;
          color: #c8924a;
          font-weight: 500;
        }
        .home-hero-preview {
          position: relative;
          z-index: 1;
          width: min(100%, 1140px);
          margin: 0 auto 0;
          overflow: hidden;
          background: #FFFFFF;
          box-shadow: 0 16px 50px rgba(0, 0, 0, 0.2);
          line-height: 0;
        }
        .home-hero-preview-image {
          display: block;
          width: 100%;
          height: auto;
        }
        @keyframes receipt-drift {
          0%, 100% {
            transform: translate3d(0, 0, 0) rotate(-1deg);
          }
          50% {
            transform: translate3d(0, -11px, 0) rotate(1deg);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .home-scattered-receipt img {
            animation: none;
          }
        }
        @media (max-width: 1000px) {
          .home-hero {
            min-height: 0;
          }
          .home-receipt-one,
          .home-receipt-four {
            --receipt-width: 120px;
          }
          .home-receipt-two,
          .home-receipt-five {
            --receipt-width: 118px;
          }
          .home-receipt-seven {
            display: none;
          }
          .home-receipt-eight,
          .home-receipt-nine {
            --receipt-width: 82px;
          }
          .home-receipt-ten,
          .home-receipt-eleven {
            --receipt-width: 68px;
          }
          .home-receipt-twelve,
          .home-receipt-thirteen {
            --receipt-width: 58px;
          }
          .home-receipt-sixteen,
          .home-receipt-seventeen {
            --receipt-width: 64px;
          }
        }
        @media (max-width: 760px) {
          .home-hero {
            min-height: 660px;
            align-items: flex-start;
            padding: 70px 20px 54px;
          }
          .home-hero-title {
            max-width: 620px;
            margin-bottom: 22px;
            font-size: clamp(34px, 6vw, 40px);
            letter-spacing: -1.6px;
            line-height: 1;
          }
          .home-hero-description {
            max-width: 340px;
            margin-bottom: 30px;
            font-size: 14px;
            line-height: 1.6;
          }
          .home-hero-actions {
            flex-direction: column;
            align-items: center;
            gap: 10px;
          }
          .home-hero-actions a,
          .home-hero-actions button {
            width: min(100%, 328px);
          }
          .home-receipt-one {
            --receipt-width: 54px;
            top: 2%;
            left: -4%;
          }
          .home-receipt-two {
            --receipt-width: 62px;
            bottom: 1%;
            left: -2%;
          }
          .home-receipt-three,
          .home-receipt-six {
            --receipt-width: 42px;
          }
          .home-receipt-four {
            --receipt-width: 54px;
            top: 2%;
            right: -4%;
          }
          .home-receipt-five {
            --receipt-width: 62px;
            right: -2%;
            bottom: 12%;
          }
          .home-receipt-eight {
            --receipt-width: 48px;
            top: 24%;
            left: -7%;
          }
          .home-receipt-nine {
            --receipt-width: 44px;
            top: 26%;
            right: -7%;
          }
          .home-receipt-ten,
          .home-receipt-eleven,
          .home-receipt-fourteen,
          .home-receipt-fifteen {
            display: none;
          }
          .home-receipt-twelve {
            --receipt-width: 38px;
            top: 43%;
            left: -5%;
          }
          .home-receipt-thirteen {
            --receipt-width: 36px;
            top: 44%;
            right: -5%;
          }
          .home-receipt-sixteen {
            --receipt-width: 42px;
            bottom: -2%;
            left: 18%;
          }
          .home-receipt-seventeen {
            --receipt-width: 40px;
            right: 18%;
            bottom: -1%;
          }
          .home-receipt-eighteen {
            display: none;
          }
          .home-receipt-field {
            height: 500px;
          }
          .home-hero-tabs {
            margin: 16px auto 0;
            max-width: calc(100% - 8px);
          }
          .home-hero-examples-intro {
            max-width: calc(100% - 24px);
            margin-top: 48px;
            font-size: 11px;
          }
          .home-hero-tab {
            padding: 10px 14px;
            font-size: 12px;
          }
        }
      `}</style>
      <PublicNavbar />

      <section className="home-hero">
        <div className="home-hero-content">
            <p className="public-eyebrow mb-4">L&apos;IA pour votre vie professionnelle</p>
            <h1 className="home-hero-title">
              Automatisez vos tâches administratives et{" "}comptables
            </h1>

            <p className="home-hero-description">
            Connecter votre boite mail, envoyez vos factures, suivez vos paiements, effectuez vos rapprochements bancaires, créez vos bulletins de paie, déclarez votre TVA, obtenez des insights financiers et exportez une comptabilité propre.            </p>

            <div className="home-hero-actions">
              <a
                className="public-primary-action home-hero-cta ui-control"
                href={appUrl("/inscription")}
                style={{ minHeight: 50, padding: "0 30px", fontSize: 16, fontFamily: FONT }}
              >
                Créer mon espace
              </a>
              <button
                type="button"
                className="public-secondary-action home-demo-action ui-control"
                onClick={() => setDemoOpen(true)}
                style={{ minHeight: 50, padding: "0 24px", fontSize: 16, fontFamily: FONT }}
              >
                Recevoir la vidéo démo
              </button>
            </div>

            <p className="home-hero-examples-intro">
              <span>Voici quelques fonctionnalités de Mohasib</span>
              <svg
                className="home-hero-examples-arrow"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 5v14M6 13l6 6 6-6" />
              </svg>
            </p>

            <div className="home-hero-tabs" role="tablist" aria-label="Fonctionnalités Mohasib">
              {PRODUCT_TABS.map((tab, index) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={index === activeProductTab}
                  className={`home-hero-tab${index === activeProductTab ? " is-active" : ""}`}
                  onClick={() => setActiveProductTab(index)}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="home-hero-preview" aria-label="Aperçu du tableau de bord Mohasib">
              <video
                key={productPreview.src}
                className="home-hero-preview-image"
                src={productPreview.src}
                aria-label={productPreview.alt}
                width={productPreview.width}
                height={productPreview.height}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
              />
            </div>
        </div>
      </section>

      <PublicFooter />
      <DemoRequestModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </div>
  );
}
