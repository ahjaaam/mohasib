import { TicketStatus } from "@/components/admin/AdminControls";
import { adminContext, formatDate } from "@/lib/admin-data";

export default async function SupportTicketsPage() {
  const { admin } = await adminContext();
  const { data: tickets } = await admin
    .from("support_tickets")
    .select("*, companies(raison_sociale), dossiers(raison_sociale)")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-xl font-bold">Support rapide</h1>
      <p className="mt-1 text-xs text-gray-500">Tickets ouverts depuis le bouton d&apos;aide rapide dans l&apos;application</p>

      <section className="mt-5 rounded-md border border-black/10 bg-white">
        <div className="divide-y divide-black/5">
          {(tickets ?? []).length === 0 && (
            <div className="px-4 py-8 text-center text-[11px] text-gray-400">Aucun ticket pour le moment</div>
          )}
          {(tickets ?? []).map(ticket => {
            const company = (ticket.companies as { raison_sociale?: string } | null)?.raison_sociale;
            const dossier = (ticket.dossiers as { raison_sociale?: string } | null)?.raison_sociale;
            return (
              <div key={ticket.id} className="grid gap-2 px-4 py-3 text-[11px] sm:grid-cols-[1.4fr_2fr_1fr_130px_130px]">
                <div>
                  <b>{ticket.subject}</b>
                  <div className="mt-0.5 text-gray-500">{ticket.user_name || ticket.user_email}</div>
                  <div className="text-gray-400">{ticket.user_email}</div>
                </div>
                <div className="whitespace-pre-wrap text-gray-700">{ticket.message}</div>
                <div className="text-gray-500">
                  {company && <div>{company}</div>}
                  {dossier && <div>Dossier : {dossier}</div>}
                  {ticket.page_url && <div className="truncate text-gray-400">{ticket.page_url}</div>}
                </div>
                <span className="text-gray-500">{formatDate(ticket.created_at)}</span>
                <TicketStatus id={ticket.id} current={ticket.status} />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
