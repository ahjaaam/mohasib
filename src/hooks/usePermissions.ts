"use client";

import { useCallback } from "react";

export function usePermissions(permissions: string[] | null) {
  const can = useCallback((resource: string, action: string) => (
    permissions === null || permissions.includes(`${resource}:${action}`)
  ), [permissions]);

  return { can, isOwner: permissions === null };
}
