import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp, tooManyRequests } from "@/lib/rate-limit";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import { getUserAccessProfile } from "@/lib/team";
import { can } from "@/lib/rbac";
import { createVersion, logAudit } from "@/lib/audit";
import { getRequestMeta } from "@/lib/request-meta";
import { getNextInvoiceDocumentNumber } from "@/lib/document-numbers";
import {
  calculateAgentDueDate,
  calculateAgentInvoiceAmounts,
  isIsoDate,
  matchAgentClient,
} from "@/lib/chat-agent";

const CHAT_LIMIT = 30;
const CHAT_RATE_LIMIT = { maxAttempts: CHAT_LIMIT, windowMs: 60_000, blockMs: 5 * 60_000 };
const MONTHLY_AGENT_CALL_LIMIT = 10;
const CHAT_MODEL = process.env.ANTHROPIC_CHAT_MODEL || "claude-sonnet-4-6";
const MAX_TOOL_ITERATIONS = 4;

const SYSTEM_PROMPT = `Tu es Mohasib Agent, un assistant comptable spécialisé pour les PME et TPE marocaines, intégré à l'application Mohasib.

Tu maîtrises la comptabilité générale marocaine, le PCGM, la TVA, l'IS, l'IR, la facturation, les déclarations fiscales et les obligations administratives des entreprises au Maroc.

Tu es aussi un agent capable d'agir dans Mohasib. Tu as accès à des outils qui interrogent les vraies données comptables de l'utilisateur connecté (chiffre d'affaires, factures, transactions, informations légales de l'entreprise) et à un outil qui crée des brouillons de facture. Utilise-les systématiquement dès qu'une question porte sur SES données ou qu'il demande une action. N'invente jamais un chiffre propre à l'entreprise : si un outil ne retourne rien d'utile, dis-le clairement.

Règles d'action :
- Quand l'utilisateur demande de créer ou préparer une facture, utilise create_invoice_draft. Ne dis jamais qu'une facture a été créée sans le résultat réussi de cet outil.
- Un montant sans précision est considéré HT. Une description manquante devient "Prestation de services". Le taux de TVA vient de la configuration de l'entreprise ou du dossier.
- L'outil crée uniquement un brouillon et ne l'envoie jamais. Explique-le clairement après la création.
- Si plusieurs clients correspondent, demande à l'utilisateur lequel choisir. Si aucun client ne correspond, demande-lui de créer le client dans Mohasib.
- Ne répète jamais une création déjà réussie dans le même tour.

Format de réponse — règles strictes, l'interface n'affiche que du texte brut :
- N'utilise JAMAIS de symboles Markdown : pas de #, pas de **, pas de _, pas de listes à puces avec * ou -, pas de tableaux Markdown.
- N'utilise AUCUN emoji.
- Écris en paragraphes courts et clairs, avec des sauts de ligne pour aérer. Pour une liste, écris chaque élément sur sa propre ligne, précédé d'un tiret simple suivi d'un espace ("- ").
- Pas de titres en majuscules ni de mise en forme décorative : du texte simple, comme dans un message.

Autres règles :
- Réponds en français ou en darija selon la langue de l'utilisateur.
- Sois clair, concis et concret. Va droit au but.
- N'invente jamais une référence légale ou une règle fiscale ; précise quand une règle peut avoir changé ou doit être vérifiée auprès de la DGI.
- Recommande l'avis d'un expert-comptable lorsque la situation nécessite une interprétation professionnelle.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_financial_summary",
    description:
      "Retourne un résumé financier réel de l'entreprise (ou du dossier client) de l'utilisateur connecté : chiffre d'affaires, dépenses, résultat estimé, TVA collectée, factures en attente/en retard. À utiliser pour toute question sur le revenu, le chiffre d'affaires, les dépenses, le résultat ou la TVA à déclarer.",
    input_schema: {
      type: "object",
      properties: {
        period: {
          type: "string",
          enum: ["month", "year", "all"],
          description: "Période à résumer : 'month' = mois en cours, 'year' = année en cours, 'all' = depuis le début.",
        },
      },
      required: ["period"],
    },
  },
  {
    name: "list_invoices",
    description: "Liste les factures récentes de l'utilisateur, avec filtre optionnel par statut. À utiliser pour des questions sur des factures précises, impayées ou en retard.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["draft", "sent", "paid", "overdue", "all"], description: "Filtre par statut. 'all' par défaut." },
        limit: { type: "number", description: "Nombre maximum de factures à retourner (max 20, 10 par défaut)." },
      },
    },
  },
  {
    name: "list_transactions",
    description: "Liste les transactions bancaires récentes de l'utilisateur, avec filtre optionnel par type.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["income", "expense", "all"], description: "Filtre par type. 'all' par défaut." },
        limit: { type: "number", description: "Nombre maximum de transactions à retourner (max 20, 10 par défaut)." },
      },
    },
  },
  {
    name: "get_company_profile",
    description: "Retourne les informations d'identité de l'entreprise ou du dossier client de l'utilisateur : raison sociale, forme juridique, ICE, IF, RC, CNSS, régime TVA.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "create_invoice_draft",
    description:
      "Crée réellement un brouillon de facture dans Mohasib pour un client existant. À utiliser immédiatement quand l'utilisateur demande de créer ou préparer une facture. Le brouillon n'est jamais envoyé. Un montant sans précision est HT, la description par défaut est 'Prestation de services', et la TVA ainsi que l'échéance utilisent la configuration Mohasib.",
    input_schema: {
      type: "object",
      properties: {
        client_name: {
          type: "string",
          description: "Nom du client existant tel qu'indiqué par l'utilisateur.",
        },
        amount: {
          type: "number",
          description: "Montant positif de la facture.",
        },
        amount_basis: {
          type: "string",
          enum: ["HT", "TTC"],
          description: "Base du montant. Utiliser HT si l'utilisateur ne précise rien.",
        },
        description: {
          type: "string",
          description: "Description de la prestation ou du produit. Utiliser 'Prestation de services' si elle manque.",
        },
        tax_rate: {
          type: "number",
          enum: [0, 7, 10, 14, 20],
          description: "Taux de TVA uniquement si l'utilisateur le précise explicitement. Sinon omettre pour utiliser la configuration Mohasib.",
        },
        due_date: {
          type: "string",
          description: "Échéance explicite au format YYYY-MM-DD. Omettre pour utiliser les conditions de paiement configurées.",
        },
      },
      required: ["client_name", "amount"],
    },
  },
];

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ToolContext = {
  ownerId: string;
  actorId: string;
  actorEmail: string | null;
  companyId: string | null;
  dossierId: string | null;
  canCreateInvoice: boolean;
  requestMeta: ReturnType<typeof getRequestMeta>;
  mutationResults: Map<string, unknown>;
};

async function executeTool(name: string, input: any, ctx: ToolContext): Promise<unknown> {
  const admin = createAdminClient();
  const { ownerId, dossierId } = ctx;

  try {
    if (name === "get_financial_summary") {
      const period = input?.period === "year" || input?.period === "all" ? input.period : "month";
      const now = new Date();
      const from = period === "month"
        ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
        : period === "year"
          ? `${now.getFullYear()}-01-01`
          : null;

      let txQuery = admin.from("transactions").select("type, amount")
        .eq(dossierId ? "dossier_id" : "user_id", dossierId ?? ownerId);
      if (!dossierId) txQuery = txQuery.is("dossier_id", null);
      if (from) txQuery = txQuery.gte("date", from);
      const { data: transactions } = await txQuery;

      const revenue = (transactions ?? []).filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
      const expenses = (transactions ?? []).filter((t) => t.type === "expense").reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

      let invQuery = admin.from("invoices").select("status, total, tax_amount, due_date")
        .eq(dossierId ? "dossier_id" : "user_id", dossierId ?? ownerId);
      if (!dossierId) invQuery = invQuery.is("dossier_id", null);
      const { data: invoices } = await invQuery;

      const activeInvoices = (invoices ?? []).filter((i) => i.status !== "draft");
      const pending = activeInvoices.filter((i) => ["sent", "overdue"].includes(i.status));
      const today = now.toISOString().slice(0, 10);
      const overdue = pending.filter((i) => i.due_date && i.due_date < today);
      const tvaCollectee = activeInvoices.reduce((s, i) => s + Number(i.tax_amount ?? 0), 0);

      return {
        periode: period,
        devise: "MAD",
        chiffre_affaires: Math.round(revenue),
        depenses: Math.round(expenses),
        resultat_estime: Math.round(revenue - expenses),
        tva_collectee: Math.round(tvaCollectee),
        factures_en_attente: pending.length,
        montant_factures_en_attente: Math.round(pending.reduce((s, i) => s + Number(i.total), 0)),
        factures_en_retard: overdue.length,
      };
    }

    if (name === "list_invoices") {
      const status = typeof input?.status === "string" ? input.status : "all";
      const limit = Math.min(Number(input?.limit) || 10, 20);
      let query = admin.from("invoices").select("invoice_number, issue_date, due_date, total, status, clients(name)")
        .eq(dossierId ? "dossier_id" : "user_id", dossierId ?? ownerId)
        .order("issue_date", { ascending: false })
        .limit(limit);
      if (!dossierId) query = query.is("dossier_id", null);
      if (status !== "all") query = query.eq("status", status);
      const { data } = await query;
      return {
        devise: "MAD",
        factures: (data ?? []).map((inv: any) => ({
          numero: inv.invoice_number,
          client: inv.clients?.name ?? null,
          date_emission: inv.issue_date,
          date_echeance: inv.due_date,
          total_ttc: Number(inv.total),
          statut: inv.status,
        })),
      };
    }

    if (name === "list_transactions") {
      const type = typeof input?.type === "string" ? input.type : "all";
      const limit = Math.min(Number(input?.limit) || 10, 20);
      let query = admin.from("transactions").select("date, description, amount, type, category")
        .eq(dossierId ? "dossier_id" : "user_id", dossierId ?? ownerId)
        .order("date", { ascending: false })
        .limit(limit);
      if (!dossierId) query = query.is("dossier_id", null);
      if (type !== "all") query = query.eq("type", type);
      const { data } = await query;
      return {
        devise: "MAD",
        transactions: (data ?? []).map((t: any) => ({
          date: t.date,
          description: t.description,
          montant: Number(t.amount),
          type: t.type,
          categorie: t.category,
        })),
      };
    }

    if (name === "get_company_profile") {
      if (dossierId) {
        const { data } = await admin.from("dossiers")
          .select("raison_sociale, forme_juridique, ice, if_fiscal, rc, cnss, regime_tva, capital_social")
          .eq("id", dossierId)
          .maybeSingle();
        return data ?? { erreur: "Dossier introuvable." };
      }
      const { data } = await admin.from("companies")
        .select("raison_sociale, forme_juridique, ice, if_number, rc, cnss, tva_regime, tva_assujetti, capital_social")
        .eq("user_id", ownerId)
        .maybeSingle();
      return data ?? { erreur: "Entreprise introuvable." };
    }

    if (name === "create_invoice_draft") {
      if (!ctx.canCreateInvoice) {
        return {
          succes: false,
          code: "permission_refusee",
          erreur: "Vous n'avez pas la permission de créer des factures dans cet espace.",
        };
      }

      const clientName = typeof input?.client_name === "string" ? input.client_name.trim() : "";
      const amount = Number(input?.amount);
      if (!clientName) return { succes: false, code: "client_requis", erreur: "Le nom du client est requis." };
      if (!Number.isFinite(amount) || amount <= 0 || amount > 999_999_999) {
        return { succes: false, code: "montant_invalide", erreur: "Le montant doit être positif et inférieur à 1 milliard MAD." };
      }

      const mutationKey = JSON.stringify({
        name,
        clientName: clientName.toLocaleLowerCase("fr"),
        amount,
        amountBasis: input?.amount_basis ?? "HT",
        description: input?.description ?? "Prestation de services",
        taxRate: input?.tax_rate ?? null,
        dueDate: input?.due_date ?? null,
        dossierId,
      });
      if (ctx.mutationResults.has(mutationKey)) return ctx.mutationResults.get(mutationKey);

      let clientsQuery = admin.from("clients").select("id, name, email").order("name");
      clientsQuery = dossierId
        ? clientsQuery.eq("dossier_id", dossierId)
        : clientsQuery.eq("user_id", ownerId).is("dossier_id", null);
      const { data: clients, error: clientsError } = await clientsQuery;
      if (clientsError) return { succes: false, code: "clients_indisponibles", erreur: clientsError.message };

      const clientMatch = matchAgentClient(clientName, clients ?? []);
      if (clientMatch.status === "ambiguous") {
        return {
          succes: false,
          code: "client_ambigu",
          erreur: "Plusieurs clients correspondent.",
          clients: clientMatch.clients.map((client) => ({ nom: client.name, email: client.email ?? null })),
        };
      }
      if (clientMatch.status === "not_found") {
        return {
          succes: false,
          code: "client_introuvable",
          erreur: `Aucun client ne correspond à "${clientName}".`,
          clients_existants: clientMatch.clients.map((client) => client.name),
        };
      }

      let paymentDelay: string | null = null;
      let configuredTaxRate = 20;
      if (dossierId) {
        const { data: dossier } = await admin.from("dossiers")
          .select("invoice_payment_delay, taux_tva_defaut, regime_tva")
          .eq("id", dossierId)
          .maybeSingle();
        paymentDelay = dossier?.invoice_payment_delay ?? null;
        configuredTaxRate = String(dossier?.regime_tva ?? "").toLocaleLowerCase("fr") === "exonere"
          ? 0
          : Number(dossier?.taux_tva_defaut ?? 20);
      } else {
        const { data: company } = await admin.from("companies")
          .select("invoice_payment_delay, tva_assujetti")
          .eq("user_id", ownerId)
          .maybeSingle();
        paymentDelay = company?.invoice_payment_delay ?? null;
        configuredTaxRate = company?.tva_assujetti === false ? 0 : 20;
      }

      const explicitTaxRate = Number(input?.tax_rate);
      const taxRate = input?.tax_rate === undefined
        ? configuredTaxRate
        : explicitTaxRate;
      if (![0, 7, 10, 14, 20].includes(taxRate)) {
        return { succes: false, code: "tva_invalide", erreur: "Le taux de TVA doit être 0, 7, 10, 14 ou 20 %." };
      }

      const amountBasis = input?.amount_basis === "TTC" ? "TTC" : "HT";
      const amounts = calculateAgentInvoiceAmounts(amount, taxRate, amountBasis);
      const issueDate = new Date().toISOString().slice(0, 10);
      if (input?.due_date !== undefined && !isIsoDate(input.due_date)) {
        return { succes: false, code: "echeance_invalide", erreur: "La date d'échéance doit être au format YYYY-MM-DD." };
      }
      const dueDate = isIsoDate(input?.due_date)
        ? input.due_date
        : calculateAgentDueDate(issueDate, paymentDelay);
      const description = typeof input?.description === "string" && input.description.trim()
        ? input.description.trim().slice(0, 500)
        : "Prestation de services";

      let invoiceNumber = await getNextInvoiceDocumentNumber(admin, {
        prefix: "FAC",
        userId: ownerId,
        dossierId,
      });
      const insertInvoice = (number: string) => admin.from("invoices").insert({
        user_id: ownerId,
        ...(dossierId ? { dossier_id: dossierId } : {}),
        client_id: clientMatch.client.id,
        invoice_number: number,
        invoice_type: "facture",
        status: "draft",
        issue_date: issueDate,
        due_date: dueDate,
        subtotal: amounts.subtotal,
        tax_rate: taxRate,
        tax_amount: amounts.taxAmount,
        total: amounts.total,
        currency: "MAD",
        items: [{
          description,
          quantity: 1,
          unit_price: amounts.subtotal,
          tva_rate: taxRate,
          amount: amounts.subtotal,
        }],
        notes: "Brouillon créé par l'agent Mohasib.",
      }).select("*").single();

      let { data: invoice, error: insertError } = await insertInvoice(invoiceNumber);
      if (insertError && (insertError.code === "23505" || /duplicate key/i.test(insertError.message ?? ""))) {
        invoiceNumber = await getNextInvoiceDocumentNumber(admin, {
          prefix: "FAC",
          userId: ownerId,
          dossierId,
        });
        const retry = await insertInvoice(invoiceNumber);
        invoice = retry.data;
        insertError = retry.error;
      }
      if (insertError || !invoice) {
        const limitReached = /trial_limit_reached:invoices/i.test(insertError?.message ?? "");
        return {
          succes: false,
          code: limitReached ? "limite_forfait_atteinte" : "creation_echouee",
          erreur: limitReached
            ? "La limite de factures du forfait d'essai est atteinte."
            : insertError?.message ?? "La facture n'a pas pu être créée.",
        };
      }

      if (dossierId) {
        await admin.from("dossiers").update({ derniere_ecriture: new Date().toISOString() }).eq("id", dossierId);
      }
      await createVersion(
        "invoice",
        invoice.id,
        invoice,
        ctx.actorId,
        ctx.actorEmail,
        "CREATE",
        "Brouillon créé par l'agent Mohasib",
      );
      await logAudit({
        userId: ctx.actorId,
        userEmail: ctx.actorEmail,
        companyId: ctx.companyId,
        dossierId,
        action: "CREATE",
        entityType: "invoice",
        entityId: invoice.id,
        entityLabel: invoice.invoice_number,
        newValues: { ...invoice, source: "mohasib_chat_agent" },
        ...ctx.requestMeta,
      });

      const result = {
        succes: true,
        brouillon: true,
        facture_id: invoice.id,
        numero: invoice.invoice_number,
        client: clientMatch.client.name,
        description,
        montant_ht: amounts.subtotal,
        tva: amounts.taxAmount,
        taux_tva: taxRate,
        total_ttc: amounts.total,
        date_emission: issueDate,
        date_echeance: dueDate,
        lien: dossierId
          ? `/comptable-pro/dossiers/${dossierId}/factures/${invoice.id}`
          : `/factures/${invoice.id}`,
      };
      ctx.mutationResults.set(mutationKey, result);
      return result;
    }

    return { erreur: "Outil inconnu." };
  } catch (error) {
    return { erreur: error instanceof Error ? error.message : "Erreur lors de la récupération des données." };
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response("Unauthorized", { status: 401 });

    const rateLimit = await checkRateLimit(getClientIp(request), "chat", CHAT_RATE_LIMIT);
    if (!rateLimit.allowed) {
      return tooManyRequests(rateLimit, CHAT_LIMIT, "Trop de messages. Réessayez dans quelques minutes.");
    }

    const body = await request.json();
    const messages: ChatMessage[] = Array.isArray(body.messages)
      ? body.messages
          .filter(
            (message: unknown): message is ChatMessage =>
              typeof message === "object" &&
              message !== null &&
              "role" in message &&
              "content" in message &&
              ((message as ChatMessage).role === "user" || (message as ChatMessage).role === "assistant") &&
              typeof (message as ChatMessage).content === "string" &&
              (message as ChatMessage).content.trim().length > 0
          )
          .slice(-24)
          .map((message: ChatMessage) => ({ ...message, content: message.content.slice(0, 4_000) }))
      : [];

    const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
    if (!latestUserMessage) return new Response("Invalid messages", { status: 400 });

    // Resolve which account's data this conversation may be grounded in. A
    // client_portal user's dossier scope is always derived from their own
    // membership row server-side — never trusted from the request body.
    const ownerId = await resolveAccountOwnerId(user.id);
    const access = await getUserAccessProfile(user.id);
    let dossierId: string | null = null;
    const admin = createAdminClient();
    if (access.roleName === "client_portal") {
      const { data: membership } = await admin.from("user_memberships")
        .select("dossier_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .eq("role_name", "client_portal")
        .maybeSingle();
      if (!membership?.dossier_id) {
        return new Response("Forbidden", { status: 403 });
      }
      dossierId = membership.dossier_id;
    } else if (typeof body.dossier_id === "string") {
      const { data: dossier } = await admin.from("dossiers")
        .select("id")
        .eq("id", body.dossier_id)
        .eq("fiduciaire_user_id", ownerId)
        .maybeSingle();
      if (!dossier) return new Response("Forbidden", { status: 403 });
      dossierId = dossier.id;
    }

    const { data: company } = await admin.from("companies")
      .select("id")
      .eq("user_id", ownerId)
      .maybeSingle();
    const companyId = company?.id ?? null;
    if (!companyId) return new Response("Account not found", { status: 403 });

    const monthlyUsageResult = await admin.rpc("consume_ai_agent_monthly_call", {
      p_company_id: companyId,
      p_limit: MONTHLY_AGENT_CALL_LIMIT,
    });
    const monthlyUsage = Array.isArray(monthlyUsageResult.data)
      ? monthlyUsageResult.data[0]
      : monthlyUsageResult.data;
    if (monthlyUsageResult.error || !monthlyUsage) {
      console.error("[chat] Monthly usage counter unavailable", monthlyUsageResult.error?.message ?? "empty response");
      return new Response("Usage counter unavailable", { status: 503 });
    }
    if (!monthlyUsage.allowed) {
      return Response.json({
        error: `Vous avez atteint la limite de ${MONTHLY_AGENT_CALL_LIMIT} appels du Mohasib Agent pour ce mois.`,
        used: Number(monthlyUsage.used ?? MONTHLY_AGENT_CALL_LIMIT),
        limit: MONTHLY_AGENT_CALL_LIMIT,
        resetDate: monthlyUsage.reset_date,
      }, {
        status: 429,
        headers: {
          "X-Mohasib-Agent-Limit": String(MONTHLY_AGENT_CALL_LIMIT),
          "X-Mohasib-Agent-Remaining": "0",
          "X-Mohasib-Agent-Reset": String(monthlyUsage.reset_date),
        },
      });
    }
    const canCreateInvoice = await can(
      {
        userId: user.id,
        companyId,
        dossierId,
        scope: dossierId ? "comptable_pro" : "business",
      },
      "invoice",
      "create",
    );

    let conversationId = typeof body.conversation_id === "string" ? body.conversation_id : null;
    if (conversationId) {
      const { data: ownedConversation } = await supabase
        .from("chat_conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!ownedConversation) return new Response("Conversation not found", { status: 404 });
    } else {
      const title = `${latestUserMessage.content.slice(0, 60)}${latestUserMessage.content.length > 60 ? "…" : ""}`;
      const { data: conversation, error } = await supabase
        .from("chat_conversations")
        .insert({ user_id: user.id, title })
        .select("id")
        .single();
      if (error || !conversation) return new Response("Could not create conversation", { status: 500 });
      conversationId = conversation.id;
    }

    const { error: saveUserError } = await supabase.from("chat_messages").insert({
      user_id: user.id,
      conversation_id: conversationId,
      role: "user",
      content: latestUserMessage.content,
    });
    if (saveUserError) return new Response("Could not save message", { status: 500 });

    const anthropic = new Anthropic();
    const toolContext: ToolContext = {
      ownerId,
      actorId: user.id,
      actorEmail: user.email ?? null,
      companyId,
      dossierId,
      canCreateInvoice,
      requestMeta: getRequestMeta(request),
      mutationResults: new Map(),
    };

    const encoder = new TextEncoder();
    const responseStream = new ReadableStream({
      async start(controller) {
        let fullReply = "";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ conversation_id: conversationId })}\n\n`));

        try {
          let conversationMessages: Anthropic.MessageParam[] = messages;

          for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
            const stream = anthropic.messages.stream({
              model: CHAT_MODEL,
              max_tokens: 1_200,
              system: SYSTEM_PROMPT,
              tools: TOOLS,
              messages: conversationMessages,
            });

            for await (const event of stream) {
              if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
                fullReply += event.delta.text;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
              }
            }

            const finalMessage = await stream.finalMessage();
            if (finalMessage.stop_reason !== "tool_use") break;

            conversationMessages = [...conversationMessages, { role: "assistant", content: finalMessage.content }];

            const toolUseBlocks = finalMessage.content.filter(
              (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
            );
            const toolResults: Anthropic.ToolResultBlockParam[] = [];
            for (const block of toolUseBlocks) {
              const result = await executeTool(block.name, block.input, toolContext);
              toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
            }
            conversationMessages = [...conversationMessages, { role: "user", content: toolResults }];
          }

          if (fullReply) {
            await supabase.from("chat_messages").insert({
              user_id: user.id,
              conversation_id: conversationId,
              role: "assistant",
              content: fullReply,
            });
            await supabase
              .from("chat_conversations")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", conversationId)
              .eq("user_id", user.id);
          }
        } catch {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: "Le service IA est momentanément indisponible." })}\n\n`)
          );
        } finally {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(responseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
