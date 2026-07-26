export type GlobalSearchKind =
  | "client"
  | "invoice"
  | "supplier"
  | "employee"
  | "transaction"
  | "document"
  | "dossier";

export type GlobalSearchResult = {
  id: string;
  kind: GlobalSearchKind;
  label: string;
  description: string;
  href: string;
};
