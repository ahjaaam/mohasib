"use client";

import type { MouseEvent, ReactNode } from "react";
import { PermissionsProvider, usePermissions } from "@/hooks/usePermissions";

function GuardedArea({ children }: { children: ReactNode }) {
  const { guard } = usePermissions();

  function checkPermission(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const guarded = target.closest<HTMLElement>("[data-permission]");
    const permission = guarded?.dataset.permission;
    if (!permission) return;

    const [resource, action] = permission.split(":");
    if (resource && action && !guard(resource, action)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  return <div className="contents" onClickCapture={checkPermission}>{children}</div>;
}

export default function PermissionBoundary({ permissions, children }: { permissions: string[] | null; children: ReactNode }) {
  return (
    <PermissionsProvider permissions={permissions}>
      <GuardedArea>{children}</GuardedArea>
    </PermissionsProvider>
  );
}
