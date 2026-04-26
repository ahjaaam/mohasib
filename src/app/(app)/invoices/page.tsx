"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
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

type MenuItem = { label: string; href?: string; action?: () => void; red?: boolean };

function InvoiceMenu({ inv, onMarkPaid, onDelete }: {
  inv: Invoice;
  onMarkPaid: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, openUp: false });
  const [waLoading, setWaLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    const rect = btnRef.current!.getBoundingClientRect();
    const DROPDOWN_H = 220;
    const DROPDOWN_W = 200;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < DROPDOWN_H;
    setPos({
      top: openUp ? rect.top - DROPDOWN_H : rect.bottom + 4,
      left: Math.max(8, rect.right - DROPDOWN_W),
      openUp,
    });
    setOpen(true);
  }

  async function handleEmail() {
    setOpen(false);
    setEmailLoading(true);
    try {
      const res = await fetch(`/api/invoices/${inv.id}/send-email`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.message || json.error || "Erreur d'envoi email", { duration: 5000 });
      } else {
        toast.success("Email envoyé avec succès 📧");
      }
    } catch {
      toast.error("Erreur d'envoi. Vérifiez votre connexion.", { duration: 5000 });
    } finally {
      setEmailLoading(false);
    }
  }

  async function handleWhatsApp() {
    setOpen(false);
    setWaLoading(true);
    console.log("Invoice ID for WhatsApp:", inv.id);
    try {
      const res = await fetch(`/api/invoices/${inv.id}/pdf`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const { whatsappUrl } = await res.json();
      window.open(whatsappUrl, "_blank");
      toast.success("WhatsApp ouvert 📲");
    } catch (err: any) {
      toast.error(err.message || "Erreur WhatsApp", { duration: 5000 });
    } finally {
      setWaLoading(false);
    }
  }

  async function handlePdf() {
    setOpen(false);
    if (!inv.id) { console.error("Missing invoice ID"); return; }
    console.log("Invoice ID for PDF:", inv.id);
    try {
      const res = await fetch(`/api/invoices/${inv.id}/pdf`);
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const disposition = res.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      a.href = url;
      a.download = match ? match[1] : `facture-${inv.invoice_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1000);
    } catch (e: any) {
      console.error("PDF error:", e);
      toast.error(e.message || "Erreur lors du téléchargement");
    }
  }

  function handleRelance() {
    setOpen(false);
    const client = (inv as any).clients;
    const phone = client?.phone?.replace(/\D/g, "");
    if (!phone) { toast.error("Numéro de téléphone du client manquant"); return; }
    const msg = encodeURIComponent(`Bonjour, je vous relance concernant la facture ${inv.invoice_number} d'un montant de ${fmt(Number(inv.total))}. Merci de procéder au règlement.`);
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  }

  const itemsByStatus: Record<string, MenuItem[]> = {
    draft: [
      { label: "Modifier", href: `/invoices/${inv.id}/edit` },
      { label: "Télécharger PDF", action: handlePdf },
      { label: "Envoyer par WhatsApp", action: handleWhatsApp },
      { label: "Envoyer par email", action: handleEmail },
      { label: "Supprimer", action: () => { setOpen(false); onDelete(inv.id); }, red: true },
    ],
    sent: [
      { label: "Voir la facture", href: `/invoices/${inv.id}` },
      { label: "Télécharger PDF", action: handlePdf },
      { label: "Envoyer par WhatsApp", action: handleWhatsApp },
      { label: "Envoyer par email", action: handleEmail },
      { label: "Marquer comme payée", action: () => { setOpen(false); onMarkPaid(inv.id); } },
      { label: "Supprimer", action: () => { setOpen(false); onDelete(inv.id); }, red: true },
    ],
    paid: [
      { label: "Voir la facture", href: `/invoices/${inv.id}` },
      { label: "Télécharger PDF", action: handlePdf },
      { label: "Envoyer par WhatsApp", action: handleWhatsApp },
      { label: "Envoyer par email", action: handleEmail },
      { label: "Supprimer", action: () => { setOpen(false); onDelete(inv.id); }, red: true },
    ],
    overdue: [
      { label: "Voir la facture", href: `/invoices/${inv.id}` },
      { label: "Télécharger PDF", action: handlePdf },
      { label: "Envoyer par WhatsApp", action: handleWhatsApp },
      { label: "Envoyer par email", action: handleEmail },
      { label: "Marquer comme payée", action: () => { setOpen(false); onMarkPaid(inv.id); } },
      { label: "Relancer le client", action: handleRelance },
      { label: "Supprimer", action: () => { setOpen(false); onDelete(inv.id); }, red: true },
    ],
    cancelled: [
      { label: "Voir la facture", href: `/invoices/${inv.id}` },
      { label: "Supprimer", action: () => { setOpen(false); onDelete(inv.id); }, red: true },
    ],
  };

  const items = itemsByStatus[inv.status] ?? itemsByStatus.sent;

  return (
    <>
      <div className="flex justify-end">
        <button
          ref={btnRef}
          onClick={toggle}
          disabled={waLoading || emailLoading}
          className="flex items-center justify-center w-7 h-7 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#1A1A2E] transition-colors text-[18px] leading-none"
        >
          {(waLoading || emailLoading) ? <Loader2 size={13} className="animate-spin" /> : "⋯"}
        </button>
      </div>

      {open && (
        <div
          ref={menuRef}
          className="py-1"
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            zIndex: 9999,
            minWidth: "200px",
            background: "white",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          }}
        >
          {items.map((item) =>
            item.href ? (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-[13px] text-[#1A1A2E] hover:bg-[#FAFAF6] transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                onClick={item.action}
                className="w-full text-left px-4 py-2 text-[13px] hover:bg-[#FAFAF6] transition-colors"
                style={{ color: item.red ? "#DC2626" : "#1A1A2E" }}
              >
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </>
  );
}

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
        .select("*, clients(id, name, email, phone)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      setInvoices(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function markPaid(id: string) {
    const { error } = await supabase.from("invoices").update({ status: "paid" }).eq("id", id);
    if (error) { toast.error("Erreur lors de la mise à jour"); return; }
    setInvoices((prev) => prev.map((i) => i.id === id ? { ...i, status: "paid" } : i));
    toast.success("Facture marquée comme payée");
  }

  async function deleteInvoice(id: string) {
    if (!confirm("Supprimer cette facture ?")) return;
    const { error } = await supabase.from("invoices").delete().eq("id", id);
    if (error) { toast.error("Erreur lors de la suppression"); return; }
    setInvoices((prev) => prev.filter((i) => i.id !== id));
    toast.success("Facture supprimée");
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
                    <InvoiceMenu inv={inv} onMarkPaid={markPaid} onDelete={deleteInvoice} />
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
