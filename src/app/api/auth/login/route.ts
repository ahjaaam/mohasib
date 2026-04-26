import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp, applyRateLimitHeaders, tooManyRequests } from "@/lib/rate-limit";

const LIMIT = 5;
const OPTS = { maxAttempts: LIMIT, windowMs: 60_000, blockMs: 15 * 60_000 };

async function verifyTurnstile(token: string): Promise<boolean> {
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: token,
      }),
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(ip, "auth/login", OPTS);

  if (!rl.allowed) {
    return tooManyRequests(rl, LIMIT, "Trop de tentatives. Réessayez dans 15 minutes.");
  }

  let email: string, password: string, captchaToken: string | undefined;
  try {
    ({ email, password, captchaToken } = await req.json());
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json({ error: "Email et mot de passe requis." }, { status: 400 });
  }

  // Verify CAPTCHA when the client sends a token (triggered after 3 failures)
  if (captchaToken) {
    const valid = await verifyTurnstile(captchaToken);
    if (!valid) {
      const res = NextResponse.json(
        { error: "Vérification CAPTCHA échouée. Réessayez." },
        { status: 403 }
      );
      applyRateLimitHeaders(res, LIMIT, rl);
      return res;
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const res = NextResponse.json({
      error: error.message === "Invalid login credentials"
        ? "Email ou mot de passe incorrect."
        : error.message,
    }, { status: 401 });
    applyRateLimitHeaders(res, LIMIT, rl);
    return res;
  }

  const res = NextResponse.json({ userId: data.user?.id });
  applyRateLimitHeaders(res, LIMIT, rl);
  return res;
}
