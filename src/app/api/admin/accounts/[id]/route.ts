import { NextResponse } from "next/server";
import { logAdminAudit, requireAdminApi } from "@/lib/admin-api";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, admin, response } = await requireAdminApi();
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { data: company, error: companyError } = await admin!
    .from("companies")
    .select("id, user_id, raison_sociale")
    .eq("id", id)
    .maybeSingle();

  if (companyError) return NextResponse.json({ message: companyError.message }, { status: 500 });
  if (!company) return NextResponse.json({ message: "Compte introuvable." }, { status: 404 });

  const companyName = company.raison_sociale || "Compte sans nom";
  if (typeof body.confirmation !== "string" || body.confirmation.trim() !== companyName.trim()) {
    return NextResponse.json({ message: "Le nom de confirmation ne correspond pas." }, { status: 400 });
  }

  if (!company.user_id) {
    return NextResponse.json({ message: "Ce compte n’a pas de propriétaire Supabase Auth associé." }, { status: 409 });
  }
  if (company.user_id === user!.id) {
    return NextResponse.json({ message: "Vous ne pouvez pas supprimer votre propre compte administrateur." }, { status: 403 });
  }

  const authUser = await admin!.auth.admin.getUserById(company.user_id);
  if (authUser.error) {
    return NextResponse.json({ message: `Utilisateur Auth introuvable : ${authUser.error.message}` }, { status: 409 });
  }

  const deleted = await admin!.auth.admin.deleteUser(company.user_id);
  if (deleted.error) {
    return NextResponse.json({ message: `Suppression Supabase impossible : ${deleted.error.message}` }, { status: 409 });
  }

  await logAdminAudit({
    adminEmail: user!.email!,
    action: "ACCOUNT_DELETE",
    entityType: "company",
    entityId: company.id,
    entityLabel: companyName,
    oldValues: { owner_id: company.user_id, owner_email: authUser.data.user.email ?? null },
    newValues: { deleted: true },
  });

  return NextResponse.json({ success: true });
}
