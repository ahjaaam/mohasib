"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import type { Invoice, InvoiceStatus } from "@/types";

function fmt(n: number) { return n.toLocaleString("fr-MA") + " MAD"; }
function fmtDate(d: string) { return new Date(d).toLocaleDateString("fr-MA"); }

const TABS: { key: "all" | InvoiceStatus; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "sent", label: "En attente" },
  { key: "paid", label: "Payées" },
  { key: "overdue", label: "En retard" },
  { key: "draft", label: "Brouillons" },
];

const BADGE: Record<InvoiceStatus, [string, string]> = {
  paid:      ["b-paid",    "Payée"],
  sent:      ["b-pending", "En attente"],
  overdue:   ["b-overdue", "En retard"],
  draft:     ["b-draft",   "Brouillon"],
  cancelled: ["b-draft",   "Annulée"],
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<"all" | InvoiceStatus>("all");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase
        .from("invoices")
        .select("*, clients(id, name, email)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      setInvoices(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = filter === "all" ? invoices : invoices.filter((i) => i.status === filter);

  return (
    <div>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`tab ${filter === t.key ? "active" : ""}`} onClick={() => setFilter(t.key)}>
            {t.label}
            {t.key !== "all" && (
              <span className="ml-1.5 text-[10px] bg-[rgba(0,0,0,0.06)] px-1.5 py-0.5 rounded-full">
                {invoices.filter((i) => i.status === t.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="tbl">
        <table>
          <thead>
            <tr>
              <th>N° Facture</th>
              <th>Client</th>
              <th>HT</th>
              <th>TVA</th>
              <th>TTC</th>
              <th>Date</th>
              <th>Échéance</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="text-center py-8 text-[#6B7280] text-[12px]">Chargement...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-10">
                  <p className="text-[#6B7280] text-[12.5px] mb-3">Aucune facture</p>
                  <Link href="/invoices/new" className="btn btn-gold">+ Nouvelle Facture</Link>
                </td>
              </tr>
            )}
            {filtered.map((inv) => {
              const [cls, label] = BADGE[inv.status] ?? ["b-draft", inv.status];
              return (
                <tr key={inv.id}>
                  <td>
                    <Link href={`/invoices/${inv.id}`} className="font-medium text-[#6B7280] hover:text-[#C8924A] transition-colors">
                      {inv.invoice_number}
                    </Link>
                  </td>
                  <td>{(inv as any).clients?.name ?? "—"}</td>
                  <td className="text-[#6B7280]">{fmt(Number(inv.subtotal))}</td>
                  <td className="text-[#6B7280]">{fmt(Number(inv.tax_amount))}</td>
                  <td className="font-semibold">{fmt(Number(inv.total))}</td>
                  <td className="text-[#6B7280]">{fmtDate(inv.issue_date)}</td>
                  <td className={inv.status === "overdue" ? "text-[#DC2626]" : "text-[#6B7280]"}>
                    {inv.due_date ? fmtDate(inv.due_date) : "—"}
                  </td>
                  <td><span className={`badge ${cls}`}>{label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
