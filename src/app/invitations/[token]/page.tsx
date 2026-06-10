import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLE_LABELS } from "@/lib/team";
import InvitationClient from "./InvitationClient";

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();
  const { data: membership } = await admin.from("user_memberships")
    .select("user_email,role_name,dossier_scope,status,invitation_expires_at,companies(raison_sociale)")
    .eq("invitation_token", token).maybeSingle();

  if (!membership || membership.status !== "invited") {
    return <InvitationState title="Invitation invalide" text="Ce lien n'est plus valide ou a déjà été utilisé." />;
  }
  if (!membership.invitation_expires_at || new Date(membership.invitation_expires_at) < new Date()) {
    return <InvitationState title="Invitation expirée" text="Demandez au propriétaire de vous envoyer un nouveau lien." />;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const company = Array.isArray(membership.companies) ? membership.companies[0] : membership.companies;
  return (
    <InvitationClient
      token={token}
      currentEmail={user?.email ?? null}
      invitation={{
        email: membership.user_email ?? "",
        roleLabel: ROLE_LABELS[membership.role_name] ?? membership.role_name,
        accountName: company?.raison_sociale || "Votre équipe",
        accessLabel: membership.dossier_scope?.length ? `${membership.dossier_scope.length} dossiers` : "Selon les permissions attribuées",
      }}
    />
  );
}

function InvitationState({ title, text }: { title: string; text: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAFAF6] p-5">
      <div className="max-w-md rounded-xl border border-black/[0.08] bg-white p-8 text-center">
        <h1 className="text-xl font-bold text-[#0D1526]">{title}</h1>
        <p className="mt-3 text-sm text-[#6B7280]">{text}</p>
      </div>
    </main>
  );
}
