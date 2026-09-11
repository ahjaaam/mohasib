import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const EXPECTED_SCHEMA_VERSION = 107;

export async function GET() {
  const requiredConfiguration = {
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabaseServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
  const configurationReady = Object.values(requiredConfiguration).every(Boolean);
  let database: "ok" | "unavailable" = "unavailable";
  let schema: "ok" | "outdated" | "unavailable" = "unavailable";
  let schemaVersion: number | null = null;
  if (configurationReady) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin.from("app_schema_version").select("version").eq("singleton", true).single();
      if (!error && data) {
        database = "ok";
        schemaVersion = Number(data.version);
        schema = schemaVersion === EXPECTED_SCHEMA_VERSION ? "ok" : "outdated";
      }
    } catch {
      database = "unavailable";
    }
  }
  const ready = configurationReady && database === "ok" && schema === "ok";

  return NextResponse.json(
    {
      status: ready ? "ok" : "degraded",
      service: "mohasib-web",
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "local",
      timestamp: new Date().toISOString(),
      checks: {
        application: "ok",
        configuration: configurationReady ? "ok" : "missing",
        database,
        schema,
      },
      schemaVersion,
      expectedSchemaVersion: EXPECTED_SCHEMA_VERSION,
    },
    {
      status: ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
