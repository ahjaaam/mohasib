"use client";

import { ArrowRight } from "lucide-react";
import PublicNavbar from "@/components/PublicNavbar";
import PublicFooter from "@/components/PublicFooter";
import WorkflowShowcase from "@/components/home/WorkflowShowcase";
import WorkflowCommandCenter from "@/components/home/WorkflowCommandCenter";
import ToolConsolidationSection from "@/components/home/ToolConsolidationSection";
import CapabilitiesSection from "@/components/home/CapabilitiesSection";
import DocumentTransformationSection from "@/components/home/DocumentTransformationSection";
import FAQSection from "@/components/home/FAQSection";
import { appUrl } from "@/lib/public-urls";

const FONT = "var(--font-jakarta), sans-serif";

export default function HomePageClient() {
  return (
    <div className="public-site" style={{ fontFamily: FONT }}>
      <style>{`
        .public-skip-link {
          position: fixed;
          z-index: 1000;
          top: 12px;
          left: 12px;
          padding: 10px 16px;
          border-radius: var(--home-radius-control);
          background: #141413;
          color: #fff;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
          transform: translateY(-160%);
          transition: transform 150ms ease;
        }
        .public-skip-link:focus-visible {
          outline: 3px solid #976224;
          outline-offset: 3px;
          transform: translateY(0);
        }
        #main-content {
          scroll-margin-top: 120px;
        }
        .home-hero {
          position: relative;
          display: flex;
          min-height: 0;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          padding: 52px 27px 96px;
          background: #FDFBF6;
        }
        .home-hero-content {
          position: relative;
          z-index: 3;
          width: min(100%, 1180px);
          margin: 0 auto;
          text-align: center;
        }
        .home-hero-intro {
          display: block;
        }
        .home-hero-copy {
          position: relative;
          z-index: 2;
          max-width: 800px;
          margin: 0 auto;
          text-align: center;
        }
        .home-hero-title {
          max-width: 760px;
          margin: 0 auto 24px;
          color: #141413;
          font-size: clamp(50px, 5.5vw, 76px);
          font-weight: 600;
          letter-spacing: -0.02em;
          line-height: 0.96;
          text-wrap: balance;
        }
        .home-hero-title span {
          display: block;
          color: #976224;
        }
        .home-hero-description {
          max-width: 650px;
          margin: 0 auto 30px;
          color: #4B5563;
          font-family: ${FONT};
          font-size: 17px;
          line-height: 1.6;
        }
        .home-hero-button:focus-visible {
          outline: 3px solid #0D3650;
          outline-offset: 4px;
        }
        .home-hero-actions {
          display: flex;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .home-hero-button {
          display: inline-flex;
          min-height: 54px;
          align-items: center;
          justify-content: center;
          gap: 9px;
          border: 1.5px solid #141413;
          border-radius: var(--home-radius-control) !important;
          padding: 0 28px;
          font-family: ${FONT};
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
          transition: background-color 150ms ease, color 150ms ease, transform 150ms ease;
        }
        .home-hero-button:hover {
          transform: translateY(-2px);
        }
        .home-hero-button-primary {
          background: #141413;
          color: #F3F0EE;
        }
        .home-hero .home-hero-button {
          font-size: 16px;
          font-weight: 600;
        }
        .home-hero .home-hero-button-primary {
          border: 0;
          background: linear-gradient(135deg, #976224 0%, #0D1526 100%);
          color: #FFFFFF;
        }
        .home-hero-button-primary:hover {
          background: #262627;
        }
        .home-hero .home-hero-button-primary:hover {
          background: linear-gradient(135deg, #7D4F1C 0%, #19274A 100%);
        }
        .home-hero-button-secondary {
          background: #FFFFFF;
          color: #141413;
        }
        .home-hero-button-secondary:hover {
          background: #F5F6F8;
        }
        .home-hero-proof {
          display: flex;
          justify-content: center;
          gap: 22px;
          margin-top: 22px;
          color: #606875;
          font-size: 12px;
          font-weight: 600;
        }
        .home-hero-proof span {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        #centre-execution {
          scroll-margin-top: 100px;
        }
        .home-closing-cta {
          padding: 104px 24px 112px;
          background: #F3F0EE;
          color: #141413;
          text-align: center;
        }
        .home-closing-cta-inner {
          width: min(100%, 980px);
          margin: 0 auto;
        }
        .home-closing-cta h2 {
          max-width: 920px;
          margin: 0 auto;
          font-size: clamp(44px, 6vw, 72px);
          font-weight: 600;
          letter-spacing: -0.055em;
          line-height: 1.02;
          text-wrap: balance;
        }
        .home-closing-cta .home-hero-actions {
          margin-top: 38px;
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
        @keyframes receipt-drift {
          0%, 100% {
            transform: translate3d(0, 0, 0) rotate(-1deg);
          }
          50% {
            transform: translate3d(0, -11px, 0) rotate(1deg);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .public-skip-link,
          .home-hero-button {
            transition: none;
          }
          .home-hero-button:hover {
            transform: none;
          }
          .home-scattered-receipt img {
            animation: none;
          }
        }
        @media (max-width: 1390px) {
          .home-hero {
            padding-top: 42px;
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
            padding: 36px 20px 54px;
          }
          .home-hero-title {
            max-width: 620px;
            margin-bottom: 22px;
            font-size: clamp(40px, 10.5vw, 54px);
            letter-spacing: -0.055em;
            line-height: 0.98;
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
          .home-hero-button {
            width: min(100%, 328px);
          }
          .home-hero-proof {
            max-width: 330px;
            margin: 22px auto 0;
            flex-wrap: wrap;
            gap: 9px 16px;
          }
          .home-closing-cta {
            padding: 72px 20px 78px;
          }
          .home-closing-cta h2 {
            font-size: clamp(36px, 11vw, 48px);
            letter-spacing: -0.045em;
          }
          .home-closing-cta .home-hero-actions {
            margin-top: 30px;
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
        }
      `}</style>
      <a className="public-skip-link" href="#main-content">Aller au contenu principal</a>
      <PublicNavbar logoWidth={132} />

      <main id="main-content" tabIndex={-1}>
      <section className="home-hero">
        <div className="home-hero-content">
          <div className="home-hero-intro">
            <div className="home-hero-copy">
              <h1 className="home-hero-title">
                Votre comptabilité,
                <span>exécutée par l&apos;IA.</span>
              </h1>

              <p className="home-hero-description">
                Factures, paiements, TVA et écritures comptables : Mohasib exécute votre gestion de bout en bout.
              </p>

              <div className="home-hero-actions">
                <a className="home-hero-button home-hero-button-primary" href={appUrl("/inscription")}>
                  Essayer gratuitement <ArrowRight size={16} aria-hidden="true" />
                </a>
                <a className="home-hero-button home-hero-button-secondary" href="/centre-aide">
                  Demander une démo
                </a>
              </div>

              <div className="home-hero-proof">
                <span>Utilisé par les directeurs financiers et les TPME</span>
              </div>
            </div>
          </div>

          <div id="centre-execution">
            <WorkflowCommandCenter />
          </div>

        </div>
      </section>

      <WorkflowShowcase />
      <ToolConsolidationSection />
      <CapabilitiesSection />
      <DocumentTransformationSection />
      <FAQSection />

      <section className="home-closing-cta" aria-labelledby="closing-cta-title">
        <div className="home-closing-cta-inner">
          <h2 id="closing-cta-title">
            Le temps, c&apos;est de l&apos;argent. Économisez les deux.
          </h2>
          <div className="home-hero-actions">
            <a className="home-hero-button home-hero-button-primary" href={appUrl("/inscription")}>Créer mon compte</a>
            <a className="home-hero-button home-hero-button-secondary" href="/centre-aide">Nous contacter</a>
          </div>
        </div>
      </section>
      </main>

      <PublicFooter />
    </div>
  );
}
