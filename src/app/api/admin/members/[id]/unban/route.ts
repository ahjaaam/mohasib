import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { logAdminAudit, requireAdminApi } from "@/lib/admin-api";

async function findAuthUser(admin: NonNullable<Awaited<ReturnType<typeof requireAdminApi>>["admin"]>, userId?: string | null, email?: string | null) {
  if (userId) {
    const result = await admin.auth.admin.getUserById(userId);
    if (result.data.user) return result.data.user;
  }

  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) return null;
  for (let page = 1; page <= 10; page += 1) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    const match = result.data.users.find(user => user.email?.toLowerCase() === normalizedEmail);
    if (match) return match;
    if (result.data.users.length < 1000) break;
  }
  return null;
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, admin, response } = await requireAdminApi();
  if (response) return response;

  const { data: member } = await admin!.from("user_memberships").select("*").eq("id", id).maybeSingle();
  if (!member) return NextResponse.json({ message: "Collaborateur introuvable." }, { status: 404 });

  const authUser = await findAuthUser(admin!, member.user_id, member.user_email) as User | null;
  if (!authUser) {
    return NextResponse.json({ message: "Aucun utilisateur Supabase Auth ne correspond à cette adresse e-mail." }, { status: 404 });
  }

  const unban = await admin!.auth.admin.updateUserById(authUser.id, { ban_duration: "none" });
  if (unban.error) return NextResponse.json({ message: `Déblocage Auth impossible : ${unban.error.message}` }, { status: 400 });

  const verified = await admin!.auth.admin.getUserById(authUser.id);
  const bannedUntil = verified.data.user?.banned_until;
  if (bannedUntil && new Date(bannedUntil) > new Date()) {
    return NextResponse.json({ message: `Supabase indique encore un blocage jusqu'au ${bannedUntil}.` }, { status: 409 });
  }

  const membershipUpdate = await admin!.from("user_memberships").update({
    user_id: authUser.id,
    status: "active",
  }).eq("id", id);
  if (membershipUpdate.error) return NextResponse.json({ message: membershipUpdate.error.message }, { status: 400 });

  await logAdminAudit({
    adminEmail: user!.email!,
    action: "MEMBER_AUTH_UNBAN",
    entityType: "user_membership",
    entityId: id,
    entityLabel: member.user_email,
    companyId: member.company_id,
    oldValues: { status: member.status, user_id: member.user_id, banned_until: authUser.banned_until ?? null },
    newValues: { status: "active", user_id: authUser.id, banned_until: null },
  });

  return NextResponse.json({ ok: true, message: "Le compte Auth est débloqué." });
}
