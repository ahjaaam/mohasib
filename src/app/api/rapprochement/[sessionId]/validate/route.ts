import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recomputeRapprochementSession } from "@/lib/rapprochement-api";
import { authorizePermission } from "@/lib/api-permissions";

export async function POST(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const permission = await authorizePermission("accounting", "lock");
    if (permission.response) return permission.response;

    const result = await recomputeRapprochementSession(supabase, sessionId);
    if (!result) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (!result.isBalanced) {
      return NextResponse.json({ error: "Le rapprochement n'est pas équilibré", ...result }, { status: 400 });
    }

    await supabase
      .from("rapprochement_sessions")
      .update({ statut: "validé", validated_at: new Date().toISOString() })
      .eq("id", sessionId);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
