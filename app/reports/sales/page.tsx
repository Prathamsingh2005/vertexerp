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

type SaleItemRow = {
  product_id: string | null;
  product_name: string;
  quantity: number | string | null;
};

type SaleRow = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  payment_mode: string;
  customer_id: string | null;
  grand_total: number | string | null;
  customer: LedgerRow | LedgerRow[] | null;
  sale_items: SaleItemRow[] | null;
};

type ProfileRow = {
  active_company_id: string | null;
};

type Sale = {
  id: string;
  invoiceNumber: string;
  date: string;
  paymentMode: string;
  customerName: string;
  customerMobile: string;
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

function mapSale(row: SaleRow): Sale {
  const customer = getJoinedLedger(row.customer);

  return {
    id: row.id,
    invoiceNumber: row.invoice_number || "Sales Invoice",
    date: row.invoice_date || "",
    paymentMode: row.payment_mode || "Cash",
    customerName: customer?.name || "Unknown Customer",
    customerMobile: customer?.mobile || "",
    grandTotal: toNumber(row.grand_total),
    itemCount: (row.sale_items || []).length,
  };
}

export default function SalesReportPage() {
  const [sales, setSales] = useState<Sale[]>([]);
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

  async function loadSales() {
    setIsLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setSales([]);
        showMessage("Please sign in to view the sales report.");
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
        setSales([]);
        showMessage("Select an active company from the Companies page first.");
        return;
      }

      const { data, error } = await supabase
        .from("sales")
        .select(
          `
            id,
            invoice_number,
            invoice_date,
            payment_mode,
            customer_id,
            grand_total,
            customer:ledgers!sales_customer_id_fkey(
              id,
              name,
              mobile
            ),
            sale_items(
              product_id,
              product_name,
              quantity
            )
          `
        )
        .eq("company_id", activeCompanyId)
        .order("invoice_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setSales(
        ((data || []) as unknown as SaleRow[]).map(mapSale)
      );
    } catch (error) {
      setSales([]);

      showMessage(
        error instanceof Error
          ? error.message
          : "Sales report data could not be loaded from the cloud database."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadSales();

    const refreshEvents = [
      "vertexerp-sales-updated",
      "vertexerp-active-company-updated",
    ];

    refreshEvents.forEach((eventName) => {
      window.addEventListener(eventName, loadSales);
    });

    return () => {
      refreshEvents.forEach((eventName) => {
        window.removeEventListener(eventName, loadSales);
      });
    };
  }, []);

  const filteredSales = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return sales.filter((sale) => {
      const matchesSearch =
        !search ||
        sale.invoiceNumber.toLowerCase().includes(search) ||
        sale.customerName.toLowerCase().includes(search) ||
        sale.customerMobile.includes(search);

      const matchesFromDate = !fromDate || sale.date >= fromDate;
      const matchesToDate = !toDate || sale.date <= toDate;

      return matchesSearch && matchesFromDate && matchesToDate;
    });
  }, [sales, searchTerm, fromDate, toDate]);

  const totalSales = filteredSales.reduce(
    (total, sale) => total + sale.grandTotal,
    0
  );

  const paidSales = filteredSales
    .filter((sale) => !isCreditPayment(sale.paymentMode))
    .reduce((total, sale) => total + sale.grandTotal, 0);

  const creditSales = filteredSales
    .filter((sale) => isCreditPayment(sale.paymentMode))
    .reduce((total, sale) => total + sale.grandTotal, 0);

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
                🛒 Sales Report
              </h1>

              <p className="mt-2 text-base text-slate-600 sm:text-lg">
                Review sales invoices, customer details and payment status.
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
              <p className="font-medium text-slate-600">Total Sales</p>

              <h2 className="mt-3 break-words text-3xl font-bold text-blue-600 sm:text-4xl">
                {isLoading ? "..." : formatCurrency(totalSales)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                From filtered cloud invoices
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">Paid Sales</p>

              <h2 className="mt-3 break-words text-3xl font-bold text-green-600 sm:text-4xl">
                {isLoading ? "..." : formatCurrency(paidSales)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Cash, UPI, bank transfer and card invoices
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">Credit Sales</p>

              <h2 className="mt-3 break-words text-3xl font-bold text-orange-500 sm:text-4xl">
                {isLoading ? "..." : formatCurrency(creditSales)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Use Outstanding for receipt-adjusted pending balance
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-slate-100 bg-white p-4 shadow-lg sm:mt-8 sm:p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search invoice, customer or mobile..."
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
                  Sales Invoices
                </h2>

                <p className="mt-1 text-sm text-slate-600 sm:text-base">
                  {isLoading
                    ? "Loading cloud invoices..."
                    : `${filteredSales.length} invoice${
                        filteredSales.length !== 1 ? "s" : ""
                      } found`}
                </p>
              </div>

              <div className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                Total: {isLoading ? "..." : formatCurrency(totalSales)}
              </div>
            </div>

            <div className="p-4 md:hidden">
              {isLoading ? (
                <p className="py-10 text-center text-sm text-slate-500">
                  Loading sales invoices from the cloud database...
                </p>
              ) : filteredSales.length === 0 ? (
                <div className="py-10 text-center text-slate-500">
                  <p className="text-lg font-semibold text-slate-700">
                    No sales invoices found
                  </p>

                  <p className="mt-2 text-sm">
                    Change the filters or create a new invoice.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredSales.map((sale) => {
                    const isCredit = isCreditPayment(sale.paymentMode);

                    return (
                      <article
                        key={sale.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link
                              href={`/sales/invoice/${sale.id}`}
                              className="block truncate text-lg font-bold text-blue-600 transition hover:text-blue-800 hover:underline"
                            >
                              {sale.invoiceNumber}
                            </Link>

                            <p className="mt-1 truncate text-sm text-slate-600">
                              {sale.customerName}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {formatDate(sale.date)}
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
                              {sale.itemCount} Item
                              {sale.itemCount !== 1 ? "s" : ""}
                            </p>
                          </div>

                          <div className="rounded-xl bg-white p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Payment Mode
                            </p>

                            <p className="mt-1 break-words font-semibold text-slate-800">
                              {sale.paymentMode}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between rounded-xl bg-blue-50 p-3">
                          <span className="text-sm font-semibold text-blue-700">
                            Invoice Total
                          </span>

                          <span className="text-lg font-bold text-blue-700">
                            {formatCurrency(sale.grandTotal)}
                          </span>
                        </div>

                        {sale.customerMobile && (
                          <p className="mt-3 text-sm text-slate-500">
                            Mobile: {sale.customerMobile}
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
                      Invoice
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Customer
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
                        Loading sales invoices from the cloud database...
                      </td>
                    </tr>
                  ) : filteredSales.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-12 text-center text-slate-500"
                      >
                        <p className="text-lg font-semibold text-slate-700">
                          No sales invoices found
                        </p>

                        <p className="mt-2">
                          Change the filters or create a new invoice.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map((sale) => {
                      const isCredit = isCreditPayment(sale.paymentMode);

                      return (
                        <tr
                          key={sale.id}
                          className="border-b border-slate-100 transition hover:bg-blue-50"
                        >
                          <td className="px-6 py-5">
                            <Link
                              href={`/sales/invoice/${sale.id}`}
                              className="font-bold text-blue-600 transition hover:text-blue-800 hover:underline"
                            >
                              {sale.invoiceNumber}
                            </Link>
                          </td>

                          <td className="px-6 py-5">
                            <p className="font-bold text-slate-900">
                              {sale.customerName}
                            </p>

                            <p className="mt-1 text-sm text-slate-500">
                              {sale.customerMobile || "No mobile added"}
                            </p>
                          </td>

                          <td className="px-6 py-5 text-slate-700">
                            {formatDate(sale.date)}
                          </td>

                          <td className="px-6 py-5 text-slate-700">
                            {sale.itemCount} Item
                            {sale.itemCount !== 1 ? "s" : ""}
                          </td>

                          <td className="px-6 py-5 text-slate-700">
                            {sale.paymentMode}
                          </td>

                          <td className="px-6 py-5 font-bold text-slate-900">
                            {formatCurrency(sale.grandTotal)}
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