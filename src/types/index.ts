export interface User {
  id: string;
  full_name: string | null;
  company: string | null;
  ice: string | null;
  rc: string | null;
  if_fiscal: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp?: string | null;
  address: string | null;
  city: string | null;
  postal_code?: string | null;
  country?: string | null;
  ice: string | null;
  if_number?: string | null;
  rc: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled" | "partiellement_payee";

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export interface PartialPayment {
  date: string;
  montant: number;
  mode: string;
  note?: string;
}

export type InvoiceType = "facture" | "avoir_client" | "proforma" | "devis";

export type DevisStatus = "brouillon" | "envoyé" | "accepté" | "refusé" | "expiré";

export interface Invoice {
  id: string;
  user_id: string;
  client_id: string | null;
  invoice_number: string;
  invoice_type?: InvoiceType;
  linked_invoice_id?: string | null;
  avoir_reason?: string | null;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  currency: string;
  notes: string | null;
  items: InvoiceItem[];
  montant_paye?: number;
  reste_a_payer?: number | null;
  paiements?: PartialPayment[];
  whatsapp_sent_at?: string | null;
  whatsapp_sent_count?: number;
  // Devis-specific fields
  devis_status?: DevisStatus;
  devis_validity_days?: number | null;
  devis_expiry_date?: string | null;
  devis_accepted_at?: string | null;
  devis_refused_at?: string | null;
  devis_refused_reason?: string | null;
  devis_notes?: string | null;
  devis_conditions?: string | null;
  devis_objet?: string | null;
  converted_to_invoice_id?: string | null;
  created_at: string;
  updated_at: string;
  clients?: Pick<Client, "id" | "name" | "email" | "phone">;
}

export interface AvoirFournisseur {
  id: string;
  user_id: string;
  dossier_id?: string | null;
  numero_interne: string;
  ref_fournisseur: string | null;
  fournisseur: string;
  date: string;
  montant_ht: number;
  tva_amount: number;
  tva_rate: number;
  total: number;
  motif: string | null;
  compte_comptable: string | null;
  statut: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ReceiptStatus = "pending" | "matched" | "ignored";

export interface OcrData {
  date?: string | null;
  amount?: number | null;       // signed: negative = expense
  currency?: string | null;
  vendor?: string | null;
  vendor_name?: string | null;  // alias used by new prompt
  description?: string | null;
  category?: string | null;
  type?: "income" | "expense" | null;
  tax_amount?: number | null;
  tva_amount?: number | null;
  tva_rate?: number | null;
  payment_method?: string | null;
  receipt_number?: string | null;
  confidence?: number | null;
  compte?: string | null;
  due_date?: string | null;
  due_date_confidence?: string | null;
  is_supplier_invoice?: boolean | null;
  document_type?: "invoice" | "receipt" | "purchase_order" | "delivery_note" | "avoir" | "bank_statement" | "other" | null;
  montant_paye?: number | null;
  payment_status?: string | null;
}

export interface Receipt {
  id: string;
  user_id: string;
  dossier_id?: string | null;
  transaction_id: string | null;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  status: ReceiptStatus;
  ocr_data: OcrData;
  created_at: string;
  updated_at: string;
}

export type TransactionType = "income" | "expense";
export type TransactionSource = "manual" | "bank_import";

export interface Transaction {
  id: string;
  user_id: string;
  invoice_id: string | null;
  client_id: string | null;
  type: TransactionType;
  category: string | null;
  description: string;
  amount: number;
  currency: string;
  date: string;
  payment_method: string | null;
  reference: string | null;
  notes: string | null;
  source: TransactionSource;
  bank_reference?: string | null;
  fournisseur?: string | null;
  if_fournisseur?: string | null;
  ice_fournisseur?: string | null;
  compte_comptable?: string | null;
  created_at: string;
  updated_at: string;
  clients?: Pick<Client, "id" | "name">;
  invoices?: Pick<Invoice, "id" | "invoice_number">;
}
