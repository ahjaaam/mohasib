import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PDF_MAX_PAGES = 8;
const CSV_MAX_ROWS = 200;
const TOKENS_PER_PAGE = 2000;
const HAIKU_COST_PER_M = 0.80; // USD per million input tokens
const MAD_PER_USD = 10;

function countPDFPages(buffer: Buffer): number {
  const str = buffer.toString("latin1");
  // Highest /Count value in the page tree = total pages
  const countMatches = [...str.matchAll(/\/Count\s+(\d+)/g)];
  if (countMatches.length > 0) {
    return Math.max(...countMatches.map((m) => parseInt(m[1], 10)));
  }
  // Fallback: count /Type /Page objects (not /Pages catalog)
  const pageMatches = str.match(/\/Type\s*\/Page[^s]/g);
  return pageMatches?.length ?? 1;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const isPDF = file.type === "application/pdf";
  const isCSV = file.type === "text/csv" || file.type === "application/vnd.ms-excel"
    || file.type === "application/csv" || file.name.toLowerCase().endsWith(".csv");
  const isImage = ["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(file.type);

  // Image: always 1 page
  if (isImage) {
    return NextResponse.json({
      type: "image",
      pages: 1,
      estimatedTransactions: 25,
      withinLimits: true,
      estimatedCostMAD: "< 0,01",
      chunked: false,
      chunkCount: 1,
    });
  }

  // CSV: count rows
  if (isCSV) {
    const text = await file.text();
    const dataRows = Math.max(text.split("\n").filter((l) => l.trim()).length - 1, 0);

    if (dataRows > CSV_MAX_ROWS) {
      return NextResponse.json({
        type: "csv",
        rows: dataRows,
        withinLimits: false,
        error: "too_large",
        message: `Ce fichier contient ${dataRows.toLocaleString("fr-MA")} lignes. Maximum recommandé : ${CSV_MAX_ROWS.toLocaleString("fr-MA")} lignes par import.`,
      });
    }

    return NextResponse.json({
      type: "csv",
      rows: dataRows,
      estimatedTransactions: dataRows,
      withinLimits: true,
      estimatedCostMAD: "< 0,01",
      chunked: false,
      chunkCount: 1,
    });
  }

  // PDF: count pages
  if (isPDF) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const pages = countPDFPages(buffer);
    const estimatedTransactions = Math.round(pages * 8);
    const costUSD = (pages * TOKENS_PER_PAGE / 1_000_000) * HAIKU_COST_PER_M;
    const costMAD = costUSD * MAD_PER_USD;
    const estimatedCostMAD = costMAD < 0.01 ? "< 0,01" : costMAD.toFixed(2);

    if (pages > PDF_MAX_PAGES) {
      return NextResponse.json({
        type: "pdf",
        pages,
        withinLimits: false,
        error: "too_large",
        message: `Ce relevé contient ${pages} pages. Maximum recommandé : ${PDF_MAX_PAGES} pages par import. Importez par trimestre plutôt qu'à l'annuel.`,
      });
    }

    const chunked = pages > 20;
    const chunkCount = chunked ? Math.ceil(pages / 15) : 1;

    return NextResponse.json({
      type: "pdf",
      pages,
      estimatedTransactions,
      withinLimits: true,
      estimatedCostMAD,
      chunked,
      chunkCount,
    });
  }

  return NextResponse.json({ error: "Format non supporté" }, { status: 400 });
}
