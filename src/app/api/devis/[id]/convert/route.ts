import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authorizePermission } from "@/lib/api-permissions";
import { createVersion, logAccountingEvent, logAudit } from "@/lib/audit";
import { getRequestMeta } from "@/lib/request-meta";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const permission = await authorizePermission("invoice", "create");
    if (permission.response) return permission.response;

    const { data: devis, error: fetchErr } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !devis) {
      return NextResponse.json({ error: "Devis introuvable" }, { status: 404 });
    }
    if (devis.invoice_type !== "devis") {
      return NextResponse.json({ error: "Ce document n'est pas un devis" }, { status: 400 });
    }

    // Generate next FAC- number
    const { data: lastInv } = await supabase
      .from("invoices")
      .select("invoice_number")
      .eq("user_id", user.id)
      .not("invoice_type", "eq", "devis")
      .order("created_at", { ascending: false })
      .limit(1);

    const lastNum = lastInv?.[0]
      ? parseInt(lastInv[0].invoice_number.split("-").pop() ?? "0", 10)
      : 0;
    const year = new Date().getFullYear();
    const invoiceNumber = `FAC-${year}-${String(lastNum + 1).padStart(4, "0")}`;

    const today = new Date().toISOString().split("T")[0];
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const { data: newInv, error: insertErr } = await supabase
      .from("invoices")
      .insert({
        user_id: user.id,
        client_id: devis.client_id,
        invoice_number: invoiceNumber,
        invoice_type: "facture",
        status: "sent",
        issue_date: today,
        due_date: dueDate.toISOString().split("T")[0],
        subtotal: devis.subtotal,
        tax_rate: devis.tax_rate,
        tax_amount: devis.tax_amount,
        total: devis.total,
        currency: devis.currency ?? "MAD",
        notes: devis.devis_notes ?? devis.notes,
        items: devis.items,
      })
      .select("*")
      .single();

    if (insertErr || !newInv) {
      return NextResponse.json({ error: insertErr?.message ?? "Erreur lors de la création de la facture" }, { status: 500 });
    }

    // Link devis to the new invoice and mark as converted
    await supabase
      .from("invoices")
      .update({ converted_to_invoice_id: newInv.id })
      .eq("id", id);

    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("user_id", user.id)
      .single();
    await createVersion(
      "invoice",
      newInv.id,
      newInv as any,
      user.id,
      user.email ?? null,
      "CREATE",
      "Devis converti en facture",
    );
    await logAudit({
      userId: user.id,
      userEmail: user.email ?? null,
      companyId: company?.id ?? null,
      action: "CREATE",
      entityType: "invoice",
      entityId: newInv.id,
      entityLabel: newInv.invoice_number,
      oldValues: devis as any,
      newValues: newInv as any,
      ...getRequestMeta(req),
    });
    await logAccountingEvent({
      companyId: company?.id ?? null,
      eventType: "INVOICE_CREATED",
      triggeredBy: user.id,
      triggeredByEmail: user.email ?? null,
      entityType: "invoice",
      entityId: newInv.id,
      amount: Number(newInv.total ?? 0),
      periodMois: newInv.issue_date ? Number(String(newInv.issue_date).slice(5, 7)) : null,
      periodAnnee: newInv.issue_date ? Number(String(newInv.issue_date).slice(0, 4)) : null,
      eventData: { source: "devis.convert", devis, invoice: newInv },
    });

    // Fire-and-forget: book journal entries
    fetch("/api/accounting/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "invoice", invoiceId: newInv.id }),
    }).catch(() => {});

    return NextResponse.json({ success: true, invoice_id: newInv.id, invoice_number: newInv.invoice_number });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
