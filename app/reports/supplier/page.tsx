"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";

type LedgerRow = {
  id: string;
  name: string;
  ledger_type: string;
  opening_balance: number | string | null;
  mobile: string | null;
  email: string | null;
  gst_number: string | null;
  address: string | null;
};

type PurchaseRow = {
  id: string;
  supplier_id: string | null;
  payment_mode: string;
  grand_total: number | string | null;
};

type PaymentRow = {
  id: string;
  payment_type: string;
  party_id: string | null;
  amount: number | string | null;
};

type ProfileRow = {
  active_company_id: string | null;
};

type SupplierReportRow = {
  id: string;
  name: string;
  mobile: string;
  email: string;
  gst: string;
  openingBalance: number;
  billCount: number;
  totalPurchase: number;
  creditPurchase: number;
  paidAmount: number;
  pendingAmount: number;
};

function toNumber(value: unknown) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function formatCurrency(amount: number) {
  return `₹${toNumber(amount).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function isSupplierLedger(ledgerType: string) {
  return String(ledgerType || "").trim().toLowerCase() === "supplier";
}

function isCreditPayment(paymentMode: string) {
  return String(paymentMode || "").trim().toLowerCase() === "credit";
}

function isSupplierPayment(paymentType: string) {
  return (
    String(paymentType || "").trim().toLowerCase() ===
    "supplier payment"
  );
}

export default function SupplierReportPage() {
  const [ledgers, setLedgers] = useState<LedgerRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);

    window.setTimeout(() => {
      setMessage("");
    }, 4500);
  }

  async function loadSupplierReportData() {
    setIsLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setLedgers([]);
        setPurchases([]);
        setPayments([]);
        showMessage("Please sign in to view the supplier report.");
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
        setPurchases([]);
        setPayments([]);
        showMessage("Select an active company from the Companies page first.");
        return;
      }

      const [ledgersResponse, purchasesResponse, paymentsResponse] =
        await Promise.all([
          supabase
            .from("ledgers")
            .select(
              "id, name, ledger_type, opening_balance, mobile, email, gst_number, address"
            )
            .eq("company_id", activeCompanyId)
            .order("name", { ascending: true }),
          supabase
            .from("purchases")
            .select("id, supplier_id, payment_mode, grand_total")
            .eq("company_id", activeCompanyId),
          supabase
            .from("payments")
            .select("id, payment_type, party_id, amount")
            .eq("company_id", activeCompanyId),
        ]);

      if (ledgersResponse.error) {
        throw ledgersResponse.error;
      }

      if (purchasesResponse.error) {
        throw purchasesResponse.error;
      }

      if (paymentsResponse.error) {
        throw paymentsResponse.error;
      }

      setLedgers((ledgersResponse.data || []) as LedgerRow[]);
      setPurchases((purchasesResponse.data || []) as PurchaseRow[]);
      setPayments((paymentsResponse.data || []) as PaymentRow[]);
    } catch (error) {
      setLedgers([]);
      setPurchases([]);
      setPayments([]);

      showMessage(
        error instanceof Error
          ? error.message
          : "Supplier report data could not be loaded from the cloud database."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadSupplierReportData();

    const refreshEvents = [
      "vertexerp-ledgers-updated",
      "vertexerp-purchases-updated",
      "vertexerp-payments-updated",
      "vertexerp-active-company-updated",
    ];

    refreshEvents.forEach((eventName) => {
      window.addEventListener(eventName, loadSupplierReportData);
    });

    return () => {
      refreshEvents.forEach((eventName) => {
        window.removeEventListener(eventName, loadSupplierReportData);
      });
    };
  }, []);

  const supplierRows = useMemo<SupplierReportRow[]>(() => {
    const supplierMap = new Map<string, SupplierReportRow>();

    ledgers
      .filter((ledger) => isSupplierLedger(ledger.ledger_type))
      .forEach((supplier) => {
        supplierMap.set(supplier.id, {
          id: supplier.id,
          name: supplier.name || "Unnamed Supplier",
          mobile: supplier.mobile || "",
          email: supplier.email || "",
          gst: supplier.gst_number || "",
          openingBalance: toNumber(supplier.opening_balance),
          billCount: 0,
          totalPurchase: 0,
          creditPurchase: 0,
          paidAmount: 0,
          pendingAmount: 0,
        });
      });

    purchases.forEach((purchase) => {
      if (!purchase.supplier_id) {
        return;
      }

      const supplier = supplierMap.get(purchase.supplier_id);

      if (!supplier) {
        return;
      }

      const billAmount = toNumber(purchase.grand_total);

      supplier.billCount += 1;
      supplier.totalPurchase += billAmount;

      if (isCreditPayment(purchase.payment_mode)) {
        supplier.creditPurchase += billAmount;
      }
    });

    payments
      .filter((payment) => isSupplierPayment(payment.payment_type))
      .forEach((payment) => {
        if (!payment.party_id) {
          return;
        }

        const supplier = supplierMap.get(payment.party_id);

        if (!supplier) {
          return;
        }

        supplier.paidAmount += toNumber(payment.amount);
      });

    supplierMap.forEach((supplier) => {
      supplier.pendingAmount = Math.max(
        0,
        supplier.creditPurchase - supplier.paidAmount
      );
    });

    return Array.from(supplierMap.values()).sort(
      (first, second) => second.totalPurchase - first.totalPurchase
    );
  }, [ledgers, purchases, payments]);

  const filteredSuppliers = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    if (!search) {
      return supplierRows;
    }

    return supplierRows.filter(
      (supplier) =>
        supplier.name.toLowerCase().includes(search) ||
        supplier.mobile.includes(search) ||
        supplier.email.toLowerCase().includes(search) ||
        supplier.gst.toLowerCase().includes(search)
    );
  }, [supplierRows, searchTerm]);

  const totalPurchase = supplierRows.reduce(
    (total, supplier) => total + supplier.totalPurchase,
    0
  );

  const totalPending = supplierRows.reduce(
    (total, supplier) => total + supplier.pendingAmount,
    0
  );

  const totalPaid = supplierRows.reduce(
    (total, supplier) => total + supplier.paidAmount,
    0
  );

  const activeSuppliers = supplierRows.filter(
    (supplier) => supplier.billCount > 0
  ).length;

  function resetSearch() {
    setSearchTerm("");
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
                🏢 Supplier Report
              </h1>

              <p className="mt-2 text-lg text-slate-600">
                Review supplier purchases, payments and outstanding payables.
              </p>
            </div>

            <Link
              href="/reports"
              className="w-fit rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              ← Back to Reports
            </Link>
          </div>

          {message && (
            <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 font-medium text-blue-700">
              {message}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">Total Suppliers</p>

              <h2 className="mt-3 text-4xl font-bold text-blue-600">
                {isLoading ? "..." : supplierRows.length}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Supplier ledgers in active company
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">Active Suppliers</p>

              <h2 className="mt-3 text-4xl font-bold text-green-600">
                {isLoading ? "..." : activeSuppliers}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Suppliers with at least one purchase bill
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">
                Total Purchase Value
              </p>

              <h2 className="mt-3 text-4xl font-bold text-purple-600">
                {isLoading ? "..." : formatCurrency(totalPurchase)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Total value of all cloud purchase bills
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">Outstanding Payable</p>

              <h2 className="mt-3 text-4xl font-bold text-orange-500">
                {isLoading ? "..." : formatCurrency(totalPending)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Credit purchases minus supplier payments
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-6">
              <p className="font-semibold text-emerald-800">
                Supplier Payments
              </p>

              <p className="mt-2 text-3xl font-bold text-emerald-600">
                {isLoading ? "..." : formatCurrency(totalPaid)}
              </p>

              <p className="mt-2 text-sm text-emerald-700">
                Total payments recorded against supplier balances
              </p>
            </div>

            <div className="rounded-3xl border border-blue-100 bg-blue-50 p-6">
              <p className="font-semibold text-blue-800">
                Balance Calculation
              </p>

              <p className="mt-2 text-sm leading-6 text-blue-700">
                Outstanding is calculated as credit purchases minus supplier
                payments. Opening balance is displayed separately for reference.
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search supplier by name, mobile, email or GST..."
                className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none placeholder:text-slate-500 transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 lg:col-span-3"
              />

              <button
                type="button"
                onClick={resetSearch}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Reset Search
              </button>
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-8 py-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Supplier Summary
                </h2>

                <p className="mt-1 text-slate-600">
                  {isLoading
                    ? "Loading supplier data from the cloud..."
                    : `${filteredSuppliers.length} supplier${
                        filteredSuppliers.length !== 1 ? "s" : ""
                      } found`}
                </p>
              </div>

              <div className="rounded-full bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700">
                Purchases: {isLoading ? "..." : formatCurrency(totalPurchase)}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1250px]">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200 text-left">
                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Supplier
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Mobile
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      GST Number
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Opening Balance
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Purchase Bills
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Total Purchase
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Payments
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Outstanding
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-6 py-12 text-center text-slate-500"
                      >
                        Loading supplier report from the cloud database...
                      </td>
                    </tr>
                  ) : filteredSuppliers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-6 py-12 text-center text-slate-500"
                      >
                        <p className="text-lg font-semibold text-slate-700">
                          No suppliers found
                        </p>

                        <p className="mt-2">
                          Add a Supplier ledger or create a purchase bill.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredSuppliers.map((supplier) => (
                      <tr
                        key={supplier.id}
                        className="border-b border-slate-100 transition hover:bg-purple-50"
                      >
                        <td className="px-6 py-5">
                          <p className="font-bold text-slate-900">
                            {supplier.name}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {supplier.email || "No email added"}
                          </p>
                        </td>

                        <td className="px-6 py-5 text-slate-700">
                          {supplier.mobile || "—"}
                        </td>

                        <td className="px-6 py-5 text-slate-700">
                          {supplier.gst || "—"}
                        </td>

                        <td className="px-6 py-5 font-semibold text-slate-700">
                          {formatCurrency(supplier.openingBalance)}
                        </td>

                        <td className="px-6 py-5 font-semibold text-slate-700">
                          {supplier.billCount}
                        </td>

                        <td className="px-6 py-5 font-bold text-purple-700">
                          {formatCurrency(supplier.totalPurchase)}
                        </td>

                        <td className="px-6 py-5 font-bold text-emerald-600">
                          {formatCurrency(supplier.paidAmount)}
                        </td>

                        <td className="px-6 py-5 font-bold text-orange-600">
                          {formatCurrency(supplier.pendingAmount)}
                        </td>

                        <td className="px-6 py-5">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              supplier.pendingAmount > 0
                                ? "bg-orange-100 text-orange-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {supplier.pendingAmount > 0
                              ? "Payment Due"
                              : "Clear"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}