"use client";

import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import BalanceSheetManager from "@/components/BalanceSheetManager";
import { usePermissions } from "@/hooks/usePermissions";

export default function BalanceSheetPage() {
  const {
    access,
    can,
    error: permissionError,
    isLoading: isPermissionLoading,
  } = usePermissions();

  const canViewBalanceSheet = can("accounting.view");

  return (
    <div className="flex min-h-screen bg-[#f3f6fb]">
      <Sidebar />

      <div className="min-w-0 flex-1 overflow-x-hidden">
        <Navbar />

        <main className="min-w-0 p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-600">
                Accounting Reports
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Active role:{" "}
                <strong>{access?.roleName || "No active role"}</strong>
              </p>
            </div>

            <Link
              href="/reports"
              className="w-fit rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-sm font-black text-violet-700 shadow-sm transition hover:bg-violet-50"
            >
              ← Back to Reports
            </Link>
          </div>

          {permissionError && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-semibold text-red-700">
              {permissionError}
            </div>
          )}

          {isPermissionLoading ? (
            <div className="rounded-3xl border border-violet-100 bg-white p-10 text-center font-semibold text-slate-600 shadow-xl shadow-violet-100/50">
              Loading Balance Sheet permissions...
            </div>
          ) : !canViewBalanceSheet ? (
            <section className="rounded-3xl border border-red-200 bg-white p-8 text-center shadow-xl sm:p-12">
              <div className="text-4xl">🔒</div>
              <h1 className="mt-4 text-2xl font-black text-slate-900">
                Balance Sheet Access Restricted
              </h1>
              <p className="mx-auto mt-3 max-w-2xl leading-7 text-slate-600">
                Your current role does not include the accounting.view
                permission for the active company.
              </p>
            </section>
          ) : (
            <BalanceSheetManager />
          )}
        </main>
      </div>
    </div>
  );
}