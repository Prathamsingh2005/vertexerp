"use client";

import type { ReactNode } from "react";
import PermissionProvider from "@/components/PermissionProvider";
import RoutePermissionGuard from "@/components/RoutePermissionGuard";

export default function Providers({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <PermissionProvider>
      <RoutePermissionGuard>{children}</RoutePermissionGuard>
    </PermissionProvider>
  );
}