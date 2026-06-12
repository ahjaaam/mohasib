"use client";

import { createContext, useCallback, useContext } from "react";
import toast from "react-hot-toast";

export const PERMISSION_DENIED_MESSAGE =
  "Le propriétaire ne vous a pas accordé cet accès. Contactez-le pour modifier vos permissions.";

const PermissionsContext = createContext<string[] | null>(null);

export function PermissionsProvider({ permissions, children }: { permissions: string[] | null; children: React.ReactNode }) {
  return <PermissionsContext.Provider value={permissions}>{children}</PermissionsContext.Provider>;
}

export function usePermissions(explicitPermissions?: string[] | null) {
  const contextPermissions = useContext(PermissionsContext);
  const permissions = explicitPermissions === undefined ? contextPermissions : explicitPermissions;
  const can = useCallback((resource: string, action: string) => (
    permissions === null || permissions.includes(`${resource}:${action}`)
  ), [permissions]);

  const guard = useCallback((resource: string, action: string) => {
    if (can(resource, action)) return true;
    toast.error(PERMISSION_DENIED_MESSAGE, { duration: 5000 });
    return false;
  }, [can]);

  return { can, guard, isOwner: permissions === null };
}
