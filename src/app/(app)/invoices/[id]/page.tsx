import { createClient } from "@/lib/supabase/server";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import { formatDate, INVOICE_STATUS_LABELS } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import InvoiceActions from "./InvoiceActions";

function fmt(n: number) {
  return n.toLocaleString("fr-MA", { minimumFractionDigits: 2 }) + " MAD";
}
function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  catch { return d; }
}

const STATUS_CLASS: Record<string, [string, string]> = {
  paid:                 ["#D1FAE5", "#065F46"],
  sent:                 ["#EFF6FF", "#1D4ED8"],
  overdue:              ["#FEE2E2", "#991B1B"],
  draft:                ["#F3F4F6", "#6B7280"],
  cancelled:            ["#F3F4F6", "#6B7280"],
  partiellement_payee:  ["#FEF3C7", "#92400E"],
};

const STATUS_LABEL: Record<string, string> = {
  ...INVOICE_STATUS_LABELS,
  partiellement_payee: "Partiel",
};

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const ownerId = await resolveAccountOwnerId(user!.id);

  const { data: inv } = await supabase
    .from("invoices")
    .select("*, clients(*)")
    .eq("id", id)
    .eq("user_id", ownerId)
    .is("dossier_id", null)
    .single();

  if (!inv) notFound();

  const { data: versions } = await supabase
    .from("entity_versions")
    .select("id, version_number, changed_at, changed_by_email, change_type, change_reason, diff")
    .eq("entity_type", "invoice")
    .eq("entity_id", id)
    .order("version_number", { ascending: false });

  const client = (inv as any).clients;
  const [bgStatus, colorStatus] = STATUS_CLASS[inv.status] ?? ["#F3F4F6", "#6B7280"];
  const labelStatus = STATUS_LABEL[inv.status] ?? inv.status;

  const paiements: Array<{ date: string; montant: number; mode: string; note?: string }> =
    Array.isArray((inv as any).paiements) ? (inv as any).paiements : [];
  const montantPaye = Number((inv as any).montant_paye ?? 0);
  const resteAPayer = Number((inv as any).reste_a_payer ?? Number(inv.total));
  const totalTtc = Number(inv.total);

  return (
    <div>
      {/* Back */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/invoices" className="btn btn-outline flex items-center gap-1.5">
          <ArrowLeft size={13} /> Retour
        </Link>
        <span className="text-[13px] font-semibold text-[#1A1A2E]">{inv.invoice_number}</span>
        <span
          className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold"
          style={{ backgroundColor: bgStatus, color: colorStatus }}
        >
          {labelStatus}
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
              <div className="total-row grand"><span>Total TTC</span><span>{fmt(totalTtc)}</span></div>
            </div>
          </div>

          {/* Payment history */}
          {paiements.length > 0 && (
            <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[rgba(0,0,0,0.06)]">
                <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.5px]">
                  Historique des paiements
                </span>
              </div>
              <div className="divide-y divide-[rgba(0,0,0,0.05)]">
                {paiements.map((p, i) => (
                  <div key={i} className="px-4 py-3 flex items-center justify-between text-[12.5px]">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[#6B7280]">{fmtDate(p.date)}</span>
                      <span className="text-[#9CA3AF]">·</span>
                      <span className="text-[#374151]">{p.mode}</span>
                      {p.note && (
                        <span className="text-[#9CA3AF] text-[11.5px]">{p.note}</span>
                      )}
                    </div>
                    <span className="font-semibold text-[#1A1A2E] ml-4">{fmt(Number(p.montant))}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-[rgba(0,0,0,0.06)] px-4 py-3 bg-[#FAFAF6]">
                <div className="flex justify-between text-[12.5px] mb-1">
                  <span className="text-[#6B7280]">Total payé</span>
                  <span className="font-semibold text-[#059669]">{fmt(montantPaye)}</span>
                </div>
                {resteAPayer > 0.01 && (
                  <div className="flex justify-between text-[12.5px]">
                    <span className="text-[#6B7280]">Reste à payer</span>
                    <span className="font-bold text-[#C8924A]">{fmt(resteAPayer)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {inv.notes && (
            <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-4">
              <div className="text-[10.5px] text-[#6B7280] uppercase tracking-[0.5px] mb-1">Notes</div>
              <p className="text-[12.5px] text-[#6B7280]">{inv.notes}</p>
            </div>
          )}

          <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[rgba(0,0,0,0.06)]">
              <div className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.5px]">
                Historique des versions
              </div>
            </div>
            <div className="divide-y divide-[rgba(0,0,0,0.05)]">
              {(versions ?? []).map((version: any) => (
                <details key={version.id} className="group">
                  <summary className="px-4 py-3 cursor-pointer list-none flex items-center justify-between gap-3 text-[12.5px] hover:bg-[#FAFAF6]">
                    <span className="font-semibold text-[#1A1A2E]">
                      Version {version.version_number} · {version.change_type ?? "UPDATE"}
                    </span>
                    <span className="text-[#6B7280]">
                      {fmtDate(version.changed_at)} · {version.changed_by_email ?? "Système"}
                    </span>
                  </summary>
                  <div className="px-4 pb-4 text-[12px] text-[#6B7280]">
                    {version.change_reason && <div className="mb-2">{version.change_reason}</div>}
                    <pre className="bg-[#FAFAF6] border border-[rgba(0,0,0,0.06)] rounded-lg p-3 overflow-x-auto text-[11px] leading-relaxed">
                      {JSON.stringify(version.diff ?? {}, null, 2)}
                    </pre>
                  </div>
                </details>
              ))}
              {(versions ?? []).length === 0 && (
                <div className="px-4 py-6 text-center text-[12px] text-[#9CA3AF]">
                  Aucun historique enregistré pour cette facture.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Side */}
        <div className="flex flex-col gap-3">
          <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-4">
            <div className="text-[10.5px] text-[#6B7280] uppercase tracking-[0.5px] mb-1">Montant total</div>
            <div className="text-[26px] font-bold text-[#C8924A] leading-none mb-1">{fmt(totalTtc)}</div>
            <div className="text-[11.5px] text-[#9CA3AF]">dont TVA {fmt(Number(inv.tax_amount))}</div>
            {montantPaye > 0 && montantPaye < totalTtc && (
              <>
                <div className="h-px bg-[rgba(0,0,0,0.06)] my-2" />
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#F3F4F6" }}>
                  <div className="h-full rounded-full" style={{
                    backgroundColor: "#C8924A",
                    width: `${Math.min(100, (montantPaye / totalTtc) * 100)}%`,
                  }} />
                </div>
                <div className="flex justify-between mt-1 text-[11px]">
                  <span className="text-[#059669] font-medium">{fmt(montantPaye)} payé</span>
                  <span className="text-[#C8924A] font-medium">{fmt(resteAPayer)} restant</span>
                </div>
              </>
            )}
          </div>
          <InvoiceActions
            invoiceId={inv.id}
            invoiceNumber={inv.invoice_number}
            status={inv.status}
            totalTtc={totalTtc}
            montantPaye={montantPaye}
            paiements={paiements}
            clientPhone={client?.phone ?? null}
            clientEmail={client?.email ?? null}
            clientId={client?.id ?? null}
            whatsappSentAt={(inv as any).whatsapp_sent_at ?? null}
            whatsappSentCount={(inv as any).whatsapp_sent_count ?? 0}
            emailSentAt={(inv as any).email_sent_at ?? null}
            emailSentCount={(inv as any).email_sent_count ?? 0}
          />
        </div>
      </div>
    </div>
  );
}
