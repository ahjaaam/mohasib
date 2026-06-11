import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectivePermissions } from "@/lib/rbac";

export type TeamContext = {
  companyId: string;
  ownerId: string;
  ownerEmail: string | null;
  ownerName: string;
  accountName: string;
  plan: string;
  track: "business" | "comptable";
};

export async function resolveTeamContext(userId: string): Promise<TeamContext | null> {
  const admin = createAdminClient();

  let { data: company } = await admin
    .from("companies")
    .select("id,user_id,raison_sociale,user_type,plan")
    .eq("user_id", userId)
    .maybeSingle();

  if (!company) {
    const { data: membership } = await admin
      .from("user_memberships")
      .select("company_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .not("company_id", "is", null)
      .limit(1)
      .maybeSingle();
    if (membership?.company_id) {
      const result = await admin
        .from("companies")
        .select("id,user_id,raison_sociale,user_type,plan")
        .eq("id", membership.company_id)
        .maybeSingle();
      company = result.data;
    }
  }

  if (!company) return null;

  const [{ data: owner }, { data: cabinet }] = await Promise.all([
    admin.from("users").select("full_name,email,company").eq("id", company.user_id).maybeSingle(),
    admin.from("cabinets").select("nom_cabinet").eq("user_id", company.user_id).maybeSingle(),
  ]);

  const track = company.user_type === "fiduciaire" ? "comptable" : "business";
  return {
    companyId: company.id,
    ownerId: company.user_id,
    ownerEmail: owner?.email ?? null,
    ownerName: owner?.full_name || owner?.email || "Le propriétaire",
    accountName: track === "comptable"
      ? cabinet?.nom_cabinet || owner?.company || company.raison_sociale || "Votre cabinet"
      : company.raison_sociale || owner?.company || "Votre entreprise",
    plan: company.plan ?? "trial",
    track,
  };
}

export const ROLE_LABELS: Record<string, string> = {
  owner: "Propriétaire",
  cabinet_owner: "Propriétaire",
  manager: "Responsable",
  employee: "Responsable",
  collaborateur: "Responsable",
  read_auditor: "Responsable",
};

export async function getUserAccessProfile(userId: string) {
  const admin = createAdminClient();
  const [{ data: company }, { data: cabinet }] = await Promise.all([
    admin.from("companies").select("id").eq("user_id", userId).maybeSingle(),
    admin.from("cabinets").select("id").eq("user_id", userId).maybeSingle(),
  ]);
  if (company || cabinet) return { isOwner: true, roleLabel: "Propriétaire", permissions: null, dossierScope: null };

  const { data: membership } = await admin.from("user_memberships")
    .select("id,role_name,dossier_scope,status")
    .eq("user_id", userId).eq("status", "active").limit(1).maybeSingle();
  if (!membership) return { isOwner: false, roleLabel: "Accès restreint", permissions: [], dossierScope: [] };
  return {
    isOwner: false,
    roleLabel: ROLE_LABELS[membership.role_name] ?? membership.role_name,
    permissions: (await getEffectivePermissions(membership.id)).map(permission => `${permission.resource}:${permission.action}`),
    dossierScope: membership.dossier_scope as string[] | null,
  };
}
