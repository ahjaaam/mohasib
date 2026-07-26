import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp, tooManyRequests } from "@/lib/rate-limit";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import { getUserAccessProfile } from "@/lib/team";

const CHAT_LIMIT = 30;
const CHAT_RATE_LIMIT = { maxAttempts: CHAT_LIMIT, windowMs: 60_000, blockMs: 5 * 60_000 };
const CHAT_MODEL = process.env.ANTHROPIC_CHAT_MODEL || "claude-sonnet-4-6";
const MAX_TOOL_ITERATIONS = 4;

const SYSTEM_PROMPT = `Tu es Mohasib Chat, un assistant comptable spécialisé pour les PME et TPE marocaines, intégré à l'application Mohasib.

Tu maîtrises la comptabilité générale marocaine, le PCGM, la TVA, l'IS, l'IR, la facturation, les déclarations fiscales et les obligations administratives des entreprises au Maroc.

Tu as accès à des outils qui interrogent les vraies données comptables de l'utilisateur connecté (chiffre d'affaires, factures, transactions, informations légales de l'entreprise). Utilise-les systématiquement dès qu'une question porte sur SES données (son chiffre d'affaires, ses factures, ses clients, sa trésorerie, son ICE, etc.) plutôt que de deviner ou de répondre en termes génériques. N'invente jamais un chiffre propre à l'entreprise : si un outil ne retourne rien d'utile, dis-le clairement.

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
];

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ToolContext = { ownerId: string; dossierId: string | null };

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
      dossierId = dossier?.id ?? null;
    }

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
    const toolContext: ToolContext = { ownerId, dossierId };

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
