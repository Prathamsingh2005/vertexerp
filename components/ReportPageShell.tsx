"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import { usePermissions } from "@/hooks/usePermissions";

type ReportPermission = "reports.view" | "gst_reports.view";

type ReportPageShellProps = {
  requiredPermission: ReportPermission;
  title: string;
  eyebrow: string;
  description: string;
  icon: string;
  children: ReactNode;
  backHref?: string;
  showHero?: boolean;
};

export default function ReportPageShell({
  requiredPermission,
  title,
  eyebrow,
  description,
  icon,
  children,
  backHref = "/reports",
  showHero = true,
}: ReportPageShellProps) {
  const {
    access,
    can,
    error: permissionError,
    isLoading: isPermissionLoading,
  } = usePermissions();

  const canViewPage = can(requiredPermission);

  return (
    <div className="flex min-h-screen bg-[#f3f6fb]">
      <Sidebar />

      <div className="min-w-0 flex-1 overflow-x-hidden">
        <Navbar />

        <main className="min-w-0 p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
          {showHero && (
            <section className="overflow-hidden rounded-[30px] bg-gradient-to-br from-violet-950 via-violet-800 to-violet-600 p-6 text-white shadow-2xl shadow-violet-900/20 sm:p-8 lg:p-10">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-3xl">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-violet-100 backdrop-blur">
                    <span>{icon}</span>
                    <span>{eyebrow}</span>
                  </div>

                  <h1 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                    {title}
                  </h1>

                  <p className="mt-3 max-w-2xl text-base leading-7 text-violet-100 sm:text-lg">
                    {description}
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-stretch">
                  <div className="rounded-2xl border border-white/15 bg-slate-950/25 px-5 py-4 backdrop-blur">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-200">
                      Active Access
                    </p>

                    <p className="mt-1 text-lg font-black">
                      {isPermissionLoading
                        ? "Loading..."
                        : access?.roleName || "No active role"}
                    </p>

                    <p className="mt-1 text-sm text-violet-100">
                      {canViewPage
                        ? "Report viewing enabled"
                        : "Access restricted"}
                    </p>
                  </div>

                  <Link
                    href={backHref}
                    className="w-full rounded-xl border border-white/25 bg-white/10 px-6 py-3 text-center font-bold text-white backdrop-blur transition hover:bg-white/20 sm:w-auto"
                  >
                    ← Back to Reports
                  </Link>
                </div>
              </div>
            </section>
          )}

          {permissionError && (
            <div
              className={`${
                showHero ? "mt-6" : "mb-6"
              } rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-semibold text-red-700`}
            >
              {permissionError}
            </div>
          )}

          {isPermissionLoading ? (
            <div
              className={`${
                showHero ? "mt-6" : ""
              } rounded-3xl border border-violet-100 bg-white p-8 text-center font-semibold text-slate-600 shadow-xl shadow-violet-100/50`}
            >
              Loading {title} permissions...
            </div>
          ) : !canViewPage ? (
            <div
              className={`${
                showHero ? "mt-6" : ""
              } rounded-3xl border border-red-200 bg-white p-8 text-center shadow-xl`}
            >
              <div className="text-4xl">🔒</div>

              <h2 className="mt-4 text-2xl font-black text-slate-900">
                {title} access is restricted
              </h2>

              <p className="mx-auto mt-2 max-w-xl text-slate-600">
                Your current role does not include the{" "}
                <strong>{requiredPermission}</strong> permission for the active
                company.
              </p>

              {!showHero && (
                <Link
                  href={backHref}
                  className="mt-6 inline-flex rounded-xl bg-violet-600 px-5 py-3 font-bold text-white transition hover:bg-violet-700"
                >
                  Back to Reports
                </Link>
              )}
            </div>
          ) : (
            <div
              className={showHero ? "mt-6 min-w-0 sm:mt-8" : "min-w-0"}
            >
              {children}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}