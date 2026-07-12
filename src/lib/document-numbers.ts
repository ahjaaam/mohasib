type SupabaseLike = {
  from: (table: string) => any;
};

function currentYear() {
  return new Date().getFullYear();
}

function sequenceFromNumber(value: string | null | undefined, prefix: string, year: number) {
  const match = String(value ?? "").match(new RegExp(`^${prefix}-${year}-(\\d+)$`, "i"));
  return match ? Number.parseInt(match[1] ?? "0", 10) || 0 : 0;
}

function scopedInvoiceQuery(supabase: SupabaseLike, userId: string, dossierId?: string | null) {
  const query = supabase.from("invoices").select("invoice_number");
  return dossierId
    ? query.eq("dossier_id", dossierId)
    : query.eq("user_id", userId).is("dossier_id", null);
}

export async function getNextInvoiceDocumentNumber(
  supabase: SupabaseLike,
  {
    prefix,
    userId,
    dossierId,
    year = currentYear(),
  }: {
    prefix: "FAC" | "DEV" | "AV";
    userId: string;
    dossierId?: string | null;
    year?: number;
  },
) {
  const { data } = await scopedInvoiceQuery(supabase, userId, dossierId)
    .ilike("invoice_number", `${prefix}-${year}-%`)
    .range(0, 9999);

  const max = (data ?? []).reduce((highest: number, row: { invoice_number?: string | null }) => {
    return Math.max(highest, sequenceFromNumber(row.invoice_number, prefix, year));
  }, 0);

  return `${prefix}-${year}-${String(max + 1).padStart(4, "0")}`;
}

export async function invoiceDocumentNumberExists(
  supabase: SupabaseLike,
  {
    invoiceNumber,
    userId,
    dossierId,
  }: {
    invoiceNumber: string;
    userId: string;
    dossierId?: string | null;
  },
) {
  const { data } = await scopedInvoiceQuery(supabase, userId, dossierId)
    .eq("invoice_number", invoiceNumber)
    .limit(1);

  return (data ?? []).length > 0;
}

export async function getAvailableInvoiceDocumentNumber(
  supabase: SupabaseLike,
  {
    preferredNumber,
    prefix,
    userId,
    dossierId,
  }: {
    preferredNumber: string;
    prefix: "FAC" | "DEV" | "AV";
    userId: string;
    dossierId?: string | null;
  },
) {
  const trimmed = preferredNumber.trim();
  if (trimmed && !(await invoiceDocumentNumberExists(supabase, { invoiceNumber: trimmed, userId, dossierId }))) {
    return trimmed;
  }

  return getNextInvoiceDocumentNumber(supabase, { prefix, userId, dossierId });
}

