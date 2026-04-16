import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SYSTEM_PROMPT = `Tu es Mohasib Chat, un assistant comptable intelligent spécialisé pour les PME marocaines.

Tu maîtrises parfaitement :
- La comptabilité générale marocaine (Plan Comptable Général Marocain - PCGM)
- La fiscalité marocaine (TVA, IS, IR, taxe professionnelle, taxe de services communaux)
- La réglementation des entreprises au Maroc (OMPIC, RC, ICE, IF)
- La facturation et les obligations légales des entreprises marocaines
- La gestion financière des PME et TPE
- Les déclarations fiscales (déclarations TVA mensuelle/trimestrielle, liasse fiscale)
- L'Office des Changes et la réglementation des devises
- Les normes IFRS et leur application au Maroc

Tu réponds de manière claire, concise et professionnelle.
Tu utilises des chiffres et exemples concrets quand c'est utile.
Tu indiques toujours les références légales pertinentes (articles du CGI, décrets, circulaires DGI).
Tu précises quand une question nécessite l'avis d'un expert-comptable agréé.

Réponds en français ou darija selon la langue de l'utilisateur.`;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response("Unauthorized", { status: 401 });

    const { messages, conversation_id } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response("Invalid messages", { status: 400 });
    }

    const validMessages = messages.filter(
      (m) => m.role && m.content && typeof m.content === "string"
    );

    // Resolve or create conversation
    let convId: string = conversation_id;
    if (!convId) {
      // Auto-title from first user message (truncated)
      const firstUser = validMessages.find((m) => m.role === "user");
      const title = firstUser
        ? firstUser.content.slice(0, 60) + (firstUser.content.length > 60 ? "…" : "")
        : "Nouvelle conversation";
      const { data: conv } = await supabase
        .from("chat_conversations")
        .insert({ user_id: user.id, title })
        .select("id")
        .single();
      convId = (conv as { id: string }).id;
    }

    // Save the latest user message
    const lastUserMsg = [...validMessages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      await supabase.from("chat_messages").insert({
        user_id: user.id,
        conversation_id: convId,
        role: "user",
        content: lastUserMsg.content,
      });
    }

    const stream = await anthropic.messages.stream({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: validMessages,
    });

    const encoder = new TextEncoder();
    let fullReply = "";

    const readableStream = new ReadableStream({
      async start(controller) {
        // Send the conversation id first so client can store it
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ conversation_id: convId })}\n\n`)
        );

        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            fullReply += event.delta.text;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
            );
          }
        }

        if (fullReply) {
          await supabase.from("chat_messages").insert({
            user_id: user.id,
            conversation_id: convId,
            role: "assistant",
            content: fullReply,
          });
          // Touch updated_at on the conversation
          await supabase
            .from("chat_conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", convId);
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
