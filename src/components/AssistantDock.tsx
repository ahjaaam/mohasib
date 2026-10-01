"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, FilePlus2, FileText, FolderPlus, Loader2, ListTodo, Upload, X, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAccountOwnerId } from "@/hooks/useAccountOwner";
import { usePermissions } from "@/hooks/usePermissions";

type Mode = "business" | "accountant" | "client_portal";
type CompanyProfile = { raison_sociale: string | null; forme_juridique: string | null; ice: string | null; address: string | null; city: string | null; phone: string | null; email: string | null };
type CabinetProfile = { nom_cabinet: string | null; ice: string | null; adresse: string | null; ville: string | null; telephone: string | null; email: string | null };
type DossierProfile = { raison_sociale: string | null; forme_juridique: string | null; ice: string | null; contact_nom: string | null; contact_email: string | null; contact_phone: string | null };
type Snapshot = {
  company?: CompanyProfile | null;
  cabinet?: CabinetProfile | null;
  dossier?: DossierProfile | null;
  dossierCount?: number;
  clientCount?: number;
  invoiceCount?: number;
  receiptCount?: number;
};
type Action = { title: string; description: string; href: string; button: string; icon: LucideIcon; category: string };

const companyNeedsSetup = (company: CompanyProfile | null | undefined) => !company
  || !company.raison_sociale?.trim() || !company.forme_juridique?.trim() || !company.ice?.trim()
  || !company.address?.trim() || !company.city?.trim() || !company.phone?.trim() || !company.email?.trim();

const cabinetNeedsSetup = (cabinet: CabinetProfile | null | undefined) => !cabinet
  || !cabinet.nom_cabinet?.trim() || !cabinet.ice?.trim() || !cabinet.adresse?.trim()
  || !cabinet.ville?.trim() || !cabinet.telephone?.trim() || !cabinet.email?.trim();

const dossierNeedsSetup = (dossier: DossierProfile | null | undefined) => !dossier
  || !dossier.raison_sociale?.trim() || !dossier.forme_juridique?.trim() || !dossier.ice?.trim()
  || !dossier.contact_nom?.trim() || !dossier.contact_email?.trim() || !dossier.contact_phone?.trim();

export default function AssistantDock({ open, onClose, mode = "business", dossierId }: { open: boolean; onClose: () => void; mode?: Mode; dossierId?: string }) {
  const ownerId = useAccountOwnerId();
  const { can, isOwner } = usePermissions();
  const [snapshot, setSnapshot] = useState<Snapshot>({});
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const canReadOrCreateInvoices = can("invoice", "read") || can("invoice", "create");
  const canReadOrCreateDocuments = can("document", "read") || can("document", "create");

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setLoadFailed(false);
    void (async () => {
      const db = createClient();
      const next: Snapshot = {};
      let failed = false;
      try {
        if (mode === "business") {
          const requests: Array<Promise<void>> = [];
          if (isOwner && can("settings", "update")) requests.push((async () => {
            const { data, error } = await db.from("companies").select("raison_sociale,forme_juridique,ice,address,city,phone,email").eq("user_id", ownerId).maybeSingle();
            if (error) failed = true;
            next.company = data as CompanyProfile | null;
          })());
          if (can("invoice", "create")) {
            if (can("invoice", "read")) requests.push((async () => {
              const [clients, invoices] = await Promise.all([
                db.from("clients").select("id", { count: "exact", head: true }).eq("user_id", ownerId).is("dossier_id", null),
                db.from("invoices").select("id", { count: "exact", head: true }).eq("user_id", ownerId).is("dossier_id", null),
              ]);
              if (clients.error || invoices.error) failed = true;
              next.clientCount = clients.count ?? 0;
              next.invoiceCount = invoices.count ?? 0;
            })());
            else next.clientCount = 0;
          }
          if (can("document", "create") && can("document", "read")) requests.push((async () => {
            const { count, error } = await db.from("receipts").select("id", { count: "exact", head: true }).eq("user_id", ownerId).is("dossier_id", null);
            if (error) failed = true;
            next.receiptCount = count ?? 0;
          })());
          await Promise.all(requests);
        } else if (mode === "accountant") {
          const requests: Array<Promise<void>> = [];
          if (isOwner) requests.push((async () => {
            const { data, error } = await db.from("cabinets").select("nom_cabinet,ice,adresse,ville,telephone,email").eq("user_id", ownerId).maybeSingle();
            if (error) failed = true;
            next.cabinet = data as CabinetProfile | null;
          })());
          if (isOwner || can("dossier", "read")) requests.push((async () => {
            const { count, error } = await db.from("dossiers").select("id", { count: "exact", head: true }).eq("fiduciaire_user_id", ownerId).eq("statut", "actif");
            if (error) failed = true;
            next.dossierCount = count ?? 0;
          })());
          await Promise.all(requests);
        }

        if (dossierId && (mode === "accountant" || mode === "client_portal")) {
          const requests: Array<Promise<void>> = [];
          if (mode === "accountant" && (isOwner || can("settings", "update"))) requests.push((async () => {
            const { data, error } = await db.from("dossiers").select("raison_sociale,forme_juridique,ice,contact_nom,contact_email,contact_phone").eq("id", dossierId).maybeSingle();
            if (error) failed = true;
            next.dossier = data as DossierProfile | null;
          })());
          if (canReadOrCreateInvoices) requests.push((async () => {
            const { count, error } = await db.from("invoices").select("id", { count: "exact", head: true }).eq("dossier_id", dossierId);
            if (error) failed = true;
            next.invoiceCount = count ?? 0;
          })());
          if (canReadOrCreateDocuments) requests.push((async () => {
            const { count, error } = await db.from("receipts").select("id", { count: "exact", head: true }).eq("dossier_id", dossierId);
            if (error) failed = true;
            next.receiptCount = count ?? 0;
          })());
          await Promise.all(requests);
        }
      } catch {
        failed = true;
      }
      if (active) {
        setSnapshot(next);
        setLoadFailed(failed);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [open, mode, dossierId, ownerId, isOwner, can, canReadOrCreateInvoices, canReadOrCreateDocuments]);

  const actions = useMemo<Action[]>(() => {
    const next: Action[] = [];
    if (mode === "business") {
      if (isOwner && can("settings", "update") && companyNeedsSetup(snapshot.company)) next.push({
        category: "Compte", icon: Building2, title: "Complétez les informations de votre entreprise",
        description: "Renseignez votre ICE, votre forme juridique et vos coordonnées pour préparer vos factures.",
        href: "/parametres?tab=entreprise", button: "Compléter mon entreprise",
      });
      if (can("invoice", "create") && can("invoice", "read") && snapshot.clientCount === 0) next.push({
        category: "Facturation", icon: Building2, title: "Ajoutez votre premier client",
        description: "Enregistrez les coordonnées de votre client pour pouvoir préparer une facture à son nom.",
        href: "/clients", button: "Ajouter un client",
      });
      else if (can("invoice", "create") && can("invoice", "read") && snapshot.invoiceCount === 0) next.push({
        category: "Facturation", icon: FilePlus2, title: "Créez votre première facture",
        description: "Votre espace est prêt. Vous pouvez préparer une facture pour un client.",
        href: "/factures/nouvelle", button: "Créer une facture",
      });
      if (can("document", "create") && can("document", "read") && snapshot.receiptCount === 0) next.push({
        category: "Documents", icon: Upload, title: "Déposez votre première facture fournisseur",
        description: "Ajoutez une pièce d’achat pour la retrouver et la traiter depuis Mohasib.",
        href: "/achats", button: "Ajouter un document",
      });
    }

    if (mode === "accountant" && !dossierId) {
      if (isOwner && cabinetNeedsSetup(snapshot.cabinet)) next.push({
        category: "Cabinet", icon: Building2, title: "Complétez le profil du cabinet",
        description: "Ajoutez les coordonnées et identifiants du cabinet utilisés dans vos documents.",
        href: "/comptable-pro/settings", button: "Configurer le cabinet",
      });
      if (isOwner && snapshot.dossierCount === 0) next.push({
        category: "Dossiers clients", icon: FolderPlus, title: "Créez votre premier dossier client",
        description: "Un dossier vous permet de suivre la comptabilité et les échéances d’une entreprise cliente.",
        href: "/comptable-pro/dossiers/nouveau", button: "Créer un dossier",
      });
      else if (can("dossier", "read") && (snapshot.dossierCount ?? 0) > 0) next.push({
        category: "Dossiers clients", icon: FileText, title: "Ouvrez un dossier client",
        description: "Consultez les pièces, écritures et échéances des dossiers auxquels vous avez accès.",
        href: "/comptable-pro/dossiers", button: "Voir les dossiers",
      });
    }

    if (dossierId && mode === "accountant") {
      const base = `/comptable-pro/dossiers/${dossierId}`;
      if ((isOwner || can("settings", "update")) && dossierNeedsSetup(snapshot.dossier)) next.push({
        category: "Dossier client", icon: Building2, title: "Complétez la fiche de ce dossier",
        description: "Ajoutez les identifiants légaux et les coordonnées de contact de l’entreprise cliente.",
        href: `${base}/parametres?tab=dossier`, button: "Compléter le dossier",
      });
      if (can("invoice", "create") && can("invoice", "read") && snapshot.invoiceCount === 0) next.push({
        category: "Facturation", icon: FilePlus2, title: "Préparez la première facture du dossier",
        description: "Aucune facture n’a encore été créée dans ce dossier.",
        href: `${base}/invoices/new`, button: "Créer une facture",
      });
      if (can("document", "create") && can("document", "read") && snapshot.receiptCount === 0) next.push({
        category: "Documents", icon: Upload, title: "Importez les premières pièces comptables",
        description: "Déposez une facture d’achat ou un reçu pour commencer le suivi des justificatifs.",
        href: `${base}/inbox`, button: "Importer des pièces",
      });
    }

    if (dossierId && mode === "client_portal") {
      if (can("document", "create") && snapshot.receiptCount === 0) next.push({
        category: "Documents à transmettre", icon: Upload, title: "Transmettez vos premières pièces comptables",
        description: "Déposez vos factures d’achat et justificatifs afin que votre fiduciaire puisse les traiter.",
        href: `/comptable-pro/dossiers/${dossierId}/inbox`, button: "Transmettre des documents",
      });
      if (can("invoice", "read") && snapshot.invoiceCount === 0) next.push({
        category: "Votre dossier", icon: FileText, title: "Consultez votre espace client",
        description: "Retrouvez les informations et le suivi de votre dossier partagé par votre fiduciaire.",
        href: `/comptable-pro/dossiers/${dossierId}/tableau-de-bord`, button: "Ouvrir mon espace",
      });
    }
    return next.slice(0, 5);
  }, [mode, dossierId, isOwner, can, snapshot]);
  const sections = useMemo(() => {
    const grouped = new Map<string, Action[]>();
    actions.forEach((action) => grouped.set(action.category, [...(grouped.get(action.category) ?? []), action]));
    return [...grouped.entries()].map(([title, items]) => ({ title, items }));
  }, [actions]);

  if (!open) return null;

  return (
    <aside id="mohasib-assistant-dock" role="dialog" aria-label="À faire ensuite" className="mohasib-side-card fixed bottom-[calc(56px+env(safe-area-inset-bottom))] right-0 top-16 z-[80] flex w-full flex-col overflow-hidden sm:w-[400px] md:bottom-[14px] md:right-[14px]">
      <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-black/[0.07] px-4">
        <div className="flex items-center gap-2.5">
          <ListTodo size={16} className="text-[#C8924A]" />
          <div><h2 className="text-[13px] font-bold text-[#1A1A2E]">À faire ensuite</h2><p className="text-[10px] text-[#8A909B]">{loading ? "Vérification en cours" : `${actions.length} action${actions.length === 1 ? "" : "s"} suggérée${actions.length === 1 ? "" : "s"}`}</p></div>
        </div>
        <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md text-[#6B7280] hover:bg-black/[0.04]" aria-label="Fermer À faire ensuite"><X size={16} /></button>
      </header>

      <div className="flex-1 overflow-y-auto bg-white">
        {loading ? (
          <div className="flex items-center gap-2 border-b border-black/[0.06] px-4 py-4 text-[12px] text-[#777E8B]"><Loader2 size={15} className="animate-spin" />Recherche des prochaines étapes…</div>
        ) : loadFailed ? (
          <div className="px-4 py-5 text-[12px] leading-5 text-[#6B7280]">Certaines informations n’ont pas pu être chargées. Vérifiez vos accès ou réessayez plus tard.</div>
        ) : sections.length ? sections.map(({ title: sectionTitle, items }) => (
          <section key={sectionTitle} aria-labelledby={`todo-section-${sectionTitle}`}>
            <header className="flex h-9 items-center justify-between border-b border-black/[0.06] bg-[#F7F7F3] px-4">
              <h3 id={`todo-section-${sectionTitle}`} className="text-[10px] font-bold uppercase tracking-[0.7px] text-[#6B7280]">{sectionTitle}</h3>
              <span className="text-[9px] font-semibold text-[#9A9FA8]">{items.length}</span>
            </header>
            {items.map(({ title, description, href, button, icon: Icon }) => (
              <article key={href} className="border-b border-black/[0.06] px-4 py-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center bg-[#F7F7F3] text-[#C8924A]"><Icon size={16} /></span>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-[12px] font-bold text-[#1A1A2E]">{title}</h4>
                    <p className="mt-1 text-[11px] leading-5 text-[#6B7280]">{description}</p>
                    <Link href={href} onClick={onClose} className="todo-action-link mt-3 inline-flex h-8 items-center gap-2 rounded-md bg-[#0D1526] px-3 text-[10.5px] font-bold text-white hover:bg-[#1C2940]">{button}<ArrowRight size={13} /></Link>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )) : (
          <div className="flex min-h-48 flex-col items-center justify-center px-6 py-8 text-center">
            <CheckCircle2 size={24} className="text-[#5B8A68]" />
            <h3 className="mt-3 text-[12px] font-semibold text-[#303644]">Aucune nouvelle action pour le moment</h3>
            <p className="mt-1 text-[10.5px] leading-5 text-[#8A909B]">Les prochaines étapes apparaîtront ici selon votre activité et vos accès.</p>
          </div>
        )}
      </div>
    </aside>
  );
}
