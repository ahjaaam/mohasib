import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET /api/chat/history — list all conversations
// GET /api/chat/history?id=xxx — get messages for a conversation
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");

  if (id) {
    const { data } = await supabase
      .from("chat_messages")
      .select("role, content, created_at")
      .eq("conversation_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    return NextResponse.json({ messages: data ?? [] });
  }

  const { data } = await supabase
    .from("chat_conversations")
    .select("id, title, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ conversations: data ?? [] });
}

// DELETE /api/chat/history?id=xxx — delete one conversation
// DELETE /api/chat/history — delete all
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");

  if (id) {
    await supabase.from("chat_conversations").delete().eq("id", id).eq("user_id", user.id);
  } else {
    await supabase.from("chat_conversations").delete().eq("user_id", user.id);
  }

  return NextResponse.json({ ok: true });
}
