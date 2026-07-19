"use client";

import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import AccountingManager from "@/components/AccountingManager";
import { usePermissions } from "@/hooks/usePermissions";

export default function AccountingPage() {
  const {
    access,
    can,
    error: permissionError,
    isLoading: isPermissionLoading,
  } = usePermissions();

  const canViewAccounting = can("accounting.view");
  const canManageAccounting = can("accounting.manage");
  const canManageLocks = can("accounting.lock");
  const hasWriteAccess = canManageAccounting || canManageLocks;

  return (
    <div className="flex min-h-screen bg-[#f3f6fb]">
      <Sidebar />

      <div className="min-w-0 flex-1 overflow-x-hidden">
        <Navbar />

        <main className="min-w-0 p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
          <section className="overflow-hidden rounded-[30px] bg-gradient-to-br from-violet-950 via-violet-800 to-violet-600 p-6 text-white shadow-2xl shadow-violet-900/20 sm:p-8 lg:p-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-violet-100 backdrop-blur">
                  <span>📘</span>
                  Accounting Control Center
                </div>

                <h1 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                  Accounting Management
                </h1>

                <p className="mt-3 max-w-2xl text-base leading-7 text-violet-100 sm:text-lg">
                  Manage custom accounts, post balanced Journal and Contra
                  vouchers, review voucher history and protect finalized
                  accounting periods.
                </p>
              </div>

              <div className="flex flex-col gap-3">
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
                    {hasWriteAccess ? "Operational access" : "Read-only access"}
                  </p>
                </div>

                {canViewAccounting && (
                  <Link
                    href="/accounting/bank-reconciliation"
                    className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/10 px-5 py-3 font-black text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/20"
                  >
                    🏦 Bank Reconciliation
                  </Link>
                )}
              </div>
            </div>
          </section>

          {permissionError && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-semibold text-red-700">
              {permissionError}
            </div>
          )}

          {isPermissionLoading ? (
            <section className="mt-6 rounded-3xl border border-violet-100 bg-white p-6 text-center shadow-xl sm:p-10">
              <p className="text-lg font-bold text-slate-700">
                Loading accounting permissions...
              </p>
            </section>
          ) : !canViewAccounting ? (
            <section className="mt-6 rounded-3xl border border-red-200 bg-white p-6 text-center shadow-xl sm:p-10">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl">
                🔒
              </div>

              <h2 className="mt-5 text-2xl font-black text-slate-900">
                Accounting Access Restricted
              </h2>

              <p className="mx-auto mt-3 max-w-2xl leading-7 text-slate-600">
                Your current role does not include the accounting.view
                permission. Ask the company Owner or Admin to update your role.
              </p>
            </section>
          ) : (
            <>
              {!hasWriteAccess && (
                <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 text-violet-900">
                  <p className="font-black">Read-only accounting access</p>
                  <p className="mt-1 text-sm leading-6 text-violet-700">
                    You can review the Chart of Accounts, period-lock history
                    and manual vouchers. Create, edit, void and lock actions are
                    disabled for your current role.
                  </p>
                </div>
              )}

              <section className="mt-6 rounded-3xl border border-violet-100 bg-white p-5 shadow-xl shadow-violet-100/40 sm:mt-8 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-500">
                      Banking Control
                    </p>
                    <h2 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">
                      Bank Reconciliation
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Match imported bank statements with posted ERP Bank Book
                      transactions.
                    </p>
                  </div>

                  <Link
                    href="/accounting/bank-reconciliation"
                    className="inline-flex w-full items-center justify-center rounded-xl bg-violet-600 px-5 py-3 font-black text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5 hover:bg-violet-700 sm:w-auto"
                  >
                    Open Bank Reconciliation →
                  </Link>
                </div>
              </section>

              <div className="mt-6 sm:mt-8">
                <AccountingManager
                  canManageAccounting={canManageAccounting}
                  canManageLocks={canManageLocks}
                />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}