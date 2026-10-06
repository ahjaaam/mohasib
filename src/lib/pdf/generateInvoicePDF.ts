import { jsPDF } from "jspdf";
import { applyPlugin } from "jspdf-autotable";
import { INVOICE_VAT_TREATMENT_OPTIONS, normalizeInvoiceVatTreatment } from "@/lib/invoice-vat-treatment";
import { invoiceVatBreakdown } from "@/lib/tva-invoice-aggregation";

// Attach autoTable plugin to jsPDF
applyPlugin(jsPDF);

const GOLD = "#C8924A";
const CREAM_BG: [number, number, number] = [250, 250, 246];
const NAVY_RGB: [number, number, number] = [13, 21, 38];
const GOLD_RGB: [number, number, number] = [200, 146, 74];
const MUTED_RGB: [number, number, number] = [107, 114, 128];
const TEXT_RGB: [number, number, number] = [26, 26, 46];
const WHITE: [number, number, number] = [255, 255, 255];

function hexToRgb(hex: string): [number, number, number] {
  if (!hex || !hex.startsWith("#") || hex.length < 7) return [...GOLD_RGB];
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return [...GOLD_RGB];
  return [r, g, b];
}

function fmtAmt(n: number): string {
  return n.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " MAD";
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("fr-MA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export interface GeneratePDFInput {
  invoice: {
    invoice_number: string;
    invoice_type?: string | null;
    avoir_reason?: string | null;
    devis_objet?: string | null;
    devis_expiry_date?: string | null;
    devis_conditions?: string | null;
    issue_date: string;
    due_date?: string | null;
    payment_method?: string | null;
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    vat_treatment?: string | null;
    total: number;
    discount_type?: string | null;
    discount_mode?: string | null;
    discount_value?: number;
    discount_amount?: number;
    notes?: string | null;
    items: Array<{
      description: string;
      quantity: number;
      unit_price: number;
      tva_rate?: number;
      amount: number;
    }>;
  };
  client: {
    name: string;
    ice?: string | null;
    address?: string | null;
    city?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  company: {
    raison_sociale?: string | null;
    logoBase64?: string | null;
    logoMimeType?: string | null;
    logoWidthPx?: number | null;
    logoHeightPx?: number | null;
    ice?: string | null;
    if_number?: string | null;
    rc?: string | null;
    cnss?: string | null;
    capital_social?: number | string | null;
    address?: string | null;
    city?: string | null;
    postal_code?: string | null;
    phone?: string | null;
    email?: string | null;
    rib?: string | null;
    bank_name?: string | null;
    invoice_mentions_legales?: string | null;
    invoice_payment_delay?: string | null;
    invoice_payment_method?: string | null;
    invoice_color?: string | null;
    show_logo?: boolean | null;
    show_cnss?: boolean | null;
    show_capital?: boolean | null;
    show_rib?: boolean | null;
    show_mentions?: boolean | null;
    show_page_number?: boolean | null;
  } | null;
  generatedAt: string;
}

export function generateInvoicePDF(data: GeneratePDFInput): ArrayBuffer {
  const { invoice, client, company } = data;

  console.log("[PDF] Company data:", JSON.stringify({
    raison_sociale: company?.raison_sociale,
    invoice_color: company?.invoice_color,
    logo_url: company?.logoBase64 ? "[base64 present]" : null,
    ice: company?.ice,
    address: company?.address,
  }));

  const isAvoir = invoice.invoice_type === "avoir_client";
  const isDevis = invoice.invoice_type === "devis";
  const accentHex = company?.invoice_color ?? GOLD;
  const accentRgb: [number, number, number] = hexToRgb(accentHex);
  const companyName = company?.raison_sociale ?? null;
  const pageW = 210; // A4 width mm
  const pageH = 297; // A4 height mm
  const marginL = 14;
  const marginR = 14;
  const contentW = pageW - marginL - marginR;

  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // ── HEADER BAND (white background) ─────────────────────────
  const headerH = 36;
  doc.setFillColor(...WHITE);
  doc.rect(0, 0, pageW, headerH, "F");

  // Logo or company name (left side)
  if (company?.logoBase64 && company.show_logo !== false) {
    try {
      const mimeRaw = company.logoMimeType ?? "image/png";
      // Normalize mime type to what jsPDF expects: PNG, JPEG, WEBP
      const mimeUpper = mimeRaw.split("/")[1]?.toUpperCase() ?? "PNG";
      const imgFormat = mimeUpper === "JPG" ? "JPEG" : mimeUpper;
      // Convert px → mm (96 dpi: 1px = 25.4/96 mm), fallback to 32×14mm
      const PX_TO_MM = 25.4 / 96;
      const wMm = company.logoWidthPx ? company.logoWidthPx * PX_TO_MM : 32;
      const hMm = company.logoHeightPx ? company.logoHeightPx * PX_TO_MM : 14;
      doc.addImage(company.logoBase64, imgFormat, marginL, 9, wMm, hMm, undefined, "NONE");
    } catch (err) {
      console.error("[PDF] Logo render failed:", err);
      if (companyName) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(...NAVY_RGB);
        doc.text(companyName, marginL, 21);
      }
    }
  } else if (companyName) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...NAVY_RGB);
    doc.text(companyName, marginL, 21);
  }

  // FACTURE / AVOIR / DEVIS label (right side)
  const rightX = pageW - marginR - 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...accentRgb);
  doc.text(isAvoir ? "AVOIR" : isDevis ? "DEVIS" : "FACTURE", rightX, 14, { align: "right" });

  // Invoice meta (muted gray)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED_RGB);
  doc.text(`N° ${invoice.invoice_number}`, rightX, 21, { align: "right" });
  doc.text(`Date : ${fmtDate(invoice.issue_date)}`, rightX, 27, { align: "right" });
  if (!isAvoir && !isDevis && invoice.due_date) {
    doc.text(`Échéance : ${fmtDate(invoice.due_date)}`, rightX, 33, { align: "right" });
  }
  if (isDevis && invoice.devis_expiry_date) {
    doc.text(`Expire le : ${fmtDate(invoice.devis_expiry_date)}`, rightX, 33, { align: "right" });
  }
  if (isDevis && invoice.devis_objet) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.text(`Objet : ${invoice.devis_objet}`, rightX, 39, { align: "right" });
    doc.setFont("helvetica", "normal");
  }
  if (isAvoir && invoice.avoir_reason) {
    doc.setTextColor(...accentRgb);
    doc.text(`Motif : ${invoice.avoir_reason}`, rightX, 33, { align: "right" });
    doc.setTextColor(...MUTED_RGB);
  }

  // ── FROM / TO ───────────────────────────────────────────────
  let y = headerH + 8;
  const boxW = (contentW - 4) / 2;
  const fromLines: string[] = [];
  if (company?.address) fromLines.push(company.address);
  if (company?.city || company?.postal_code)
    fromLines.push([company?.postal_code, company?.city].filter(Boolean).join(" "));
  if (company?.ice) fromLines.push(`ICE : ${company.ice}`);
  if (company?.if_number) fromLines.push(`IF : ${company.if_number}`);
  if (company?.rc) fromLines.push(`RC : ${company.rc}`);
  if (company?.show_cnss !== false && company?.cnss) fromLines.push(`CNSS : ${company.cnss}`);
  if (company?.show_capital && Number(company.capital_social) > 0) {
    fromLines.push(`Capital social : ${Number(company.capital_social).toLocaleString("fr-MA")} MAD`);
  }
  if (company?.phone) fromLines.push(`Tél : ${company.phone}`);
  if (company?.email) fromLines.push(company.email);

  const toLines: string[] = [];
  if (client?.address) toLines.push(client.address);
  if (client?.city) toLines.push(client.city);
  if (client?.ice) toLines.push(`ICE : ${client.ice}`);
  if (client?.email) toLines.push(client.email);
  if (client?.phone) toLines.push(client.phone);
  const partyBoxH = Math.max(42, 22 + Math.max(fromLines.length, toLines.length) * 4);

  // From box
  doc.setFillColor(...CREAM_BG);
  doc.roundedRect(marginL, y, boxW, partyBoxH, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...accentRgb);
  doc.text("DE :", marginL + 4, y + 6);

  if (companyName) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_RGB);
    doc.text(companyName, marginL + 4, y + 12);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED_RGB);
  fromLines.forEach((line, i) => doc.text(line, marginL + 4, y + 18 + i * 4));

  // To box
  const toX = marginL + boxW + 4;
  doc.setFillColor(...CREAM_BG);
  doc.roundedRect(toX, y, boxW, partyBoxH, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...accentRgb);
  doc.text("À :", toX + 4, y + 6);

  if (client) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_RGB);
    doc.text(client.name, toX + 4, y + 12);

  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED_RGB);
  toLines.forEach((line, i) => doc.text(line, toX + 4, y + 18 + i * 4));

  y += partyBoxH + 6;

  // ── LINE ITEMS TABLE ────────────────────────────────────────
  (doc as any).autoTable({
    startY: y,
    margin: { left: marginL, right: marginR },
    head: [["Description", "Qté", "P.U. HT", "TVA %", "Total HT"]],
    body: invoice.items.map(item => [
      item.description,
      String(item.quantity),
      fmtAmt(item.unit_price),
      `${item.tva_rate ?? invoice.tax_rate}%`,
      fmtAmt(item.amount),
    ]),
    headStyles: {
      fillColor: accentRgb,
      textColor: WHITE,
      fontStyle: "bold",
      fontSize: 7.5,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: TEXT_RGB,
    },
    alternateRowStyles: {
      fillColor: CREAM_BG,
    },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "right", cellWidth: 16 },
      2: { halign: "right", cellWidth: 28 },
      3: { halign: "right", cellWidth: 16 },
      4: { halign: "right", cellWidth: 30 },
    },
    theme: "plain",
    tableLineColor: [243, 244, 246],
    tableLineWidth: 0.2,
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // ── TOTALS ──────────────────────────────────────────────────
  const totW = 70;
  const totX = pageW - marginR - totW;

  doc.setFillColor(...CREAM_BG);
  const hasDiscount = Number(invoice.discount_amount ?? 0) > 0;
  const vatBreakdown = invoiceVatBreakdown(invoice);
  const vatSummaryRows = vatBreakdown.reduce((count, line) => count + (line.rate === 0 ? 1 : 2), 0);
  const totalsHeight = (hasDiscount ? 36 : 24) + Math.max(0, vatSummaryRows - 1) * 6;
  doc.roundedRect(totX, y, totW, totalsHeight, 2, 2, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED_RGB);
  doc.text(hasDiscount ? "Total HT brut" : "Total HT", totX + 4, y + 7);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_RGB);
  doc.text(fmtAmt(invoice.subtotal), totX + totW - 4, y + 7, { align: "right" });

  let totalsRowY = y + 13;
  if (hasDiscount) {
    const discountLabel = invoice.discount_type === "escompte" ? "Escompte" : "Réduction commerciale";
    doc.setFont("helvetica", "normal");
    doc.setTextColor(124, 58, 237);
    doc.text(discountLabel, totX + 4, totalsRowY);
    doc.text(`- ${fmtAmt(Number(invoice.discount_amount))}`, totX + totW - 4, totalsRowY, { align: "right" });
    totalsRowY += 6;
    doc.setTextColor(...MUTED_RGB);
    doc.text("Net HT", totX + 4, totalsRowY);
    doc.setTextColor(...TEXT_RGB);
    doc.text(fmtAmt(Number(invoice.subtotal) - Number(invoice.discount_amount)), totX + totW - 4, totalsRowY, { align: "right" });
    totalsRowY += 6;
  }
  for (const line of vatBreakdown) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED_RGB);
    if (line.rate === 0) {
      doc.text("Base HT 0%", totX + 4, totalsRowY);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...TEXT_RGB);
      doc.text(fmtAmt(line.base), totX + totW - 4, totalsRowY, { align: "right" });
      totalsRowY += 6;
      continue;
    }
    doc.text(`Base HT ${line.rate}%`, totX + 4, totalsRowY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_RGB);
    doc.text(fmtAmt(line.base), totX + totW - 4, totalsRowY, { align: "right" });
    totalsRowY += 6;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED_RGB);
    doc.text(`TVA ${line.rate}%`, totX + 4, totalsRowY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_RGB);
    doc.text(fmtAmt(line.tax), totX + totW - 4, totalsRowY, { align: "right" });
    totalsRowY += 6;
  }

  // Divider
  doc.setDrawColor(229, 231, 235);
  const dividerY = totalsRowY + 3;
  doc.line(totX + 3, dividerY, totX + totW - 3, dividerY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...TEXT_RGB);
  doc.text("TOTAL TTC", totX + 4, dividerY + 6);
  doc.setTextColor(...accentRgb);
  doc.text(fmtAmt(invoice.total), totX + totW - 4, dividerY + 6, { align: "right" });

  y += totalsHeight + 6;

  const vatTreatment = normalizeInvoiceVatTreatment(invoice.vat_treatment);
  const vatTreatmentLabel = INVOICE_VAT_TREATMENT_OPTIONS.find((option) => option.value === vatTreatment)?.label;
  if (vatTreatmentLabel) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED_RGB);
    doc.text(`Traitement TVA à 0 % : ${vatTreatmentLabel}`, marginL, y);
    y += 6;
  }

  // ── PAYMENT INFO / DEVIS CONDITIONS ────────────────────────
  if (isDevis) {
    const conditions = invoice.devis_conditions ?? "Ce devis est valable jusqu'à la date d'expiration indiquée. Tout accord doit être confirmé par écrit.";
    doc.setDrawColor(229, 231, 235);
    doc.line(marginL, y, pageW - marginR, y);
    y += 5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...accentRgb);
    doc.text("CONDITIONS DU DEVIS", marginL, y + 4);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED_RGB);
    const condLines = doc.splitTextToSize(conditions, contentW - 8);
    doc.text(condLines, marginL, y + 9);
    y += 9 + condLines.length * 4 + 5;
  } else {
    const payDelay = company?.invoice_payment_delay ?? "30 jours";
    const payMethod = invoice.payment_method ?? company?.invoice_payment_method ?? "Virement bancaire";
    const hasVisibleBankDetails = company?.show_rib !== false && Boolean(company?.rib || company?.bank_name);
    if (payDelay || payMethod || hasVisibleBankDetails) {
      doc.setDrawColor(229, 231, 235);
      doc.line(marginL, y, pageW - marginR, y);
      y += 5;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...accentRgb);
      doc.text("CONDITIONS DE PAIEMENT", marginL, y + 4);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED_RGB);
      doc.text(`Paiement à ${payDelay}`, marginL, y + 9);
      if (payMethod) doc.text(`Mode : ${payMethod}`, marginL, y + 13);

      if (hasVisibleBankDetails) {
        const bX = marginL + contentW / 2;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...accentRgb);
        doc.text("COORDONNÉES BANCAIRES", bX, y + 4);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...MUTED_RGB);
        if (company?.bank_name) doc.text(`Banque : ${company.bank_name}`, bX, y + 9);
        if (company?.rib) doc.text(`RIB : ${company.rib}`, bX, y + 13);
      }

      y += 22;
    }
  }

  // ── NOTES ───────────────────────────────────────────────────
  if (invoice.notes) {
    doc.setFillColor(...CREAM_BG);
    doc.roundedRect(marginL, y, contentW, 12, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...accentRgb);
    doc.text("NOTES", marginL + 4, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED_RGB);
    doc.text(invoice.notes, marginL + 4, y + 10);
    y += 16;
  }

  // ── MENTIONS LÉGALES ────────────────────────────────────────
  if (company?.show_mentions !== false) {
    const mentions =
      company?.invoice_mentions_legales ??
      "Tout retard de paiement entraînera des pénalités conformément à la loi marocaine n° 32-10.";

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    const wrapped = doc.splitTextToSize(mentions, contentW - 8);
    const mentionsH = Math.max(10, wrapped.length * 3 + 5);
    doc.setFillColor(...CREAM_BG);
    doc.roundedRect(marginL, y, contentW, mentionsH, 2, 2, "F");
    doc.setTextColor(...MUTED_RGB);
    doc.text(wrapped, marginL + 4, y + 5);
  }

  // ── FOOTER ──────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    const footerY = pageH - 10;
    doc.setDrawColor(229, 231, 235);
    doc.line(marginL, footerY - 3, pageW - marginR, footerY - 3);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED_RGB);
    if (company?.show_page_number !== false) {
      doc.text(`Page ${page} / ${pageCount}`, pageW / 2, footerY, { align: "center" });
    }
    doc.text(data.generatedAt, pageW - marginR, footerY, { align: "right" });
  }

  return doc.output("arraybuffer");
}
