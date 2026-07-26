"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISSED_AT_KEY = "mohasib:pwa-install-dismissed-at";
const DISMISS_FOR_MS = 14 * 24 * 60 * 60 * 1000;

function isStandalone() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

function isIos() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  );
}

export default function PWAInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const dismissedAt = Number(window.localStorage.getItem(DISMISSED_AT_KEY) ?? 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_FOR_MS) return;

    const iosGuideTimer = isIos()
      ? window.setTimeout(() => setShowIosGuide(true), 0)
      : undefined;

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };

    const handleInstalled = () => setInstallEvent(null);

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      if (iosGuideTimer !== undefined) window.clearTimeout(iosGuideTimer);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (!installEvent && !showIosGuide) return null;

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      setInstallEvent(null);
    }
  }

  function dismiss() {
    window.localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()));
    setInstallEvent(null);
    setShowIosGuide(false);
  }

  return (
    <aside
      className="pwa-install-prompt"
      aria-label="Installer l’application Mohasib"
    >
      <div className="pwa-install-prompt__icon" aria-hidden="true">
        <Download size={17} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-semibold text-[#0D1526]">
          Installer Mohasib
        </p>
        <p className="mt-0.5 text-[10.5px] leading-4 text-[#6B7280]">
          {showIosGuide
            ? "Dans Safari, touchez Partager puis « Sur l’écran d’accueil »."
            : "Accédez-y comme à une application, depuis votre écran d’accueil."}
        </p>
      </div>
      {installEvent && (
        <button type="button" className="pwa-install-prompt__action" onClick={install}>
          Installer
        </button>
      )}
      <button
        type="button"
        className="pwa-install-prompt__close"
        onClick={dismiss}
        aria-label="Fermer"
      >
        <X size={15} />
      </button>
    </aside>
  );
}
