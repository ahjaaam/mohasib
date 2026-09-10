export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserAccessProfile } from "@/lib/team";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import DossierSettingsClient from "./DossierSettingsClient";

export default async function DossierSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const access = await getUserAccessProfile(user.id);
  const isClientPortal = access.roleName === "client_portal";
  const ownerId = await resolveAccountOwnerId(user.id);

  const [profileRes, prefsRes, dossierRes] = await Promise.all([
    supabase.from("users").select("*").eq("id", user.id).single(),
    supabase.from("user_preferences").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("dossiers")
          .select(`
            raison_sociale,
            gmail_token_encrypted, gmail_email, gmail_last_sync, gmail_import_count,
            outlook_token_encrypted, outlook_email, outlook_last_sync, outlook_import_count,
            logo_url, address, city, postal_code, bank_name, rib,
            invoice_prefix, invoice_payment_delay, invoice_mentions_legales, invoice_color,
            accounting_settings
          `)
          .eq("id", id)
          .maybeSingle(),
  ]);

  return (
    <DossierSettingsClient
      dossierId={id}
      dossierName={dossierRes.data?.raison_sociale ?? "Ce dossier"}
      userId={user.id}
      ownerId={ownerId}
      userEmail={user.email ?? ""}
      profile={profileRes.data ?? {}}
      prefs={prefsRes.data ?? {}}
      mailbox={dossierRes.data ?? {}}
      invoiceBranding={dossierRes.data ?? {}}
      accountingSettings={dossierRes.data?.accounting_settings ?? null}
      isClientPortal={isClientPortal}
    />
  );
}
