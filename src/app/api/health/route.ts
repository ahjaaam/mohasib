import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const requiredConfiguration = {
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabaseServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
  const ready = Object.values(requiredConfiguration).every(Boolean);

  return NextResponse.json(
    {
      status: ready ? "ok" : "degraded",
      service: "mohasib-web",
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "local",
      timestamp: new Date().toISOString(),
      checks: {
        application: "ok",
        configuration: ready ? "ok" : "missing",
      },
    },
    {
      status: ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
