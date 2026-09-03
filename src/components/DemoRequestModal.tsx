"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Send, X } from "lucide-react";
import styles from "./DemoRequestModal.module.css";

type DemoRequestModalProps = {
  open: boolean;
  onClose: () => void;
};

const PROFILE_OPTIONS = [
  ["entrepreneur", "Entrepreneur / dirigeant"],
  ["independant", "Indépendant"],
  ["comptable", "Comptable"],
  ["fiduciaire", "Fiduciaire / cabinet"],
  ["autre", "Autre"],
];

const NEED_OPTIONS = [
  ["vue-ensemble", "Une vue d’ensemble de Mohasib"],
  ["facturation", "Facturation et suivi des échéances"],
  ["documents", "Documents, e-mails et OCR"],
  ["comptabilite", "Comptabilité et écritures"],
  ["declarations", "TVA, paie et déclarations"],
  ["cabinet", "Gestion d’un cabinet comptable"],
];

export default function DemoRequestModal({ open, onClose }: DemoRequestModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => modalRef.current?.querySelector<HTMLElement>("select, input")?.focus(), 0);

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, open]);

  if (!open) return null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/notify/demo-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form.entries())),
    }).catch(() => null);

    if (!response?.ok) {
      const payload = await response?.json().catch(() => null);
      setError(payload?.message || "Impossible d’envoyer votre demande. Réessayez dans un instant.");
      setSaving(false);
      return;
    }

    setSaving(false);
    setSent(true);
  }

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-modal-title"
        aria-describedby="demo-modal-description"
      >
        <button type="button" className={styles.close} onClick={onClose} aria-label="Fermer">
          <X size={18} />
        </button>

        {sent ? (
          <div className={styles.success}>
            <div>
              <span className={styles.successIcon}>
                <Check size={25} />
              </span>
              <h2 className={styles.successTitle}>Demande reçue</h2>
              <p className={styles.successText}>
                Merci. Je vais préparer une vidéo adaptée à votre profil et vous l’envoyer
                directement avec les coordonnées indiquées.
              </p>
              <button type="button" className={styles.successButton} onClick={onClose}>
                Fermer
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.header}>
              <p className={styles.eyebrow}>Vidéo de démonstration personnalisée</p>
              <h2 className={styles.title} id="demo-modal-title">
                Voyez Mohasib dans le contexte de votre activité.
              </h2>
              <p className={styles.description} id="demo-modal-description">
                Dites-moi qui vous êtes et ce que vous souhaitez voir. Je vous enverrai
                une démonstration courte et adaptée.
              </p>
            </div>

            <form className={styles.form} onSubmit={submit}>
              <div className={styles.grid}>
                <label className={styles.field}>
                  <span className={styles.label}>Vous êtes *</span>
                  <select className={styles.select} name="profil" required defaultValue="">
                    <option value="" disabled>Sélectionnez votre profil</option>
                    {PROFILE_OPTIONS.map(([value, label]) => (
                      <option value={value} key={value}>{label}</option>
                    ))}
                  </select>
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>Nom complet *</span>
                  <input className={styles.input} name="nom" autoComplete="name" required maxLength={120} placeholder="Votre nom" />
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>E-mail professionnel *</span>
                  <input className={styles.input} name="email" type="email" autoComplete="email" required maxLength={320} placeholder="vous@entreprise.ma" />
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>WhatsApp *</span>
                  <span className={styles.phone}>
                    <span className={styles.phonePrefix}>+212</span>
                    <input className={styles.input} name="telephone" type="tel" autoComplete="tel" required maxLength={24} placeholder="6 00 00 00 00" />
                  </span>
                </label>

                <label className={styles.wideField}>
                  <span className={styles.label}>Votre Entreprise ou cabinet *</span>
                  <input className={styles.input} name="entreprise" autoComplete="organization" required maxLength={160} placeholder="Nom de votre structure" />
                </label>

                <label className={styles.wideField}>
                  <span className={styles.label}>Ce que vous souhaitez voir *</span>
                  <select className={styles.select} name="besoin" required defaultValue="">
                    <option value="" disabled>Sélectionnez votre priorité</option>
                    {NEED_OPTIONS.map(([value, label]) => (
                      <option value={value} key={value}>{label}</option>
                    ))}
                  </select>
                </label>

                <label className={styles.honeypot} aria-hidden="true">
                  Site web
                  <input name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>

              <p className={styles.consent}>
                En envoyant cette demande, vous acceptez que Mohasib conserve vos
                coordonnées afin de vous transmettre la démonstration et de vous recontacter.
              </p>

              {error && <p className={styles.error} role="alert">{error}</p>}

              <button type="submit" className={styles.submit} disabled={saving}>
                <Send size={16} />
                {saving ? "Envoi en cours…" : "Recevoir ma vidéo"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
