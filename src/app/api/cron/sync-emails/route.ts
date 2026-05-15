import { NextRequest, NextResponse } from "next/server";

// Email sync is now inbound-only via Resend webhook (/api/email/inbound).
// This cron endpoint is kept as a no-op so existing Vercel Cron config
// doesn't break; it can be removed once the cron job is deleted.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, message: "Email sync now handled by inbound webhook" });
}
