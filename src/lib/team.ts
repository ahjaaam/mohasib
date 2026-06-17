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

  const { data: membership } = await admin
    .from("user_memberships")
    .select("company_id,role_name,access_scope")
    .eq("user_id", userId)
    .eq("status", "active")
    .not("company_id", "is", null)
    .limit(1)
    .maybeSingle();

  let company = null;
  if (membership?.company_id && !["owner", "cabinet_owner"].includes(membership.role_name)) {
    const result = await admin
      .from("companies")
      .select("id,user_id,raison_sociale,user_type,plan")
      .eq("id", membership.company_id)
      .maybeSingle();
    company = result.data;
  }

  if (!company) {
    const result = await admin
      .from("companies")
      .select("id,user_id,raison_sociale,user_type,plan")
      .eq("user_id", userId)
      .maybeSingle();
    company = result.data;
  }

  if (!company) return null;

  const [{ data: owner }, { data: cabinet }] = await Promise.all([
    admin.from("users").select("full_name,email,company").eq("id", company.user_id).maybeSingle(),
    admin.from("cabinets").select("nom_cabinet").eq("user_id", company.user_id).maybeSingle(),
  ]);

  const hasComptablePro =
    company.user_type === "fiduciaire"
    || !!cabinet
    || ["comptable_pro", "comptable_inf"].includes(company.plan ?? "");
  const track = hasComptablePro ? "comptable" : "business";
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
  manager: "Collaborateur",
  employee: "Collaborateur",
  collaborateur: "Collaborateur",
  read_auditor: "Collaborateur",
};

export async function getUserAccessProfile(userId: string) {
  const admin = createAdminClient();
  const { data: membership } = await admin.from("user_memberships")
    .select("id,role_name,dossier_scope,status,access_scope")
    .eq("user_id", userId).eq("status", "active").limit(1).maybeSingle();
  if (membership && !["owner", "cabinet_owner"].includes(membership.role_name)) {
    if (membership.role_name === "manager") {
      return {
        isOwner: false,
        roleLabel: "Collaborateur",
        permissions: (await getEffectivePermissions(membership.id))
          .filter(permission => permission.resource !== "settings")
          .map(permission => `${permission.resource}:${permission.action}`),
        dossierScope: null,
        accessScope: membership.access_scope ?? "both",
      };
    }
    return {
      isOwner: false,
      roleLabel: ROLE_LABELS[membership.role_name] ?? membership.role_name,
      permissions: (await getEffectivePermissions(membership.id)).map(permission => `${permission.resource}:${permission.action}`),
      dossierScope: membership.dossier_scope as string[] | null,
      accessScope: membership.access_scope ?? "both",
    };
  }

  const [{ data: company }, { data: cabinet }] = await Promise.all([
    admin.from("companies").select("id").eq("user_id", userId).maybeSingle(),
    admin.from("cabinets").select("id").eq("user_id", userId).maybeSingle(),
  ]);
  if (company || cabinet) return { isOwner: true, roleLabel: "Propriétaire", permissions: null, dossierScope: null, accessScope: "both" };

  if (!membership) return { isOwner: false, roleLabel: "Accès restreint", permissions: [], dossierScope: [], accessScope: null };
  return {
    isOwner: false,
    roleLabel: ROLE_LABELS[membership.role_name] ?? membership.role_name,
    permissions: (await getEffectivePermissions(membership.id)).map(permission => `${permission.resource}:${permission.action}`),
    dossierScope: membership.dossier_scope as string[] | null,
    accessScope: membership.access_scope ?? "both",
  };
}
