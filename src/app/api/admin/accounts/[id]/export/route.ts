import { requireAdminApi, logAdminAudit } from "@/lib/admin-api";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, admin, response } = await requireAdminApi();
  if (response) return response;
  const company = await admin!.from("companies").select("*").eq("id", id).maybeSingle();
  if (!company.data) return new Response(null, { status: 404 });
  const [memberships, subscriptions, dossiers, support, audits, deliveries] = await Promise.all([
    admin!.from("user_memberships").select("*").eq("company_id", id),
    admin!.from("subscriptions").select("*").eq("company_id", id),
    admin!.from("dossiers").select("*").eq("fiduciaire_user_id", company.data.user_id),
    admin!.from("support_tickets").select("*").eq("company_id", id),
    admin!.from("audit_logs").select("*").eq("company_id", id).limit(1000),
    admin!.from("notification_deliveries").select("*").eq("company_id", id).limit(1000),
  ]);
  const payload = { exported_at: new Date().toISOString(), company: company.data, memberships: memberships.data ?? [], subscriptions: subscriptions.data ?? [], dossiers: dossiers.data ?? [], support_tickets: support.data ?? [], audit_logs: audits.data ?? [], notification_deliveries: deliveries.data ?? [] };
  await logAdminAudit({ adminEmail: user!.email!, action: "ACCOUNT_EXPORT", entityType: "company", entityId: id, entityLabel: company.data.raison_sociale, companyId: id });
  return new Response(JSON.stringify(payload, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="compte-${id}.json"` } });
}
