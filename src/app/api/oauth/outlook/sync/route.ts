import { NextRequest, NextResponse } from "next/server";
import { getCurrentCompanyId, getCurrentUserForDossier } from "@/lib/email-oauth";
import { syncCompanyEmail, syncDossierEmail } from "@/lib/email-sync";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const dossierId = typeof body.dossierId === "string" ? body.dossierId : null;

  try {
    if (dossierId) {
      const user = await getCurrentUserForDossier(dossierId);
      if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      return NextResponse.json(await syncDossierEmail("outlook", dossierId));
    }

    const { companyId } = await getCurrentCompanyId();
    if (!companyId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.json(await syncCompanyEmail("outlook", companyId));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur de synchronisation Outlook." },
      { status: 400 },
    );
  }
}
