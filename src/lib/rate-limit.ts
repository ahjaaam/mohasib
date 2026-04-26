import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Uses service role to bypass RLS on rate_limits table.
// Falls back to anon key if service role key is not configured.
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface RateLimitOptions {
  maxAttempts: number;
  windowMs: number;  // sliding window in ms
  blockMs: number;   // how long to block after maxAttempts is reached
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;  // unix timestamp (seconds)
}

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "127.0.0.1"
  );
}

export async function checkRateLimit(
  ip: string,
  endpoint: string,
  opts: RateLimitOptions
): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - opts.windowMs);

  const { data: existing } = await adminClient
    .from("rate_limits")
    .select("*")
    .eq("ip", ip)
    .eq("endpoint", endpoint)
    .single();

  // Still blocked from a previous violation
  if (existing?.blocked_until && new Date(existing.blocked_until) > now) {
    const resetTime = Math.floor(new Date(existing.blocked_until).getTime() / 1000);
    return { allowed: false, remaining: 0, resetTime };
  }

  // No record yet, or window has expired → fresh start
  if (!existing || new Date(existing.first_attempt) < windowStart) {
    await adminClient.from("rate_limits").upsert(
      { ip, endpoint, attempts: 1, first_attempt: now.toISOString(), blocked_until: null },
      { onConflict: "ip,endpoint" }
    );
    const resetTime = Math.floor((now.getTime() + opts.windowMs) / 1000);
    return { allowed: true, remaining: opts.maxAttempts - 1, resetTime };
  }

  const attempts = (existing.attempts ?? 0) + 1;

  if (attempts >= opts.maxAttempts) {
    const blockedUntil = new Date(now.getTime() + opts.blockMs);
    await adminClient.from("rate_limits")
      .update({ attempts, blocked_until: blockedUntil.toISOString() })
      .eq("ip", ip)
      .eq("endpoint", endpoint);
    const resetTime = Math.floor(blockedUntil.getTime() / 1000);
    return { allowed: false, remaining: 0, resetTime };
  }

  await adminClient.from("rate_limits")
    .update({ attempts })
    .eq("ip", ip)
    .eq("endpoint", endpoint);

  const resetTime = Math.floor((new Date(existing.first_attempt).getTime() + opts.windowMs) / 1000);
  return { allowed: true, remaining: opts.maxAttempts - attempts, resetTime };
}

export function applyRateLimitHeaders(
  res: NextResponse,
  limit: number,
  result: RateLimitResult
): void {
  res.headers.set("X-RateLimit-Limit", limit.toString());
  res.headers.set("X-RateLimit-Remaining", result.remaining.toString());
  res.headers.set("X-RateLimit-Reset", result.resetTime.toString());
  if (!result.allowed) {
    const retryAfter = Math.max(0, result.resetTime - Math.floor(Date.now() / 1000));
    res.headers.set("Retry-After", retryAfter.toString());
  }
}

export function tooManyRequests(result: RateLimitResult, limit: number, message: string): NextResponse {
  const res = NextResponse.json({ error: message }, { status: 429 });
  applyRateLimitHeaders(res, limit, result);
  return res;
}
