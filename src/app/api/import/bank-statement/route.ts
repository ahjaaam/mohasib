import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 120; // 2 min — PDF extraction can take time

const anthropic = new Anthropic();

const CATEGORIES_INCOME = ["Ventes", "Services", "Remboursement", "Autre revenu"];
const CATEGORIES_EXPENSE = [
  "Achats", "Salaires", "Loyer", "Fournitures",
  "Transport", "Communication", "Fiscalité", "Banque", "Autre dépense",
];

function normalizeDate(d: string | null | undefined): string {
  if (!d) return new Date().toISOString().split("T")[0];
  // DD/MM/YYYY → YYYY-MM-DD
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) {
    const [dd, mm, yyyy] = d.split("/");
    return `${yyyy}-${mm}-${dd}`;
  }
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  // Try generic parse
  const parsed = new Date(d);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];
  return new Date().toISOString().split("T")[0];
}

function normalizeCategory(cat: string | null | undefined, amount: number): string {
  const all = [...CATEGORIES_INCOME, ...CATEGORIES_EXPENSE];
  if (cat && all.includes(cat)) return cat;
  return amount >= 0 ? "Autre revenu" : "Autre dépense";
}

const EXTRACTION_PROMPT = `You are a Moroccan bank statement parser. Extract ALL transactions from this bank statement.

Return a JSON object with EXACTLY this structure (no markdown, no extra text):
{
  "period": "Month Year in French e.g. Mars 2025",
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "exact description from statement",
      "amount": -1500.00,
      "category": "category string",
      "reference": "ref number or null"
    }
  ]
}

RULES:
- Debits / money out → NEGATIVE numbers (e.g. -1500.00)
- Credits / money in → POSITIVE numbers (e.g. 5000.00)
- Convert all dates to YYYY-MM-DD format
- Copy description exactly as shown in the statement
- Include ALL transactions — do not skip any
- For "category" choose the best match:
  * Positive amounts: Ventes, Services, Remboursement, Autre revenu
  * Negative amounts: Achats, Salaires, Loyer, Fournitures, Transport, Communication, Fiscalité, Banque, Autre dépense
- Return ONLY the JSON object — no markdown fences, no explanation`;

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
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Fichier trop volumineux. Maximum 10MB." },
      { status: 400 }
    );
  }

  const isPDF = file.type === "application/pdf";
  const isImage = ["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(file.type);

  if (!isPDF && !isImage) {
    return NextResponse.json(
      { error: "Format non supporté. Utilisez PDF, JPG ou PNG." },
      { status: 400 }
    );
  }

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");

  // Build Claude content block
  let contentBlock: Anthropic.MessageParam["content"][number];
  if (isPDF) {
    contentBlock = {
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: base64,
      },
    } as any; // SDK type is correct, `as any` avoids version mismatch
  } else {
    const mimeType = (file.type === "image/jpg" ? "image/jpeg" : file.type) as
      | "image/jpeg"
      | "image/png"
      | "image/webp";
    contentBlock = {
      type: "image",
      source: { type: "base64", media_type: mimeType, data: base64 },
    };
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: [contentBlock, { type: "text", text: EXTRACTION_PROMPT }],
        },
      ],
    });

    const rawText =
      message.content[0].type === "text" ? message.content[0].text.trim() : "";

    // Strip accidental markdown fences
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    let parsed: { period?: string; transactions?: any[] };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        {
          error:
            "Aucune transaction détectée. Vérifiez que le document est bien un relevé bancaire.",
        },
        { status: 422 }
      );
    }

    const rawTxs: any[] = parsed.transactions ?? [];

    if (rawTxs.length === 0) {
      return NextResponse.json(
        {
          error:
            "Aucune transaction détectée. Vérifiez que le document est bien un relevé bancaire.",
        },
        { status: 422 }
      );
    }

    // Normalize each transaction
    const transactions = rawTxs.map((t) => ({
      date: normalizeDate(t.date),
      description: String(t.description ?? "").trim() || "Transaction",
      amount: Number(t.amount ?? 0),
      category: normalizeCategory(t.category, Number(t.amount ?? 0)),
      reference: t.reference ? String(t.reference).trim() : null,
    }));

    return NextResponse.json({
      transactions,
      period: parsed.period ?? null,
      count: transactions.length,
    });
  } catch (err: any) {
    console.error("[bank-statement]", err);
    const msg = err?.message ?? "";
    if (msg.toLowerCase().includes("password") || msg.toLowerCase().includes("encrypt")) {
      return NextResponse.json(
        {
          error:
            "Ce PDF est protégé par un mot de passe. Téléchargez une version sans protection depuis votre banque.",
        },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { error: "Erreur d'analyse. Réessayez ou importez manuellement." },
      { status: 500 }
    );
  }
}
