import { redirect } from "next/navigation";
import { requirePlanFeature } from "@/lib/api-plan";

export default async function ExportLayout({ children }: { children: React.ReactNode }) {
  const plan = await requirePlanFeature("export_fiduciaire");
  if (plan.response) redirect("/tarifs?feature=export_fiduciaire");
  return children;
}
