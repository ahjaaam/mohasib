import { NextResponse } from "next/server";
import { logAdminAudit, requireAdminApi } from "@/lib/admin-api";

const STATUSES = ["nouveau", "contacté", "finalisé", "cancelled"];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, admin, response } = await requireAdminApi();
  if (response) return response;
  const { status } = await request.json();
  if (!STATUSES.includes(status)) return NextResponse.json({ message: "Statut invalide" }, { status: 400 });

  const { data: ticket } = await admin!.from("support_tickets").select("*").eq("id", id).maybeSingle();
  if (!ticket) return NextResponse.json({ message: "Ticket introuvable" }, { status: 404 });

  await admin!.from("support_tickets").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  await logAdminAudit({
    adminEmail: user!.email!,
    action: "SUPPORT_TICKET_STATUS",
    entityType: "support_tickets",
    entityId: id,
    entityLabel: ticket.subject,
    companyId: ticket.company_id,
    oldValues: { status: ticket.status },
    newValues: { status },
  });
  return NextResponse.json({ ok: true });
}
