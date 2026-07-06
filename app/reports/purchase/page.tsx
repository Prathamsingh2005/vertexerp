"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";

type LedgerRow = {
  id: string;
  name: string;
  mobile: string | null;
};

type PurchaseItemRow = {
  product_id: string | null;
  product_name: string;
  quantity: number | string | null;
};

type PurchaseRow = {
  id: string;
  bill_number: string;
  purchase_date: string;
  payment_mode: string;
  supplier_id: string | null;
  grand_total: number | string | null;
  supplier: LedgerRow | LedgerRow[] | null;
  purchase_items: PurchaseItemRow[] | null;
};

type ProfileRow = {
  active_company_id: string | null;
};

type Purchase = {
  id: string;
  billNumber: string;
  date: string;
  paymentMode: string;
  supplierName: string;
  supplierMobile: string;
  grandTotal: number;
  itemCount: number;
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

function formatDate(dateValue: string) {
  if (!dateValue) {
    return "—";
  }

  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isCreditPayment(paymentMode: string) {
  return String(paymentMode || "").trim().toLowerCase() === "credit";
}

function getJoinedLedger(
  ledger: LedgerRow | LedgerRow[] | null
): LedgerRow | null {
  return Array.isArray(ledger) ? ledger[0] || null : ledger;
}

function mapPurchase(row: PurchaseRow): Purchase {
  const supplier = getJoinedLedger(row.supplier);

  return {
    id: row.id,
    billNumber: row.bill_number || "Purchase Bill",
    date: row.purchase_date || "",
    paymentMode: row.payment_mode || "Cash",
    supplierName: supplier?.name || "Unknown Supplier",
    supplierMobile: supplier?.mobile || "",
    grandTotal: toNumber(row.grand_total),
    itemCount: (row.purchase_items || []).length,
  };
}

export default function PurchaseReportPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);

    window.setTimeout(() => {
      setMessage("");
    }, 4500);
  }

  async function loadPurchases() {
    setIsLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setPurchases([]);
        showMessage("Please sign in to view the purchase report.");
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
        setPurchases([]);
        showMessage("Select an active company from the Companies page first.");
        return;
      }

      const { data, error } = await supabase
        .from("purchases")
        .select(
          `
            id,
            bill_number,
            purchase_date,
            payment_mode,
            supplier_id,
            grand_total,
            supplier:ledgers!purchases_supplier_id_fkey(
              id,
              name,
              mobile
            ),
            purchase_items(
              product_id,
              product_name,
              quantity
            )
          `
        )
        .eq("company_id", activeCompanyId)
        .order("purchase_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setPurchases(
        ((data || []) as unknown as PurchaseRow[]).map(mapPurchase)
      );
    } catch (error) {
      setPurchases([]);

      showMessage(
        error instanceof Error
          ? error.message
          : "Purchase report data could not be loaded from the cloud database."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadPurchases();

    const refreshEvents = [
      "vertexerp-purchases-updated",
      "vertexerp-active-company-updated",
    ];

    refreshEvents.forEach((eventName) => {
      window.addEventListener(eventName, loadPurchases);
    });

    return () => {
      refreshEvents.forEach((eventName) => {
        window.removeEventListener(eventName, loadPurchases);
      });
    };
  }, []);

  const filteredPurchases = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return purchases.filter((purchase) => {
      const matchesSearch =
        !search ||
        purchase.billNumber.toLowerCase().includes(search) ||
        purchase.supplierName.toLowerCase().includes(search) ||
        purchase.supplierMobile.includes(search);

      const matchesFromDate = !fromDate || purchase.date >= fromDate;
      const matchesToDate = !toDate || purchase.date <= toDate;

      return matchesSearch && matchesFromDate && matchesToDate;
    });
  }, [purchases, searchTerm, fromDate, toDate]);

  const totalPurchase = filteredPurchases.reduce(
    (total, purchase) => total + purchase.grandTotal,
    0
  );

  const paidPurchase = filteredPurchases
    .filter((purchase) => !isCreditPayment(purchase.paymentMode))
    .reduce((total, purchase) => total + purchase.grandTotal, 0);

  const creditPurchase = filteredPurchases
    .filter((purchase) => isCreditPayment(purchase.paymentMode))
    .reduce((total, purchase) => total + purchase.grandTotal, 0);

  function resetFilters() {
    setSearchTerm("");
    setFromDate("");
    setToDate("");
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <div className="min-w-0 flex-1">
        <Navbar />

        <main className="p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
          <div className="mb-6 flex flex-col gap-5 lg:mb-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
                🧾 Purchase Report
              </h1>

              <p className="mt-2 text-base text-slate-600 sm:text-lg">
                Review supplier purchases, bill details and payment status.
              </p>
            </div>

            <Link
              href="/reports"
              className="w-full rounded-xl border border-slate-300 bg-white px-6 py-3 text-center font-semibold text-slate-700 transition hover:bg-slate-100 sm:w-fit"
            >
              ← Back to Reports
            </Link>
          </div>

          {message && (
            <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 sm:mb-6 sm:text-base">
              {message}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3">
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">
                Total Purchase
              </p>

              <h2 className="mt-3 break-words text-3xl font-bold text-purple-600 sm:text-4xl">
                {isLoading ? "..." : formatCurrency(totalPurchase)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                From filtered cloud purchase bills
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">Paid Purchases</p>

              <h2 className="mt-3 break-words text-3xl font-bold text-green-600 sm:text-4xl">
                {isLoading ? "..." : formatCurrency(paidPurchase)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Cash, UPI, bank transfer and card purchase bills
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">
                Credit Purchases
              </p>

              <h2 className="mt-3 break-words text-3xl font-bold text-orange-500 sm:text-4xl">
                {isLoading ? "..." : formatCurrency(creditPurchase)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Use Outstanding for payment-adjusted pending balance
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-slate-100 bg-white p-4 shadow-lg sm:mt-8 sm:p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search bill, supplier or mobile..."
                className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none placeholder:text-slate-500 transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 lg:col-span-2"
              />

              <input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />

              <input
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-5 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-100 sm:w-auto"
            >
              Reset Filters
            </button>
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl sm:mt-8">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 lg:py-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
                  Purchase Bills
                </h2>

                <p className="mt-1 text-sm text-slate-600 sm:text-base">
                  {isLoading
                    ? "Loading cloud purchase bills..."
                    : `${filteredPurchases.length} bill${
                        filteredPurchases.length !== 1 ? "s" : ""
                      } found`}
                </p>
              </div>

              <div className="rounded-full bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700">
                Total: {isLoading ? "..." : formatCurrency(totalPurchase)}
              </div>
            </div>

            <div className="p-4 md:hidden">
              {isLoading ? (
                <p className="py-10 text-center text-sm text-slate-500">
                  Loading purchase bills from the cloud database...
                </p>
              ) : filteredPurchases.length === 0 ? (
                <div className="py-10 text-center text-slate-500">
                  <p className="text-lg font-semibold text-slate-700">
                    No purchase bills found
                  </p>

                  <p className="mt-2 text-sm">
                    Change the filters or create a new purchase bill.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredPurchases.map((purchase) => {
                    const isCredit = isCreditPayment(purchase.paymentMode);

                    return (
                      <article
                        key={purchase.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link
                              href={`/purchase/bill/${purchase.id}`}
                              className="block truncate text-lg font-bold text-purple-600 transition hover:text-purple-800 hover:underline"
                            >
                              {purchase.billNumber}
                            </Link>

                            <p className="mt-1 truncate text-sm text-slate-600">
                              {purchase.supplierName}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {formatDate(purchase.date)}
                            </p>
                          </div>

                          <span
                            className={
                              isCredit
                                ? "shrink-0 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700"
                                : "shrink-0 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700"
                            }
                          >
                            {isCredit ? "Credit" : "Paid"}
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div className="rounded-xl bg-white p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Items
                            </p>

                            <p className="mt-1 font-semibold text-slate-800">
                              {purchase.itemCount} Item
                              {purchase.itemCount !== 1 ? "s" : ""}
                            </p>
                          </div>

                          <div className="rounded-xl bg-white p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Payment Mode
                            </p>

                            <p className="mt-1 break-words font-semibold text-slate-800">
                              {purchase.paymentMode}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between rounded-xl bg-purple-50 p-3">
                          <span className="text-sm font-semibold text-purple-700">
                            Bill Total
                          </span>

                          <span className="text-lg font-bold text-purple-700">
                            {formatCurrency(purchase.grandTotal)}
                          </span>
                        </div>

                        {purchase.supplierMobile && (
                          <p className="mt-3 text-sm text-slate-500">
                            Mobile: {purchase.supplierMobile}
                          </p>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1000px]">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200 text-left">
                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Bill
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Supplier
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Date
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Items
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Payment Mode
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Amount
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
                        colSpan={7}
                        className="px-6 py-12 text-center text-slate-500"
                      >
                        Loading purchase bills from the cloud database...
                      </td>
                    </tr>
                  ) : filteredPurchases.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-12 text-center text-slate-500"
                      >
                        <p className="text-lg font-semibold text-slate-700">
                          No purchase bills found
                        </p>

                        <p className="mt-2">
                          Change the filters or create a new purchase bill.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredPurchases.map((purchase) => {
                      const isCredit = isCreditPayment(
                        purchase.paymentMode
                      );

                      return (
                        <tr
                          key={purchase.id}
                          className="border-b border-slate-100 transition hover:bg-purple-50"
                        >
                          <td className="px-6 py-5">
                            <Link
                              href={`/purchase/bill/${purchase.id}`}
                              className="font-bold text-purple-600 transition hover:text-purple-800 hover:underline"
                            >
                              {purchase.billNumber}
                            </Link>
                          </td>

                          <td className="px-6 py-5">
                            <p className="font-bold text-slate-900">
                              {purchase.supplierName}
                            </p>

                            <p className="mt-1 text-sm text-slate-500">
                              {purchase.supplierMobile || "No mobile added"}
                            </p>
                          </td>

                          <td className="px-6 py-5 text-slate-700">
                            {formatDate(purchase.date)}
                          </td>

                          <td className="px-6 py-5 text-slate-700">
                            {purchase.itemCount} Item
                            {purchase.itemCount !== 1 ? "s" : ""}
                          </td>

                          <td className="px-6 py-5 text-slate-700">
                            {purchase.paymentMode}
                          </td>

                          <td className="px-6 py-5 font-bold text-slate-900">
                            {formatCurrency(purchase.grandTotal)}
                          </td>

                          <td className="px-6 py-5">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${
                                isCredit
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-green-100 text-green-700"
                              }`}
                            >
                              {isCredit ? "Credit" : "Paid"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
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