import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api";

export async function POST() {
  const { response } = await requireAdminApi();
  if (response) return response;
  return NextResponse.json({
    message: "Les anciens packages ont été retirés. Utilisez la configuration tarifaire Entreprise/Cabinet du compte.",
  }, { status: 410 });
}
