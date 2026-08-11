import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizePermission } from "@/lib/api-permissions";
import { evaluateInvoiceControls } from "@/lib/invoice-controls";
import { resolveTeamContext } from "@/lib/team";

async function receiptContext(id: string, action: "read" | "create") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };

  const { data: receipt } = await supabase
    .from("receipts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!receipt) return { response: NextResponse.json({ error: "Justificatif introuvable" }, { status: 404 }) };

  const permission = await authorizePermission("document", action, { dossierId: receipt.dossier_id });
  if (permission.response) return { response: permission.response };
  return { user, receipt };
}

async function controlPayload(userId: string, receipt: any) {
  const admin = createAdminClient();
  let priorQuery = admin
    .from("receipts")
    .select("id,ocr_data,created_at")
    .neq("id", receipt.id)
    .lt("created_at", receipt.created_at)
    .order("created_at", { ascending: false })
    .limit(250);
  priorQuery = receipt.dossier_id
    ? priorQuery.eq("dossier_id", receipt.dossier_id)
    : priorQuery.eq("user_id", receipt.user_id).is("dossier_id", null);
  const { data: priorDocuments } = await priorQuery;
  const checks = evaluateInvoiceControls(receipt.ocr_data ?? {}, priorDocuments ?? []);

  if (JSON.stringify(receipt.control_checks ?? []) !== JSON.stringify(checks)) {
    await admin.from("receipts").update({ control_checks: checks }).eq("id", receipt.id);
  }

  const context = await resolveTeamContext(userId);
  const [{ data: events }, { data: owner }, { data: memberships }] = await Promise.all([
    admin
      .from("receipt_control_events")
      .select("id,actor_id,event_type,message,metadata,created_at")
      .eq("receipt_id", receipt.id)
      .order("created_at", { ascending: false }),
    admin.from("users").select("id,full_name,email").eq("id", receipt.user_id).maybeSingle(),
    context
      ? admin
          .from("user_memberships")
          .select("user_id,user_email,first_name,last_name,dossier_scope")
          .eq("company_id", context.companyId)
          .eq("status", "active")
          .not("user_id", "is", null)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const actorIds = [...new Set((events ?? []).map(event => event.actor_id).filter(Boolean))];
  const { data: actorProfiles } = actorIds.length
    ? await admin.from("users").select("id,full_name,email").in("id", actorIds)
    : { data: [] as any[] };
  const actors = new Map((actorProfiles ?? []).map(profile => [profile.id, profile.full_name || profile.email]));

  const approvers = [
    owner && { id: owner.id, label: owner.full_name || owner.email || "Propriétaire", email: owner.email },
    ...(memberships ?? [])
      .filter(member => !receipt.dossier_id || !member.dossier_scope?.length || member.dossier_scope.includes(receipt.dossier_id))
      .map(member => ({
        id: member.user_id,
        label: `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || member.user_email,
        email: member.user_email,
      })),
  ].filter(Boolean).filter((approver: any, index, list) => list.findIndex((item: any) => item.id === approver.id) === index);

  return {
    current_user_id: userId,
    receipt: { ...receipt, control_checks: checks },
    checks,
    approvers,
    events: (events ?? []).map(event => ({ ...event, actor_label: event.actor_id ? actors.get(event.actor_id) ?? null : null })),
  };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resolved = await receiptContext(id, "read");
  if (resolved.response || !resolved.user || !resolved.receipt) return resolved.response;
  return NextResponse.json(await controlPayload(resolved.user.id, resolved.receipt));
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resolved = await receiptContext(id, "create");
  if (resolved.response || !resolved.user || !resolved.receipt) return resolved.response;

  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "");
  const admin = createAdminClient();
  const now = new Date().toISOString();
  let update: Record<string, unknown>;

  if (action === "request_approval") {
    const approverId = String(body.approverId ?? "");
    const payload = await controlPayload(resolved.user.id, resolved.receipt);
    if (!(payload.approvers as any[]).some(approver => approver.id === approverId)) {
      return NextResponse.json({ error: "Validateur invalide" }, { status: 400 });
    }
    update = {
      approver_id: approverId,
      approval_status: "pending",
      approval_requested_by: resolved.user.id,
      approval_requested_at: now,
      approval_decided_at: null,
      approval_note: null,
    };
  } else if (action === "approve" || action === "reject") {
    if (resolved.receipt.approver_id !== resolved.user.id) {
      return NextResponse.json({ error: "Seul le validateur désigné peut prendre cette décision." }, { status: 403 });
    }
    update = {
      approval_status: action === "approve" ? "approved" : "rejected",
      approval_decided_at: now,
      approval_note: String(body.note ?? "").trim().slice(0, 500) || null,
    };
  } else if (action === "cancel_approval") {
    update = {
      approver_id: null,
      approval_status: "not_requested",
      approval_requested_by: null,
      approval_requested_at: null,
      approval_decided_at: null,
      approval_note: null,
    };
  } else if (action === "mark_paid") {
    update = {
      control_status: "paid",
      ocr_data: { ...(resolved.receipt.ocr_data ?? {}), payment_status: "paid" },
    };
  } else if (action === "mark_review") {
    update = { control_status: "review" };
  } else {
    return NextResponse.json({ error: "Action invalide" }, { status: 400 });
  }

  const { data: updated, error } = await admin
    .from("receipts")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Service-role updates do not carry auth.uid() into the database trigger.
  // Attribute only the event created by this action; a broad time-window update
  // could incorrectly claim a concurrent user's event.
  const expectedEventType = action === "request_approval"
    ? "approval_pending"
    : action === "approve"
      ? "approval_approved"
      : action === "reject"
        ? "approval_rejected"
        : action === "cancel_approval"
          ? "approval_not_requested"
          : action === "mark_paid"
            ? "status_paid"
            : "status_review";
  const { data: eventToAttribute } = await admin
    .from("receipt_control_events")
    .select("id")
    .eq("receipt_id", id)
    .eq("event_type", expectedEventType)
    .is("actor_id", null)
    .gte("created_at", new Date(Date.now() - 5_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (eventToAttribute) {
    await admin.from("receipt_control_events").update({ actor_id: resolved.user.id }).eq("id", eventToAttribute.id);
  }

  const supplier = updated.ocr_data?.vendor_name ?? updated.ocr_data?.vendor ?? updated.file_name ?? "Facture fournisseur";
  const link = updated.dossier_id ? `/comptable-pro/dossiers/${updated.dossier_id}/inbox` : "/inbox";
  if (action === "request_approval" && updated.approver_id) {
    await admin.from("notifications").insert({
      user_id: updated.approver_id,
      type: "invoice_approval",
      title: "Facture à valider",
      message: `${supplier} attend votre validation.`,
      link,
      priority: "high",
      unique_key: `receipt-approval-${id}-${Date.now()}`,
    });
  } else if ((action === "approve" || action === "reject") && updated.approval_requested_by) {
    await admin.from("notifications").insert({
      user_id: updated.approval_requested_by,
      type: "invoice_approval_result",
      title: action === "approve" ? "Facture validée" : "Facture refusée",
      message: `${supplier} a été ${action === "approve" ? "validée" : "refusée"}.`,
      link,
      priority: action === "reject" ? "high" : "normal",
      unique_key: `receipt-approval-result-${id}-${Date.now()}`,
    });
  }
  return NextResponse.json(await controlPayload(resolved.user.id, updated));
}
