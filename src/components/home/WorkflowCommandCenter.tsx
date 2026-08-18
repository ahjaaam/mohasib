"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { BarChart3, Check, FileText, Landmark, Mail, ShieldCheck, UsersRound } from "lucide-react";
import styles from "./WorkflowCommandCenter.module.css";

type Row = { label: string; value: string; tone?: "gold" | "alert" };
type Stage = { step: string; title: string; rows: Row[]; note?: string; status?: string; primaryAction?: string; secondaryAction?: string };
type Workflow = { id: string; label: string; note: string; icon: typeof Mail; stages: [Stage, Stage, Stage] };

const workflows: Workflow[] = [
  {
    id: "documents", label: "Documents", note: "Facture fournisseur · FA-2026-0412", icon: Mail,
    stages: [
      { step: "01 · Document reçu", title: "E-mail entrant", note: "Boîte mail connectée · reçu à 09:14.", rows: [
        { label: "Expéditeur", value: "Sotrafil SARL" }, { label: "Objet", value: "Facture FA-2026-0412" },
        { label: "Pièce jointe", value: "facture-0412.pdf" }, { label: "Reçu le", value: "05/08/2026" },
      ] },
      { step: "02 · Mohasib travaille", title: "Extraction et préparation de l’écriture", note: "14 champs lus et contrôlés sur 14.", rows: [
        { label: "Fournisseur", value: "Sotrafil SARL" }, { label: "Total HT", value: "12 000,00 MAD" },
        { label: "TVA 20 %", value: "2 400,00 MAD" }, { label: "Total TTC", value: "14 400,00 MAD" },
        { label: "Comptes proposés", value: "6111 / 4411", tone: "gold" },
      ] },
      { step: "03 · Vous validez", title: "Écriture comptable préparée", status: "Prêt à valider", primaryAction: "Valider l’écriture", secondaryAction: "Modifier", rows: [
        { label: "Journal", value: "Achats" }, { label: "Échéance", value: "02/09/2026" },
      ] },
    ],
  },
  {
    id: "banque", label: "Banque", note: "Relevé Attijariwafa · août 2026", icon: Landmark,
    stages: [
      { step: "01 · Transaction importée", title: "Opération bancaire", note: "Relevé synchronisé automatiquement.", rows: [
        { label: "Banque", value: "Attijariwafa" }, { label: "Libellé", value: "Virement Sotrafil" },
        { label: "Montant", value: "-14 400,00 MAD" }, { label: "Date de valeur", value: "05/08/2026" },
      ] },
      { step: "02 · Mohasib travaille", title: "Recherche du justificatif", note: "3 pièces analysées, montant et date concordants.", rows: [
        { label: "Candidat 1", value: "FA-2026-0412 · 96 %", tone: "gold" }, { label: "Candidat 2", value: "FA-2026-0398 · 41 %" },
        { label: "Contrôle montant", value: "Identique" }, { label: "Écart de date", value: "1 jour" },
      ] },
      { step: "03 · Vous validez", title: "Correspondance trouvée par Mohasib", status: "Rapprochement suggéré — 96 %", primaryAction: "Confirmer", secondaryAction: "Voir les pièces", rows: [
        { label: "Écriture", value: "5141 / 4411" }, { label: "Reste à vérifier", value: "1 opération", tone: "alert" },
      ] },
    ],
  },
  {
    id: "facturation", label: "Facturation", note: "Facture client · FC-2026-0087", icon: FileText,
    stages: [
      { step: "01 · Facture envoyée", title: "Facture client transmise", note: "Envoyée par e-mail le 29/07/2026.", rows: [
        { label: "Client", value: "Groupe Zniber" }, { label: "Facture", value: "FC-2026-0087" },
        { label: "Total TTC", value: "14 280,00 MAD" }, { label: "Échéance", value: "12/08/2026" },
      ] },
      { step: "02 · Mohasib travaille", title: "Suivi de l’échéance et relance", note: "Historique client : 2 retards sur 9 factures.", rows: [
        { label: "Statut", value: "Échue depuis 12 jours", tone: "alert" }, { label: "Paiement reçu", value: "Aucun" },
        { label: "Modèle retenu", value: "Relance courtoise n° 1", tone: "gold" },
      ] },
      { step: "03 · Vous validez", title: "Message de relance rédigé", status: "Relance prête à envoyer", primaryAction: "Envoyer la relance", secondaryAction: "Modifier le texte", rows: [
        { label: "Objet", value: "Facture FC-2026-0087 échue" }, { label: "Canal", value: "E-mail + WhatsApp" },
      ] },
    ],
  },
  {
    id: "pilotage", label: "Pilotage", note: "Consolidation · août 2026", icon: BarChart3,
    stages: [
      { step: "01 · Données consolidées", title: "Sources réunies", note: "Mise à jour quotidienne à 06:00.", rows: [
        { label: "Période", value: "Août 2026" }, { label: "Sources", value: "Banque, factures, caisse" }, { label: "Écritures", value: "248 lignes" },
      ] },
      { step: "02 · Mohasib travaille", title: "Analyse des écarts", note: "Poste concerné : achats de matières premières.", rows: [
        { label: "Charges fournisseurs", value: "98 750,00 MAD" }, { label: "Moyenne 6 mois", value: "83 600,00 MAD" },
        { label: "Écart détecté", value: "+18 %", tone: "alert" }, { label: "Trésorerie", value: "318 400,00 MAD" },
      ] },
      { step: "03 · Vous validez", title: "Anomalie remontée pour décision", status: "Écart identifié — Charges +18 %", primaryAction: "Analyser l’écart", secondaryAction: "Marquer comme normal", rows: [
        { label: "Factures à revoir", value: "3 documents" }, { label: "Impact estimé", value: "15 150,00 MAD" },
      ] },
    ],
  },
  {
    id: "tva", label: "TVA", note: "Déclaration · juillet 2026", icon: ShieldCheck,
    stages: [
      { step: "01 · Contrôles effectués", title: "Écritures et pièces vérifiées", note: "Aucune pièce justificative manquante.", rows: [
        { label: "Période", value: "Juillet 2026" }, { label: "Écritures", value: "248 lignes" },
        { label: "Équilibre", value: "Conforme" }, { label: "Pièces manquantes", value: "0" },
      ] },
      { step: "02 · Mohasib travaille", title: "Calcul de la TVA", note: "2 taux à confirmer avant transmission.", rows: [
        { label: "TVA collectée", value: "42 860,00 MAD" }, { label: "TVA déductible", value: "17 340,00 MAD" },
        { label: "TVA à payer", value: "25 520,00 MAD", tone: "gold" },
      ] },
      { step: "03 · Vous validez", title: "Déclaration calculée et contrôlée", status: "Déclaration prête à valider", primaryAction: "Valider la déclaration", secondaryAction: "Contrôler les taux", rows: [
        { label: "Régime", value: "Débit · mensuel" }, { label: "Export comptable", value: "CSV / Sage prêt" },
      ] },
    ],
  },
  {
    id: "paie", label: "Paie", note: "Paie · août 2026 · 14 salariés", icon: UsersRound,
    stages: [
      { step: "01 · Variables collectées", title: "Éléments du mois", note: "Pointages et absences importés du planning.", rows: [
        { label: "Salariés", value: "14" }, { label: "Heures supplémentaires", value: "32 h" }, { label: "Absences", value: "3 jours" },
      ] },
      { step: "02 · Mohasib travaille", title: "Préparation des bulletins", note: "13 bulletins sur 14 complets.", rows: [
        { label: "Masse salariale nette", value: "118 640,00 MAD" }, { label: "CNSS", value: "8 940,00 MAD" },
        { label: "Variable manquante", value: "Prime de rendement", tone: "alert" },
      ] },
      { step: "03 · Vous validez", title: "Bulletins préparés, une prime à confirmer", status: "Bulletins prêts — validation requise", primaryAction: "Valider la paie", secondaryAction: "Compléter la prime", rows: [
        { label: "Validation", value: "Direction" }, { label: "Archivage", value: "Automatique après accord" },
      ] },
    ],
  },
];

const ROTATION_MS = 7000;

export default function WorkflowCommandCenter() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const active = workflows[activeIndex];

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) return;
    const timer = window.setTimeout(() => setActiveIndex((index) => (index + 1) % workflows.length), ROTATION_MS);
    return () => window.clearTimeout(timer);
  }, [activeIndex, paused, reducedMotion]);

  const selectTab = (index: number, focus = false) => {
    setActiveIndex(index);
    if (focus) document.getElementById(`command-tab-${workflows[index].id}`)?.focus();
  };

  const onTabsKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Home") return selectTab(0, true);
    if (event.key === "End") return selectTab(workflows.length - 1, true);
    const direction = event.key === "ArrowRight" ? 1 : -1;
    selectTab((activeIndex + direction + workflows.length) % workflows.length, true);
  };

  return (
    <div className={styles.frame} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}>
      <div className={styles.topbar}>
        <div>
          <Image
            className={styles.brandIcon}
            src="/favicon.png"
            alt=""
            width={14}
            height={14}
            aria-hidden="true"
          />
          <strong>Mohasib · Centre d’exécution</strong>
        </div>
        <span>Document reçu → Mohasib travaille → Vous validez</span>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Workflows Mohasib" onKeyDown={onTabsKeyDown}>
        {workflows.map((workflow, index) => {
          const Icon = workflow.icon;
          const selected = index === activeIndex;
          return (
            <button type="button" role="tab" id={`command-tab-${workflow.id}`} aria-selected={selected} aria-controls={`command-panel-${workflow.id}`} tabIndex={selected ? 0 : -1} className={selected ? styles.activeTab : undefined} onClick={() => selectTab(index)} key={workflow.id}>
              <Icon size={15} strokeWidth={1.7} aria-hidden="true" />
              {workflow.label}
              {selected && <span className={paused || reducedMotion ? styles.staticProgress : styles.progress} aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <div className={styles.panel} role="tabpanel" id={`command-panel-${active.id}`} aria-labelledby={`command-tab-${active.id}`} key={active.id}>
        {active.stages.map((stage, index) => (
          <article className={styles.stage} key={stage.step}>
            <div className={styles.stageStep}>
              <span>{stage.step}</span>
              {index === active.stages.length - 1 ? <Check size={15} /> : <span aria-hidden="true">→</span>}
            </div>
            <h3>{stage.title}</h3>
            <div className={styles.rows}>
              {stage.rows.map((row) => (
                <div className={styles.row} key={row.label}>
                  <span>{row.label}</span>
                  <strong className={row.tone ? styles[row.tone] : undefined}>{row.value}</strong>
                </div>
              ))}
            </div>
            {stage.note && <p className={styles.note}>{stage.note}</p>}
            {stage.status && <div className={styles.status}><Check size={13} /><strong>{stage.status}</strong></div>}
            {stage.primaryAction && <div className={styles.actions} aria-hidden="true"><span>{stage.primaryAction}</span><span>{stage.secondaryAction}</span></div>}
          </article>
        ))}
      </div>

      <div className={styles.footer}>
        <strong>Mohasib prépare et exécute. Vous contrôlez et validez.</strong>
        <span>{active.note}</span>
      </div>
    </div>
  );
}
