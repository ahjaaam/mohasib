type SupabaseLike = {
  from: (table: string) => any;
};

function currentYear() {
  return new Date().getFullYear();
}

function normalizedPrefix(prefix: string) {
  return prefix.trim().replace(/-+$/, "") || "FAC";
}

function sequenceFromNumber(value: string | null | undefined, prefix: string, year: number) {
  const escapedPrefix = normalizedPrefix(prefix).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(value ?? "").match(new RegExp(`^${escapedPrefix}-${year}-(\\d+)$`, "i"));
  return match ? Number.parseInt(match[1] ?? "0", 10) || 0 : 0;
}

export async function getInvoiceNumberPrefix(
  supabase: SupabaseLike,
  { userId, dossierId }: { userId: string; dossierId?: string | null },
) {
  const table = dossierId ? "dossiers" : "companies";
  const scopeId = dossierId ?? userId;
  const scopeColumn = dossierId ? "id" : "user_id";
  const { data } = await supabase.from(table).select("invoice_prefix").eq(scopeColumn, scopeId).maybeSingle();
  return normalizedPrefix(data?.invoice_prefix || "F-");
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
    prefix: string;
    userId: string;
    dossierId?: string | null;
    year?: number;
  },
) {
  const normalized = normalizedPrefix(prefix);
  const { data } = await scopedInvoiceQuery(supabase, userId, dossierId)
    .ilike("invoice_number", `${normalized}-${year}-%`)
    .range(0, 9999);

  const max = (data ?? []).reduce((highest: number, row: { invoice_number?: string | null }) => {
    return Math.max(highest, sequenceFromNumber(row.invoice_number, normalized, year));
  }, 0);

  return `${normalized}-${year}-${String(max + 1).padStart(4, "0")}`;
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
    prefix: string;
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
