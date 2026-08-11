"use client";

import Link from "next/link";
import { useState } from "react";

export type AdminAccountRow = {
  id: string; name: string; email: string; phone: string; type: string; status: string;
  endDate: string; createdDate: string; tags: string[]; owner: string;
};

export function AdminAccountsTable({ rows }: { rows: AdminAccountRow[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const allSelected = rows.length > 0 && selected.length === rows.length;
  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  async function act(action: string) {
    if (!selected.length) return;
    const tag = action === "add_tag" ? window.prompt("Tag à ajouter aux comptes sélectionnés")?.trim() : undefined;
    if (action === "add_tag" && !tag) return;
    if (["suspend", "archive"].includes(action) && !window.confirm(`Appliquer l’action à ${selected.length} compte(s) ?`)) return;
    setBusy(true);
    const response = await fetch("/api/admin/accounts/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: selected, action, tag }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { alert(data.message || "Action impossible"); setBusy(false); return; }
    window.location.reload();
  }
  return <>
    {selected.length > 0 && <div className="mb-2 flex flex-wrap items-center gap-2 rounded border border-[#C8924A]/30 bg-[#FFF9F0] p-2 text-[11px]"><b>{selected.length} compte(s)</b><button disabled={busy} onClick={() => void act("suspend")} className="rounded border border-red-200 bg-white px-2 py-1 text-red-700">Suspendre</button><button disabled={busy} onClick={() => void act("reactivate")} className="rounded border border-black/10 bg-white px-2 py-1">Réactiver</button><button disabled={busy} onClick={() => void act("archive")} className="rounded border border-black/10 bg-white px-2 py-1">Archiver</button><button disabled={busy} onClick={() => void act("restore")} className="rounded border border-black/10 bg-white px-2 py-1">Restaurer</button><button disabled={busy} onClick={() => void act("add_tag")} className="rounded border border-black/10 bg-white px-2 py-1">Ajouter un tag</button><Link href={`/admin/notifications?companies=${selected.join(",")}`} className="rounded bg-[#0D1526] px-2 py-1 text-white">Notifier</Link></div>}
    <div className="overflow-x-auto rounded-md border border-black/10 bg-white"><table className="w-full text-left text-[11px]"><thead className="bg-[#F8F8F5] text-gray-500"><tr><th className="px-3 py-2"><input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? [] : rows.map(row => row.id))} aria-label="Tout sélectionner" /></th>{["Compte", "Email propriétaire", "Téléphone", "Type", "Accès", "Fin", "Pilotage", "Créé", "Actions"].map(value => <th key={value} className="px-3 py-2.5 font-semibold">{value}</th>)}</tr></thead><tbody className="divide-y divide-black/5">{rows.map(row => <tr key={row.id} className="hover:bg-black/[.015]"><td className="px-3 py-3"><input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggle(row.id)} aria-label={`Sélectionner ${row.name}`} /></td><td className="px-3 py-3 font-bold"><Link href={`/admin/comptes/${row.id}`}>{row.name}</Link></td><td className="px-3 py-3 text-gray-500">{row.email}</td><td className="px-3 py-3">{row.phone}</td><td className="px-3 py-3">{row.type}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${row.status === "active" || row.status === "free" ? "bg-emerald-50 text-emerald-700" : row.status === "trial" ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-700"}`}>{row.status}</span></td><td className="px-3 py-3">{row.endDate}</td><td className="px-3 py-3"><div className="flex max-w-40 flex-wrap gap-1">{row.tags.map(tag => <span key={tag} className="rounded bg-[#F1ECE4] px-1.5 py-0.5 text-[9px]">{tag}</span>)}</div><div className="mt-1 text-[9px] text-gray-400">{row.owner}</div></td><td className="px-3 py-3 text-gray-500">{row.createdDate}</td><td className="px-3 py-3"><Link href={`/admin/comptes/${row.id}`} className="rounded bg-[#0D1526] px-2.5 py-1.5 text-[10px] font-semibold text-white">Gérer</Link></td></tr>)}</tbody></table></div>
  </>;
}
