import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validatePassword } from "@/lib/password-policy";
import { sendLeadNotification } from "@/lib/lead-notifications";

const USER_TYPES = new Set(["entrepreneur", "fiduciaire"]);

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const fullName = String(body.full_name ?? "").trim();
  const company = String(body.company ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const userType = USER_TYPES.has(String(body.user_type)) ? String(body.user_type) : "entrepreneur";

  if (!fullName || !email || !password) {
    return NextResponse.json({ error: "Nom, email et mot de passe requis." }, { status: 400 });
  }
  if (!phone) {
    return NextResponse.json({ error: "Le numéro de téléphone est obligatoire." }, { status: 400 });
  }
  const passwordError = validatePassword(password);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        company,
        phone,
        user_type: userType,
      },
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
  }
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    return NextResponse.json({
      error: "Un compte existe déjà avec cette adresse e-mail. Connectez-vous ou réinitialisez votre mot de passe.",
      code: "email_exists",
    }, { status: 409 });
  }

  await sendLeadNotification({
    kind: "signup",
    fullName,
    email,
    phone,
    company,
    userType,
    source: "Création de compte",
  }).catch(error => {
    console.error("Signup notification failed", error);
  });

  return NextResponse.json({
    ok: true,
    hasSession: Boolean(data.session),
    redirect: userType === "fiduciaire" ? "/comptable-pro" : "/tableau-de-bord",
  });
}
