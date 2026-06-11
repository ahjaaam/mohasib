import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const errorDescription = searchParams.get("error_description");
  if (errorDescription) {
    return NextResponse.redirect(`${origin}/mot-de-passe-oublie?erreur=${encodeURIComponent(errorDescription)}`);
  }

  const supabase = await createClient();
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" })
      : { error: new Error("Lien de récupération incomplet") };
  if (error) {
    console.error("[auth/recuperation] exchangeCodeForSession failed:", error.message);
    return NextResponse.redirect(`${origin}/mot-de-passe-oublie?erreur=lien-invalide`);
  }

  return NextResponse.redirect(`${origin}/reinitialiser-mot-de-passe`);
}
