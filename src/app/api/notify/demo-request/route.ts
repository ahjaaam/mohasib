import { NextResponse } from "next/server";
import { sendLeadNotification } from "@/lib/lead-notifications";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await sendLeadNotification({
      kind: "demo",
      fullName: String(body.nom ?? ""),
      email: String(body.email ?? ""),
      phone: String(body.telephone ?? ""),
      company: String(body.entreprise ?? ""),
      source: "Demande de démo homepage",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Demo notification failed", error);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
