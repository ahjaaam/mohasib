export type InvoiceControlSeverity = "info" | "warning" | "critical";

export type InvoiceControlCheck = {
  code: string;
  severity: InvoiceControlSeverity;
  title: string;
  message: string;
  relatedReceiptId?: string;
};

export type InvoiceControlData = {
  document_type?: "invoice" | "receipt" | "purchase_order" | "delivery_note" | "avoir" | "bank_statement" | "other" | null;
  is_supplier_invoice?: boolean | null;
  vendor?: string | null;
  vendor_name?: string | null;
  receipt_number?: string | null;
  invoice_number?: string | null;
  date?: string | null;
  amount?: number | null;
  amount_ht?: number | null;
  amount_ttc?: number | null;
  discount_amount?: number | null;
  tva_amount?: number | null;
  tva_rate?: number | null;
  supplier_ice?: string | null;
  supplier_if?: string | null;
  supplier_rib?: string | null;
  supplier_iban?: string | null;
};

export type PriorSupplierDocument = {
  id: string;
  ocr_data: InvoiceControlData;
  created_at?: string | null;
};

const MOROCCAN_TVA_RATES = new Set([0, 7, 10, 14, 20]);

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function finite(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.abs(parsed) : null;
}

function supplierName(data: InvoiceControlData) {
  return normalize(data.vendor_name ?? data.vendor);
}

function invoiceReference(data: InvoiceControlData) {
  return normalize(data.invoice_number ?? data.receipt_number);
}

function bankIdentity(data: InvoiceControlData) {
  return normalize(data.supplier_iban ?? data.supplier_rib);
}

function amountsMatch(left: unknown, right: unknown, tolerance = 0.5) {
  const a = finite(left);
  const b = finite(right);
  return a != null && b != null && Math.abs(a - b) <= tolerance;
}

export function evaluateInvoiceControls(
  current: InvoiceControlData,
  priorDocuments: PriorSupplierDocument[] = [],
): InvoiceControlCheck[] {
  const checks: InvoiceControlCheck[] = [];
  const documentType = current.document_type ?? null;
  const unsupportedDocumentType = documentType != null
    && !["invoice", "receipt", "avoir"].includes(documentType);
  const outgoingInvoice = documentType === "invoice" && current.is_supplier_invoice === false;
  const supplier = supplierName(current);
  const reference = invoiceReference(current);
  const amount = finite(current.amount_ttc ?? current.amount);
  const rate = finite(current.tva_rate);
  const tax = finite(current.tva_amount);
  const untaxed = finite(current.amount_ht);
  const discount = finite(current.discount_amount) ?? 0;

  if (unsupportedDocumentType || outgoingInvoice) {
    checks.push({
      code: "not_supplier_invoice",
      severity: "critical",
      title: "Document non-facture",
      message: outgoingInvoice
        ? "Ce document semble être une facture émise par votre entreprise, et non une facture fournisseur. Vérifiez-le ou ignorez-le."
        : "Ce document ne semble pas être une facture, un reçu ou un avoir fournisseur. Vérifiez-le ou ignorez-le.",
    });
  }

  if (!supplier) {
    checks.push({
      code: "missing_supplier",
      severity: "warning",
      title: "Fournisseur manquant",
      message: "Vérifiez ou renseignez le nom du fournisseur avant la comptabilisation.",
    });
  }
  if (!reference) {
    checks.push({
      code: "missing_reference",
      severity: "warning",
      title: "Numéro de facture manquant",
      message: "Le numéro de facture est nécessaire pour prévenir les doublons.",
    });
  }
  if (!current.date) {
    checks.push({
      code: "missing_date",
      severity: "warning",
      title: "Date manquante",
      message: "La facture ne contient pas de date exploitable.",
    });
  }
  if (amount == null || amount <= 0) {
    checks.push({
      code: "invalid_amount",
      severity: "critical",
      title: "Montant invalide",
      message: "Le montant TTC doit être supérieur à zéro.",
    });
  }
  if (rate != null && !MOROCCAN_TVA_RATES.has(rate)) {
    checks.push({
      code: "invalid_tva_rate",
      severity: "critical",
      title: "Taux de TVA inhabituel",
      message: `${rate}% ne correspond pas aux taux marocains pris en charge (0, 7, 10, 14 ou 20%).`,
    });
  }
  if (amount != null && untaxed != null && tax != null) {
    const difference = Math.abs(untaxed + tax - discount - amount);
    if (difference > 1) {
      checks.push({
        code: "tva_total_mismatch",
        severity: "critical",
        title: "Totaux incohérents",
        message: discount > 0
          ? `HT + TVA - remise diffère du TTC net de ${difference.toLocaleString("fr-MA", { maximumFractionDigits: 2 })} MAD.`
          : `HT + TVA diffère du TTC de ${difference.toLocaleString("fr-MA", { maximumFractionDigits: 2 })} MAD.`,
      });
    }
  }

  const sameSupplier = priorDocuments.filter(document => supplier && supplierName(document.ocr_data) === supplier);
  const exactDuplicate = sameSupplier.find(document => {
    const priorReference = invoiceReference(document.ocr_data);
    return reference && priorReference === reference;
  });
  if (exactDuplicate) {
    checks.push({
      code: "duplicate_reference",
      severity: "critical",
      title: "Doublon probable",
      message: "Une facture du même fournisseur porte déjà ce numéro.",
      relatedReceiptId: exactDuplicate.id,
    });
  } else {
    const probableDuplicate = sameSupplier.find(document =>
      current.date
      && document.ocr_data.date === current.date
      && amountsMatch(document.ocr_data.amount_ttc ?? document.ocr_data.amount, amount),
    );
    if (probableDuplicate) {
      checks.push({
        code: "duplicate_amount_date",
        severity: "warning",
        title: "Facture similaire détectée",
        message: "Même fournisseur, même date et même montant qu'un document existant.",
        relatedReceiptId: probableDuplicate.id,
      });
    }
  }

  const currentBank = bankIdentity(current);
  if (supplier && currentBank) {
    const previousWithBank = sameSupplier
      .filter(document => bankIdentity(document.ocr_data))
      .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0];
    if (previousWithBank && bankIdentity(previousWithBank.ocr_data) !== currentBank) {
      checks.push({
        code: "supplier_bank_changed",
        severity: "critical",
        title: "Coordonnées bancaires modifiées",
        message: "Le RIB/IBAN diffère du dernier document connu de ce fournisseur. Vérifiez-le avant paiement.",
        relatedReceiptId: previousWithBank.id,
      });
    }
  }

  if (!checks.some(check => check.severity === "critical")) {
    checks.push({
      code: "automatic_checks_complete",
      severity: "info",
      title: "Contrôles automatiques terminés",
      message: checks.some(check => check.severity === "warning")
        ? "Aucune anomalie bloquante détectée. Vérifiez les avertissements restants."
        : "Aucune anomalie détectée sur le fournisseur, la TVA, le montant ou les doublons.",
    });
  }

  return checks;
}

export function highestInvoiceControlSeverity(checks: InvoiceControlCheck[]): InvoiceControlSeverity {
  if (checks.some(check => check.severity === "critical")) return "critical";
  if (checks.some(check => check.severity === "warning")) return "warning";
  return "info";
}
