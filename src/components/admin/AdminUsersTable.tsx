"use client";

import Link from "next/link";
import { useState } from "react";

export type AdminUserRow = {
  id: string; name: string; email: string; phone: string; companyId: string | null; company: string;
  role: string; status: string; createdAt: string; lastSignIn: string; lastActivity: string;
  lastActivityAt: number; activityCount: number; unreadCount: number; ticketCount: number; health: number;
};

function UserAction({ id, action, label, danger = false }: { id: string; action: string; label: string; danger?: boolean }) {
  const [busy, setBusy] = useState(false);
  async function run() {
    if (danger && !window.confirm(`${label} cet utilisateur ?`)) return;
    setBusy(true);
    const response = await fetch(`/api/admin/users/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { alert(data.message || "Action impossible"); setBusy(false); return; }
    window.location.reload();
  }
  return <button disabled={busy} onClick={() => void run()} className={`rounded border px-2 py-1 text-[10px] font-semibold ${danger ? "border-red-200 text-red-700" : "border-black/10"}`}>{busy ? "…" : label}</button>;
}

export function AdminUsersTable({ rows }: { rows: AdminUserRow[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const allSelected = rows.length > 0 && selected.length === rows.length;
  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  async function bulk(action: "suspend" | "reactivate") {
    if (!selected.length || !window.confirm(`${action === "suspend" ? "Suspendre" : "Réactiver"} ${selected.length} utilisateur(s) ?`)) return;
    setBusy(true);
    const response = await fetch("/api/admin/users/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: selected, action }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { alert(data.message || "Action impossible"); setBusy(false); return; }
    window.location.reload();
  }
  return <>
    {selected.length > 0 && <div className="mb-2 flex flex-wrap items-center gap-2 rounded border border-[#C8924A]/30 bg-[#FFF9F0] p-2 text-[11px]"><b>{selected.length} sélectionné(s)</b><button disabled={busy} onClick={() => void bulk("suspend")} className="rounded border border-red-200 bg-white px-2 py-1 text-red-700">Suspendre</button><button disabled={busy} onClick={() => void bulk("reactivate")} className="rounded border border-black/10 bg-white px-2 py-1">Réactiver</button><Link href={`/admin/notifications?users=${selected.join(",")}`} className="rounded bg-[#0D1526] px-2 py-1 text-white">Notifier</Link></div>}
    <div className="overflow-x-auto rounded-md border border-black/10 bg-white"><table className="w-full text-left text-[11px]"><thead className="bg-[#F8F8F5] text-gray-500"><tr><th className="px-3 py-2"><input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? [] : rows.map(row => row.id))} aria-label="Tout sélectionner" /></th>{["Utilisateur", "Compte / rôle", "État", "Engagement", "Dernière activité", "Signal", "Actions"].map(label => <th key={label} className="px-3 py-2.5">{label}</th>)}</tr></thead>
    <tbody className="divide-y divide-black/5">{rows.map(row => <tr key={row.id}><td className="px-3 py-3"><input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggle(row.id)} aria-label={`Sélectionner ${row.email}`} /></td><td className="px-3 py-3"><b>{row.name || row.email}</b><div className="text-gray-500">{row.email}</div><div className="text-gray-400">{row.phone}</div></td><td className="px-3 py-3">{row.companyId ? <Link href={`/admin/comptes/${row.companyId}`} className="font-semibold text-[#C8924A]">{row.company}</Link> : row.company}<div className="text-gray-400">{row.role}</div></td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${row.status === "active" ? "bg-emerald-50 text-emerald-700" : row.status === "invited" ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-700"}`}>{row.status}</span><div className="mt-1 text-gray-400">Inscrit {row.createdAt}</div></td><td className="px-3 py-3"><b>{row.activityCount}</b> actions / 30j<div className="mt-1 h-1.5 w-24 rounded bg-gray-100"><div className={`h-full rounded ${row.health >= 70 ? "bg-emerald-500" : row.health >= 40 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${row.health}%` }} /></div><div className="mt-0.5 text-[9px] text-gray-400">Santé {row.health}/100</div></td><td className="px-3 py-3">{row.lastActivity}<div className="text-gray-400">Connexion {row.lastSignIn}</div></td><td className="px-3 py-3">{row.unreadCount > 0 && <div>{row.unreadCount} notif. non lue(s)</div>}{row.ticketCount > 0 && <div className="text-amber-700">{row.ticketCount} ticket(s)</div>}{!row.unreadCount && !row.ticketCount && <span className="text-gray-400">Aucun signal</span>}</td><td className="px-3 py-3"><div className="flex max-w-52 flex-wrap gap-1"><Link href={`/admin/notifications?user=${row.id}`} className="rounded border border-black/10 px-2 py-1 text-[10px] font-semibold">Notifier</Link><UserAction id={row.id} action="password_reset" label="Réinit. MDP" />{row.status === "unverified" && <UserAction id={row.id} action="verify_email" label="Vérifier email" />}{row.status === "suspended" ? <UserAction id={row.id} action="reactivate" label="Réactiver" /> : <UserAction id={row.id} action="suspend" label="Suspendre" danger />}</div></td></tr>)}{rows.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Aucun utilisateur pour ces filtres.</td></tr>}</tbody></table></div>
  </>;
}
