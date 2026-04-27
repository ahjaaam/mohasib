"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { translateError } from "@/lib/errors";
import { Download, Package, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";

function fmt(n: number) {
  return n.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

const now = new Date();

function getMonth() {
  const d = now;
  const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start, end: `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}` };
}

function getQuarter(q: number, y: number) {
  const sm = (q - 1) * 3;
  const start = `${y}-${String(sm + 1).padStart(2, "0")}-01`;
  const last = new Date(y, sm + 3, 0);
  return { start, end: `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}` };
}

function getYear(y: number) {
  return { start: `${y}-01-01`, end: `${y}-12-31` };
}

const STEPS = [
  "Journal des Ventes (Excel)",
  "Journal des Ventes (PDF)",
  "Journal des Achats (Excel)",
  "Grand Livre (Excel)",
  "Balance Comptable (Excel)",
  "Récap TVA (PDF)",
  "Synthèse Financière (PDF)",
];

const CATEGORY_ACCOUNTS: Record<string, { num: string; name: string }> = {
  "Ventes":           { num: "7111", name: "Ventes de marchandises" },
  "Services":         { num: "7061", name: "Prestations de services" },
  "Loyer":            { num: "6132", name: "Locations immobilières" },
  "Salaires":         { num: "6171", name: "Rémunérations du personnel" },
  "Équipement":       { num: "2340", name: "Matériel et outillage" },
  "Marketing":        { num: "6143", name: "Publicité et marketing" },
  "Transport":        { num: "6142", name: "Transports" },
  "Fournitures":      { num: "6122", name: "Fournitures de bureau" },
  "Télécommunications": { num: "6141", name: "Honoraires et commissions" },
  "default":          { num: "6147", name: "Autres charges externes" },
};

interface HistoryItem { date: string; periodLabel: string; filename: string }
interface Stats {
  invoiceCount: number; invoiceTotal: number;
  expenseCount: number; expenseTotal: number;
  tvaCollected: number; tvaDeductible: number;
}

export default function ExportPage() {
  const [mode, setMode] = useState<"month"|"quarter"|"year"|"custom">("quarter");
  const [quarter, setQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3));
  const [year, setYear] = useState(now.getFullYear());
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [profile, setProfile] = useState<Record<string, string> | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const supabase = createClient();

  const period = (() => {
    if (mode === "month")   return getMonth();
    if (mode === "quarter") return getQuarter(quarter, year);
    if (mode === "year")    return getYear(year);
    return { start: customStart, end: customEnd };
  })();

  const periodLabel = (() => {
    if (mode === "quarter") return `T${quarter}-${year}`;
    if (mode === "year")    return String(year);
    if (mode === "month") {
      return new Date(period.start + "T00:00:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    }
    return period.start && period.end ? `${period.start}_${period.end}` : "Période";
  })();

  const safeCompany = (profile?.company ?? "Mohasib").replace(/[^a-zA-Z0-9]/g, "_");
  const safePeriod  = periodLabel.replace(/[^a-zA-Z0-9-]/g, "_");
  const today       = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const zipName     = `Mohasib_Export_${safeCompany}_${safePeriod}_${today}.zip`;

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("users").select("*").eq("id", user.id).single();
      if (data) setProfile(data);
    })();
    try { setHistory(JSON.parse(localStorage.getItem("mohasib_export_history") || "[]")); } catch {}
  }, []);

  useEffect(() => {
    if (!period.start || !period.end) return;
    setStats(null);
    setDone(false);
    setError(null);
    fetchStats();
  }, [period.start, period.end]);

  async function fetchStats() {
    setLoadingStats(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [invRes, txRes] = await Promise.all([
      supabase.from("invoices").select("total,tax_amount,status").eq("user_id", user.id)
        .gte("issue_date", period.start).lte("issue_date", period.end),
      supabase.from("transactions").select("amount,type,category").eq("user_id", user.id)
        .gte("date", period.start).lte("date", period.end),
    ]);
    const invoices = (invRes.data ?? []).filter((i: any) => i.status !== "draft" && i.status !== "cancelled");
    const expenses = (txRes.data ?? []).filter((t: any) => t.type === "expense");
    setStats({
      invoiceCount:   invoices.length,
      invoiceTotal:   invoices.reduce((s: number, i: any) => s + Number(i.total), 0),
      expenseCount:   expenses.length,
      expenseTotal:   expenses.reduce((s: number, t: any) => s + Number(t.amount), 0),
      tvaCollected:   invoices.reduce((s: number, i: any) => s + Number(i.tax_amount), 0),
      tvaDeductible:  expenses.reduce((s: number, t: any) => s + Number(t.amount) * 0.2, 0),
    });
    setLoadingStats(false);
  }

  async function generatePackage() {
    if (!period.start || !period.end) return;
    setGenerating(true); setDone(false); setError(null); setCurrentStep(0);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const [invRes, txRes] = await Promise.all([
        supabase.from("invoices").select("*, clients(id,name,ice,address)")
          .eq("user_id", user.id).gte("issue_date", period.start).lte("issue_date", period.end)
          .order("issue_date", { ascending: true }),
        supabase.from("transactions").select("*")
          .eq("user_id", user.id).gte("date", period.start).lte("date", period.end)
          .order("date", { ascending: true }),
      ]);

      const invoices: any[] = (invRes.data ?? []).filter((i: any) => i.status !== "draft" && i.status !== "cancelled");
      const allTx: any[]    = txRes.data ?? [];
      const expenses        = allTx.filter(t => t.type === "expense");

      // Lazy-load heavy libraries
      const XLSX              = await import("xlsx");
      const { jsPDF }         = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();

      // ── PDF helpers ──────────────────────────────────────────────────────────
      function addHeader(doc: any, title: string) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10); doc.setTextColor(13, 21, 38);
        doc.text(profile?.company ?? "Votre Entreprise", 14, 20);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8); doc.setTextColor(100);
        if (profile?.ice)       doc.text(`ICE: ${profile.ice}`,           14, 26);
        if (profile?.rc)        doc.text(`RC: ${profile.rc}`,             14, 30);
        if (profile?.if_fiscal) doc.text(`IF: ${profile.if_fiscal}`,      14, 34);
        if (profile?.address)   doc.text(profile.address,                 14, 38);
        const cx = doc.internal.pageSize.width / 2;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14); doc.setTextColor(13, 21, 38);
        doc.text(title, cx, 25, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9); doc.setTextColor(100);
        doc.text(`Période : ${periodLabel}`, cx, 32, { align: "center" });
        doc.text(`Généré le : ${new Date().toLocaleDateString("fr-FR")}`, cx, 38, { align: "center" });
        return 50;
      }
      function addFooter(doc: any) {
        const n = doc.internal.getNumberOfPages();
        for (let i = 1; i <= n; i++) {
          doc.setPage(i);
          const y = doc.internal.pageSize.height - 8;
          doc.setFontSize(7); doc.setTextColor(150);
          doc.text("Généré par Mohasib — mohasib.ma", 14, y);
          doc.text(`Page ${i}/${n}`, doc.internal.pageSize.width - 14, y, { align: "right" });
        }
      }

      // ── 1. Journal des Ventes — Excel ────────────────────────────────────────
      setCurrentStep(0);
      {
        const rows: any[][] = [
          [profile?.company ?? "Mohasib", "", "", "", "", "", "", ""],
          [`JOURNAL DES VENTES — ${periodLabel}`, "", "", "", "", "", "", ""],
          [],
          ["Date", "N° Facture", "Client", "ICE Client", "Montant HT", "TVA", "Montant TTC", "Statut"],
        ];
        const byMonth: Record<string, any[]> = {};
        for (const inv of invoices) {
          const m = inv.issue_date.slice(0, 7);
          if (!byMonth[m]) byMonth[m] = [];
          byMonth[m].push(inv);
        }
        let gHT = 0, gTVA = 0, gTTC = 0;
        for (const [month, group] of Object.entries(byMonth)) {
          const ml = new Date(month + "-01T00:00:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
          rows.push([ml.toUpperCase(), "", "", "", "", "", "", ""]);
          let mHT = 0, mTVA = 0, mTTC = 0;
          for (const inv of group) {
            const ht = Number(inv.total) - Number(inv.tax_amount);
            const statusLabel = inv.status === "paid" ? "Payée" : inv.status === "sent" ? "Envoyée" : "En retard";
            rows.push([fmtDate(inv.issue_date), inv.invoice_number, inv.clients?.name ?? "—", inv.clients?.ice ?? "—", ht, Number(inv.tax_amount), Number(inv.total), statusLabel]);
            mHT += ht; mTVA += Number(inv.tax_amount); mTTC += Number(inv.total);
          }
          rows.push(["", "", "", `Sous-total ${ml}`, mHT, mTVA, mTTC, ""]);
          gHT += mHT; gTVA += mTVA; gTTC += mTTC;
        }
        rows.push([], ["", "", "", "TOTAL GÉNÉRAL", gHT, gTVA, gTTC, ""]);
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws["!cols"] = [{ wch: 12 }, { wch: 15 }, { wch: 26 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 10 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Journal des Ventes");
        zip.file(`01_Journal_Ventes_${safePeriod}.xlsx`, XLSX.write(wb, { bookType: "xlsx", type: "array" }));
      }

      // ── 2. Journal des Ventes — PDF ──────────────────────────────────────────
      setCurrentStep(1);
      {
        const doc = new jsPDF({ orientation: "landscape" });
        const startY = addHeader(doc, "JOURNAL DES VENTES");
        const body = invoices.map((inv: any) => {
          const ht = Number(inv.total) - Number(inv.tax_amount);
          return [fmtDate(inv.issue_date), inv.invoice_number, inv.clients?.name ?? "—", inv.clients?.ice ?? "—",
            `${fmt(ht)} MAD`, `${fmt(Number(inv.tax_amount))} MAD`, `${fmt(Number(inv.total))} MAD`,
            inv.status === "paid" ? "Payée" : inv.status === "sent" ? "Envoyée" : "En retard"];
        });
        const tHT  = invoices.reduce((s: number, i: any) => s + Number(i.total) - Number(i.tax_amount), 0);
        const tTVA = invoices.reduce((s: number, i: any) => s + Number(i.tax_amount), 0);
        const tTTC = invoices.reduce((s: number, i: any) => s + Number(i.total), 0);
        autoTable(doc, {
          startY, head: [["Date", "N° Facture", "Client", "ICE Client", "HT", "TVA", "TTC", "Statut"]],
          body,
          foot: [["", "", "", "TOTAL", `${fmt(tHT)} MAD`, `${fmt(tTVA)} MAD`, `${fmt(tTTC)} MAD`, ""]],
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [13, 21, 38], textColor: 255, fontStyle: "bold" },
          footStyles: { fillColor: [200, 146, 74], textColor: 255, fontStyle: "bold" },
          alternateRowStyles: { fillColor: [250, 250, 246] },
          showFoot: "lastPage",
        });
        addFooter(doc);
        zip.file(`02_Journal_Ventes_${safePeriod}.pdf`, doc.output("arraybuffer"));
      }

      // ── 3. Journal des Achats — Excel ────────────────────────────────────────
      setCurrentStep(2);
      {
        const rows: any[][] = [
          [profile?.company ?? "Mohasib", "", "", "", "", "", ""],
          [`JOURNAL DES ACHATS — ${periodLabel}`, "", "", "", "", "", ""],
          [],
          ["Date", "Description", "Catégorie", "N° Compte CGNC", "Montant HT", "TVA (est. 20%)", "Montant TTC"],
        ];
        const byCat: Record<string, any[]> = {};
        for (const tx of expenses) {
          const c = tx.category ?? "Autres";
          if (!byCat[c]) byCat[c] = [];
          byCat[c].push(tx);
        }
        let gHT = 0, gTVA = 0, gTTC = 0;
        for (const [cat, group] of Object.entries(byCat)) {
          const acc = CATEGORY_ACCOUNTS[cat] ?? CATEGORY_ACCOUNTS["default"];
          rows.push([cat.toUpperCase(), "", "", acc.num, "", "", ""]);
          let cHT = 0, cTVA = 0, cTTC = 0;
          for (const tx of group) {
            const ttc = Number(tx.amount), tva = ttc * 0.2, ht = ttc - tva;
            rows.push([fmtDate(tx.date), tx.description, cat, acc.num, ht, tva, ttc]);
            cHT += ht; cTVA += tva; cTTC += ttc;
          }
          rows.push(["", "", `Sous-total ${cat}`, "", cHT, cTVA, cTTC]);
          gHT += cHT; gTVA += cTVA; gTTC += cTTC;
        }
        rows.push([], ["", "", "TOTAL GÉNÉRAL", "", gHT, gTVA, gTTC]);
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws["!cols"] = [{ wch: 12 }, { wch: 32 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Journal des Achats");
        zip.file(`03_Journal_Achats_${safePeriod}.xlsx`, XLSX.write(wb, { bookType: "xlsx", type: "array" }));
      }

      // ── 4. Grand Livre — Excel ───────────────────────────────────────────────
      setCurrentStep(3);
      {
        type Entry = { num: string; name: string; date: string; label: string; debit: number; credit: number };
        const entries: Entry[] = [];
        for (const inv of invoices) {
          const ht = Number(inv.total) - Number(inv.tax_amount);
          entries.push({ num: "3421", name: "Clients",              date: inv.issue_date, label: `Facture ${inv.invoice_number}`, debit: Number(inv.total), credit: 0 });
          entries.push({ num: "7111", name: "Ventes marchandises",  date: inv.issue_date, label: `Facture ${inv.invoice_number}`, debit: 0, credit: ht });
          entries.push({ num: "4455", name: "TVA facturée",         date: inv.issue_date, label: `TVA – ${inv.invoice_number}`,   debit: 0, credit: Number(inv.tax_amount) });
        }
        for (const tx of expenses) {
          const acc = CATEGORY_ACCOUNTS[tx.category ?? ""] ?? CATEGORY_ACCOUNTS["default"];
          const tva = Number(tx.amount) * 0.2, ht = Number(tx.amount) - tva;
          entries.push({ num: acc.num, name: acc.name,  date: tx.date, label: tx.description, debit: ht,              credit: 0 });
          entries.push({ num: "4456", name: "TVA déductible", date: tx.date, label: `TVA – ${tx.description}`, debit: tva, credit: 0 });
          entries.push({ num: "5141", name: "Banques",         date: tx.date, label: tx.description,            debit: 0,   credit: Number(tx.amount) });
        }
        entries.sort((a, b) => a.num.localeCompare(b.num) || a.date.localeCompare(b.date));

        const rows: any[][] = [
          [profile?.company ?? "Mohasib", "", "", "", "", ""],
          [`GRAND LIVRE — ${periodLabel}`, "", "", "", "", ""],
          [],
          ["N° Compte", "Intitulé", "Date", "Libellé", "Débit (MAD)", "Crédit (MAD)"],
        ];
        let curNum = "", aD = 0, aC = 0;
        for (const e of entries) {
          if (e.num !== curNum) {
            if (curNum) { rows.push(["", `Solde compte ${curNum}`, "", "", aD, aC]); rows.push([]); }
            curNum = e.num; aD = 0; aC = 0;
            rows.push([`── COMPTE ${e.num} — ${e.name} ──`, "", "", "", "", ""]);
            rows.push(["", "", "Solde d'ouverture", "", 0, 0]);
          }
          rows.push([e.num, e.name, fmtDate(e.date), e.label, e.debit || "", e.credit || ""]);
          aD += e.debit; aC += e.credit;
        }
        if (curNum) rows.push(["", `Solde compte ${curNum}`, "", "", aD, aC]);

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws["!cols"] = [{ wch: 10 }, { wch: 26 }, { wch: 12 }, { wch: 36 }, { wch: 14 }, { wch: 14 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Grand Livre");
        zip.file(`04_Grand_Livre_${safePeriod}.xlsx`, XLSX.write(wb, { bookType: "xlsx", type: "array" }));
      }

      // ── 5. Balance Comptable — Excel ─────────────────────────────────────────
      setCurrentStep(4);
      {
        const bal: Record<string, { name: string; debit: number; credit: number }> = {};
        const add = (num: string, name: string, d: number, c: number) => {
          if (!bal[num]) bal[num] = { name, debit: 0, credit: 0 };
          bal[num].debit += d; bal[num].credit += c;
        };
        for (const inv of invoices) {
          const ht = Number(inv.total) - Number(inv.tax_amount);
          add("3421", "Clients",             Number(inv.total), 0);
          add("7111", "Ventes marchandises", 0,  ht);
          add("4455", "TVA facturée",        0,  Number(inv.tax_amount));
        }
        for (const tx of expenses) {
          const acc = CATEGORY_ACCOUNTS[tx.category ?? ""] ?? CATEGORY_ACCOUNTS["default"];
          const tva = Number(tx.amount) * 0.2, ht = Number(tx.amount) - tva;
          add(acc.num, acc.name,     ht,              0);
          add("4456", "TVA déductible", tva,           0);
          add("5141", "Banques",        0,  Number(tx.amount));
        }
        let tD = 0, tC = 0;
        const rows: any[][] = [
          [profile?.company ?? "Mohasib", "", "", ""],
          [`BALANCE COMPTABLE — ${periodLabel}`, "", "", ""],
          [],
          ["N° Compte", "Intitulé", "Total Débit (MAD)", "Total Crédit (MAD)"],
        ];
        for (const [num, b] of Object.entries(bal).sort(([a], [b]) => a.localeCompare(b))) {
          rows.push([num, b.name, b.debit, b.credit]);
          tD += b.debit; tC += b.credit;
        }
        rows.push([], ["", "TOTAL", tD, tC]);
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws["!cols"] = [{ wch: 10 }, { wch: 32 }, { wch: 18 }, { wch: 18 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Balance Comptable");
        zip.file(`05_Balance_Comptable_${safePeriod}.xlsx`, XLSX.write(wb, { bookType: "xlsx", type: "array" }));
      }

      // ── 6. Récap TVA — PDF ───────────────────────────────────────────────────
      setCurrentStep(5);
      {
        const doc = new jsPDF();
        let y = addHeader(doc, "RÉCAPITULATIF TVA");

        const byRate: Record<number, { base: number; tva: number }> = {};
        for (const inv of invoices) {
          const r = Number(inv.tax_rate);
          if (!byRate[r]) byRate[r] = { base: 0, tva: 0 };
          byRate[r].base += Number(inv.total) - Number(inv.tax_amount);
          byRate[r].tva  += Number(inv.tax_amount);
        }
        const tTVAcol  = invoices.reduce((s: number, i: any) => s + Number(i.tax_amount), 0);
        const tHTventes = invoices.reduce((s: number, i: any) => s + Number(i.total) - Number(i.tax_amount), 0);
        const tTVAdéd  = expenses.reduce((s: number, t: any) => s + Number(t.amount) * 0.2, 0);
        const tHTachats = expenses.reduce((s: number, t: any) => s + Number(t.amount) * 0.8, 0);
        const netTVA   = tTVAcol - tTVAdéd;

        doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(13, 21, 38);
        doc.text("1. TVA Collectée — sur ventes", 14, y); y += 7;
        autoTable(doc, {
          startY: y,
          head: [["Taux TVA", "Base HT (MAD)", "TVA Collectée (MAD)"]],
          body: Object.entries(byRate).map(([r, v]) => [`${r}%`, fmt(v.base), fmt(v.tva)]),
          foot: [["TOTAL", fmt(tHTventes), fmt(tTVAcol)]],
          styles: { fontSize: 9 },
          headStyles: { fillColor: [13, 21, 38], textColor: 255, fontStyle: "bold" },
          footStyles: { fillColor: [200, 146, 74], textColor: 255, fontStyle: "bold" },
          showFoot: "lastPage", margin: { left: 14, right: 14 },
        });
        y = (doc as any).lastAutoTable.finalY + 12;

        doc.setFont("helvetica", "bold"); doc.setFontSize(11);
        doc.text("2. TVA Déductible — sur achats (taux estimé 20%)", 14, y); y += 7;
        autoTable(doc, {
          startY: y,
          head: [["Base HT (MAD)", "TVA Déductible (MAD)"]],
          body: [[fmt(tHTachats), fmt(tTVAdéd)]],
          styles: { fontSize: 9 },
          headStyles: { fillColor: [13, 21, 38], textColor: 255 },
          margin: { left: 14, right: 14 },
        });
        y = (doc as any).lastAutoTable.finalY + 14;

        doc.setFont("helvetica", "bold"); doc.setFontSize(12);
        doc.setTextColor(13, 21, 38);
        doc.text("TVA Nette Due :", 14, y);
        doc.setTextColor(netTVA >= 0 ? 220 : 5, netTVA >= 0 ? 38 : 150, 38);
        doc.text(
          `${fmt(Math.abs(netTVA))} MAD${netTVA < 0 ? " (crédit TVA)" : " — à verser à la DGI"}`,
          70, y
        );

        addFooter(doc);
        zip.file(`06_Recap_TVA_${safePeriod}.pdf`, doc.output("arraybuffer"));
      }

      // ── 7. Synthèse Financière — PDF ─────────────────────────────────────────
      setCurrentStep(6);
      {
        const doc = new jsPDF();
        addHeader(doc, "SYNTHÈSE FINANCIÈRE");

        const tRevTTC  = invoices.reduce((s: number, i: any) => s + Number(i.total), 0);
        const tTVAcol  = invoices.reduce((s: number, i: any) => s + Number(i.tax_amount), 0);
        const tRevHT   = tRevTTC - tTVAcol;
        const tExpTTC  = expenses.reduce((s: number, t: any) => s + Number(t.amount), 0);
        const tTVAdéd  = expenses.reduce((s: number, t: any) => s + Number(t.amount) * 0.2, 0);
        const tExpHT   = tExpTTC - tTVAdéd;
        const netHT    = tRevHT - tExpHT;

        autoTable(doc, {
          startY: 55,
          head: [["Indicateur", "Montant"]],
          body: [
            ["Chiffre d'affaires TTC",   `${fmt(tRevTTC)} MAD`],
            ["Chiffre d'affaires HT",    `${fmt(tRevHT)} MAD`],
            ["Charges totales TTC",      `${fmt(tExpTTC)} MAD`],
            ["Charges totales HT",       `${fmt(tExpHT)} MAD`],
            ["Résultat net (HT)",        `${fmt(netHT)} MAD`],
            ["TVA collectée",            `${fmt(tTVAcol)} MAD`],
            ["TVA déductible (est.)",    `${fmt(tTVAdéd)} MAD`],
            ["TVA nette due",            `${fmt(tTVAcol - tTVAdéd)} MAD`],
            ["Nombre de factures",       String(invoices.length)],
            ["Nombre de dépenses",       String(expenses.length)],
          ],
          styles: { fontSize: 10 },
          headStyles: { fillColor: [13, 21, 38], textColor: 255, fontStyle: "bold" },
          columnStyles: { 0: { fontStyle: "bold" }, 1: { halign: "right" } },
          margin: { left: 14, right: 14 },
        });

        // Expense breakdown by category
        const byCat: Record<string, number> = {};
        for (const tx of expenses) byCat[tx.category ?? "Autres"] = (byCat[tx.category ?? "Autres"] ?? 0) + Number(tx.amount);
        if (Object.keys(byCat).length > 0) {
          const y2 = (doc as any).lastAutoTable.finalY + 12;
          autoTable(doc, {
            startY: y2,
            head: [["Répartition des charges par catégorie", "Montant TTC"]],
            body: Object.entries(byCat).sort(([, a], [, b]) => b - a).map(([k, v]) => [k, `${fmt(v)} MAD`]),
            styles: { fontSize: 9 },
            headStyles: { fillColor: [200, 146, 74], textColor: 255, fontStyle: "bold" },
            alternateRowStyles: { fillColor: [250, 250, 246] },
            margin: { left: 14, right: 14 },
          });
        }

        addFooter(doc);
        zip.file(`07_Synthese_Financiere_${safePeriod}.pdf`, doc.output("arraybuffer"));
      }

      // ── Build & download ZIP ─────────────────────────────────────────────────
      const blob = await zip.generateAsync({ type: "blob" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = zipName; a.click();
      URL.revokeObjectURL(url);

      const newItem: HistoryItem = { date: new Date().toISOString(), periodLabel, filename: zipName };
      const newHistory = [newItem, ...history].slice(0, 10);
      setHistory(newHistory);
      localStorage.setItem("mohasib_export_history", JSON.stringify(newHistory));
      setDone(true);
    } catch (err: any) {
      setError(translateError(err));
    } finally {
      setGenerating(false);
      setCurrentStep(-1);
    }
  }

  const canGenerate = !generating && !!period.start && !!period.end;

  return (
    <div className="max-w-3xl">

      {/* ── Period selector ── */}
      <div className="card p-5 mb-4">
        <div className="text-[13px] font-semibold text-[#1A1A2E] mb-3">Période comptable</div>
        <div className="tabs mb-4">
          {(["month", "quarter", "year", "custom"] as const).map(m => (
            <button key={m} className={`tab ${mode === m ? "active" : ""}`} onClick={() => setMode(m)}>
              {m === "month" ? "Ce mois" : m === "quarter" ? "Trimestre" : m === "year" ? "Année" : "Personnalisé"}
            </button>
          ))}
        </div>
        {mode === "quarter" && (
          <div className="flex gap-3">
            <select className="input flex-1" value={quarter} onChange={e => setQuarter(Number(e.target.value))}>
              <option value={1}>T1 — Janvier à Mars</option>
              <option value={2}>T2 — Avril à Juin</option>
              <option value={3}>T3 — Juillet à Septembre</option>
              <option value={4}>T4 — Octobre à Décembre</option>
            </select>
            <select className="input w-28" value={year} onChange={e => setYear(Number(e.target.value))}>
              {[now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        )}
        {mode === "year" && (
          <select className="input w-40" value={year} onChange={e => setYear(Number(e.target.value))}>
            {[now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        )}
        {mode === "custom" && (
          <div className="flex gap-3 items-center">
            <input type="date" className="input flex-1" value={customStart} onChange={e => setCustomStart(e.target.value)} />
            <span className="text-[#6B7280] text-[12px]">au</span>
            <input type="date" className="input flex-1" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
          </div>
        )}
        {period.start && period.end && (
          <div className="mt-3 text-[11.5px] text-[#6B7280]">
            📅 <strong>{fmtDate(period.start)}</strong> → <strong>{fmtDate(period.end)}</strong>
          </div>
        )}
      </div>

      {/* ── Stats preview ── */}
      {period.start && period.end && (
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[13px] font-semibold text-[#1A1A2E]">Aperçu de la période</div>
            {loadingStats && <RefreshCw size={13} className="text-[#6B7280] animate-spin" />}
          </div>
          {stats ? (
            stats.invoiceCount === 0 && stats.expenseCount === 0 ? (
              <div className="flex items-center gap-2 text-[12px] text-[#92400E] bg-[#FEF3C7] border border-[rgba(217,119,6,0.2)] rounded-lg px-3 py-2.5">
                <AlertCircle size={13} /> Aucune donnée pour cette période.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="kpi p-3">
                  <div className="kpi-label">Factures</div>
                  <div className="kpi-value text-[17px]">{stats.invoiceCount}</div>
                  <div className="text-[11px] text-[#059669] font-medium">{fmt(stats.invoiceTotal)} MAD</div>
                </div>
                <div className="kpi p-3">
                  <div className="kpi-label">Dépenses</div>
                  <div className="kpi-value text-[17px]">{stats.expenseCount}</div>
                  <div className="text-[11px] text-[#DC2626] font-medium">{fmt(stats.expenseTotal)} MAD</div>
                </div>
                <div className="kpi p-3">
                  <div className="kpi-label">TVA collectée</div>
                  <div className="kpi-value text-[17px]">{fmt(stats.tvaCollected)}</div>
                  <div className="text-[11px] text-[#6B7280]">MAD</div>
                </div>
                <div className="kpi p-3">
                  <div className="kpi-label">TVA nette due</div>
                  <div className="kpi-value text-[17px]">{fmt(Math.max(0, stats.tvaCollected - stats.tvaDeductible))}</div>
                  <div className="text-[11px] text-[#6B7280]">MAD</div>
                </div>
              </div>
            )
          ) : (
            <div className="text-[12px] text-[#6B7280]">Chargement des données...</div>
          )}
          <div className="mt-3 flex items-center gap-2 text-[11px] text-[#6B7280]">
            <Package size={12} />
            <span>7 documents seront générés dans le package ZIP</span>
          </div>
        </div>
      )}

      {/* ── Company info ── */}
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[13px] font-semibold text-[#1A1A2E]">Informations de l&apos;entreprise</div>
        </div>
        {profile ? (
          <>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12px]">
              <div><span className="text-[#6B7280]">Raison sociale : </span><span className="font-medium">{profile.company ?? "—"}</span></div>
              <div><span className="text-[#6B7280]">ICE : </span><span className="font-medium">{profile.ice ?? "—"}</span></div>
              <div><span className="text-[#6B7280]">IF : </span><span className="font-medium">{profile.if_fiscal ?? "—"}</span></div>
              <div><span className="text-[#6B7280]">RC : </span><span className="font-medium">{profile.rc ?? "—"}</span></div>
              <div><span className="text-[#6B7280]">Adresse : </span><span className="font-medium">{profile.address ?? "—"}</span></div>
              <div><span className="text-[#6B7280]">Ville : </span><span className="font-medium">{profile.city ?? "—"}</span></div>
            </div>
            {(!profile.company || !profile.ice) && (
              <div className="mt-3 flex items-center gap-2 text-[11.5px] text-[#92400E] bg-[#FEF3C7] border border-[rgba(217,119,6,0.2)] rounded-lg px-3 py-2">
                <AlertCircle size={12} />
                Complétez votre profil (Raison sociale et ICE) pour un export optimal.
              </div>
            )}
          </>
        ) : (
          <div className="text-[12px] text-[#6B7280]">Chargement...</div>
        )}
      </div>

      {/* ── Generate button ── */}
      <div className="card p-5 mb-4">
        <div className="mb-4">
          <div className="text-[12px] font-medium text-[#1A1A2E] mb-2.5">Documents inclus dans le package :</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              { n: "01 · Journal des Ventes",    f: "Excel + PDF" },
              { n: "02 · Journal des Achats",    f: "Excel" },
              { n: "03 · Grand Livre (CGNC)",    f: "Excel" },
              { n: "04 · Balance Comptable",     f: "Excel" },
              { n: "05 · Récapitulatif TVA",     f: "PDF" },
              { n: "06 · Synthèse Financière",   f: "PDF" },
            ].map(({ n, f }) => (
              <div key={n} className="flex items-center gap-2 text-[11.5px]">
                <CheckCircle size={12} className="text-[#C8924A] flex-shrink-0" />
                <span className="text-[#1A1A2E]">{n}</span>
                <span className="tag tag-gray ml-auto">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Progress bar */}
        {generating && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2 text-[12.5px] text-[#1A1A2E]">
              <RefreshCw size={13} className="animate-spin text-[#C8924A]" />
              <span>{currentStep >= 0 ? STEPS[currentStep] : "Initialisation..."}</span>
              <span className="text-[#6B7280] ml-auto">({Math.max(1, currentStep + 1)}/7)</span>
            </div>
            <div className="h-1.5 bg-[#F0EDE5] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#C8924A] rounded-full transition-all duration-500"
                style={{ width: `${((currentStep + 1) / 7) * 100}%` }}
              />
            </div>
          </div>
        )}

        {done && !generating && (
          <div className="mb-4 flex items-center gap-2 text-[12.5px] text-[#059669] bg-[#D1FAE5] border border-[rgba(5,150,105,0.2)] rounded-lg px-3 py-2">
            <CheckCircle size={14} /> Package généré et téléchargé avec succès !
          </div>
        )}
        {error && (
          <div className="mb-4 flex items-center gap-2 text-[12.5px] text-[#DC2626] bg-[#FEE2E2] border border-[rgba(220,38,38,0.2)] rounded-lg px-3 py-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <button
          className="btn btn-gold w-full py-3 text-[14px] justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={generatePackage}
          disabled={!canGenerate}
        >
          <Download size={16} />
          {generating ? "Génération en cours..." : "Générer le package fiduciaire"}
        </button>

        {!generating && period.start && period.end && (
          <div className="mt-2 text-center text-[10.5px] text-[#6B7280] truncate">{zipName}</div>
        )}
      </div>

      {/* ── Export history ── */}
      {history.length > 0 && (
        <div className="card p-5">
          <div className="text-[13px] font-semibold text-[#1A1A2E] mb-3">Historique des exports</div>
          <div className="space-y-0">
            {history.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-[12px] py-2 border-b border-[rgba(0,0,0,0.06)] last:border-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[#1A1A2E]">{item.periodLabel}</span>
                  <span className="text-[#6B7280]">— {new Date(item.date).toLocaleDateString("fr-FR")}</span>
                </div>
                <span className="text-[10.5px] text-[#6B7280] truncate max-w-[180px] hidden md:block">{item.filename}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
