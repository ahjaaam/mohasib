"use client";

import { createContext, useContext, useEffect } from "react";

interface DossierContextType {
  dossierId: string | null;
}

const DossierContext = createContext<DossierContextType>({ dossierId: null });

export function DossierProvider({
  dossierId,
  children,
}: {
  dossierId: string | null;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (dossierId) {
      document.cookie = `active_dossier_id=${dossierId}; path=/; max-age=7200`;
    } else {
      document.cookie = "active_dossier_id=; path=/; max-age=0";
    }
  }, [dossierId]);

  return (
    <DossierContext.Provider value={{ dossierId }}>
      {children}
    </DossierContext.Provider>
  );
}

export const useDossier = () => useContext(DossierContext);
