"use client";

import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import DashboardOverview from "@/components/DashboardOverview";
import { usePermissions } from "@/hooks/usePermissions";

export default function DashboardPage() {
  const {
    access,
    can,
    error: permissionError,
    isLoading: isPermissionLoading,
  } = usePermissions();

  const canViewDashboard = can("dashboard.view");

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
                  <span>📊</span>
                  Business Command Center
                </div>

                <h1 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                  Dashboard
                </h1>

                <p className="mt-3 max-w-2xl text-base leading-7 text-violet-100 sm:text-lg">
                  Monitor sales, purchases, stock, profit and recent business
                  activity from one permission-aware workspace.
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
                  {canViewDashboard ? "Dashboard enabled" : "Restricted"}
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
              Loading dashboard permissions...
            </div>
          ) : !canViewDashboard ? (
            <div className="mt-6 rounded-3xl border border-red-200 bg-white p-8 text-center shadow-xl">
              <div className="text-4xl">🔒</div>
              <h2 className="mt-4 text-2xl font-black text-slate-900">
                Dashboard access is restricted
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-slate-600">
                Your current role does not include the dashboard.view
                permission for the active company.
              </p>
            </div>
          ) : (
            <div className="mt-6 min-w-0 sm:mt-8">
              <DashboardOverview />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}