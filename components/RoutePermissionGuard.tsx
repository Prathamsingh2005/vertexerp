"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { PermissionCode } from "@/lib/permissions";
import { usePermissions } from "@/hooks/usePermissions";
import AccessDenied from "@/components/AccessDenied";

type RouteRule = {
  prefix: string;
  permission: PermissionCode;
};

const PUBLIC_EXACT_PATHS = new Set([
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
]);

const PUBLIC_PREFIXES = ["/auth", "/invite"];

const ALLOW_WITHOUT_ACTIVE_COMPANY = new Set([
  "/dashboard",
  "/company",
]);

const ROUTE_RULES: RouteRule[] = [
  { prefix: "/settings/backup", permission: "backup.export" },
  { prefix: "/settings/team", permission: "team.view" },
  { prefix: "/settings/roles", permission: "roles.view" },
  { prefix: "/reports/gst", permission: "gst_reports.view" },
  { prefix: "/audit-history", permission: "audit.view" },
  { prefix: "/accounting", permission: "accounting.view" },
  { prefix: "/credit-notes", permission: "credit_notes.view" },
  { prefix: "/debit-notes", permission: "debit_notes.view" },
  { prefix: "/outstanding", permission: "outstanding.view" },
  { prefix: "/payments", permission: "payments.view" },
  { prefix: "/expenses", permission: "expenses.view" },
  { prefix: "/purchase", permission: "purchase.view" },
  { prefix: "/inventory", permission: "inventory.view" },
  { prefix: "/reports", permission: "reports.view" },
  { prefix: "/ledger", permission: "ledgers.view" },
  { prefix: "/sales", permission: "sales.view" },
  { prefix: "/company", permission: "company.view" },
  { prefix: "/dashboard", permission: "dashboard.view" },
];

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export default function RoutePermissionGuard({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { access, can, error, isLoading } = usePermissions();

  const isPublic =
    PUBLIC_EXACT_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));

  if (isPublic) {
    return <>{children}</>;
  }

  const rule = ROUTE_RULES.find(({ prefix }) =>
    matchesPrefix(pathname, prefix)
  );

  if (!rule) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="mx-auto h-11 w-11 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
          <p className="mt-4 font-semibold text-slate-600">
            Checking company access...
          </p>
        </div>
      </div>
    );
  }

  if (!access && ALLOW_WITHOUT_ACTIVE_COMPANY.has(rule.prefix)) {
    return <>{children}</>;
  }

  if (error || !access || !can(rule.permission)) {
    return (
      <AccessDenied
        description={
          error
            ? error
            : "Your current company role does not allow this page. Ask the company Owner or Admin to update your access."
        }
      />
    );
  }

  return <>{children}</>;
}