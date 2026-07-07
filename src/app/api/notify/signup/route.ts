import { NextResponse } from "next/server";
import { sendLeadNotification } from "@/lib/lead-notifications";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await sendLeadNotification({
      kind: "signup",
      fullName: String(body.full_name ?? ""),
      email: String(body.email ?? ""),
      phone: String(body.phone ?? ""),
      company: String(body.company ?? ""),
      userType: String(body.user_type ?? ""),
      source: "Création de compte",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Signup notification failed", error);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
