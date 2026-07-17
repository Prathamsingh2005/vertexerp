"use client";

import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import ReportsManager from "@/components/ReportsManager";
import { usePermissions } from "@/hooks/usePermissions";

type ReportPermission =
  | "reports.view"
  | "gst_reports.view"
  | "accounting.view";

type ReportCard = {
  icon: string;
  title: string;
  description: string;
  href: string;
  action: string;
  permission: ReportPermission;
};

const reportCards: ReportCard[] = [
  {
    icon: "🧮",
    title: "GST Reports",
    description:
      "GSTR-1, GSTR-3B, HSN/SAC, Input GST, Output GST and return reversals.",
    href: "/reports/gst",
    action: "Open GST Reports",
    permission: "gst_reports.view",
  },
  {
    icon: "📖",
    title: "Party Statements",
    description:
      "Customer and supplier statements with documents, payments and running balances.",
    href: "/reports/statements",
    action: "Open Statements",
    permission: "reports.view",
  },
  {
    icon: "🛒",
    title: "Sales Report",
    description:
      "Invoice-wise sales, customer sales and payment details.",
    href: "/reports/sales",
    action: "Open Sales",
    permission: "reports.view",
  },
  {
    icon: "🧾",
    title: "Purchase Report",
    description:
      "Supplier purchases, bills and pending payment amounts.",
    href: "/reports/purchase",
    action: "Open Purchases",
    permission: "reports.view",
  },
  {
    icon: "📦",
    title: "Stock Report",
    description:
      "Available stock, low-stock items and inventory value.",
    href: "/reports/stock",
    action: "Open Stock",
    permission: "reports.view",
  },
  {
    icon: "👥",
    title: "Customer Report",
    description:
      "Customer-wise sales, balances and payment history.",
    href: "/reports/customer",
    action: "Open Customers",
    permission: "reports.view",
  },
  {
    icon: "🏢",
    title: "Supplier Report",
    description:
      "Supplier bills, purchases and outstanding amounts.",
    href: "/reports/supplier",
    action: "Open Suppliers",
    permission: "reports.view",
  },
  {
    icon: "💰",
    title: "Profit & Loss",
    description:
      "Accounting income, expenses, COGS and net profit.",
    href: "/reports/profit",
    action: "Open P&L",
    permission: "reports.view",
  },
  {
    icon: "⚖️",
    title: "Balance Sheet",
    description:
      "Assets, liabilities, equity and accumulated profit or loss as on date.",
    href: "/reports/balance-sheet",
    action: "Open Balance Sheet",
    permission: "accounting.view",
  },
  {
    icon: "💳",
    title: "Payment Report",
    description:
      "Customer receipts, supplier payments and collection summary.",
    href: "/reports/payments",
    action: "Open Payments",
    permission: "reports.view",
  },
];

export default function ReportsPage() {
  const {
    access,
    can,
    error: permissionError,
    isLoading: isPermissionLoading,
  } = usePermissions();

  const canViewReports = can("reports.view");
  const canViewGstReports = can("gst_reports.view");
  const canViewAccounting = can("accounting.view");
  const canOpenReportsCenter =
    canViewReports || canViewGstReports || canViewAccounting;

  const permissionAccess: Record<ReportPermission, boolean> = {
    "reports.view": canViewReports,
    "gst_reports.view": canViewGstReports,
    "accounting.view": canViewAccounting,
  };

  const visibleReportCards = reportCards.filter(
    (report) => permissionAccess[report.permission],
  );

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
                  Business Intelligence Center
                </div>

                <h1 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                  Reports &amp; Analytics
                </h1>

                <p className="mt-3 max-w-2xl text-base leading-7 text-violet-100 sm:text-lg">
                  Open every allowed business report immediately, then review
                  live accounting, GST, sales, purchase, stock and outstanding
                  analytics below.
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
                  {canViewAccounting
                    ? "Accounting and business reports access"
                    : canViewReports
                      ? "Business reports access"
                      : canViewGstReports
                        ? "GST reports access"
                        : "No reports access"}
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
              Loading report permissions...
            </div>
          ) : !canOpenReportsCenter ? (
            <div className="mt-6 rounded-3xl border border-red-200 bg-white p-8 text-center shadow-xl">
              <div className="text-4xl">🔒</div>
              <h2 className="mt-4 text-2xl font-black text-slate-900">
                Reports access is restricted
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-slate-600">
                Your current role does not include business, accounting or GST
                report permissions for the active company.
              </p>
            </div>
          ) : (
            <>
              <section className="mt-6 rounded-[28px] border border-violet-100 bg-white p-4 shadow-xl shadow-violet-100/40 sm:mt-8 sm:p-6">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-600">
                      Quick Report Access
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">
                      Open a report without scrolling
                    </h2>
                    <p className="mt-1 text-sm text-slate-600 sm:text-base">
                      Only reports allowed for your active role are shown here.
                    </p>
                  </div>

                  <span className="w-fit rounded-full bg-violet-100 px-4 py-2 text-sm font-black text-violet-700">
                    {visibleReportCards.length} available
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                  {visibleReportCards.map((report) => (
                    <Link
                      key={report.href}
                      href={report.href}
                      className="group flex min-h-[155px] min-w-0 flex-col rounded-2xl border border-violet-100 bg-gradient-to-br from-white to-violet-50/70 p-4 transition duration-200 hover:-translate-y-1 hover:border-violet-300 hover:shadow-xl hover:shadow-violet-100/70 sm:p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-2xl shadow-sm">
                          {report.icon}
                        </span>

                        <span className="text-xl font-black text-violet-400 transition group-hover:translate-x-1 group-hover:text-violet-700">
                          →
                        </span>
                      </div>

                      <h3 className="mt-4 text-lg font-black text-slate-950">
                        {report.title}
                      </h3>

                      <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">
                        {report.description}
                      </p>

                      <span className="mt-auto pt-3 text-sm font-black text-violet-700">
                        {report.action}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>

              {canViewReports ? (
                <section className="mt-6 min-w-0 sm:mt-8">
                  <div className="mb-5">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-600">
                      Live Analytics
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">
                      Detailed report dashboard
                    </h2>
                    <p className="mt-1 text-sm text-slate-600 sm:text-base">
                      Use the cards above for navigation and the dashboard below
                      for consolidated analysis.
                    </p>
                  </div>

                  <ReportsManager />
                </section>
              ) : (
                <div className="mt-6 rounded-3xl border border-violet-100 bg-white p-6 text-center shadow-xl shadow-violet-100/40 sm:mt-8">
                  <p className="font-semibold text-slate-700">
                    Use the accounting or GST report shortcuts available for
                    your active role.
                  </p>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}