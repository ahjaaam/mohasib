"use client";

import PublicNavbar from "@/components/PublicNavbar";
import PublicFooter from "@/components/PublicFooter";
import WorkflowShowcase from "@/components/home/WorkflowShowcase";
import WorkflowCommandCenter from "@/components/home/WorkflowCommandCenter";
import ToolConsolidationSection from "@/components/home/ToolConsolidationSection";
import CapabilitiesSection from "@/components/home/CapabilitiesSection";
import DocumentTransformationSection from "@/components/home/DocumentTransformationSection";
import FAQSection from "@/components/home/FAQSection";
import AnnouncementBar from "@/components/home/AnnouncementBar";
import { appUrl } from "@/lib/public-urls";

const FONT = "var(--font-jakarta), sans-serif";

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
        .home-phone-cta {
          display: flex;
          width: min(100%, 520px);
          align-items: center;
          gap: 8px;
          padding: 7px;
          border: 1px solid #0D1526;
          border-radius: 12px !important;
          background: #FFFFFF;
          box-shadow: 0 0 0 1px #0D1526;
          transition: border-color 150ms ease, box-shadow 150ms ease;
        }
        .home-phone-cta:focus-within {
          border-color: #0D1526;
          box-shadow: 0 0 0 1px #0D1526;
        }
        .home-phone-cta input {
          min-width: 0;
          min-height: 48px;
          flex: 1;
          border: 0;
          background: transparent;
          padding: 0 15px;
          color: #0D1526;
          font-family: ${FONT};
          font-size: 15px;
          outline: none;
        }
        .home-phone-cta input::placeholder {
          color: #777D87;
        }
        .home-phone-cta input:focus-visible {
          outline: none;
        }
        .home-phone-cta button {
          min-height: 48px;
          flex: 0 0 auto;
          border: 0;
          border-radius: 8px !important;
          background: #0D1526;
          padding: 0 22px;
          color: #FFFFFF;
          font-family: ${FONT};
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 150ms ease;
        }
        .home-phone-cta button:hover {
          background: #202B42;
        }
        .home-closing-cta {
          padding: 104px 24px 112px;
          background: #FFFFFF;
          color: #0D1526;
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
        .home-closing-cta .home-phone-cta {
          margin: 38px auto 0;
          border-color: #0D1526;
          box-shadow: 0 0 0 1px #0D1526;
        }
        .home-closing-cta .home-phone-cta button {
          background: #0D1526;
        }
        .home-closing-cta .home-phone-cta button:hover {
          background: #202B42;
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
          .home-phone-cta {
            width: min(100%, 328px);
            align-items: stretch;
            flex-direction: column;
          }
          .home-phone-cta button {
            width: 100%;
          }
          .home-closing-cta {
            padding: 72px 20px 78px;
          }
          .home-closing-cta h2 {
            font-size: clamp(36px, 11vw, 48px);
            letter-spacing: -0.045em;
          }
          .home-closing-cta .home-phone-cta {
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
      <PublicNavbar />
      <AnnouncementBar />

      <section className="home-hero">
        <div className="home-hero-content">
            <p className="public-eyebrow mb-4">L&apos;IA AU SERVICE DE VOTRE GESTION</p>
            <h1 className="home-hero-title">
              Votre comptabilité, exécutées par l&apos;IA.
            </h1>

            <p className="home-hero-description">
            Connecter votre boite mail, envoyez vos factures, suivez vos paiements, effectuez vos rapprochements bancaires, créez vos bulletins de paie, déclarez votre TVA, obtenez des insights financiers et exportez une comptabilité propre.            </p>

            <div className="home-hero-actions">
              <form className="home-phone-cta" action={appUrl("/inscription")} method="get">
                <input
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  inputMode="tel"
                  aria-label="Votre numéro de téléphone"
                  placeholder="Votre numéro de téléphone"
                  required
                />
                <button type="submit">Commencer</button>
              </form>
            </div>

            <WorkflowCommandCenter />

        </div>
      </section>

      <ToolConsolidationSection />
      <WorkflowShowcase />
      <DocumentTransformationSection />
      <CapabilitiesSection />
      <FAQSection />

      <section className="home-closing-cta" aria-labelledby="closing-cta-title">
        <div className="home-closing-cta-inner">
          <h2 id="closing-cta-title">
            Le temps, c&apos;est de l&apos;argent. Économisez les deux.
          </h2>
          <form className="home-phone-cta" action={appUrl("/inscription")} method="get">
            <input
              type="tel"
              name="phone"
              autoComplete="tel"
              inputMode="tel"
              aria-label="Votre numéro de téléphone"
              placeholder="Votre numéro de téléphone"
              required
            />
            <button type="submit">Commencer</button>
          </form>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
