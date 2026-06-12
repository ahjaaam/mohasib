"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { BarChart2, Download } from "lucide-react";
import { getAccountLabel, getAccountClass, getAccountClassName } from "@/lib/cgnc-mapping";
import { useAccountOwnerId } from "@/hooks/useAccountOwner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AccountBalance {
  compte: string;
  compte_label: string;
  total_debit: number;
  total_credit: number;
  solde: number;
}

interface ClassGroup {
  cls: number;
  name: string;
  accounts: AccountBalance[];
  subtotal_debit: number;
  subtotal_credit: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtN(n: number) {
  if (n === 0) return "—";
  return n.toLocaleString("fr-MA", { minimumFractionDigits: 2 });
}

function fmtSolde(n: number) {
  if (n === 0) return <span className="text-[#9CA3AF]">0,00</span>;
  return (
    <span className={n > 0 ? "text-[#059669]" : "text-[#DC2626]"}>
      {n > 0 ? "" : "("}{Math.abs(n).toLocaleString("fr-MA", { minimumFractionDigits: 2 })}{n < 0 ? ")" : ""}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BalancePage() {
  const ownerId = useAccountOwnerId();
  const supabase = createClient();
  const [groups, setGroups]   = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("user_id", ownerId)
      .single();

    if (!company) { setLoading(false); return; }

    let q = supabase
      .from("ecritures_comptables")
      .select("compte, compte_label, debit, credit")
      .eq("company_id", company.id);

    if (dateFrom) q = (q as any).gte("date_ecriture", dateFrom);
    if (dateTo)   q = (q as any).lte("date_ecriture", dateTo);

    const { data: rows } = await q;

    // Aggregate by compte
    const map: Record<string, AccountBalance> = {};
    for (const r of (rows ?? [])) {
      if (!map[r.compte]) {
        map[r.compte] = {
          compte: r.compte,
          compte_label: r.compte_label ?? getAccountLabel(r.compte),
          total_debit: 0,
          total_credit: 0,
          solde: 0,
        };
      }
      map[r.compte].total_debit  += Number(r.debit);
      map[r.compte].total_credit += Number(r.credit);
    }

    for (const acc of Object.values(map)) {
      acc.solde = acc.total_debit - acc.total_credit;
    }

    // Group by account class
    const classMap: Record<number, AccountBalance[]> = {};
    for (const acc of Object.values(map).sort((a, b) => a.compte.localeCompare(b.compte))) {
      const cls = getAccountClass(acc.compte);
      if (!classMap[cls]) classMap[cls] = [];
      classMap[cls].push(acc);
    }

    const result: ClassGroup[] = Object.entries(classMap)
      .map(([clsStr, accounts]) => {
        const cls = Number(clsStr);
        return {
          cls,
          name: getAccountClassName(cls),
          accounts,
          subtotal_debit:  accounts.reduce((s, a) => s + a.total_debit,  0),
          subtotal_credit: accounts.reduce((s, a) => s + a.total_credit, 0),
        };
      })
      .sort((a, b) => a.cls - b.cls);

    setGroups(result);
    setLoading(false);
  }, [dateFrom, dateTo, ownerId]);

  useEffect(() => { load(); }, [load]);

  const grandDebit  = groups.reduce((s, g) => s + g.subtotal_debit,  0);
  const grandCredit = groups.reduce((s, g) => s + g.subtotal_credit, 0);
  const balanced    = Math.abs(grandDebit - grandCredit) < 0.01;

  function exportCSV() {
    const header = "Compte;Libellé;Débit total;Crédit total;Solde\n";
    const rows   = groups.flatMap((g) => [
      ...g.accounts.map((a) =>
        [a.compte, a.compte_label, a.total_debit.toFixed(2), a.total_credit.toFixed(2), a.solde.toFixed(2)].join(";")
      ),
      [`SOUS-TOTAL ${g.name}`, "", g.subtotal_debit.toFixed(2), g.subtotal_credit.toFixed(2), (g.subtotal_debit - g.subtotal_credit).toFixed(2)].join(";"),
      "",
    ]).join("\n");
    const total = `TOTAL;;${grandDebit.toFixed(2)};${grandCredit.toFixed(2)};${(grandDebit - grandCredit).toFixed(2)}`;
    const blob  = new Blob([header + rows + total], { type: "text/csv;charset=utf-8;" });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement("a");
    a.href = url; a.download = `balance-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[rgba(200,146,74,0.12)] flex items-center justify-center flex-shrink-0">
          <BarChart2 size={18} className="text-[#C8924A]" />
        </div>
        <div>
          <h1 className="text-[18px] font-bold text-[#1A1A2E] leading-tight">Balance comptable</h1>
          <p className="text-[12px] text-[#6B7280]">Totaux débit/crédit par compte — doit être équilibrée</p>
        </div>
        {groups.length > 0 && (
          <button onClick={exportCSV} className="ml-auto btn btn-outline flex items-center gap-1.5">
            <Download size={13} /> Export CSV
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.5px]">Du</label>
          <input type="date" className="input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.5px]">Au</label>
          <input type="date" className="input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <button onClick={load} className="btn btn-outline">Actualiser</button>
      </div>

      {/* Balance indicator */}
      {groups.length > 0 && (
        <div className={`rounded-lg px-4 py-2.5 mb-4 text-[12.5px] font-medium flex items-center gap-2 ${
          balanced ? "bg-[#D1FAE5] text-[#065F46]" : "bg-[#FEE2E2] text-[#991B1B]"
        }`}>
          {balanced ? "✅ Balance équilibrée — Total Débit = Total Crédit" : "⚠️ Balance déséquilibrée — vérifiez vos écritures"}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-[13px] text-[#6B7280]">Chargement...</div>
      ) : groups.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-xl border border-[rgba(0,0,0,0.08)]">
          <BarChart2 size={36} className="text-[#D1D5DB] mx-auto mb-3" />
          <p className="text-[13px] text-[#6B7280] mb-1">Aucune écriture comptable</p>
          <p className="text-[12px] text-[#9CA3AF]">Créez des factures ou importez un relevé bancaire pour alimenter la balance.</p>
        </div>
      ) : (
        <div className="tbl">
          <table>
            <thead>
              <tr>
                <th className="w-20">Compte</th>
                <th>Libellé</th>
                <th className="text-right w-36">Débit total</th>
                <th className="text-right w-36">Crédit total</th>
                <th className="text-right w-36">Solde</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <>
                  {/* Class header */}
                  <tr key={`cls-${g.cls}`} style={{ background: "rgba(200,146,74,0.06)" }}>
                    <td colSpan={5} className="px-3 py-2 text-[11px] font-bold text-[#C8924A] uppercase tracking-[0.5px]">
                      {g.name}
                    </td>
                  </tr>

                  {/* Account rows */}
                  {g.accounts.map((a) => (
                    <tr key={a.compte}>
                      <td className="font-mono text-[12px] text-[#374151]">{a.compte}</td>
                      <td className="text-[12.5px]">{a.compte_label}</td>
                      <td className="text-right text-[12.5px] text-[#059669] font-medium">{fmtN(a.total_debit)}</td>
                      <td className="text-right text-[12.5px] text-[#DC2626] font-medium">{fmtN(a.total_credit)}</td>
                      <td className="text-right text-[12.5px] font-semibold">{fmtSolde(a.solde)}</td>
                    </tr>
                  ))}

                  {/* Class subtotal */}
                  <tr key={`sub-${g.cls}`} style={{ background: "#FAFAF6", borderTop: "1.5px solid rgba(0,0,0,0.08)" }}>
                    <td colSpan={2} className="px-3 py-2 text-[11.5px] font-bold text-[#1A1A2E]">
                      Sous-total {g.name.split("—")[0].trim()}
                    </td>
                    <td className="px-3 py-2 text-right text-[12px] font-bold text-[#059669]">
                      {g.subtotal_debit.toLocaleString("fr-MA", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-right text-[12px] font-bold text-[#DC2626]">
                      {g.subtotal_credit.toLocaleString("fr-MA", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-right text-[12px] font-bold">
                      {fmtSolde(g.subtotal_debit - g.subtotal_credit)}
                    </td>
                  </tr>
                </>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "#0D1526" }}>
                <td colSpan={2} className="px-3 py-3 text-[12px] font-bold text-white">TOTAL GÉNÉRAL</td>
                <td className="px-3 py-3 text-right text-[13px] font-bold text-[#C8924A]">
                  {grandDebit.toLocaleString("fr-MA", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-3 py-3 text-right text-[13px] font-bold text-[#C8924A]">
                  {grandCredit.toLocaleString("fr-MA", { minimumFractionDigits: 2 })}
                </td>
                <td className={`px-3 py-3 text-right text-[13px] font-bold ${balanced ? "text-[#C8924A]" : "text-[#EF4444]"}`}>
                  {balanced ? "✓ 0,00" : (grandDebit - grandCredit).toLocaleString("fr-MA", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
