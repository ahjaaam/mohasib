"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import toast from "react-hot-toast";
import { Loader2, Send } from "lucide-react";
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

type WaSending = Record<string, "loading" | "success" | "error">;

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<"all" | InvoiceStatus>("all");
  const [loading, setLoading] = useState(true);
  const [waSending, setWaSending] = useState<WaSending>({});
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase
        .from("invoices")
        .select("*, clients(id, name, email, phone)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      setInvoices(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function sendWhatsApp(invoiceId: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setWaSending((s) => ({ ...s, [invoiceId]: "loading" }));
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pdf`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      const { whatsappUrl } = await res.json();
      window.open(whatsappUrl, "_blank");
      setWaSending((s) => ({ ...s, [invoiceId]: "success" }));
      toast.success("WhatsApp ouvert 📲");
      setTimeout(() => setWaSending((s) => { const n = { ...s }; delete n[invoiceId]; return n; }), 2000);
    } catch (err: any) {
      setWaSending((s) => ({ ...s, [invoiceId]: "error" }));
      toast.error(err.message || "Erreur WhatsApp", { duration: 5000 });
      setTimeout(() => setWaSending((s) => { const n = { ...s }; delete n[invoiceId]; return n; }), 2000);
    }
  }

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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={9} className="text-center py-8 text-[#6B7280] text-[12px]">Chargement...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-10">
                  <p className="text-[#6B7280] text-[12.5px] mb-3">Aucune facture</p>
                  <Link href="/invoices/new" className="btn btn-gold">+ Nouvelle Facture</Link>
                </td>
              </tr>
            )}
            {filtered.map((inv) => {
              const [cls, label] = BADGE[inv.status] ?? ["b-draft", inv.status];
              const waStatus = waSending[inv.id];
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
                  <td>
                    <button
                      onClick={(e) => sendWhatsApp(inv.id, e)}
                      disabled={waStatus === "loading"}
                      title="Envoyer par WhatsApp"
                      className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all ${
                        waStatus === "success"
                          ? "bg-[#D1FAE5] text-[#059669]"
                          : waStatus === "error"
                          ? "bg-[#FEE2E2] text-[#DC2626]"
                          : "bg-[#F3F4F6] hover:bg-[rgba(200,146,74,0.12)] text-[#6B7280] hover:text-[#C8924A]"
                      }`}
                    >
                      {waStatus === "loading"
                        ? <Loader2 size={12} className="animate-spin" />
                        : waStatus === "success"
                        ? <span className="text-[11px]">✓</span>
                        : waStatus === "error"
                        ? <span className="text-[11px]">✕</span>
                        : <Send size={12} />
                      }
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
