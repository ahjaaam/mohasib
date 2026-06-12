"use client";

import { createContext, useContext } from "react";

const AccountOwnerContext = createContext<string | null>(null);

export function AccountOwnerProvider({ ownerId, children }: { ownerId: string; children: React.ReactNode }) {
  return <AccountOwnerContext.Provider value={ownerId}>{children}</AccountOwnerContext.Provider>;
}

export function useAccountOwnerId() {
  const ownerId = useContext(AccountOwnerContext);
  if (!ownerId) throw new Error("AccountOwnerProvider is missing");
  return ownerId;
}
