"use client";

import { useContext } from "react";
import { PermissionContext } from "@/components/PermissionProvider";

export function usePermissions() {
  const context = useContext(PermissionContext);

  if (!context) {
    throw new Error(
      "usePermissions must be used inside the VertexERP PermissionProvider."
    );
  }

  return context;
}
