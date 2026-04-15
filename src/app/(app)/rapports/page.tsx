"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { BarChart2, Lock, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MonthData {
  ca: number;
  depenses: number;
  invoiceCount: number;
  topClients: { name: string; total: number }[];
  categories: { name: string; total: number }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) { return Math.abs(n).toLocaleString("fr-MA") + " MAD"; }

function monthLabel(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString("fr-MA", { month: "long", year: "numeric" });
}

function monthBounds(year: number, month: number) {
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const end = new Date(year, month + 1, 0);
  const endStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  return { start, end: endStr };
}

// ─── Locked report card ───────────────────────────────────────────────────────

function LockedReport({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 bg-white border border-[rgba(0,0,0,0.08)] rounded-lg px-4 py-3 opacity-60 cursor-not-allowed"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <Lock size={14} className="text-[#C8924A] flex-shrink-0" />
      <div>
        <p className="text-[13px] font-medium text-[#1A1A2E]">{title}</p>
        <p className="text-[11.5px] text-[#6B7280]">{sub}</p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RapportsPage() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [data, setData]   = useState<MonthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [notified, setNotified] = useState(false);
  const supabase = createClient();

  // ── Fetch month data ────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { start, end } = monthBounds(year, month);

    const [invRes, txRes] = await Promise.all([
      supabase.from("invoices").select("*, clients(id,name)")
        .eq("user_id", user.id)
        .gte("issue_date", start).lte("issue_date", end),
      supabase.from("transactions").select("*")
        .eq("user_id", user.id)
        .gte("date", start).lte("date", end),
    ]);

    const invoices = invRes.data ?? [];
    const transactions = txRes.data ?? [];

    const ca = invoices
      .filter((i) => i.status === "paid")
      .reduce((s, i) => s + Number(i.total), 0);

    const depenses = transactions
      .filter((t) => Number(t.amount) < 0)
      .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

    // Top clients
    const clientMap: Record<string, { name: string; total: number }> = {};
    for (const inv of invoices.filter((i) => i.status === "paid")) {
      const name = (inv as any).clients?.name ?? "Inconnu";
      const id = inv.client_id ?? name;
      if (!clientMap[id]) clientMap[id] = { name, total: 0 };
      clientMap[id].total += Number(inv.total);
    }
    const topClients = Object.values(clientMap)
      .sort((a, b) => b.total - a.total).slice(0, 5);

    // Categories
    const catMap: Record<string, number> = {};
    for (const tx of transactions.filter((t) => Number(t.amount) < 0)) {
      const cat = tx.category ?? "Autre";
      catMap[cat] = (catMap[cat] ?? 0) + Math.abs(Number(tx.amount));
    }
    const categories = Object.entries(catMap)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);

    setData({ ca, depenses, invoiceCount: invoices.length, topClients, categories });
    setLoading(false);
  }, [year, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  async function handleNotify(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    await supabase.from("fiduciaire_waitlist").insert({ email, user_id: null });
    setNotified(true);
    toast.success("Vous serez notifié !");
  }

  const net = (data?.ca ?? 0) - (data?.depenses ?? 0);
  const maxClient = data?.topClients[0]?.total ?? 1;
  const maxCat = data?.categories[0]?.total ?? 1;
  const totalCat = data?.categories.reduce((s, c) => s + c.total, 0) ?? 1;

  return (
    <div className="max-w-3xl">

      {/* ── Coming soon hero ──────────────────────────────────────────────── */}
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-8 mb-6 text-center"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
          style={{ background: "rgba(200,146,74,0.1)" }}>
          <BarChart2 size={28} className="text-[#C8924A]" />
        </div>

        <h1 className="text-[22px] font-semibold text-[#1A1A2E] mb-2">Rapports & Analyses</h1>
        <p className="text-[14px] text-[#6B7280] mb-4 max-w-sm mx-auto">
          Visualisez la santé financière de votre business en un coup d'œil.
        </p>

        <span className="inline-block text-[12px] font-medium text-[#C8924A] border border-[#C8924A] rounded-full px-4 py-1 mb-6">
          Disponible prochainement
        </span>

        {/* Locked reports */}
        <div className="text-left space-y-2 mb-6">
          <LockedReport title="Rapport de rentabilité client"  sub="Vos clients les plus profitables" />
          <LockedReport title="Évolution du chiffre d'affaires" sub="Tendances mois par mois" />
          <LockedReport title="Analyse des charges"            sub="Répartition par catégorie" />
          <LockedReport title="Prévisions de trésorerie"       sub="Projection 3 mois" />
          <LockedReport title="Rapport IS estimé"              sub="Impôt sur les sociétés prévisionnel" />
        </div>

        {/* Email capture */}
        {notified ? (
          <p className="text-[13px] text-[#059669] font-medium">✓ Vous serez notifié !</p>
        ) : (
          <form onSubmit={handleNotify} className="flex gap-2 max-w-sm mx-auto">
            <input
              className="input flex-1"
              type="email"
              placeholder="votre@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" className="btn btn-gold flex-shrink-0">
              Me notifier →
            </button>
          </form>
        )}
      </div>

      {/* ── Working report ────────────────────────────────────────────────── */}
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl overflow-hidden"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(0,0,0,0.08)]">
          <div>
            <h2 className="text-[14px] font-semibold text-[#1A1A2E]">📊 Résumé du mois</h2>
            <p className="text-[12px] text-[#6B7280] capitalize">{monthLabel(year, month)}</p>
          </div>
          {/* Month selector */}
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F3F4F6] text-[#6B7280] transition-colors">
              <ChevronLeft size={15} />
            </button>
            <span className="text-[12.5px] font-medium text-[#1A1A2E] px-1 capitalize min-w-[110px] text-center">
              {monthLabel(year, month)}
            </span>
            <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F3F4F6] text-[#6B7280] transition-colors">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-[#C8924A]" />
          </div>
        ) : (
          <div className="p-5">

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-6">
              <div className="kpi">
                <div className="kpi-label">CA du mois</div>
                <div className="kpi-value text-[20px]">{fmt(data?.ca ?? 0)}</div>
                <div className="text-[11px] text-[#6B7280]">Factures payées</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Dépenses</div>
                <div className="kpi-value text-[20px] text-[#DC2626]">{fmt(data?.depenses ?? 0)}</div>
                <div className="text-[11px] text-[#6B7280]">Charges du mois</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Résultat net</div>
                <div className={`kpi-value text-[20px] ${net >= 0 ? "text-[#059669]" : "text-[#DC2626]"}`}>
                  {net >= 0 ? "+" : ""}{fmt(net)}
                </div>
                <div className="text-[11px] text-[#6B7280]">CA − Dépenses</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Factures émises</div>
                <div className="kpi-value text-[20px]">{data?.invoiceCount ?? 0}</div>
                <div className="text-[11px] text-[#6B7280]">Ce mois</div>
              </div>
            </div>

            {/* Two columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">

              {/* Top clients */}
              <div>
                <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.7px] mb-3">
                  Meilleurs clients
                </p>
                {data?.topClients.length === 0 ? (
                  <p className="text-[12.5px] text-[#6B7280]">Aucun client ce mois</p>
                ) : (
                  <div className="space-y-2.5">
                    {data?.topClients.map((c, i) => (
                      <div key={c.name}>
                        <div className="flex items-center justify-between text-[12.5px] mb-1">
                          <span className="text-[#1A1A2E] font-medium flex items-center gap-1.5">
                            <span className="text-[10px] text-[#6B7280] w-4">#{i + 1}</span>
                            {c.name}
                          </span>
                          <span className="text-[#6B7280]">{fmt(c.total)}</span>
                        </div>
                        <div className="h-[4px] bg-[#F3F4F6] rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-[#C8924A]"
                            style={{ width: `${(c.total / maxClient) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Categories */}
              <div>
                <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.7px] mb-3">
                  Répartition des charges
                </p>
                {data?.categories.length === 0 ? (
                  <p className="text-[12.5px] text-[#6B7280]">Aucune dépense ce mois</p>
                ) : (
                  <div className="space-y-2.5">
                    {data?.categories.slice(0, 5).map((c, i) => {
                      const pct = Math.round((c.total / totalCat) * 100);
                      const colors = ["#C8924A", "#0D1526", "#059669", "#2563EB", "#7C3AED"];
                      return (
                        <div key={c.name}>
                          <div className="flex items-center justify-between text-[12.5px] mb-1">
                            <span className="flex items-center gap-1.5 text-[#1A1A2E]">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colors[i] }} />
                              {c.name}
                            </span>
                            <span className="text-[#6B7280]">{fmt(c.total)} <span className="text-[10.5px]">{pct}%</span></span>
                          </div>
                          <div className="h-[4px] bg-[#F3F4F6] rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: colors[i] }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Export */}
            <div className="border-t border-[rgba(0,0,0,0.07)] pt-4 flex justify-end">
              <button
                onClick={() => toast("Export PDF — disponible prochainement", { icon: "📄" })}
                className="btn btn-outline text-[12.5px]"
              >
                📄 Export en PDF
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
