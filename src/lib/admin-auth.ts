import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || !adminEmails().includes(user.email.toLowerCase())) notFound();
  return user;
}

export async function getAdminUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email && adminEmails().includes(user.email.toLowerCase()) ? user : null;
}
