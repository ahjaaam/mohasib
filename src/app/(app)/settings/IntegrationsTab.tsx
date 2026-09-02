"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, Mail, CheckCircle2, Lock, Unplug, RefreshCw } from "lucide-react";
import GoogleDriveIcon from "@/components/GoogleDriveIcon";

interface Props {
  company: {
    gmail_token_encrypted?: string | null;
    gmail_email?: string | null;
    gmail_last_sync?: string | null;
    gmail_import_count?: number | null;
    outlook_token_encrypted?: string | null;
    outlook_email?: string | null;
    outlook_last_sync?: string | null;
    outlook_import_count?: number | null;
  };
  dossierId?: string;
}

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return "Jamais";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "À l'instant";
  if (min < 60) return `Il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Il y a ${h}h`;
  return `Il y a ${Math.floor(h / 24)} jour(s)`;
}

function StatusBadge({ connected, email }: { connected: boolean; email?: string | null }) {
  if (!connected) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded-full">
        Non connecté
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-[#059669] bg-[#ECFDF5] px-2 py-0.5 rounded-full font-medium">
      <CheckCircle2 size={11} />
      {email ?? "Connecté"}
    </span>
  );
}

// Isolated component so useSearchParams doesn't require Suspense on the whole page
function OAuthFeedback() {
  const searchParams = useSearchParams();
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    if (success === "gmail") toast.success("Gmail connecté avec succès");
    if (success === "outlook") toast.success("Outlook connecté avec succès");
    if (success === "google_drive") toast.success("Google Drive connecté avec succès");
    if (error === "gmail_failed") toast.error("Connexion Gmail échouée. Réessayez.");
    if (error === "outlook_failed") toast.error("Connexion Outlook échouée. Réessayez.");
    if (error === "gmail_not_configured") toast.error("OAuth Gmail n'est pas encore configuré côté serveur.");
    if (error === "outlook_not_configured") toast.error("OAuth Outlook n'est pas encore configuré côté serveur.");
    if (error === "gmail_invalid_state") toast.error("La demande Gmail a expiré ou n'est plus valide. Recommencez la connexion.");
    if (error === "outlook_invalid_state") toast.error("La demande Outlook a expiré ou n'est plus valide. Recommencez la connexion.");
    if (error === "drive_failed") toast.error("Connexion Google Drive échouée. Réessayez.");
    if (error === "drive_not_configured") toast.error("Google Drive n'est pas encore configuré côté serveur.");
    if (error === "drive_invalid_state") toast.error("La demande Google Drive a expiré. Recommencez la connexion.");
    if (error === "drive_owner_required") toast.error("Seul le propriétaire du compte peut connecter Google Drive.");
    if (error === "drive_account_mismatch") toast.error("Déconnectez d'abord le compte Google Drive actuel avant d'en utiliser un autre.");
  }, [searchParams]);
  return null;
}

export default function IntegrationsTab({ company, dossierId }: Props) {
  const [gmailLoading, setGmailLoading] = useState(false);
  const [outlookLoading, setOutlookLoading] = useState(false);
  const [gmailSyncing, setGmailSyncing] = useState(false);
  const [outlookSyncing, setOutlookSyncing] = useState(false);

  const gmailConnected = !!company.gmail_token_encrypted;
  const outlookConnected = !!company.outlook_token_encrypted;
  const scopeBody = dossierId ? { dossierId } : {};
  const gmailConnectHref = dossierId ? `/api/oauth/gmail/connect?dossierId=${dossierId}` : "/api/oauth/gmail/connect";
  const outlookConnectHref = dossierId ? `/api/oauth/outlook/connect?dossierId=${dossierId}` : "/api/oauth/outlook/connect";

  async function disconnectGmail() {
    if (!confirm("Déconnecter Gmail ? La synchronisation automatique sera désactivée.")) return;
    setGmailLoading(true);
    try {
      const res = await fetch("/api/oauth/gmail/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scopeBody),
      });
      if (!res.ok) throw new Error();
      toast.success("Gmail déconnecté");
      window.location.reload();
    } catch {
      toast.error("Erreur lors de la déconnexion");
    } finally {
      setGmailLoading(false);
    }
  }

  async function disconnectOutlook() {
    if (!confirm("Déconnecter Outlook ? La synchronisation automatique sera désactivée.")) return;
    setOutlookLoading(true);
    try {
      const res = await fetch("/api/oauth/outlook/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scopeBody),
      });
      if (!res.ok) throw new Error();
      toast.success("Outlook déconnecté");
      window.location.reload();
    } catch {
      toast.error("Erreur lors de la déconnexion");
    } finally {
      setOutlookLoading(false);
    }
  }

  async function syncGmail() {
    setGmailSyncing(true);
    try {
      const res = await fetch("/api/oauth/gmail/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scopeBody),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Erreur de synchronisation");
      const found = json.messagesFound ?? 0;
      const imp = json.imported ?? 0;
      toast.success(
        found === 0
          ? `${json.messagesScanned ?? 0} email(s) vérifié(s), aucune facture trouvée`
          : `${found} email(s) trouvé(s) — ${imp} document(s) importé(s)`
      );
      window.location.reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur de synchronisation", { duration: 5000 });
    } finally {
      setGmailSyncing(false);
    }
  }

  async function syncOutlook() {
    setOutlookSyncing(true);
    try {
      const res = await fetch("/api/oauth/outlook/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scopeBody),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Erreur de synchronisation");
      toast.success(
        (json.imported ?? 0) > 0
          ? `${json.imported} document(s) importé(s) depuis Outlook`
          : `${json.messagesScanned ?? 0} email(s) vérifié(s), ${json.attachmentsFound ?? 0} pièce(s) jointe(s) trouvée(s)`,
      );
      window.location.reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur de synchronisation", { duration: 5000 });
    } finally {
      setOutlookSyncing(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={null}><OAuthFeedback /></Suspense>

      {/* Privacy notice */}
      <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-xl px-4 py-3 text-[12px] text-[#0369A1] leading-relaxed">
        <span className="font-semibold inline-flex items-center gap-1"><Lock size={13} /> Confidentialité :</span> Mohasib accède uniquement aux
        emails contenant des factures ou reçus. Vos emails personnels ne sont jamais lus.
        Vous pouvez déconnecter à tout moment.
      </div>

      {/* Gmail card */}
      <EmailProviderCard
        name="Gmail"
        icon={<GmailIcon />}
        connected={gmailConnected}
        email={company.gmail_email}
        lastSync={company.gmail_last_sync}
        importCount={company.gmail_import_count}
        connectHref={gmailConnectHref}
        onDisconnect={disconnectGmail}
        onSync={syncGmail}
        disconnectLoading={gmailLoading}
        syncLoading={gmailSyncing}
      />

      {!dossierId && <GoogleDriveCard />}

      {/* Outlook card */}
      <EmailProviderCard
        name="Outlook"
        icon={<OutlookIcon />}
        connected={outlookConnected}
        email={company.outlook_email}
        lastSync={company.outlook_last_sync}
        importCount={company.outlook_import_count}
        connectHref={outlookConnectHref}
        onDisconnect={disconnectOutlook}
        onSync={syncOutlook}
        disconnectLoading={outlookLoading}
        syncLoading={outlookSyncing}
      />

      <p className="text-[11px] text-[#9CA3AF] px-0.5">
        La synchronisation automatique s'exécute toutes les 15 minutes.
        Les factures détectées apparaissent dans votre{" "}
        <a href="/achats" className="underline hover:text-[#6B7280]">espace Achats</a>.
      </p>
    </div>
  );
}

function GoogleDriveCard() {
  const [status, setStatus] = useState<{ connected: boolean; email: string | null; archives: unknown[] } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetch("/api/google-drive/archives")
      .then(async response => response.ok ? response.json() : Promise.reject())
      .then(setStatus)
      .catch(() => setStatus({ connected: false, email: null, archives: [] }));
  }, []);

  async function disconnect() {
    if (!confirm("Déconnecter Google Drive ? Les fichiers resteront dans Drive, mais ne seront plus accessibles depuis Mohasib.")) return;
    setDisconnecting(true);
    try {
      const response = await fetch("/api/oauth/google-drive/disconnect", { method: "POST" });
      if (!response.ok) throw new Error();
      setStatus({ connected: false, email: null, archives: [] });
      toast.success("Google Drive déconnecté");
    } catch {
      toast.error("Erreur lors de la déconnexion de Google Drive");
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#F8FAFC] flex items-center justify-center">
            <GoogleDriveIcon size={20} />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-[#1A1A2E]">Google Drive</div>
            {status ? (
              <StatusBadge connected={status.connected} email={status.email} />
            ) : (
              <span className="text-[11px] text-[#9CA3AF]">Vérification…</span>
            )}
          </div>
        </div>

        {status?.connected ? (
          <button
            onClick={disconnect}
            disabled={disconnecting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] text-[#DC2626] border border-[rgba(220,38,38,0.2)] rounded-lg hover:bg-[#FEF2F2] disabled:opacity-50"
          >
            {disconnecting ? <Loader2 size={11} className="animate-spin" /> : <Unplug size={11} />}
            Déconnecter
          </button>
        ) : (
          <a
            href="/api/oauth/google-drive/connect"
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-medium text-white bg-[#1A1A2E] rounded-lg hover:bg-[#0D1526]"
          >
            <GoogleDriveIcon size={12} />
            Connecter Drive
          </a>
        )}
      </div>
      <p className="mt-3 pt-2.5 border-t border-[rgba(0,0,0,0.05)] text-[11px] text-[#6B7280]">
        Créez plusieurs archives dans Mohasib. Chaque archive correspond à un dossier privé dans votre Google Drive.
        {status?.connected ? ` ${status.archives.length} archive(s) configurée(s).` : ""}
      </p>
    </div>
  );
}

function EmailProviderCard({
  name, icon, connected, email, lastSync, importCount,
  connectHref, onDisconnect, onSync, disconnectLoading, syncLoading,
}: {
  name: string;
  icon: React.ReactNode;
  connected: boolean;
  email?: string | null;
  lastSync?: string | null;
  importCount?: number | null;
  connectHref: string;
  onDisconnect: () => void;
  onSync: () => void;
  disconnectLoading: boolean;
  syncLoading: boolean;
}) {
  return (
    <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 flex items-center justify-center">{icon}</div>
          <div>
            <div className="text-[13px] font-semibold text-[#1A1A2E]">{name}</div>
            <StatusBadge connected={connected} email={email} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {connected ? (
            <>
              <button
                onClick={onSync}
                disabled={syncLoading}
                title="Synchroniser maintenant"
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] text-[#6B7280] border border-[rgba(0,0,0,0.1)] rounded-lg hover:bg-[#F9F9F6] transition-colors disabled:opacity-50"
              >
                {syncLoading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                Synchroniser
              </button>
              <button
                onClick={onDisconnect}
                disabled={disconnectLoading}
                title="Déconnecter"
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] text-[#DC2626] border border-[rgba(220,38,38,0.2)] rounded-lg hover:bg-[#FEF2F2] transition-colors disabled:opacity-50"
              >
                {disconnectLoading ? <Loader2 size={11} className="animate-spin" /> : <Unplug size={11} />}
                Déconnecter
              </button>
            </>
          ) : (
            <a
              href={connectHref}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-medium text-white bg-[#1A1A2E] rounded-lg hover:bg-[#0D1526] transition-colors"
            >
              <Mail size={11} />
              Connecter {name}
            </a>
          )}
        </div>
      </div>

      {connected && (
        <div className="flex gap-5 pt-2.5 border-t border-[rgba(0,0,0,0.05)] text-[11px] text-[#6B7280]">
          <span>Dernière sync : <span className="text-[#374151]">{fmtRelative(lastSync)}</span></span>
          <span>
            Ce mois :{" "}
            <span className="text-[#374151] font-medium">
              {importCount ?? 0} facture(s) importée(s)
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

function GmailIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M20 4H4C2.897 4 2 4.897 2 6v12c0 1.103.897 2 2 2h16c1.103 0 2-.897 2-2V6c0-1.103-.897-2-2-2z" fill="#fff" stroke="#E5E7EB"/>
      <path d="M2 6l10 7L22 6" stroke="#EA4335" strokeWidth="1.5" fill="none"/>
      <path d="M2 6v12h20V6L12 13 2 6z" fill="#fff"/>
      <path d="M2 6l10 7 10-7" fill="none" stroke="#EA4335" strokeWidth="1.5"/>
    </svg>
  );
}

function OutlookIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="4" width="20" height="16" rx="2" fill="#0078D4"/>
      <rect x="8" y="4" width="14" height="16" rx="1" fill="#0078D4"/>
      <path d="M8 4h12a2 2 0 012 2v12a2 2 0 01-2 2H8V4z" fill="#28A8E0"/>
      <path d="M8 4l6 8 8-5" stroke="white" strokeWidth="1.2" fill="none"/>
      <circle cx="6" cy="12" r="3.5" fill="white"/>
      <text x="6" y="14" textAnchor="middle" fontSize="5" fill="#0078D4" fontWeight="bold">O</text>
    </svg>
  );
}
