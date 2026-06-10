import AdminShell from "@/components/admin/AdminShell";
import { requireAdmin } from "@/lib/admin-auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return <AdminShell email={user.email ?? ""}>{children}</AdminShell>;
}
