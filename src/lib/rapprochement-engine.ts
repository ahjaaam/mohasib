import stringSimilarity from "string-similarity";

export type BankLine = {
  id?: string;
  date: string;
  description: string;
  amount: number;
  reference?: string | null;
};

export type Ecriture = {
  id: string;
  date_ecriture: string;
  compte: string;
  libelle?: string | null;
  debit?: number | null;
  credit?: number | null;
  transaction_id?: string | null;
  invoice_id?: string | null;
};

export type MatchResult = {
  bankLine: BankLine;
  ecriture: Ecriture | null;
  confidence: number;
  method: "auto" | "suggestion" | "unmatched";
};

function daysBetween(a: string, b: string) {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000;
}

function amountForEcriture(ecriture: Ecriture) {
  return Number(ecriture.debit || ecriture.credit || 0);
}

export async function autoMatch(_sessionId: string, bankLines: BankLine[], ecritures: Ecriture[]): Promise<MatchResult[]> {
  const results: MatchResult[] = [];
  const usedEcritures = new Set<string>();

  for (const bankLine of bankLines) {
    let bestMatch: Ecriture | null = null;
    let bestScore = 0;

    for (const ecriture of ecritures) {
      if (usedEcritures.has(ecriture.id)) continue;
      if (ecriture.compte !== "5141") continue;

      let score = 0;
      const bankAmt = Math.abs(Number(bankLine.amount));
      const ecritureAmt = Math.abs(amountForEcriture(ecriture));

      if (Math.abs(bankAmt - ecritureAmt) < 0.01) {
        score += 40;
      } else if (bankAmt > 0 && Math.abs(bankAmt - ecritureAmt) / bankAmt < 0.01) {
        score += 25;
      }

      const diff = daysBetween(bankLine.date, ecriture.date_ecriture);
      if (diff === 0) score += 30;
      else if (diff <= 2) score += 20;
      else if (diff <= 5) score += 10;

      const similarity = stringSimilarity.compareTwoStrings(
        (bankLine.description || "").toLowerCase(),
        (ecriture.libelle || "").toLowerCase(),
      );
      score += similarity * 20;

      const bankIsCredit = Number(bankLine.amount) > 0;
      const ecritureIsDebit = Number(ecriture.debit || 0) > 0;
      if (bankIsCredit === ecritureIsDebit) score += 10;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = ecriture;
      }
    }

    if (bestMatch && bestScore >= 70) {
      const method = bestScore >= 90 ? "auto" : "suggestion";
      results.push({ bankLine, ecriture: bestMatch, confidence: bestScore / 100, method });
      if (method === "auto") usedEcritures.add(bestMatch.id);
    } else {
      results.push({ bankLine, ecriture: null, confidence: 0, method: "unmatched" });
    }
  }

  return results;
}
