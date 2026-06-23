"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { boundary: "global-error" },
      extra: { digest: error.digest },
    });
  }, [error]);

  return (
    <html lang="fr">
      <body className="flex min-h-screen items-center justify-center bg-[#FAFAF6] px-6 text-[#0D1526]">
        <main className="max-w-md text-center">
          <h1 className="text-2xl font-bold">Une erreur est survenue</h1>
          <p className="mt-3 text-sm text-gray-600">
            L&apos;incident a été enregistré. Vous pouvez réessayer sans perdre votre session.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-md bg-[#0D1526] px-5 py-2.5 text-sm font-semibold text-white"
          >
            Réessayer
          </button>
        </main>
      </body>
    </html>
  );
}
