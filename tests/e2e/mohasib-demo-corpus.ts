export type CorpusClassification =
  | "supplier_invoice"
  | "supplier_invoice_packet"
  | "expense_receipt"
  | "purchase_order"
  | "bank_statement";

export type CorpusSample = {
  path: string;
  classification: CorpusClassification;
  notes?: string;
  duplicateOf?: string;
  professionalValidation?: string[];
};

export const mohasibDemoCorpus: CorpusSample[] = [
  { path: "3PL/DOC (60) (1).pdf", classification: "supplier_invoice", notes: "Barid Al-Maghrib / La Poste invoice; four-page scan." },
  { path: "Non Trade/0177 (1).pdf", classification: "supplier_invoice", notes: "Business Cash Center transport-of-funds invoice." },
  { path: "Non Trade/20260352 (3).pdf", classification: "supplier_invoice", notes: "Athena Surveillance staffing/security invoice." },
  { path: "Non Trade/26021593 (3).pdf", classification: "supplier_invoice", notes: "Les Eaux Minerales d'Oulmes invoice packet." },
  { path: "Non Trade/5262.pdf", classification: "supplier_invoice", notes: "Business Cash Center transport-of-funds invoice." },
  { path: "Non Trade/AR Factures ECART SERVICES T3 2025 (1).pdf", classification: "supplier_invoice", notes: "Forvis Mazars professional-services invoice." },
  { path: "Non Trade/CamScanner 03-12-2025 13.27(1).pdf", classification: "supplier_invoice", notes: "Auto-entrepreneur invoice stating exemption from VAT.", professionalValidation: ["Confirm the exemption evidence and non-deductible VAT treatment."] },
  { path: "Non Trade/CamScanner 06-01-2026 12.27 (5).pdf", classification: "supplier_invoice", notes: "ESDATA guarding invoice." },
  { path: "Non Trade/CamScanner 07-01-2026 16.00 (4).pdf", classification: "supplier_invoice", notes: "Athena Surveillance invoice." },
  { path: "Non Trade/DOC (78) (1).pdf", classification: "supplier_invoice", notes: "Athena Surveillance invoice." },
  { path: "Non Trade/DOC007 (4) (1).pdf", classification: "supplier_invoice", notes: "Les Eaux Minerales d'Oulmes invoice." },
  { path: "Non Trade/ESM JUMIA COMMERCIAL 0078-092025 (1).pdf", classification: "supplier_invoice_packet", notes: "GMCE invoice with payroll/billing support." },
  { path: "Non Trade/ESM, JUMIA COMMERCIAL 0022-082025 (1) (1).pdf", classification: "supplier_invoice_packet", notes: "GMCE invoice with payroll/billing support." },
  { path: "Non Trade/FR260039 (4).pdf", classification: "supplier_invoice", notes: "ESDATA guarding invoice." },
  { path: "Non Trade/IMG_2164.pdf", classification: "supplier_invoice", notes: "Skycorp marketing invoice." },
  { path: "Non Trade/INV-63755 (1).pdf", classification: "supplier_invoice", notes: "BeInterim invoice with explicit HT, VAT, TTC, date and due date." },
  { path: "Non Trade/INV-64035.pdf", classification: "supplier_invoice", notes: "BeInterim invoice." },
  { path: "Non Trade/Purchase Order_MAECPO250500032_23_05_2025 17_40.pdf", classification: "purchase_order", professionalValidation: ["A purchase order is supporting evidence, not a supplier invoice to book."] },
  { path: "Non Trade/Purchase Order_MAECPO250500037_23_05_2025 17_10 (1).pdf", classification: "purchase_order", professionalValidation: ["A purchase order is supporting evidence, not a supplier invoice to book."] },
  { path: "Non Trade/Purchase Order_MAECPO250500037_23_05_2025 17_10.pdf", classification: "purchase_order", duplicateOf: "Non Trade/Purchase Order_MAECPO250500037_23_05_2025 17_10 (1).pdf", professionalValidation: ["A purchase order is supporting evidence, not a supplier invoice to book."] },
  { path: "Non Trade/Purchase Order_MAECPO251200035_23_12_2025 07_40.pdf", classification: "purchase_order", professionalValidation: ["Confirm whether insurance VAT shown on the PO is recoverable; do not book the PO itself."] },
  { path: "Non Trade/Purchase Order_MAECPO251200064_26_12_2025 18_10 (1).pdf", classification: "purchase_order", professionalValidation: ["A purchase order is supporting evidence, not a supplier invoice to book."] },
  { path: "Non Trade/Purchase Order_MAECPO260100021_12_01_2026 17_41.pdf", classification: "purchase_order", professionalValidation: ["A purchase order is supporting evidence, not a supplier invoice to book."] },
  { path: "Non Trade/Purchase Order_MAECPO260100024_12_01_2026 18_40.pdf", classification: "purchase_order", professionalValidation: ["A purchase order is supporting evidence, not a supplier invoice to book."] },
  { path: "Non Trade/Quittance_RT_Police_initiale_AVM (12) (1) (1) (1).pdf", classification: "supplier_invoice", notes: "Insurance premium invoice/quittance.", professionalValidation: ["Validate the accounting split between net premium, insurance taxes and accessories."] },
  { path: "REÇUS/2018-10-23.jpg", classification: "expense_receipt", notes: "O'Paname restaurant receipt." },
  { path: "REÇUS/Facture-1074.jpg", classification: "expense_receipt", notes: "Le RDU restaurant receipt." },
  { path: "REÇUS/Facture-La-Poste.jpg", classification: "expense_receipt", notes: "Cafe de la Poste restaurant receipt." },
  { path: "REÇUS/Le-Bistro-Arabe-Moroccan-Jazz-Restaurant-in-Marrakech-menu-vwi.jpg", classification: "expense_receipt", notes: "Le Bistro Arabe restaurant receipt." },
  { path: "REÇUS/b9122689-f51b-44e4-bb8b-d4c5732ddebe.jpg", classification: "expense_receipt", notes: "Restaurant provisional receipt." },
  { path: "REÇUS/cafe-restaurant-bladna.jpg", classification: "expense_receipt", notes: "Bladna restaurant receipt." },
  { path: "REÇUS/catanzaro-2.png", classification: "expense_receipt", notes: "Catanzaro restaurant receipt embedded in a social-media screenshot." },
  { path: "REÇUS/encore-une-fois-nous.jpg", classification: "expense_receipt", notes: "French restaurant receipt with multiple VAT rates.", professionalValidation: ["Validate foreign-VAT/non-Moroccan deductibility treatment."] },
  { path: "REÇUS/facture.jpg", classification: "expense_receipt", notes: "Restaurant invoice with explicit TTC and VAT." },
  { path: "REÇUS/images.jpeg", classification: "expense_receipt", notes: "Hilton Garden Inn restaurant receipt with explicit HT, VAT and TTC." },
  { path: "REÇUS/le-tanjia.jpg", classification: "expense_receipt", notes: "Le Tanjia restaurant receipt." },
  { path: "REÇUS/photo0jpg.jpg", classification: "expense_receipt", notes: "Arkech restaurant receipt." },
  { path: "RV BNK/Releve Novembre ATW 2025 (2).pdf", classification: "bank_statement", notes: "Attijariwafa Bank statement, November 2025." },
  { path: "RV BNK/Relevé BMCI Novembre 2025 (1).pdf", classification: "bank_statement", notes: "BMCI statement, November 2025." },
  { path: "RV BNK/Relevé Barid Novembre 25 (1).pdf", classification: "bank_statement", notes: "Al Barid Bank statement, November 2025." },
  { path: "Trade/2026-15   --  MAECPINV260200013.pdf", classification: "supplier_invoice_packet", notes: "Trade supplier invoice with PO/supporting pages." },
  { path: "Trade/MAECPINV260100019.pdf", classification: "supplier_invoice_packet", notes: "Industape trade supplier invoice with PO/supporting pages." },
  { path: "Trade/MAECPINV260200011.pdf", classification: "supplier_invoice_packet", notes: "Good Brands Morocco supplier invoice with supporting pages." },
  { path: "Trade/MAECPINV260200043.pdf", classification: "supplier_invoice_packet", notes: "GPC Carton supplier invoice with supporting pages." },
  { path: "Trade/MAECPINV260200044.pdf", classification: "supplier_invoice_packet", notes: "GPC Carton supplier invoice with supporting pages." },
  { path: "Trade/MAECPINV260300078.pdf", classification: "supplier_invoice_packet", notes: "Dehycos Manufacturing supplier invoice with PO/supporting pages." },
];

export const verifiedSupplierInvoice = {
  path: "Non Trade/INV-63755 (1).pdf",
  vendorPattern: /be\s*interim/i,
  invoiceNumber: "INV-63755",
  date: "2025-09-01",
  dueDate: "2025-09-21",
  amountHt: 26_362.07,
  vatRate: 20,
  vatAmount: 5_272.41,
  amountTtc: 31_634.48,
} as const;

export const verifiedExpenseReceipt = {
  path: "REÇUS/facture.jpg",
  date: "2019-07-08",
  amountTtc: 1_015,
  vatAmount: 92.28,
} as const;
