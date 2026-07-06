"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";

type ProductRow = {
  id: string;
  name: string;
  purchase_price: number | string | null;
};

type LedgerRow = {
  id: string;
  name: string;
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
  customer_id: string | null;
  subtotal: number | string | null;
  gst_total: number | string | null;
  discount_total: number | string | null;
  grand_total: number | string | null;
  customer: LedgerRow | LedgerRow[] | null;
  sale_items: SaleItemRow[] | null;
};

type ExpenseRow = {
  id: string;
  expense_date: string;
  category: string;
  amount: number | string | null;
  payment_mode: string;
  description: string | null;
};

type ProfileRow = {
  active_company_id: string | null;
};

type SaleItem = {
  productId: string;
  productName: string;
  quantity: number;
};

type Sale = {
  id: string;
  invoiceNumber: string;
  date: string;
  customerName: string;
  subtotal: number;
  gstTotal: number;
  discountTotal: number;
  grandTotal: number;
  items: SaleItem[];
};

type Expense = {
  id: string;
  date: string;
  category: string;
  amount: number;
  paymentMode: string;
  description: string;
};

type ProfitRow = {
  id: string;
  invoiceNumber: string;
  date: string;
  customerName: string;
  netSales: number;
  estimatedCost: number;
  grossProfit: number;
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
    customerName: customer?.name || "Unknown Customer",
    subtotal: toNumber(row.subtotal),
    gstTotal: toNumber(row.gst_total),
    discountTotal: toNumber(row.discount_total),
    grandTotal: toNumber(row.grand_total),
    items: (row.sale_items || []).map((item) => ({
      productId: item.product_id || "",
      productName: item.product_name || "Product",
      quantity: toNumber(item.quantity),
    })),
  };
}

function mapExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    date: row.expense_date || "",
    category: row.category || "Other",
    amount: toNumber(row.amount),
    paymentMode: row.payment_mode || "Cash",
    description: row.description || "",
  };
}

export default function ProfitReportPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
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

  async function loadReportData() {
    setIsLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setProducts([]);
        setSales([]);
        setExpenses([]);
        showMessage("Please sign in to view the profit and loss report.");
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
        setProducts([]);
        setSales([]);
        setExpenses([]);
        showMessage("Select an active company from the Companies page first.");
        return;
      }

      const [productsResponse, salesResponse, expensesResponse] =
        await Promise.all([
          supabase
            .from("products")
            .select("id, name, purchase_price")
            .eq("company_id", activeCompanyId),
          supabase
            .from("sales")
            .select(
              `
                id,
                invoice_number,
                invoice_date,
                customer_id,
                subtotal,
                gst_total,
                discount_total,
                grand_total,
                customer:ledgers!sales_customer_id_fkey(
                  id,
                  name
                ),
                sale_items(
                  product_id,
                  product_name,
                  quantity
                )
              `
            )
            .eq("company_id", activeCompanyId),
          supabase
            .from("expenses")
            .select(
              "id, expense_date, category, amount, payment_mode, description"
            )
            .eq("company_id", activeCompanyId),
        ]);

      if (productsResponse.error) {
        throw productsResponse.error;
      }

      if (salesResponse.error) {
        throw salesResponse.error;
      }

      if (expensesResponse.error) {
        throw expensesResponse.error;
      }

      setProducts((productsResponse.data || []) as ProductRow[]);
      setSales(
        ((salesResponse.data || []) as unknown as SaleRow[]).map(mapSale)
      );
      setExpenses(
        ((expensesResponse.data || []) as ExpenseRow[]).map(mapExpense)
      );
    } catch (error) {
      setProducts([]);
      setSales([]);
      setExpenses([]);

      showMessage(
        error instanceof Error
          ? error.message
          : "Profit and loss data could not be loaded from the cloud database."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadReportData();

    const refreshEvents = [
      "vertexerp-products-updated",
      "vertexerp-sales-updated",
      "vertexerp-expenses-updated",
      "vertexerp-active-company-updated",
    ];

    refreshEvents.forEach((eventName) => {
      window.addEventListener(eventName, loadReportData);
    });

    return () => {
      refreshEvents.forEach((eventName) => {
        window.removeEventListener(eventName, loadReportData);
      });
    };
  }, []);

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const matchesFromDate = !fromDate || sale.date >= fromDate;
      const matchesToDate = !toDate || sale.date <= toDate;

      return matchesFromDate && matchesToDate;
    });
  }, [sales, fromDate, toDate]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const matchesFromDate = !fromDate || expense.date >= fromDate;
      const matchesToDate = !toDate || expense.date <= toDate;

      return matchesFromDate && matchesToDate;
    });
  }, [expenses, fromDate, toDate]);

  const profitRows = useMemo<ProfitRow[]>(() => {
    const productCostMap = new Map<string, number>();

    products.forEach((product) => {
      productCostMap.set(product.id, toNumber(product.purchase_price));
    });

    return filteredSales
      .map((sale) => {
        const netSales = Math.max(0, sale.subtotal - sale.discountTotal);

        const estimatedCost = sale.items.reduce((total, item) => {
          const purchasePrice = productCostMap.get(item.productId) || 0;

          return total + item.quantity * purchasePrice;
        }, 0);

        return {
          id: sale.id,
          invoiceNumber: sale.invoiceNumber,
          date: sale.date,
          customerName: sale.customerName,
          netSales,
          estimatedCost,
          grossProfit: netSales - estimatedCost,
        };
      })
      .sort((first, second) => second.date.localeCompare(first.date));
  }, [filteredSales, products]);

  const totalRevenue = profitRows.reduce(
    (total, row) => total + row.netSales,
    0
  );

  const totalEstimatedCost = profitRows.reduce(
    (total, row) => total + row.estimatedCost,
    0
  );

  const grossProfit = totalRevenue - totalEstimatedCost;

  const totalOperatingExpenses = filteredExpenses.reduce(
    (total, expense) => total + expense.amount,
    0
  );

  const netProfit = grossProfit - totalOperatingExpenses;

  const grossMargin =
    totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  const netProfitMargin =
    totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  const totalGst = filteredSales.reduce(
    (total, sale) => total + sale.gstTotal,
    0
  );

  function resetFilters() {
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
                💰 Profit &amp; Loss
              </h1>

              <p className="mt-2 text-base text-slate-600 sm:text-lg">
                Analyze sales revenue, product cost, expenses and net profit.
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
              <p className="font-medium text-slate-600">Sales Revenue</p>

              <h2 className="mt-3 break-words text-3xl font-bold text-blue-600 sm:text-4xl">
                {isLoading ? "..." : formatCurrency(totalRevenue)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Sales excluding GST
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">
                Estimated Product Cost
              </p>

              <h2 className="mt-3 break-words text-3xl font-bold text-purple-600 sm:text-4xl">
                {isLoading ? "..." : formatCurrency(totalEstimatedCost)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Based on current purchase prices
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">
                Gross Profit Estimate
              </p>

              <h2
                className={`mt-3 break-words text-3xl font-bold sm:text-4xl ${
                  grossProfit >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {isLoading ? "..." : formatCurrency(grossProfit)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Revenue minus product cost
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">
                Operating Expenses
              </p>

              <h2 className="mt-3 break-words text-3xl font-bold text-orange-500 sm:text-4xl">
                {isLoading ? "..." : formatCurrency(totalOperatingExpenses)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                {isLoading
                  ? "Loading expenses..."
                  : `${filteredExpenses.length} expense${
                      filteredExpenses.length !== 1 ? "s" : ""
                    } included`}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">
                Net Profit Estimate
              </p>

              <h2
                className={`mt-3 break-words text-3xl font-bold sm:text-4xl ${
                  netProfit >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {isLoading ? "..." : formatCurrency(netProfit)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Gross profit minus expenses
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">
                Net Profit Margin
              </p>

              <h2
                className={`mt-3 break-words text-3xl font-bold sm:text-4xl ${
                  netProfitMargin >= 0
                    ? "text-emerald-600"
                    : "text-red-600"
                }`}
              >
                {isLoading ? "..." : `${netProfitMargin.toFixed(2)}%`}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Profit percentage on revenue
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:mt-6 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3">
            <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5 sm:p-6">
              <p className="font-semibold text-blue-800">
                GST Collected on Sales
              </p>

              <p className="mt-2 text-3xl font-bold text-blue-600">
                {isLoading ? "..." : formatCurrency(totalGst)}
              </p>

              <p className="mt-2 text-sm text-blue-700">
                GST amount included in filtered sales invoices
              </p>
            </div>

            <div className="rounded-3xl border border-green-100 bg-green-50 p-5 sm:p-6">
              <p className="font-semibold text-green-800">
                Gross Profit Margin
              </p>

              <p className="mt-2 text-3xl font-bold text-green-600">
                {isLoading ? "..." : `${grossMargin.toFixed(2)}%`}
              </p>

              <p className="mt-2 text-sm text-green-700">
                Margin before operating expenses
              </p>
            </div>

            <div className="rounded-3xl border border-orange-100 bg-orange-50 p-5 sm:p-6">
              <p className="font-semibold text-orange-800">
                Calculation Note
              </p>

              <p className="mt-2 text-sm leading-6 text-orange-700">
                Net profit includes saved expenses. Product cost is estimated
                from each product&apos;s current purchase price.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-slate-100 bg-white p-4 shadow-lg sm:mt-8 sm:p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

              <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
                {isLoading
                  ? "Loading report..."
                  : `${profitRows.length} Invoice${
                      profitRows.length !== 1 ? "s" : ""
                    } • ${filteredExpenses.length} Expense${
                      filteredExpenses.length !== 1 ? "s" : ""
                    }`}
              </div>

              <button
                type="button"
                onClick={resetFilters}
                className="w-full rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-100 sm:w-auto"
              >
                Reset Filters
              </button>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl sm:mt-8">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 lg:py-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
                  Invoice-wise Profit Estimate
                </h2>

                <p className="mt-1 text-sm text-slate-600 sm:text-base">
                  Sales revenue and estimated cost for each saved invoice.
                </p>
              </div>

              <div
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  netProfit >= 0
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                Net Profit: {isLoading ? "..." : formatCurrency(netProfit)}
              </div>
            </div>

            <div className="p-4 md:hidden">
              {isLoading ? (
                <p className="py-10 text-center text-sm text-slate-500">
                  Loading report data from the cloud database...
                </p>
              ) : profitRows.length === 0 ? (
                <div className="py-10 text-center text-slate-500">
                  <p className="text-lg font-semibold text-slate-700">
                    No sales invoices found
                  </p>

                  <p className="mt-2 text-sm">
                    Change the date range or create a sales invoice.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {profitRows.map((row) => {
                    const margin =
                      row.netSales > 0
                        ? (row.grossProfit / row.netSales) * 100
                        : 0;

                    return (
                      <article
                        key={row.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link
                              href={`/sales/invoice/${row.id}`}
                              className="block truncate text-lg font-bold text-blue-600 transition hover:text-blue-800 hover:underline"
                            >
                              {row.invoiceNumber}
                            </Link>

                            <p className="mt-1 truncate text-sm text-slate-600">
                              {row.customerName}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {formatDate(row.date)}
                            </p>
                          </div>

                          <span
                            className={
                              margin >= 0
                                ? "shrink-0 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700"
                                : "shrink-0 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700"
                            }
                          >
                            {margin.toFixed(2)}%
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div className="rounded-xl bg-white p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Sales Revenue
                            </p>

                            <p className="mt-1 break-words font-bold text-blue-700">
                              {formatCurrency(row.netSales)}
                            </p>
                          </div>

                          <div className="rounded-xl bg-white p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Estimated Cost
                            </p>

                            <p className="mt-1 break-words font-bold text-purple-700">
                              {formatCurrency(row.estimatedCost)}
                            </p>
                          </div>
                        </div>

                        <div
                          className={
                            row.grossProfit >= 0
                              ? "mt-3 flex items-center justify-between rounded-xl bg-green-50 p-3"
                              : "mt-3 flex items-center justify-between rounded-xl bg-red-50 p-3"
                          }
                        >
                          <span
                            className={
                              row.grossProfit >= 0
                                ? "text-sm font-semibold text-green-700"
                                : "text-sm font-semibold text-red-700"
                            }
                          >
                            Gross Profit
                          </span>

                          <span
                            className={
                              row.grossProfit >= 0
                                ? "text-lg font-bold text-green-700"
                                : "text-lg font-bold text-red-700"
                            }
                          >
                            {formatCurrency(row.grossProfit)}
                          </span>
                        </div>
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
                      Sales Revenue
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Estimated Cost
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Gross Profit
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Margin
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
                        Loading report data from the cloud database...
                      </td>
                    </tr>
                  ) : profitRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-12 text-center text-slate-500"
                      >
                        <p className="text-lg font-semibold text-slate-700">
                          No sales invoices found
                        </p>

                        <p className="mt-2">
                          Change the date range or create a sales invoice.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    profitRows.map((row) => {
                      const margin =
                        row.netSales > 0
                          ? (row.grossProfit / row.netSales) * 100
                          : 0;

                      return (
                        <tr
                          key={row.id}
                          className="border-b border-slate-100 transition hover:bg-green-50"
                        >
                          <td className="px-6 py-5">
                            <Link
                              href={`/sales/invoice/${row.id}`}
                              className="font-bold text-blue-600 transition hover:text-blue-800 hover:underline"
                            >
                              {row.invoiceNumber}
                            </Link>
                          </td>

                          <td className="px-6 py-5 font-semibold text-slate-900">
                            {row.customerName}
                          </td>

                          <td className="px-6 py-5 text-slate-700">
                            {formatDate(row.date)}
                          </td>

                          <td className="px-6 py-5 font-bold text-blue-700">
                            {formatCurrency(row.netSales)}
                          </td>

                          <td className="px-6 py-5 font-semibold text-purple-700">
                            {formatCurrency(row.estimatedCost)}
                          </td>

                          <td
                            className={`px-6 py-5 font-bold ${
                              row.grossProfit >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {formatCurrency(row.grossProfit)}
                          </td>

                          <td className="px-6 py-5">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${
                                margin >= 0
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {margin.toFixed(2)}%
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