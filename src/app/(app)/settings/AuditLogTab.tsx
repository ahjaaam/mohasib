"use client";

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";

type AuditLogRow = {
  id: string;
  created_at: string;
  user_email: string | null;
  action: string;
  entity_type: string;
  entity_label: string | null;
  success: boolean | null;
  request_path: string | null;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("fr-MA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AuditLogTab({ logs }: { logs: AuditLogRow[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((log) =>
      [
        log.user_email,
        log.action,
        log.entity_type,
        log.entity_label,
        log.request_path,
      ].some((value) => value?.toLowerCase().includes(q)),
    );
  }, [logs, query]);

  function exportCsv() {
    const rows = [
      ["Date", "Utilisateur", "Action", "Entité", "Libellé", "Statut", "Chemin"],
      ...filtered.map((log) => [
        formatDate(log.created_at),
        log.user_email ?? "",
        log.action,
        log.entity_type,
        log.entity_label ?? "",
        log.success === false ? "Erreur" : "Succès",
        log.request_path ?? "",
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "journal-audit.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[rgba(0,0,0,0.06)] flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[14px] font-semibold text-[#1A1A2E]">Journal d&apos;audit</h2>
          <p className="text-[11.5px] text-[#6B7280] mt-0.5">Dernières actions tracées sur le compte.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher"
              className="h-9 w-[180px] rounded-lg border border-[rgba(0,0,0,0.08)] pl-8 pr-3 text-[12px] outline-none focus:border-[#C8924A]"
            />
          </div>
          <button
            type="button"
            onClick={exportCsv}
            className="h-9 px-3 rounded-lg bg-[#0D1526] text-white text-[12px] font-medium flex items-center gap-1.5"
          >
            <Download size={13} />
            CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-[#FAFAF6] text-[#6B7280]">
            <tr>
              <th className="text-left font-semibold px-4 py-2.5">Date</th>
              <th className="text-left font-semibold px-4 py-2.5">Utilisateur</th>
              <th className="text-left font-semibold px-4 py-2.5">Action</th>
              <th className="text-left font-semibold px-4 py-2.5">Entité</th>
              <th className="text-left font-semibold px-4 py-2.5">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(0,0,0,0.06)]">
            {filtered.map((log) => (
              <tr key={log.id} className="hover:bg-[#FAFAF6]">
                <td className="px-4 py-3 text-[#6B7280] whitespace-nowrap">{formatDate(log.created_at)}</td>
                <td className="px-4 py-3 text-[#374151]">{log.user_email ?? "Système"}</td>
                <td className="px-4 py-3 font-semibold text-[#1A1A2E]">{log.action}</td>
                <td className="px-4 py-3 text-[#374151]">
                  {log.entity_label ?? log.entity_type}
                  {log.request_path && <div className="text-[10.5px] text-[#9CA3AF] mt-0.5">{log.request_path}</div>}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    log.success === false ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
                  }`}>
                    {log.success === false ? "Erreur" : "Succès"}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[#9CA3AF]">
                  Aucun événement d&apos;audit trouvé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
