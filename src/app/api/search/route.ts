import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { GlobalSearchResult } from "@/lib/global-search";
import { resolveTeamContext } from "@/lib/team";

const RESULT_LIMIT = 5;

function searchableTerm(value: string) {
  return value
    .slice(0, 80)
    .replace(/[,()%_\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function scopedHref(dossierId: string | null | undefined, section: string, query: Record<string, string>) {
  const params = new URLSearchParams(query);
  return dossierId
    ? `/comptable-pro/dossiers/${dossierId}/${section}?${params.toString()}`
    : `/${section}?${params.toString()}`;
}

function amount(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return `${number.toLocaleString("fr-MA", { maximumFractionDigits: 2 })} MAD`;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ results: [] }, { status: 401 });
  }
  const context = await resolveTeamContext(user.id);
  const invoicingOnly = context?.plan === "free";

  const query = searchableTerm(request.nextUrl.searchParams.get("q") ?? "");
  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const pattern = `%${query}%`;
  const [
    clientResponse,
    invoiceResponse,
    employeeResponse,
    transactionResponse,
    documentResponse,
    receiptResponse,
    dossierResponse,
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("id,name,email,phone,city,ice,rc,dossier_id")
      .or(`name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern},city.ilike.${pattern},ice.ilike.${pattern},rc.ilike.${pattern}`)
      .order("name")
      .limit(RESULT_LIMIT),
    supabase
      .from("invoices")
      .select("id,invoice_number,status,total,dossier_id,clients(name)")
      .or(`invoice_number.ilike.${pattern},notes.ilike.${pattern}`)
      .order("created_at", { ascending: false })
      .limit(RESULT_LIMIT),
    supabase
      .from("employees")
      .select("id,nom,prenom,matricule,cin,poste,departement,numero_cnss,dossier_id")
      .or(`nom.ilike.${pattern},prenom.ilike.${pattern},matricule.ilike.${pattern},cin.ilike.${pattern},poste.ilike.${pattern},departement.ilike.${pattern},numero_cnss.ilike.${pattern}`)
      .order("nom")
      .limit(RESULT_LIMIT),
    supabase
      .from("transactions")
      .select("id,description,category,reference,fournisseur,if_fournisseur,ice_fournisseur,amount,date,dossier_id")
      .or(`description.ilike.${pattern},category.ilike.${pattern},reference.ilike.${pattern},fournisseur.ilike.${pattern},if_fournisseur.ilike.${pattern},ice_fournisseur.ilike.${pattern},notes.ilike.${pattern}`)
      .order("date", { ascending: false })
      .limit(RESULT_LIMIT * 2),
    supabase
      .from("company_documents")
      .select("id,name,file_name,document_category,notes,dossier_id")
      .or(`name.ilike.${pattern},file_name.ilike.${pattern},document_category.ilike.${pattern},notes.ilike.${pattern}`)
      .order("created_at", { ascending: false })
      .limit(RESULT_LIMIT),
    supabase
      .from("receipts")
      .select("id,file_name,ocr_data,dossier_id,created_at")
      .or(`file_name.ilike.${pattern},ocr_data->>vendor_name.ilike.${pattern},ocr_data->>vendor.ilike.${pattern}`)
      .order("created_at", { ascending: false })
      .limit(RESULT_LIMIT),
    supabase
      .from("dossiers")
      .select("id,raison_sociale,ice,if_fiscal,rc,contact_nom,contact_email,contact_phone")
      .or(`raison_sociale.ilike.${pattern},ice.ilike.${pattern},if_fiscal.ilike.${pattern},rc.ilike.${pattern},contact_nom.ilike.${pattern},contact_email.ilike.${pattern},contact_phone.ilike.${pattern}`)
      .order("raison_sociale")
      .limit(RESULT_LIMIT),
  ]);

  const results: GlobalSearchResult[] = [];

  for (const client of clientResponse.data ?? []) {
    const details = [client.email, client.phone, client.ice ? `ICE ${client.ice}` : null]
      .filter(Boolean)
      .join(" · ");
    results.push({
      id: client.id,
      kind: "client",
      label: client.name,
      description: details || "Client",
      href: scopedHref(client.dossier_id, "clients", { search: client.name }),
    });
  }

  for (const invoice of invoiceResponse.data ?? []) {
    const client = Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients;
    const details = [client?.name, amount(invoice.total), invoice.status].filter(Boolean).join(" · ");
    results.push({
      id: invoice.id,
      kind: "invoice",
      label: invoice.invoice_number,
      description: details || "Facture",
      href: invoice.dossier_id
        ? scopedHref(invoice.dossier_id, "factures", { q: invoice.invoice_number })
        : `/factures/${invoice.id}`,
    });
  }

  for (const employee of employeeResponse.data ?? []) {
    const fullName = `${employee.prenom ?? ""} ${employee.nom ?? ""}`.trim();
    const details = [employee.poste, employee.departement, employee.matricule].filter(Boolean).join(" · ");
    results.push({
      id: employee.id,
      kind: "employee",
      label: fullName,
      description: details || "Employé",
      href: scopedHref(employee.dossier_id, "paie", { tab: "employes", search: fullName }),
    });
  }

  const supplierNames = new Set<string>();
  for (const transaction of transactionResponse.data ?? []) {
    const supplier = transaction.fournisseur?.trim();
    if (supplier && normalize(`${supplier} ${transaction.if_fournisseur ?? ""} ${transaction.ice_fournisseur ?? ""}`).includes(normalize(query))) {
      supplierNames.add(normalize(supplier));
      results.push({
        id: `transaction-supplier-${transaction.id}`,
        kind: "supplier",
        label: supplier,
        description: [transaction.ice_fournisseur ? `ICE ${transaction.ice_fournisseur}` : null, "Fournisseur"]
          .filter(Boolean)
          .join(" · "),
        href: scopedHref(transaction.dossier_id, "transactions", { search: supplier }),
      });
    }

    results.push({
      id: transaction.id,
      kind: "transaction",
      label: transaction.description,
      description: [transaction.category, amount(transaction.amount), transaction.date].filter(Boolean).join(" · "),
      href: scopedHref(transaction.dossier_id, "transactions", { search: transaction.description }),
    });
  }

  for (const document of documentResponse.data ?? []) {
    results.push({
      id: document.id,
      kind: "document",
      label: document.name,
      description: document.document_category || document.file_name || "Document",
      href: scopedHref(document.dossier_id, "archive", { search: document.name }),
    });
  }

  for (const receipt of receiptResponse.data ?? []) {
    const ocrData = (receipt.ocr_data ?? {}) as Record<string, unknown>;
    const vendor = String(ocrData.vendor_name ?? ocrData.vendor ?? "").trim();
    if (vendor && !supplierNames.has(normalize(vendor))) {
      supplierNames.add(normalize(vendor));
      results.push({
        id: `receipt-supplier-${receipt.id}`,
        kind: "supplier",
        label: vendor,
        description: "Fournisseur · Notes de frais",
        href: scopedHref(receipt.dossier_id, "notes-de-frais", { search: vendor }),
      });
    }

    results.push({
      id: `receipt-${receipt.id}`,
      kind: "document",
      label: receipt.file_name || vendor || "Reçu",
      description: vendor ? `Reçu · ${vendor}` : "Reçu fournisseur",
      href: scopedHref(receipt.dossier_id, "notes-de-frais", { search: vendor || receipt.file_name || "" }),
    });
  }

  for (const dossier of dossierResponse.data ?? []) {
    const details = [dossier.ice ? `ICE ${dossier.ice}` : null, dossier.contact_nom].filter(Boolean).join(" · ");
    results.push({
      id: dossier.id,
      kind: "dossier",
      label: dossier.raison_sociale,
      description: details || "Dossier",
      href: `/comptable-pro/dossiers/${dossier.id}/tableau-de-bord`,
    });
  }

  const planVisibleResults = invoicingOnly
    ? results.filter((result) => result.kind === "client" || result.kind === "invoice")
    : results;
  const deduplicated = Array.from(
    new Map(planVisibleResults.map((result) => [`${result.kind}:${normalize(result.label)}:${result.href}`, result])).values()
  );

  return NextResponse.json(
    { results: deduplicated.slice(0, 30) },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
