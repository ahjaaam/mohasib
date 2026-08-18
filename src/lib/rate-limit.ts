import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { isIP } from "node:net";

// Uses service role to bypass RLS on rate_limits table.
const adminClient = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

export interface RateLimitOptions {
  maxAttempts: number;
  windowMs: number;  // sliding window in ms
  blockMs: number;   // how long to block after maxAttempts is reached
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;  // unix timestamp (seconds)
  attempts?: number;
}

async function getExistingRateLimit(key: string, endpoint: string) {
  if (!adminClient) return null;
  const { data, error } = await adminClient
    .from("rate_limits")
    .select("*")
    .eq("ip", key)
    .eq("endpoint", endpoint)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function unavailableResult(opts: RateLimitOptions): RateLimitResult {
  return {
    allowed: false,
    remaining: 0,
    resetTime: Math.ceil(Date.now() / 1000) + 60,
    attempts: opts.maxAttempts,
  };
}

async function consumeRateLimit(
  key: string,
  endpoint: string,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  if (!adminClient) return unavailableResult(opts);
  const { data, error } = await adminClient.rpc("consume_rate_limit", {
    key_arg: key,
    endpoint_arg: endpoint,
    max_attempts_arg: opts.maxAttempts,
    window_ms_arg: opts.windowMs,
    block_ms_arg: opts.blockMs,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) {
    console.error("[rate-limit] Atomic counter unavailable", error?.message ?? "empty response");
    return unavailableResult(opts);
  }
  return {
    allowed: row.allowed === true,
    remaining: Number(row.remaining ?? 0),
    resetTime: Number(row.reset_time ?? Math.ceil(Date.now() / 1000) + 60),
    attempts: Number(row.attempts ?? 0),
  };
}

export async function getRateLimitStatus(
  key: string,
  endpoint: string,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  if (!adminClient) return unavailableResult(opts);
  const now = new Date();
  let existing;
  try {
    existing = await getExistingRateLimit(key, endpoint);
  } catch (error) {
    console.error("[rate-limit] Status unavailable", error instanceof Error ? error.message : error);
    return unavailableResult(opts);
  }
  if (existing?.blocked_until && new Date(existing.blocked_until) > now) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: Math.floor(new Date(existing.blocked_until).getTime() / 1000),
      attempts: Number(existing.attempts ?? opts.maxAttempts),
    };
  }
  if (!existing || new Date(existing.first_attempt).getTime() < now.getTime() - opts.windowMs) {
    return {
      allowed: true,
      remaining: opts.maxAttempts,
      resetTime: Math.floor((now.getTime() + opts.windowMs) / 1000),
      attempts: 0,
    };
  }
  const attempts = Number(existing.attempts ?? 0);
  return {
    allowed: true,
    remaining: Math.max(0, opts.maxAttempts - attempts),
    resetTime: Math.floor((new Date(existing.first_attempt).getTime() + opts.windowMs) / 1000),
    attempts,
  };
}

export async function recordRateLimitFailure(
  key: string,
  endpoint: string,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  return consumeRateLimit(key, endpoint, opts);
}

export async function clearRateLimit(key: string, endpoint: string) {
  if (!adminClient) return;
  await adminClient.from("rate_limits").delete().eq("ip", key).eq("endpoint", endpoint);
}

export function getClientIp(req: NextRequest): string {
  const candidates = process.env.VERCEL
    ? [req.headers.get("x-vercel-forwarded-for"), req.headers.get("x-forwarded-for"), req.headers.get("x-real-ip")]
    : [req.headers.get("cf-connecting-ip"), req.headers.get("x-real-ip"), req.headers.get("x-forwarded-for")];
  for (const candidate of candidates) {
    const value = candidate?.split(",")[0]?.trim();
    if (value && isIP(value)) return value;
  }
  // A shared fallback deliberately fails closed as a single rate-limit bucket.
  return "unknown";
}

export async function checkRateLimit(
  ip: string,
  endpoint: string,
  opts: RateLimitOptions
): Promise<RateLimitResult> {
  return consumeRateLimit(ip, endpoint, opts);
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
