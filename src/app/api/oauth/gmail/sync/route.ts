import { NextResponse } from "next/server";
import { getCurrentCompanyId } from "@/lib/email-oauth";
import { syncCompanyEmail } from "@/lib/email-sync";

export async function POST() {
  const { companyId } = await getCurrentCompanyId();
  if (!companyId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    return NextResponse.json(await syncCompanyEmail("gmail", companyId));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur de synchronisation Gmail." },
      { status: 400 },
    );
  }
}
