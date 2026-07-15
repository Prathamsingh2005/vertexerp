"use client";

import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import DebitNotesManager from "@/components/DebitNotesManager";
import { usePermissions } from "@/hooks/usePermissions";

export default function DebitNotesPage() {
  const {
    access,
    can,
    error: permissionError,
    isLoading: isPermissionLoading,
  } = usePermissions();

  const canViewDebitNotes = can("debit_notes.view");
  const canCreateDebitNote = can("debit_notes.create");
  const canVoidDebitNote = can("debit_notes.void");
  const hasWriteAccess = canCreateDebitNote || canVoidDebitNote;

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
                  <span>↪️</span>
                  Purchase Return Control Center
                </div>

                <h1 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                  Debit Notes
                </h1>

                <p className="mt-3 max-w-2xl text-base leading-7 text-violet-100 sm:text-lg">
                  Return goods to suppliers without deleting purchase bills.
                  Debit notes safely adjust stock, inventory value, Input GST
                  and supplier payables.
                </p>
              </div>

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
            </div>
          </section>

          {permissionError && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-semibold text-red-700">
              {permissionError}
            </div>
          )}

          {isPermissionLoading ? (
            <div className="mt-6 rounded-3xl border border-violet-100 bg-white p-8 text-center font-semibold text-slate-600 shadow-xl shadow-violet-100/50">
              Loading debit-note permissions...
            </div>
          ) : !canViewDebitNotes ? (
            <div className="mt-6 rounded-3xl border border-red-200 bg-white p-8 text-center shadow-xl">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl">
                🔒
              </div>
              <h2 className="mt-4 text-2xl font-black text-slate-900">
                Debit Notes Access Restricted
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-slate-600">
                Your active role does not include permission to view supplier
                debit notes for this company.
              </p>
            </div>
          ) : (
            <>
              {!hasWriteAccess && (
                <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 text-sm font-semibold text-violet-800">
                  Read-only access is active. You can view and print debit
                  notes, but creating or voiding them is disabled.
                </div>
              )}

              <div className="mt-6 min-w-0">
                <DebitNotesManager
                  canCreate={canCreateDebitNote}
                  canVoid={canVoidDebitNote}
                />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}