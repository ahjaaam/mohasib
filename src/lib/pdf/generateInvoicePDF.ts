import { jsPDF } from "jspdf";
import { applyPlugin } from "jspdf-autotable";

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
    issue_date: string;
    due_date?: string | null;
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    total: number;
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
    address?: string | null;
    city?: string | null;
    postal_code?: string | null;
    phone?: string | null;
    email?: string | null;
    rib?: string | null;
    bank_name?: string | null;
    invoice_mentions_legales?: string | null;
    invoice_payment_delay?: string | null;
    invoice_color?: string | null;
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

  const accentHex = company?.invoice_color ?? GOLD;
  const accentRgb = hexToRgb(accentHex);
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
  if (company?.logoBase64) {
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

  // FACTURE label (right side, dark navy)
  const rightX = pageW - marginR - 2; // 2mm extra breathing room
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...NAVY_RGB);
  doc.text("FACTURE", rightX, 14, { align: "right" });

  // Invoice meta (muted gray)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED_RGB);
  doc.text(`N° ${invoice.invoice_number}`, rightX, 21, { align: "right" });
  doc.text(`Date : ${fmtDate(invoice.issue_date)}`, rightX, 27, { align: "right" });
  if (invoice.due_date) {
    doc.text(`Échéance : ${fmtDate(invoice.due_date)}`, rightX, 33, { align: "right" });
  }

  // ── FROM / TO ───────────────────────────────────────────────
  let y = headerH + 8;
  const boxW = (contentW - 4) / 2;

  // From box
  doc.setFillColor(...CREAM_BG);
  doc.roundedRect(marginL, y, boxW, 42, 2, 2, "F");

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

  const fromLines: string[] = [];
  if (company?.address) fromLines.push(company.address);
  if (company?.city || company?.postal_code)
    fromLines.push([company?.postal_code, company?.city].filter(Boolean).join(" "));
  if (company?.ice) fromLines.push(`ICE : ${company.ice}`);
  if (company?.if_number) fromLines.push(`IF : ${company.if_number}`);
  if (company?.rc) fromLines.push(`RC : ${company.rc}`);
  if (company?.phone) fromLines.push(`Tél : ${company.phone}`);
  if (company?.email) fromLines.push(company.email);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED_RGB);
  fromLines.forEach((line, i) => doc.text(line, marginL + 4, y + 18 + i * 4));

  // To box
  const toX = marginL + boxW + 4;
  doc.setFillColor(...CREAM_BG);
  doc.roundedRect(toX, y, boxW, 42, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...accentRgb);
  doc.text("À :", toX + 4, y + 6);

  if (client) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_RGB);
    doc.text(client.name, toX + 4, y + 12);

    const toLines: string[] = [];
    if (client.address) toLines.push(client.address);
    if (client.city) toLines.push(client.city);
    if (client.ice) toLines.push(`ICE : ${client.ice}`);
    if (client.email) toLines.push(client.email);
    if (client.phone) toLines.push(client.phone);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED_RGB);
    toLines.forEach((line, i) => doc.text(line, toX + 4, y + 18 + i * 4));
  }

  y += 48;

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
  doc.roundedRect(totX, y, totW, 24, 2, 2, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED_RGB);
  doc.text("Total HT", totX + 4, y + 7);
  doc.text(`TVA (${invoice.tax_rate}%)`, totX + 4, y + 13);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_RGB);
  doc.text(fmtAmt(invoice.subtotal), totX + totW - 4, y + 7, { align: "right" });
  doc.text(fmtAmt(invoice.tax_amount), totX + totW - 4, y + 13, { align: "right" });

  // Divider
  doc.setDrawColor(229, 231, 235);
  doc.line(totX + 3, y + 16, totX + totW - 3, y + 16);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...NAVY_RGB);
  doc.text("TOTAL TTC", totX + 4, y + 22);
  doc.setTextColor(...accentRgb);
  doc.text(fmtAmt(invoice.total), totX + totW - 4, y + 22, { align: "right" });

  y += 30;

  // ── PAYMENT INFO ────────────────────────────────────────────
  const payDelay = company?.invoice_payment_delay ?? "30 jours";
  if (payDelay || company?.rib || company?.bank_name) {
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
    doc.text(`Paiement à ${payDelay} — Virement bancaire`, marginL, y + 9);

    if (company?.bank_name || company?.rib) {
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

    y += 18;
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
  const mentions =
    company?.invoice_mentions_legales ??
    "Tout retard de paiement entraînera des pénalités conformément à la loi marocaine n° 32-10.";

  doc.setFillColor(...CREAM_BG);
  doc.roundedRect(marginL, y, contentW, 10, 2, 2, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...MUTED_RGB);
  const wrapped = doc.splitTextToSize(mentions, contentW - 8);
  doc.text(wrapped, marginL + 4, y + 5);

  // ── FOOTER ──────────────────────────────────────────────────
  const footerY = pageH - 10;
  doc.setDrawColor(229, 231, 235);
  doc.line(marginL, footerY - 3, pageW - marginR, footerY - 3);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...accentRgb);
  doc.text("Généré par Mohasib — mohasib.ma", marginL, footerY);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED_RGB);
  doc.text("Page 1 / 1", pageW / 2, footerY, { align: "center" });
  doc.text(data.generatedAt, pageW - marginR, footerY, { align: "right" });

  return doc.output("arraybuffer");
}
