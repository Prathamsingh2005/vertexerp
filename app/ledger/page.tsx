"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import LedgerManager from "@/components/LedgerManager";

type Ledger = {
  id: string;
  name: string;
  group: string;
  openingBalance: number;
  mobile: string;
  email: string;
  gst: string;
  address: string;
};

const LEDGERS_KEY = "VertexERP_ledgers";
const LEDGERS_EVENT = "VertexERP-ledgers-updated";

function readLedgers(): Ledger[] {
  try {
    const savedLedgers = window.localStorage.getItem(LEDGERS_KEY);

    if (!savedLedgers) {
      return [];
    }

    const parsedLedgers = JSON.parse(savedLedgers);

    return Array.isArray(parsedLedgers) ? parsedLedgers : [];
  } catch {
    return [];
  }
}

export default function LedgerPage() {
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  function loadLedgers() {
    setLedgers(readLedgers());
  }

  useEffect(() => {
    loadLedgers();

    window.addEventListener(LEDGERS_EVENT, loadLedgers);
    window.addEventListener("storage", loadLedgers);

    return () => {
      window.removeEventListener(LEDGERS_EVENT, loadLedgers);
      window.removeEventListener("storage", loadLedgers);
    };
  }, []);

  const ledgerStats = useMemo(() => {
    const customers = ledgers.filter((ledger) =>
      String(ledger.group || "").toLowerCase().includes("customer")
    ).length;

    const suppliers = ledgers.filter((ledger) =>
      String(ledger.group || "").toLowerCase().includes("supplier")
    ).length;

    const bankAccounts = ledgers.filter((ledger) => {
      const group = String(ledger.group || "").toLowerCase();

      return group.includes("bank") || group.includes("cash");
    }).length;

    return {
      totalLedgers: ledgers.length,
      customers,
      suppliers,
      bankAccounts,
    };
  }, [ledgers]);

  function scrollToLedgerForm() {
    document.getElementById("create-ledger")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <div className="min-w-0 flex-1">
        <Navbar />

        <main className="p-6 md:p-8">
          <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-900">
                📒 Ledger Management
              </h1>

              <p className="mt-2 text-lg text-slate-600">
                Create and manage customers, suppliers and bank accounts.
              </p>
            </div>

            <button
              type="button"
              onClick={scrollToLedgerForm}
              className="rounded-xl px-6 py-3 font-semibold text-white shadow-lg transition hover:scale-[1.02] active:scale-[0.98]"
              style={{
                backgroundColor: "#2563eb",
                color: "#ffffff",
              }}
            >
              + Add Ledger
            </button>
          </div>

          <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-blue-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">Total Ledgers</p>

              <h2
                className="mt-3 text-4xl font-bold"
                style={{ color: "#2563eb" }}
              >
                {ledgerStats.totalLedgers}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Total saved customer, supplier and account ledgers
              </p>
            </div>

            <div className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">Customers</p>

              <h2
                className="mt-3 text-4xl font-bold"
                style={{ color: "#059669" }}
              >
                {ledgerStats.customers}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Customer ledgers saved in this company
              </p>
            </div>

            <div className="rounded-3xl border border-orange-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">Suppliers</p>

              <h2
                className="mt-3 text-4xl font-bold"
                style={{ color: "#ea580c" }}
              >
                {ledgerStats.suppliers}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Supplier ledgers saved in this company
              </p>
            </div>

            <div className="rounded-3xl border border-purple-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">Bank Accounts</p>

              <h2
                className="mt-3 text-4xl font-bold"
                style={{ color: "#7e22ce" }}
              >
                {ledgerStats.bankAccounts}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Bank and cash account ledgers
              </p>
            </div>
          </section>

          <section className="mt-8 rounded-3xl border border-slate-100 bg-white p-5 shadow-lg">
            <div className="relative">
              <span className="absolute left-5 top-3.5 text-lg text-slate-400">
                🔍
              </span>

              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by ledger name, group, mobile, email or GST..."
                className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-14 pr-5 text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </section>

          <div id="create-ledger">
            <LedgerManager searchQuery={searchQuery} />
          </div>
        </main>
      </div>
    </div>
  );
}