"use client";

import { createContext, useContext } from "react";
import type { PlanEntitlements } from "@/lib/plan-features";

const PlanEntitlementsContext = createContext<PlanEntitlements | null>(null);

export function PlanEntitlementsProvider({ value, children }: { value: PlanEntitlements; children: React.ReactNode }) {
  return <PlanEntitlementsContext.Provider value={value}>{children}</PlanEntitlementsContext.Provider>;
}

export function usePlanEntitlements() {
  const value = useContext(PlanEntitlementsContext);
  if (!value) throw new Error("PlanEntitlementsProvider manquant");
  return value;
}
