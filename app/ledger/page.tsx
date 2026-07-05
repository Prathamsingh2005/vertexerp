"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import LedgerManager from "@/components/LedgerManager";
import { createClient } from "@/lib/supabase/client";

type LedgerStatRow = {
  ledger_type: string;
};

type ProfileRow = {
  active_company_id: string | null;
};

export default function LedgerPage() {
  const [ledgers, setLedgers] = useState<LedgerStatRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  async function loadLedgerStats() {
    setIsLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setLedgers([]);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("active_company_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      const activeCompanyId =
        (profile as ProfileRow | null)?.active_company_id || null;

      if (!activeCompanyId) {
        setLedgers([]);
        return;
      }

      const { data, error } = await supabase
        .from("ledgers")
        .select("ledger_type")
        .eq("company_id", activeCompanyId);

      if (error) {
        throw error;
      }

      setLedgers(data || []);
    } catch {
      setLedgers([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadLedgerStats();

    window.addEventListener(
      "vertexerp-ledgers-updated",
      loadLedgerStats
    );
    window.addEventListener(
      "vertexerp-active-company-updated",
      loadLedgerStats
    );

    return () => {
      window.removeEventListener(
        "vertexerp-ledgers-updated",
        loadLedgerStats
      );
      window.removeEventListener(
        "vertexerp-active-company-updated",
        loadLedgerStats
      );
    };
  }, []);

  const ledgerStats = useMemo(() => {
    const normalizedTypes = ledgers.map((ledger) =>
      String(ledger.ledger_type || "").toLowerCase()
    );

    return {
      totalLedgers: ledgers.length,
      customers: normalizedTypes.filter((type) => type === "customer").length,
      suppliers: normalizedTypes.filter((type) => type === "supplier").length,
      bankAccounts: normalizedTypes.filter(
        (type) => type === "bank" || type === "cash"
      ).length,
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
                {isLoading ? "..." : ledgerStats.totalLedgers}
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
                {isLoading ? "..." : ledgerStats.customers}
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
                {isLoading ? "..." : ledgerStats.suppliers}
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
                {isLoading ? "..." : ledgerStats.bankAccounts}
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