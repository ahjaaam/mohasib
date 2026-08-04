import { ActivateSignupButton, StatusBadge } from "@/components/admin/AdminUI";
import { adminContext, formatDate } from "@/lib/admin-data";

export default async function SignupsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const filters = await searchParams;
  const { admin } = await adminContext();
  const { data } = await admin
    .from("fiduciaire_waitlist")
    .select("*")
    .eq("request_kind", "signup")
    .order("created_at", { ascending: false });

  const q = (filters.q ?? "").trim().toLowerCase();
  const status = filters.status ?? "pending";
  const rows = (data ?? []).filter((item) => {
    const searchable = `${item.nom ?? ""} ${item.email ?? ""} ${item.telephone ?? ""} ${item.entreprise ?? ""}`.toLowerCase();
    return (!q || searchable.includes(q)) && (!status || item.status === status);
  });

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold">Inscriptions à valider</h1>
        <p className="mt-1 text-xs text-gray-500">
          Contactez le prospect, puis activez son compte. L&apos;essai de 7 jours démarre à l&apos;activation.
        </p>
      </div>

      <form className="mb-3 grid gap-2 rounded-md border border-black/10 bg-white p-3 lg:grid-cols-[1fr_170px_90px]">
        <input name="q" defaultValue={filters.q} placeholder="Nom, email, téléphone, entreprise" className="input text-xs" />
        <select name="status" defaultValue={status} className="input text-xs">
          <option value="">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="approved">Activés</option>
          <option value="rejected">Refusés</option>
        </select>
        <button className="rounded bg-[#0D1526] text-xs font-bold text-white">Filtrer</button>
      </form>

      <div className="overflow-x-auto rounded-md border border-black/10 bg-white">
        <table className="w-full text-left text-[11px]">
          <thead className="bg-[#F8F8F5] text-gray-500">
            <tr>
              {["Nom / entreprise", "Email", "Téléphone", "Profil", "Statut", "Inscription", "Action"].map((label) => (
                <th key={label} className="px-3 py-2.5 font-semibold">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {rows.map((item) => (
              <tr key={item.id}>
                <td className="px-3 py-3">
                  <div className="font-bold">{item.nom || "—"}</div>
                  {item.entreprise && <div className="mt-0.5 text-gray-400">{item.entreprise}</div>}
                </td>
                <td className="px-3 py-3">{item.email}</td>
                <td className="px-3 py-3">{item.telephone || "—"}</td>
                <td className="px-3 py-3">{item.track === "comptable" ? "Comptable / fiduciaire" : "Entrepreneur"}</td>
                <td className="px-3 py-3"><StatusBadge status={item.status || "pending"} /></td>
                <td className="px-3 py-3 text-gray-500">{formatDate(item.created_at)}</td>
                <td className="px-3 py-3">
                  {item.status === "pending" ? (
                    <ActivateSignupButton waitlistId={item.id} />
                  ) : (
                    <span className="font-semibold text-gray-500">{item.status === "approved" ? "Activé" : "Aucune action"}</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-400">Aucune inscription pour ce filtre.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
