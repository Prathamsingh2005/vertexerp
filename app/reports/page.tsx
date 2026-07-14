"use client";

import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import ReportsManager from "@/components/ReportsManager";

const reportCards = [
  {
    icon: "🧮",
    title: "GST Reports",
    description:
      "Review GSTR-1, GSTR-3B, HSN/SAC, Input GST, Output GST and return reversals.",
    href: "/reports/gst",
    action: "Open GST Reports →",
    actionClassName: "text-violet-600 hover:text-violet-800",
    borderClassName: "border-violet-200 bg-violet-50/40",
  },
  {
    icon: "🛒",
    title: "Sales Report",
    description:
      "View invoice-wise sales, customer sales and payment details.",
    href: "/reports/sales",
    action: "View Sales Report →",
    actionClassName: "text-blue-600 hover:text-blue-800",
    borderClassName: "border-slate-100",
  },
  {
    icon: "🧾",
    title: "Purchase Report",
    description:
      "Track supplier purchases, bills and pending payment amounts.",
    href: "/reports/purchase",
    action: "View Purchase Report →",
    actionClassName: "text-blue-600 hover:text-blue-800",
    borderClassName: "border-slate-100",
  },
  {
    icon: "📦",
    title: "Stock Report",
    description:
      "Check available stock, low-stock items and inventory value.",
    href: "/reports/stock",
    action: "View Stock Report →",
    actionClassName: "text-blue-600 hover:text-blue-800",
    borderClassName: "border-slate-100",
  },
  {
    icon: "👥",
    title: "Customer Report",
    description:
      "Analyze customer-wise sales, balances and payment history.",
    href: "/reports/customer",
    action: "View Customer Report →",
    actionClassName: "text-blue-600 hover:text-blue-800",
    borderClassName: "border-slate-100",
  },
  {
    icon: "🏢",
    title: "Supplier Report",
    description:
      "Review supplier bills, purchases and pending amounts.",
    href: "/reports/supplier",
    action: "View Supplier Report →",
    actionClassName: "text-blue-600 hover:text-blue-800",
    borderClassName: "border-slate-100",
  },
  {
    icon: "💰",
    title: "Profit & Loss",
    description:
      "Review accounting income, expenses, COGS and net profit.",
    href: "/reports/profit",
    action: "View Profit & Loss →",
    actionClassName: "text-blue-600 hover:text-blue-800",
    borderClassName: "border-slate-100",
  },
  {
    icon: "💳",
    title: "Payment Report",
    description:
      "Review customer receipts, supplier payments and collection summary.",
    href: "/reports/payments",
    action: "View Payment Report →",
    actionClassName: "text-emerald-600 hover:text-emerald-800",
    borderClassName: "border-emerald-100",
  },
];

export default function ReportsPage() {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <div className="min-w-0 flex-1">
        <Navbar />

        <main className="p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
          <div className="mb-6 lg:mb-8">
            <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
              Reports &amp; Analytics
            </h1>

            <p className="mt-2 max-w-3xl text-base text-slate-600 sm:text-lg">
              Review accounting, GST, sales, purchases, stock and business
              performance from one place.
            </p>
          </div>

          <ReportsManager />

          <section className="mt-6 grid grid-cols-1 gap-4 sm:mt-8 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3">
            {reportCards.map((report) => (
              <article
                key={report.href}
                className={`flex min-h-[210px] flex-col rounded-3xl border bg-white p-5 shadow-lg transition hover:-translate-y-1 hover:shadow-xl sm:min-h-[230px] sm:p-7 ${report.borderClassName}`}
              >
                <div className="text-3xl sm:text-4xl">
                  {report.icon}
                </div>

                <h2 className="mt-4 text-xl font-bold text-slate-900 sm:mt-5 sm:text-2xl">
                  {report.title}
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
                  {report.description}
                </p>

                <Link
                  href={report.href}
                  className={`mt-auto pt-5 font-semibold transition ${report.actionClassName}`}
                >
                  {report.action}
                </Link>
              </article>
            ))}
          </section>
        </main>
      </div>
    </div>
  );
}