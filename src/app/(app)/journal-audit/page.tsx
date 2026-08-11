import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import AccessRestricted from "@/components/AccessRestricted";
import PageHeader from "@/components/PageHeader";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import { createClient } from "@/lib/supabase/server";
import { getUserAccessProfile } from "@/lib/team";
import AuditLogTab from "../settings/AuditLogTab";

export const metadata: Metadata = {
  title: "Journal d’audit | Mohasib AI",
};

export default async function AuditLogPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const access = await getUserAccessProfile(user.id);
  if (!access.isOwner) return <AccessRestricted backHref="/tableau-de-bord" />;

  const ownerId = await resolveAccountOwnerId(user.id);
  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("user_id", ownerId)
    .single();

  if (!company) {
    return (
      <div className="border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        Impossible de charger le journal d&apos;audit. Rechargez la page ou vérifiez l&apos;accès du compte.
      </div>
    );
  }

  const { data: auditLogs } = await supabase
    .from("audit_logs")
    .select("id, created_at, user_email, action, entity_type, entity_label, success, request_path")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <>
      <PageHeader
        title="Journal d’audit"
        subtitle="Consultez les dernières actions tracées sur votre compte"
        icon={<ScrollText size={18} />}
      />
      <AuditLogTab logs={auditLogs ?? []} hideHeading />
    </>
  );
}
