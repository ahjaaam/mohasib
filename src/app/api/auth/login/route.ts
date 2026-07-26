import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimitHeaders, clearRateLimit, getClientIp, getRateLimitStatus, recordRateLimitFailure, tooManyRequests } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { getRequestMeta } from "@/lib/request-meta";
import { getAccountApprovalStatus } from "@/lib/account-approval";
import { resolveClientPortalRedirect } from "@/lib/team";

const LIMIT = 5;
const CAPTCHA_THRESHOLD = 3;
const OPTS = { maxAttempts: LIMIT, windowMs: 15 * 60_000, blockMs: 15 * 60_000 };

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  if (!process.env.TURNSTILE_SECRET_KEY) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: ip,
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
  let email: string, password: string, captchaToken: string | undefined;
  try {
    ({ email, password, captchaToken } = await req.json());
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json({ error: "Email et mot de passe requis." }, { status: 400 });
  }
  email = email.trim().toLowerCase();
  const emailKey = `email:${crypto.createHash("sha256").update(email).digest("hex")}`;
  const [ipStatus, emailStatus] = await Promise.all([
    getRateLimitStatus(ip, "auth/login:ip", OPTS),
    getRateLimitStatus(emailKey, "auth/login:email", OPTS),
  ]);
  const limitingStatus = !ipStatus.allowed ? ipStatus : emailStatus;
  if (!ipStatus.allowed || !emailStatus.allowed) {
    return tooManyRequests(limitingStatus, LIMIT, "Trop de tentatives. Réessayez dans 15 minutes.");
  }

  const captchaRequired = Math.max(ipStatus.attempts ?? 0, emailStatus.attempts ?? 0) >= CAPTCHA_THRESHOLD;
  if (captchaRequired) {
    if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || !process.env.TURNSTILE_SECRET_KEY) {
      return NextResponse.json({ error: "La vérification de sécurité est indisponible. Contactez le support." }, { status: 503 });
    }
    if (!captchaToken) {
      return NextResponse.json({
        error: "Vérification de sécurité requise.",
        code: "captcha_required",
        captchaRequired: true,
      }, { status: 403 });
    }
    const valid = await verifyTurnstile(captchaToken, ip);
    if (!valid) {
      return NextResponse.json({
        error: "Vérification CAPTCHA échouée. Réessayez.",
        code: "captcha_invalid",
        captchaRequired: true,
      }, { status: 403 });
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const [ipFailure, emailFailure] = await Promise.all([
      recordRateLimitFailure(ip, "auth/login:ip", OPTS),
      recordRateLimitFailure(emailKey, "auth/login:email", OPTS),
    ]);
    logAudit({
      userEmail: email,
      action: "LOGIN_FAILED",
      entityType: "session",
      entityLabel: email,
      success: false,
      errorMessage: "Invalid credentials",
      ...getRequestMeta(req),
    }).catch(() => {});
    if (!ipFailure.allowed || !emailFailure.allowed) {
      return tooManyRequests(!ipFailure.allowed ? ipFailure : emailFailure, LIMIT, "Trop de tentatives. Réessayez dans 15 minutes.");
    }
    const res = NextResponse.json({
      error: "Email ou mot de passe incorrect.",
      captchaRequired: Math.max(ipFailure.attempts ?? 0, emailFailure.attempts ?? 0) >= CAPTCHA_THRESHOLD,
    }, { status: 401 });
    applyRateLimitHeaders(res, LIMIT, ipFailure.remaining < emailFailure.remaining ? ipFailure : emailFailure);
    return res;
  }

  if (data.user) {
    const approvalStatus = await getAccountApprovalStatus(data.user.id);
    if (approvalStatus === "pending" || approvalStatus === "rejected") {
      await supabase.auth.signOut();
      return NextResponse.json({
        error: "ACCOUNT_PENDING",
        code: "account_pending",
        message: "Votre compte est en attente de validation par l'équipe Mohasib.",
      }, { status: 403 });
    }
  }

  await Promise.all([
    clearRateLimit(ip, "auth/login:ip"),
    clearRateLimit(emailKey, "auth/login:email"),
  ]);
  logAudit({
    userId: data.user?.id,
    userEmail: data.user?.email ?? email,
    action: "LOGIN",
    entityType: "session",
    entityId: data.user?.id,
    entityLabel: data.user?.email ?? email,
    ...getRequestMeta(req),
  }).catch(() => {});
  const redirectTo = data.user ? await resolveClientPortalRedirect(data.user.id) : null;
  const res = NextResponse.json({ userId: data.user?.id, redirectTo });
  applyRateLimitHeaders(res, LIMIT, { allowed: true, remaining: LIMIT, resetTime: Math.ceil(Date.now() / 1000), attempts: 0 });
  return res;
}
