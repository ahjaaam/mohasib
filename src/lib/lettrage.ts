// Automatic lettrage (matching) of debit/credit entries on the same account

// ── Letter code helpers ───────────────────────────────────────────────────────

export function incrementLetterCode(code: string): string {
  const chars = code.split("");
  let i = chars.length - 1;
  while (i >= 0) {
    if (chars[i] < "Z") {
      chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
      return chars.join("");
    }
    chars[i] = "A";
    i--;
  }
  return "A" + chars.join("");
}

async function getNextLetterCode(
  supabase: any,
  compte: string,
  companyId?: string | null,
  dossierId?: string | null,
): Promise<string> {
  let q = supabase
    .from("ecritures_comptables")
    .select("lettre")
    .eq("compte", compte)
    .not("lettre", "is", null)
    .order("lettre_date", { ascending: false })
    .limit(1);

  if (dossierId) q = q.eq("dossier_id", dossierId);
  else if (companyId) q = q.eq("company_id", companyId);

  const { data } = await q.single();
  if (!data?.lettre) return "A";
  return incrementLetterCode(data.lettre);
}

// ── Core matching logic ───────────────────────────────────────────────────────

async function letterAccount(
  supabase: any,
  compte: string,
  companyId?: string | null,
  dossierId?: string | null,
) {
  let q = supabase
    .from("ecritures_comptables")
    .select("id, debit, credit, source_type, source_id, is_lettered")
    .eq("compte", compte)
    .eq("is_lettered", false)
    .order("date_ecriture", { ascending: true });

  if (dossierId) q = q.eq("dossier_id", dossierId);
  else if (companyId) q = q.eq("company_id", companyId);

  const { data: entries } = await q;
  if (!entries || entries.length === 0) return;

  const debits  = entries.filter((e: any) => Number(e.debit)  > 0);
  const credits = entries.filter((e: any) => Number(e.credit) > 0);

  let letterCode = await getNextLetterCode(supabase, compte, companyId, dossierId);

  const letteredIds = new Set<string>();

  for (const debit of debits) {
    if (letteredIds.has(debit.id)) continue;

    for (const credit of credits) {
      if (letteredIds.has(credit.id)) continue;

      const diff = Math.abs(Number(debit.debit) - Number(credit.credit));
      if (diff < 0.01) {
        // Match found — letter both
        const today = new Date().toISOString().split("T")[0];
        await supabase
          .from("ecritures_comptables")
          .update({ lettre: letterCode, lettre_date: today, is_lettered: true })
          .in("id", [debit.id, credit.id]);

        letteredIds.add(debit.id);
        letteredIds.add(credit.id);

        // Mark linked invoice as paid
        if (debit.source_type === "invoice" && debit.source_id) {
          await supabase
            .from("invoices")
            .update({ status: "paid", paid_at: new Date().toISOString() })
            .eq("id", debit.source_id)
            .eq("status", "sent"); // only upgrade sent invoices
        }

        letterCode = incrementLetterCode(letterCode);
        break;
      }
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function autoLettrage(
  supabase: any,
  companyId?: string | null,
  dossierId?: string | null,
) {
  // Lettrage applies mainly to receivables (3421) and payables (4411)
  for (const compte of ["3421", "4411"]) {
    await letterAccount(supabase, compte, companyId, dossierId);
  }
}

// Manually letter two specific entries
export async function manualLettrage(
  supabase: any,
  entryIds: [string, string],
) {
  const { data: entries } = await supabase
    .from("ecritures_comptables")
    .select("id, compte, company_id, dossier_id, debit, credit")
    .in("id", entryIds);

  if (!entries || entries.length !== 2) throw new Error("Entrées introuvables");

  const [a, b] = entries;
  if (a.compte !== b.compte) throw new Error("Les deux entrées doivent être sur le même compte");

  const letterCode = await getNextLetterCode(
    supabase,
    a.compte,
    a.company_id,
    a.dossier_id,
  );
  const today = new Date().toISOString().split("T")[0];

  await supabase
    .from("ecritures_comptables")
    .update({ lettre: letterCode, lettre_date: today, is_lettered: true })
    .in("id", entryIds);
}
