"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import InboxPage from "@/app/(app)/inbox/page";

function InboxWrapper() {
  const params = useParams();
  const dossierId = params.id as string;
  const [inboxEmail, setInboxEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("dossiers")
      .select("inbox_email")
      .eq("id", dossierId)
      .single()
      .then(({ data }) => setInboxEmail(data?.inbox_email ?? null));
  }, [dossierId]);

  return <InboxPage dossierId={dossierId} inboxEmail={inboxEmail} />;
}

export default function DossierInboxPage() {
  return (
    <Suspense>
      <InboxWrapper />
    </Suspense>
  );
}
