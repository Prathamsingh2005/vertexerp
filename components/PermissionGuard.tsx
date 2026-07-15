"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { usePermissions } from "@/hooks/usePermissions";
import type { PermissionCode } from "@/lib/permissions";

type PermissionGuardProps = {
  permission: PermissionCode;
  children: ReactNode;
  fallback?: ReactNode;
  page?: boolean;
};

export default function PermissionGuard({
  permission,
  children,
  fallback = null,
  page = false,
}: PermissionGuardProps) {
  const {
    access,
    can,
    error: permissionError,
    isLoading,
  } = usePermissions();

  if (isLoading) {
    return page ? (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="rounded-3xl border border-violet-100 bg-white px-8 py-10 text-center shadow-xl shadow-violet-100/50">
          <div className="mx-auto h-11 w-11 animate-spin rounded-full border-4 border-violet-100 border-t-violet-600" />
          <p className="mt-4 font-semibold text-slate-600">
            Checking page permissions...
          </p>
        </div>
      </div>
    ) : null;
  }

  if (permissionError) {
    return page ? (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="w-full max-w-2xl rounded-3xl border border-red-200 bg-white p-7 text-center shadow-xl sm:p-9">
          <div className="text-4xl">⚠️</div>
          <h2 className="mt-4 text-2xl font-black text-slate-900">
            Permission check failed
          </h2>
          <p className="mt-2 break-words text-red-700">{permissionError}</p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex rounded-xl bg-violet-600 px-5 py-3 font-bold text-white transition hover:bg-violet-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    ) : fallback;
  }

  if (!can(permission)) {
    return page ? (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-violet-100 bg-white text-center shadow-xl shadow-violet-100/40">
          <div className="bg-gradient-to-br from-violet-950 via-violet-800 to-violet-600 px-6 py-8 text-white sm:px-9">
            <div className="text-5xl">🔒</div>
            <h2 className="mt-4 text-2xl font-black sm:text-3xl">
              Access restricted
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-violet-100">
              Your current role does not include permission to open this page.
            </p>
          </div>

          <div className="p-6 sm:p-8">
            <div className="grid gap-3 text-left sm:grid-cols-2">
              <div className="rounded-2xl bg-violet-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-600">
                  Required Permission
                </p>
                <p className="mt-2 break-words font-bold text-slate-900">
                  {permission}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  Active Role
                </p>
                <p className="mt-2 break-words font-bold text-slate-900">
                  {access?.roleName || "No active role"}
                </p>
              </div>
            </div>

            <Link
              href="/dashboard"
              className="mt-6 inline-flex rounded-xl bg-violet-600 px-5 py-3 font-bold text-white transition hover:bg-violet-700"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    ) : fallback;
  }

  return <>{children}</>;
}