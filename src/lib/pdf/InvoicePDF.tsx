import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";

// Register Helvetica — built-in, no import needed

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  tva_rate?: number;
  amount: number;
}

export interface InvoicePDFData {
  invoice: {
    invoice_number: string;
    issue_date: string;
    due_date?: string | null;
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    total: number;
    notes?: string | null;
    items: InvoiceItem[];
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
    logo_url?: string | null;
    logoBase64?: string | null;
    ice?: string | null;
    if_number?: string | null;
    rc?: string | null;
    cnss?: string | null;
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

function fmtAmt(n: number): string {
  return n.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " MAD";
}

function fmtDate(d: string): string {
  const date = new Date(d);
  return date.toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const NAVY = "#0D1526";
const GOLD = "#C8924A";
const CREAM = "#FAFAF6";
const TEXT = "#1A1A2E";
const MUTED = "#6B7280";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: TEXT,
    backgroundColor: "#FFFFFF",
    padding: 0,
  },
  // Header band
  headerBand: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 36,
    paddingVertical: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerBorder: {
    height: 3,
    marginHorizontal: 0,
  },
  logoImg: {
    width: 120,
    height: 60,
    objectFit: "contain",
  },
  logoText: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  invoiceLabel: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    letterSpacing: 1,
  },
  invoiceMeta: {
    fontSize: 11,
    color: MUTED,
    marginTop: 3,
  },
  invoiceMetaValue: {
    color: MUTED,
    fontFamily: "Helvetica-Bold",
  },
  // Body
  body: {
    paddingHorizontal: 36,
    paddingTop: 22,
    paddingBottom: 16,
    flex: 1,
  },
  // From/To section
  fromToRow: {
    flexDirection: "row",
    gap: 20,
    marginBottom: 20,
  },
  fromToBox: {
    flex: 1,
    backgroundColor: CREAM,
    borderRadius: 6,
    padding: 12,
  },
  fromToLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: GOLD,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  fromToName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: TEXT,
    marginBottom: 2,
  },
  fromToLine: {
    fontSize: 8,
    color: MUTED,
    marginBottom: 1.5,
  },
  // Table
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginBottom: 2,
  },
  tableHeaderCell: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  tableRowAlt: {
    backgroundColor: CREAM,
  },
  tableCell: {
    fontSize: 8.5,
    color: TEXT,
  },
  tableCellMuted: {
    fontSize: 8.5,
    color: MUTED,
  },
  // Column widths
  colDesc: { flex: 1 },
  colQty: { width: 50, textAlign: "right" },
  colPU: { width: 80, textAlign: "right" },
  colTva: { width: 50, textAlign: "right" },
  colTotal: { width: 90, textAlign: "right" },
  // Totals
  totalsSection: {
    marginTop: 6,
    alignItems: "flex-end",
  },
  totalsBox: {
    width: 240,
    backgroundColor: CREAM,
    borderRadius: 6,
    padding: 12,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalLabel: {
    fontSize: 8.5,
    color: MUTED,
  },
  totalValue: {
    fontSize: 8.5,
    color: TEXT,
    fontFamily: "Helvetica-Bold",
  },
  totalDivider: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    marginVertical: 4,
  },
  grandLabel: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
  },
  grandValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: GOLD,
  },
  // Payment info
  paymentSection: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 12,
    flexDirection: "row",
    gap: 20,
  },
  paymentBox: {
    flex: 1,
  },
  paymentTitle: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: GOLD,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  paymentLine: {
    fontSize: 8,
    color: MUTED,
    marginBottom: 2,
  },
  paymentValue: {
    color: TEXT,
  },
  // Mentions
  mentionsSection: {
    marginTop: 12,
    backgroundColor: CREAM,
    borderRadius: 4,
    padding: 10,
  },
  mentionsText: {
    fontSize: 7,
    color: MUTED,
    lineHeight: 1.5,
  },
  // Footer
  footer: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingHorizontal: 36,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 7,
    color: MUTED,
  },
  footerBrand: {
    fontSize: 7,
    color: GOLD,
    fontFamily: "Helvetica-Bold",
  },
});

// Plain factory function (NOT a React component) so Next.js RSC doesn't wrap it
export function createInvoicePDF({ invoice, client, company, generatedAt }: InvoicePDFData) {
  const accentColor = company?.invoice_color ?? GOLD;
  const companyName = company?.raison_sociale ?? "Mon Entreprise";

  const mentions =
    company?.invoice_mentions_legales ??
    "Tout retard de paiement entraînera des pénalités conformément à la loi marocaine n° 32-10.";

  const paymentDelay = company?.invoice_payment_delay ?? "30 jours";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header Band */}
        <View style={styles.headerBand}>
          {/* Left: Logo or company name */}
          <View>
            {company?.logoBase64 ? (
              <Image src={`data:image/png;base64,${company.logoBase64}`} style={styles.logoImg} />
            ) : (
              <Text style={styles.logoText}>{companyName}</Text>
            )}
          </View>

          {/* Right: Invoice label + meta */}
          <View style={styles.headerRight}>
            <Text style={styles.invoiceLabel}>FACTURE</Text>
            <Text style={styles.invoiceMeta}>
              N° <Text style={styles.invoiceMetaValue}>{invoice.invoice_number}</Text>
            </Text>
            <Text style={styles.invoiceMeta}>
              Date : <Text style={styles.invoiceMetaValue}>{fmtDate(invoice.issue_date)}</Text>
            </Text>
            {invoice.due_date && (
              <Text style={styles.invoiceMeta}>
                Échéance : <Text style={styles.invoiceMetaValue}>{fmtDate(invoice.due_date)}</Text>
              </Text>
            )}
          </View>
        </View>
        {/* Gold accent border below header */}
        <View style={[styles.headerBorder, { backgroundColor: accentColor }]} />

        {/* Body */}
        <View style={styles.body}>
          {/* From / To */}
          <View style={styles.fromToRow}>
            {/* From */}
            <View style={styles.fromToBox}>
              <Text style={[styles.fromToLabel, { color: accentColor }]}>De :</Text>
              <Text style={styles.fromToName}>{companyName}</Text>
              {company?.address && <Text style={styles.fromToLine}>{company.address}</Text>}
              {(company?.city || company?.postal_code) && (
                <Text style={styles.fromToLine}>
                  {[company.postal_code, company.city].filter(Boolean).join(" ")}
                </Text>
              )}
              {company?.ice && <Text style={styles.fromToLine}>ICE : {company.ice}</Text>}
              {company?.if_number && <Text style={styles.fromToLine}>IF : {company.if_number}</Text>}
              {company?.rc && <Text style={styles.fromToLine}>RC : {company.rc}</Text>}
              {company?.phone && <Text style={styles.fromToLine}>Tél : {company.phone}</Text>}
              {company?.email && <Text style={styles.fromToLine}>Email : {company.email}</Text>}
            </View>

            {/* To */}
            <View style={styles.fromToBox}>
              <Text style={[styles.fromToLabel, { color: accentColor }]}>À :</Text>
              {client ? (
                <>
                  <Text style={styles.fromToName}>{client.name}</Text>
                  {client.address && <Text style={styles.fromToLine}>{client.address}</Text>}
                  {client.city && <Text style={styles.fromToLine}>{client.city}</Text>}
                  {client.ice && <Text style={styles.fromToLine}>ICE : {client.ice}</Text>}
                  {client.email && <Text style={styles.fromToLine}>{client.email}</Text>}
                  {client.phone && <Text style={styles.fromToLine}>{client.phone}</Text>}
                </>
              ) : (
                <Text style={styles.fromToLine}>—</Text>
              )}
            </View>
          </View>

          {/* Line items table */}
          <View>
            {/* Table header */}
            <View style={[styles.tableHeader, { backgroundColor: accentColor }]}>
              <Text style={[styles.tableHeaderCell, styles.colDesc]}>Description</Text>
              <Text style={[styles.tableHeaderCell, styles.colQty]}>Qté</Text>
              <Text style={[styles.tableHeaderCell, styles.colPU]}>P.U. HT</Text>
              <Text style={[styles.tableHeaderCell, styles.colTva]}>TVA %</Text>
              <Text style={[styles.tableHeaderCell, styles.colTotal]}>Total HT</Text>
            </View>

            {/* Table rows */}
            {invoice.items.map((item, i) => (
              <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
                <Text style={[styles.tableCell, styles.colDesc]}>{item.description}</Text>
                <Text style={[styles.tableCellMuted, styles.colQty]}>{item.quantity}</Text>
                <Text style={[styles.tableCellMuted, styles.colPU]}>{fmtAmt(item.unit_price)}</Text>
                <Text style={[styles.tableCellMuted, styles.colTva]}>
                  {item.tva_rate != null ? item.tva_rate : invoice.tax_rate}%
                </Text>
                <Text style={[styles.tableCell, styles.colTotal]}>{fmtAmt(item.amount)}</Text>
              </View>
            ))}
          </View>

          {/* Totals */}
          <View style={styles.totalsSection}>
            <View style={styles.totalsBox}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total HT</Text>
                <Text style={styles.totalValue}>{fmtAmt(Number(invoice.subtotal))}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>TVA ({invoice.tax_rate}%)</Text>
                <Text style={styles.totalValue}>{fmtAmt(Number(invoice.tax_amount))}</Text>
              </View>
              <View style={styles.totalDivider} />
              <View style={styles.totalRow}>
                <Text style={styles.grandLabel}>TOTAL TTC</Text>
                <Text style={[styles.grandValue, { color: accentColor }]}>
                  {fmtAmt(Number(invoice.total))}
                </Text>
              </View>
            </View>
          </View>

          {/* Payment info */}
          {(paymentDelay || company?.rib || company?.bank_name) && (
            <View style={styles.paymentSection}>
              <View style={styles.paymentBox}>
                <Text style={[styles.paymentTitle, { color: accentColor }]}>
                  Conditions de paiement
                </Text>
                <Text style={styles.paymentLine}>
                  <Text style={styles.paymentValue}>Paiement à {paymentDelay}</Text>
                </Text>
                <Text style={styles.paymentLine}>Mode : Virement bancaire</Text>
              </View>
              {(company?.rib || company?.bank_name) && (
                <View style={styles.paymentBox}>
                  <Text style={[styles.paymentTitle, { color: accentColor }]}>
                    Coordonnées bancaires
                  </Text>
                  {company?.bank_name && (
                    <Text style={styles.paymentLine}>
                      Banque : <Text style={styles.paymentValue}>{company.bank_name}</Text>
                    </Text>
                  )}
                  {company?.rib && (
                    <Text style={styles.paymentLine}>
                      RIB : <Text style={styles.paymentValue}>{company.rib}</Text>
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Notes */}
          {invoice.notes && (
            <View style={[styles.mentionsSection, { marginTop: 10 }]}>
              <Text style={[styles.paymentTitle, { color: accentColor, marginBottom: 4 }]}>Notes</Text>
              <Text style={styles.mentionsText}>{invoice.notes}</Text>
            </View>
          )}

          {/* Mentions légales */}
          <View style={styles.mentionsSection}>
            <Text style={styles.mentionsText}>{mentions}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerBrand}>Généré par Mohasib — mohasib.ma</Text>
          <Text style={styles.footerText}>Page 1 / 1</Text>
          <Text style={styles.footerText}>{generatedAt}</Text>
        </View>
      </Page>
    </Document>
  );
}
