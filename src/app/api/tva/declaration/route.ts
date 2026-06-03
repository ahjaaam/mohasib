import { NextRequest, NextResponse } from "next/server";

function safeFilenamePart(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "periode";
}

function asNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function buildPdfPayload(body: any) {
  const totalNette = asNumber(body.totalNette);
  const collectee = Array.isArray(body.collectee) ? body.collectee : [];
  const deductible = Array.isArray(body.deductible) ? body.deductible : [];

  return {
    company: {
      name: body.company?.raison_sociale ?? "",
      ice: body.company?.ice ?? "—",
      rc: body.company?.rc ?? "—",
      if_: body.company?.if_number ?? "—",
      address: body.company?.address ?? "",
      city: body.company?.city ?? "",
    },
    period: body.periodLabel ?? "",
    statut: "brouillon",
    deposited_at: "",
    sections: {
      A: {
        tva_facturee: asNumber(body.totalCollectee),
        detail: collectee.map((row: any) => ({
          taux_tva: `${row.rate ?? 0}%`,
          base_ht: asNumber(row.baseHT),
          coefficient: Number(row.rate ?? 0) / 100,
          tva_due: asNumber(row.tvaAmount),
        })),
      },
      B: {
        tva_recuperable: asNumber(body.totalDeductible),
        detail: deductible.map((row: any) => ({
          nature: row.category ?? "Achats",
          montant_ht: asNumber(row.baseHT),
          tva_deduite: asNumber(row.tvaAmount),
        })),
      },
      C: { net_a_payer: Math.max(totalNette, 0) },
      D: { credit_reporte: totalNette < 0 ? Math.abs(totalNette) : 0 },
      E: { acomptes: 0 },
      F: { solde: totalNette },
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const serviceUrl = process.env.PDF_SERVICE_URL;
    const secret = process.env.PDF_SECRET;

    if (!serviceUrl || !secret) {
      return NextResponse.json(
        { error: "PDF service is not configured. Set PDF_SERVICE_URL and PDF_SECRET." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const data = buildPdfPayload(body);

    const res = await fetch(`${serviceUrl.replace(/\/$/, "")}/pdf/tva`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: secret.trim(), data }),
    });

    if (!res.ok) {
      let detail = `PDF service failed with status ${res.status}`;
      try {
        const errorBody = await res.json();
        detail = errorBody.detail ?? errorBody.error ?? detail;
      } catch {
        const text = await res.text().catch(() => "");
        if (text) detail = text;
      }
      return NextResponse.json({ error: detail }, { status: 502 });
    }

    const pdfBytes = await res.arrayBuffer();
    const period = safeFilenamePart(body.periodLabel ?? data.period ?? "");

    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="TVA_${period}.pdf"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
