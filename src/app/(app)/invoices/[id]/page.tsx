import { createClient } from "@/lib/supabase/server";
import { formatDate, INVOICE_STATUS_LABELS } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import InvoiceActions from "./InvoiceActions";

function fmt(n: number) { return n.toLocaleString("fr-MA", { minimumFractionDigits: 2 }) + " MAD"; }

const STATUS_CLASS: Record<string, string> = {
  paid: "b-paid",
  sent: "b-pending",
  overdue: "b-overdue",
  draft: "b-draft",
  cancelled: "b-draft",
};

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: inv } = await supabase
    .from("invoices")
    .select("*, clients(*)")
    .eq("id", id)
    .eq("user_id", user!.id)
    .single();

  if (!inv) notFound();

  const client = (inv as any).clients;

  return (
    <div>
      {/* Back */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/invoices" className="btn btn-outline flex items-center gap-1.5">
          <ArrowLeft size={13} /> Retour
        </Link>
        <span className="text-[13px] font-semibold text-[#1A1A2E]">{inv.invoice_number}</span>
        <span className={`badge ${STATUS_CLASS[inv.status] ?? "b-draft"}`}>
          {INVOICE_STATUS_LABELS[inv.status] ?? inv.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-3">
        {/* Main */}
        <div className="flex flex-col gap-3">
          {/* Client + dates */}
          <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10.5px] text-[#6B7280] uppercase tracking-[0.5px] mb-1">Facturé à</div>
                <div className="text-[13.5px] font-semibold text-[#1A1A2E]">{client?.name ?? "—"}</div>
                {client?.email && <div className="text-[12px] text-[#6B7280] mt-0.5">{client.email}</div>}
                {client?.address && <div className="text-[12px] text-[#6B7280]">{client.address}</div>}
                {client?.city && <div className="text-[12px] text-[#6B7280]">{client.city}</div>}
                {client?.ice && <div className="text-[11.5px] text-[#9CA3AF] mt-1">ICE: {client.ice}</div>}
              </div>
              <div className="flex flex-col gap-2">
                <div>
                  <div className="text-[10.5px] text-[#6B7280] uppercase tracking-[0.5px] mb-0.5">Date d&apos;émission</div>
                  <div className="text-[12.5px] font-medium text-[#1A1A2E]">{formatDate(inv.issue_date)}</div>
                </div>
                {inv.due_date && (
                  <div>
                    <div className="text-[10.5px] text-[#6B7280] uppercase tracking-[0.5px] mb-0.5">Échéance</div>
                    <div className="text-[12.5px] font-medium text-[#1A1A2E]">{formatDate(inv.due_date)}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="tbl">
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th className="text-right">Qté</th>
                  <th className="text-right">P.U. HT</th>
                  <th className="text-right">Total HT</th>
                </tr>
              </thead>
              <tbody>
                {inv.items.map((item: any, i: number) => (
                  <tr key={i}>
                    <td>{item.description}</td>
                    <td className="text-right text-[#6B7280]">{item.quantity}</td>
                    <td className="text-right text-[#6B7280]">{fmt(item.unit_price)}</td>
                    <td className="text-right font-medium">{fmt(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Totals */}
            <div className="totals-box mx-0 rounded-none border-0 border-t border-[rgba(0,0,0,0.07)]">
              <div className="total-row"><span>Total HT</span><span>{fmt(Number(inv.subtotal))}</span></div>
              <div className="total-row"><span>TVA ({inv.tax_rate}%)</span><span>{fmt(Number(inv.tax_amount))}</span></div>
              <div className="total-row grand"><span>Total TTC</span><span>{fmt(Number(inv.total))}</span></div>
            </div>
          </div>

          {inv.notes && (
            <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-4">
              <div className="text-[10.5px] text-[#6B7280] uppercase tracking-[0.5px] mb-1">Notes</div>
              <p className="text-[12.5px] text-[#6B7280]">{inv.notes}</p>
            </div>
          )}
        </div>

        {/* Side */}
        <div className="flex flex-col gap-3">
          <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-4">
            <div className="text-[10.5px] text-[#6B7280] uppercase tracking-[0.5px] mb-1">Montant total</div>
            <div className="text-[26px] font-bold text-[#C8924A] leading-none mb-1">{fmt(Number(inv.total))}</div>
            <div className="text-[11.5px] text-[#9CA3AF]">dont TVA {fmt(Number(inv.tax_amount))}</div>
          </div>
          <InvoiceActions
            invoiceId={inv.id}
            status={inv.status}
            clientPhone={client?.phone ?? null}
            clientId={client?.id ?? null}
            whatsappSentAt={(inv as any).whatsapp_sent_at ?? null}
            whatsappSentCount={(inv as any).whatsapp_sent_count ?? 0}
          />
        </div>
      </div>
    </div>
  );
}
