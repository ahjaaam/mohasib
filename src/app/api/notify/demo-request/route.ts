import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendLeadNotification } from "@/lib/lead-notifications";
import { checkRateLimit, getClientIp, tooManyRequests } from "@/lib/rate-limit";

const RATE_LIMIT = { maxAttempts: 5, windowMs: 60 * 60 * 1_000, blockMs: 60 * 60 * 1_000 };

const PROFILES: Record<string, string> = {
  entrepreneur: "Entrepreneur / dirigeant",
  independant: "Indépendant",
  comptable: "Comptable",
  fiduciaire: "Fiduciaire / cabinet",
  autre: "Autre",
};

const NEEDS: Record<string, string> = {
  "vue-ensemble": "Vue d’ensemble de Mohasib",
  facturation: "Facturation et suivi des échéances",
  documents: "Documents, e-mails et OCR",
  comptabilite: "Comptabilité et rapprochement",
  declarations: "TVA, paie et déclarations",
  cabinet: "Gestion d’un cabinet comptable",
};

function clean(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await checkRateLimit(getClientIp(request), "public/demo-request", RATE_LIMIT);
    if (!rateLimit.allowed) {
      return tooManyRequests(rateLimit, RATE_LIMIT.maxAttempts, "Trop de demandes. Réessayez dans une heure.");
    }

    const body = await request.json().catch(() => ({}));
    if (clean(body.website, 200)) return NextResponse.json({ ok: true });

    const nom = clean(body.nom, 120);
    const email = clean(body.email, 320).toLowerCase();
    const telephoneInput = clean(body.telephone, 24);
    const telephone = telephoneInput.startsWith("+")
      ? telephoneInput
      : `+212 ${telephoneInput.replace(/^0+/, "")}`;
    const entreprise = clean(body.entreprise, 160);
    const profil = clean(body.profil, 40);
    const besoin = clean(body.besoin, 60);

    if (
      !nom ||
      !email ||
      !telephoneInput ||
      !entreprise ||
      !PROFILES[profil] ||
      !NEEDS[besoin] ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json(
        { ok: false, message: "Veuillez compléter tous les champs avec des informations valides." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("demo_requests")
      .insert({ nom, email, telephone, entreprise, profil, besoin: NEEDS[besoin] })
      .select("id")
      .single();

    if (error || !data) {
      console.error("Demo request insert failed", error);
      return NextResponse.json(
        { ok: false, message: "Impossible d’enregistrer votre demande. Réessayez dans un instant." },
        { status: 500 },
      );
    }

    void sendLeadNotification({
      kind: "demo",
      fullName: nom,
      email,
      phone: telephone,
      company: entreprise,
      userType: PROFILES[profil],
      message: NEEDS[besoin],
      source: "Demande de vidéo démo — homepage",
    });

    return NextResponse.json({ ok: true, id: data.id });
  } catch (error) {
    console.error("Demo request failed", error);
    return NextResponse.json(
      { ok: false, message: "Impossible d’envoyer votre demande. Réessayez dans un instant." },
      { status: 500 },
    );
  }
}
