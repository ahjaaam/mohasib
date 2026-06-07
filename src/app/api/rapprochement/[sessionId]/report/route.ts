import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [{ data: session }, { data: lignes }, { data: profile }] = await Promise.all([
      supabase.from("rapprochement_sessions").select("*").eq("id", sessionId).single(),
      supabase.from("rapprochement_lignes").select("*").eq("session_id", sessionId).order("bank_date"),
      supabase.from("users").select("full_name, company").eq("id", user.id).single(),
    ]);

    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Proces-verbal de Rapprochement Bancaire", 14, 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Societe: ${profile?.company || "-"}`, 14, 27);
    doc.text(`Periode: ${session.periode_debut} au ${session.periode_fin}`, 14, 33);

    autoTable(doc, {
      startY: 42,
      head: [["Balances", "Montant"]],
      body: [
        ["Solde initial releve", `${Number(session.solde_initial_banque ?? 0).toFixed(2)} MAD`],
        ["Solde final releve", `${Number(session.solde_final_banque ?? 0).toFixed(2)} MAD`],
        ["Solde comptable", `${Number(session.solde_final_comptable ?? 0).toFixed(2)} MAD`],
        ["Ecart", `${Number(session.ecart ?? 0).toFixed(2)} MAD`],
      ],
      headStyles: { fillColor: [13, 21, 38] },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [["Date", "Description", "Montant", "Ecriture", "Statut"]],
      body: (lignes ?? []).map((line: any) => [
        line.bank_date || "",
        line.bank_description || "",
        `${Number(line.bank_amount ?? 0).toFixed(2)} MAD`,
        line.ecriture_id || "-",
        line.statut || "",
      ]),
      headStyles: { fillColor: [13, 21, 38] },
      styles: { fontSize: 8 },
    });

    const finalY = Math.min(((doc as any).lastAutoTable?.finalY ?? 220) + 16, 260);
    doc.text(`Etabli par: ${profile?.full_name || user.email || "-"}`, 14, finalY);
    doc.text(`Date: ${new Date().toLocaleDateString("fr-FR")}`, 14, finalY + 6);
    doc.text("Signature: ____________________", 14, finalY + 16);
    doc.setFontSize(8);
    doc.text("Genere via Mohasib AI - mohasibai.com", 14, 287);

    return new NextResponse(Buffer.from(doc.output("arraybuffer")), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="rapprochement-${sessionId}.pdf"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
