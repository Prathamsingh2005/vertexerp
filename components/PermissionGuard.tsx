"use client";

import type { ReactNode } from "react";
import type { PermissionCode } from "@/lib/permissions";
import { usePermissions } from "@/hooks/usePermissions";
import AccessDenied from "@/components/AccessDenied";

export default function PermissionGuard({
  permission,
  children,
  fallback = null,
  page = false,
}: {
  permission: PermissionCode;
  children: ReactNode;
  fallback?: ReactNode;
  page?: boolean;
}) {
  const { can, isLoading } = usePermissions();

  if (isLoading) {
    return page ? (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
      </div>
    ) : null;
  }

  if (!can(permission)) {
    return page ? <AccessDenied /> : fallback;
  }

  return <>{children}</>;
}