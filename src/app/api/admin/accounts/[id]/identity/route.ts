import { NextResponse } from "next/server";
import { requireAdminApi, logAdminAudit } from "@/lib/admin-api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, admin, response } = await requireAdminApi();
  if (response) return response;
  const body = await request.json();
  const { data: company } = await admin!.from("companies").select("raison_sociale,email,phone,ice,if_number,city").eq("id", id).maybeSingle();
  if (!company) return NextResponse.json({ message: "Compte introuvable." }, { status: 404 });
  const values = {
    raison_sociale: String(body.raison_sociale ?? "").trim(),
    email: String(body.email ?? "").trim().toLowerCase() || null,
    phone: String(body.phone ?? "").trim() || null,
    ice: String(body.ice ?? "").trim() || null,
    if_number: String(body.if_number ?? "").trim() || null,
    city: String(body.city ?? "").trim() || null,
  };
  if (!values.raison_sociale) return NextResponse.json({ message: "La raison sociale est obligatoire." }, { status: 400 });
  const result = await admin!.from("companies").update(values).eq("id", id);
  if (result.error) return NextResponse.json({ message: result.error.message }, { status: 400 });
  await logAdminAudit({ adminEmail: user!.email!, action: "ACCOUNT_IDENTITY", entityType: "company", entityId: id, entityLabel: values.raison_sociale, companyId: id, oldValues: company, newValues: values });
  return NextResponse.json({ ok: true });
}
