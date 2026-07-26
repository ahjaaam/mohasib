"use client";

import Image from "next/image";
import PublicNavbar from "@/components/PublicNavbar";
import PublicFooter from "@/components/PublicFooter";
import { appUrl, whatsappUrl } from "@/lib/public-urls";

const FONT = "var(--font-jakarta), sans-serif";

const FLOATING_ITEMS = [
  { position: "one", src: "/images/receipt-hero.png", alt: "", width: 1024, height: 1536, isMark: false },
  { position: "two", src: "/images/excel-logo-cropped.png", alt: "", width: 760, height: 760, isMark: true },
  { position: "three", src: "/images/gmail-logo-cropped.png", alt: "", width: 760, height: 760, isMark: true },
  { position: "four", src: "/images/word-logo-cropped.png", alt: "", width: 760, height: 760, isMark: true },
  { position: "five", src: "/images/sage-logo-cropped.png", alt: "", width: 760, height: 760, isMark: true },
  { position: "six", src: "/images/outlook-logo-cropped.png", alt: "", width: 760, height: 760, isMark: true },
  { position: "seven", src: "/images/google-drive-logo-cropped.png", alt: "", width: 760, height: 760, isMark: true },
];

function WhatsAppIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 16 16"
      fill="currentColor"
      style={{ color: "#085E54", flexShrink: 0 }}
    >
      <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93a7.898 7.898 0 0 0-2.327-5.607ZM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.25a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.591-6.592 6.591Zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.514.646-.63.775-.116.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.174-1.101-1.371-.116-.198-.013-.305.086-.404.09-.088.197-.232.295-.348.1-.116.133-.198.198-.33.066-.132.033-.248-.016-.347-.05-.099-.445-1.075-.61-1.47-.16-.389-.323-.335-.445-.34-.116-.006-.248-.006-.38-.006a.729.729 0 0 0-.529.248c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.132 1.394 2.132 3.383 2.992.47.205.84.326 1.129.417.475.152.904.129 1.246.08.38-.057 1.17-.48 1.338-.943.164-.462.164-.86.114-.943-.049-.084-.182-.133-.38-.232Z" />
    </svg>
  );
}

export default function HomePageClient() {
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
        .home-hero-title {
          max-width: 1160px;
          margin: 0 auto 26px;
          color: #0A0A0A;
          font-size: clamp(46px, 4.2vw, 58px);
          font-weight: 700;
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
        .home-whatsapp-action {
          border-color: #075E54;
          color: #075E54;
        }
        .home-whatsapp-action:hover {
          border-color: #075E54;
          background: #F0FFF5;
          color: #075E54;
        }
        .home-hero-note {
          margin: 13px 0 0;
          color: #8A8F98;
          font-family: ${FONT};
          font-size: 11px;
          letter-spacing: 0.02em;
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
          opacity: 0.92;
        }
        .home-scattered-mark img {
          filter: grayscale(0.55);
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
          top: -2%;
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
          top: -2%;
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
        .home-hero-preview {
          position: relative;
          z-index: 1;
          width: min(100%, 1140px);
          margin: 54px auto 0;
          overflow: hidden;
          background: #FFFFFF;
          box-shadow: 0 34px 90px rgba(0, 0, 0, 0.38);
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
          .home-hero-actions a {
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
          .home-receipt-field {
            height: 500px;
          }
          .home-hero-preview {
            margin-top: 36px;
          }
        }
      `}</style>
      <PublicNavbar />

      <section className="home-hero">
        <div className="home-receipt-field" aria-hidden="true">
          {FLOATING_ITEMS.map(({ position, src, alt, width, height, isMark }) => (
            <div
              className={`home-scattered-receipt home-receipt-${position}${isMark ? " home-scattered-mark" : ""}`}
              key={position}
            >
              <Image src={src} alt={alt} width={width} height={height} sizes="190px" />
            </div>
          ))}
        </div>

        <div className="home-hero-content">
            <p className="public-eyebrow mb-4">Comptabilité intelligente · Maroc</p>
            <h1 className="home-hero-title">
              Automatisez vos tâches administratives et{" "}comptables
            </h1>

            <p className="home-hero-description">
            Connecter votre boite mail, envoyez vos factures, suivez vos paiements, effectuez vos rapprochements bancaires, créez vos bulletins de paie, déclarez votre TVA, obtenez des insights financiers et exportez une comptabilité propre.            </p>

            <div className="home-hero-actions">
              <a
                className="public-primary-action ui-control"
                href={appUrl("/inscription")}
                style={{ minHeight: 50, padding: "0 30px", fontSize: 14, fontFamily: FONT }}
              >
                Créer un compte gratuit
              </a>
              <a
                className="public-secondary-action home-whatsapp-action ui-control"
                href={whatsappUrl("Bonjour, je souhaite en savoir plus sur Mohasib.")}
                target="_blank"
                rel="noopener noreferrer"
                style={{ minHeight: 50, padding: "0 24px", fontSize: 14, fontFamily: FONT }}
              >
                <WhatsAppIcon />
                Parler à un conseiller
              </a>
            </div>
            <p className="home-hero-note">Sans carte bancaire · Conçu pour le Maroc · Support WhatsApp</p>

            <div className="home-hero-preview" aria-label="Aperçu du tableau de bord Mohasib">
              <Image
                className="home-hero-preview-image"
                src="/images/mohasib-dashboard-overview.png"
                alt="Tableau de bord Mohasib avec revenus, dépenses, échéances et suivi des paiements"
                width={2828}
                height={1558}
                sizes="(max-width: 1180px) calc(100vw - 36px), 1140px"
                priority
              />
            </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
