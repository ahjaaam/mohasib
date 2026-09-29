import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { classifyDocumentBeforeOcr } from "@/lib/ocr-engine";

const MAX_SIZE = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const SPREADSHEET_EXTENSIONS = [".csv", ".xls", ".xlsx"];

function isSpreadsheet(file: File) {
  const name = file.name.toLowerCase();
  return SPREADSHEET_EXTENSIONS.some(extension => name.endsWith(extension));
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Fichier trop volumineux (max 10 MB)." }, { status: 400 });
  }

  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const spreadsheet = isSpreadsheet(file);
  if (!isPdf && !IMAGE_TYPES.has(file.type) && !spreadsheet) {
    return NextResponse.json({
      error: "Format non supporté. Utilisez PDF, CSV, Excel, JPG, PNG ou WebP.",
    }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  let classificationBuffer = bytes;
  let classificationMime = isPdf ? "application/pdf" : file.type;

  if (spreadsheet) {
    try {
      if (file.name.toLowerCase().endsWith(".csv")) {
        classificationBuffer = bytes;
      } else {
        const workbook = XLSX.read(bytes);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        classificationBuffer = Buffer.from(XLSX.utils.sheet_to_csv(worksheet), "utf8");
      }
      classificationMime = "text/csv";
    } catch {
      return NextResponse.json({ error: "Impossible de lire ce fichier Excel." }, { status: 400 });
    }
  }

  const classification = await classifyDocumentBeforeOcr(classificationBuffer, classificationMime);
  const section = classification.documentType === "receipt"
    ? "expense_notes"
    : classification.section;

  return NextResponse.json({ ...classification, section });
}
