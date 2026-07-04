"use client";

import { usePathname } from "next/navigation";

const pageDetails: Record<string, { title: string; subtitle: string }> = {
  "/": {
    title: "Dashboard",
    subtitle: "Welcome back 👋",
  },
  "/company": {
    title: "Company Management",
    subtitle: "Manage your business companies",
  },
  "/ledger": {
    title: "Ledger Management",
    subtitle: "Manage customers, suppliers and accounts",
  },
  "/inventory": {
    title: "Inventory Management",
    subtitle: "Manage products and stock levels",
  },
  "/sales": {
    title: "Sales & Billing",
    subtitle: "Create invoices and track customer payments",
  },
  "/purchase": {
    title: "Purchase & Stock Entry",
    subtitle: "Record supplier purchases and update stock",
  },
  "/reports": {
    title: "Reports & Analytics",
    subtitle: "Track your business performance",
  },
};

export default function Navbar() {
  const pathname = usePathname();

  const currentPage = pageDetails[pathname] || {
    title: "VertexERP",
    subtitle: "Run your business with confidence.",
  };

  return (
    <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-8 shadow-sm">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          {currentPage.title}
        </h2>

        <p className="mt-1 text-sm text-slate-600">
          {currentPage.subtitle}
        </p>
      </div>

      <div className="flex items-center gap-5">
        <input
          type="text"
          placeholder="Search..."
          className="hidden w-72 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 lg:block"
        />

        <button
          type="button"
          aria-label="Notifications"
          className="text-2xl transition hover:scale-110"
        >
          🔔
        </button>

        <button
          type="button"
          aria-label="Theme"
          className="text-2xl transition hover:scale-110"
        >
          🌙
        </button>

        <div className="flex items-center gap-3 border-l border-slate-200 pl-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 font-bold text-white">
            P
          </div>

          <div className="hidden sm:block">
            <p className="font-bold text-slate-900">Pranat Singh</p>
            <p className="text-sm text-slate-500">Administrator</p>
          </div>
        </div>
      </div>
    </header>
  );
}