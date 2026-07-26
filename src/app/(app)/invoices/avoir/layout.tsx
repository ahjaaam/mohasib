import { redirect } from "next/navigation";
import { requirePlanFeature } from "@/lib/api-plan";

export default async function AvoirLayout({ children }: { children: React.ReactNode }) {
  const plan = await requirePlanFeature("avoirs");
  if (plan.response) redirect("/tarifs?feature=avoirs");
  return children;
}
