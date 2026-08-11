import AdminShell from "@/components/admin/AdminShell";
import { requireAdmin } from "@/lib/admin-auth";
import { adminNavigationCounts } from "@/lib/admin-data";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, navigationCounts] = await Promise.all([
    requireAdmin(),
    adminNavigationCounts(),
  ]);
  return <AdminShell email={user.email ?? ""} navigationCounts={navigationCounts}>{children}</AdminShell>;
}
