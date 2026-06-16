import "server-only";
import type { NextRequest } from "next/server";

function deviceType(userAgent: string | null) {
  const ua = userAgent?.toLowerCase() ?? "";
  if (/ipad|tablet/.test(ua)) return "tablet";
  if (/mobile|iphone|android/.test(ua)) return "mobile";
  if (ua) return "desktop";
  return "api";
}

export function getRequestMeta(request: Request | NextRequest) {
  const headers = request.headers;
  const userAgent = headers.get("user-agent");
  const forwardedFor = headers.get("x-forwarded-for");
  const ipAddress = forwardedFor?.split(",")[0]?.trim()
    ?? headers.get("x-real-ip")
    ?? null;
  const url = new URL(request.url);

  return {
    ipAddress,
    userAgent,
    deviceType: deviceType(userAgent),
    requestMethod: request.method,
    requestPath: url.pathname,
  };
}
