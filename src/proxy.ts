import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { FEATURES } from "@/lib/features";

export async function proxy(request: NextRequest) {
  if (!FEATURES.RAPPROCHEMENT_ENABLED && request.nextUrl.pathname.startsWith("/api/rapprochement")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!monitoring|_next/static|_next/image|favicon.ico|f/|api/oauth/|api/email/|api/cron/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4)$).*)",
  ],
};
