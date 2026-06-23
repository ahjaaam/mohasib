import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api";

export async function GET() {
  const { user, response } = await requireAdminApi();
  if (response) return response;

  const eventId = Sentry.captureException(
    new Error("Mohasib Sentry verification — controlled test error"),
    {
      tags: {
        verification: "sentry",
        route: "/api/admin/sentry-test",
      },
      user: user?.id ? { id: user.id } : undefined,
    },
  );

  await Sentry.flush(2_000);

  return NextResponse.json({
    ok: true,
    eventId,
    message: "Controlled Sentry verification event sent.",
  });
}
