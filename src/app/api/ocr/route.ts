import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    error: "Utilisez le point d’entrée OCR propre à la section Achats ou Notes de frais.",
    code: "section_required",
  }, { status: 410 });
}
