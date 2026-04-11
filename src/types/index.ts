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

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export interface Invoice {
  id: string;
  user_id: string;
  client_id: string | null;
  invoice_number: string;
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
  created_at: string;
  updated_at: string;
  clients?: Pick<Client, "id" | "name" | "email">;
}

export type ReceiptStatus = "pending" | "matched" | "ignored";

export interface OcrData {
  date?: string | null;
  amount?: number | null;
  currency?: string | null;
  vendor?: string | null;
  description?: string | null;
  category?: string | null;
  type?: "income" | "expense" | null;
  tax_amount?: number | null;
}

export interface Receipt {
  id: string;
  user_id: string;
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
  created_at: string;
  updated_at: string;
  clients?: Pick<Client, "id" | "name">;
  invoices?: Pick<Invoice, "id" | "invoice_number">;
}
