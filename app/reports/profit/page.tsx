"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";

type LedgerRow = {
  id: string;
  name: string;
};

type SaleItemRow = {
  product_id: string | null;
  product_name: string | null;
  quantity: number | string | null;
  cogs_amount: number | string | null;
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

type ProfitLossSummaryRow = {
  total_income: number | string | null;
  total_expense: number | string | null;
  net_profit: number | string | null;
};

type ProfitLossAccountRow = {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: "Income" | "Expense";
  amount: number | string | null;
};

type ProfitRow = {
  id: string;
  invoiceNumber: string;
  date: string;
  customerName: string;
  netSales: number;
  cogsAmount: number;
  grossProfit: number;
  hasCogsSnapshot: boolean;
};

type ProfitReportData = {
  totalRevenue: number;
  totalCogs: number;
  grossProfit: number;
  operatingExpenses: number;
  netProfit: number;
  totalGst: number;
  grossMargin: number;
  netProfitMargin: number;
  invoiceCount: number;
  expenseCount: number;
  profitRows: ProfitRow[];
};

const initialReportData: ProfitReportData = {
  totalRevenue: 0,
  totalCogs: 0,
  grossProfit: 0,
  operatingExpenses: 0,
  netProfit: 0,
  totalGst: 0,
  grossMargin: 0,
  netProfitMargin: 0,
  invoiceCount: 0,
  expenseCount: 0,
  profitRows: [],
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

function isDateInRange(dateValue: string, fromDate: string, toDate: string) {
  if (!dateValue) {
    return false;
  }

  if (fromDate && dateValue < fromDate) {
    return false;
  }

  if (toDate && dateValue > toDate) {
    return false;
  }

  return true;
}

function isCostOfGoodsSoldAccount(account: ProfitLossAccountRow) {
  return (
    account.account_code === "5000" ||
    account.account_name.trim().toLowerCase() === "cost of goods sold"
  );
}

function calculateMargin(numerator: number, denominator: number) {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

export default function ProfitReportPage() {
  const [reportData, setReportData] =
    useState<ProfitReportData>(initialReportData);
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

  const loadReportData = useCallback(async () => {
    setIsLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setReportData(initialReportData);
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
        setReportData(initialReportData);
        showMessage("Select an active company from the Companies page first.");
        return;
      }

      const [salesResponse, expensesResponse, summaryResponse, accountsResponse] =
        await Promise.all([
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
                  quantity,
                  cogs_amount
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
          supabase.rpc("get_profit_loss_summary", {
            p_company_id: activeCompanyId,
            p_from_date: fromDate || null,
            p_to_date: toDate || null,
          }),
          supabase.rpc("get_profit_loss_accounts", {
            p_company_id: activeCompanyId,
            p_from_date: fromDate || null,
            p_to_date: toDate || null,
          }),
        ]);

      if (salesResponse.error) {
        throw salesResponse.error;
      }

      if (expensesResponse.error) {
        throw expensesResponse.error;
      }

      if (summaryResponse.error) {
        throw summaryResponse.error;
      }

      if (accountsResponse.error) {
        throw accountsResponse.error;
      }

      const sales = (salesResponse.data || []) as unknown as SaleRow[];
      const expenses = (expensesResponse.data || []) as ExpenseRow[];
      const summary = ((summaryResponse.data || []) as ProfitLossSummaryRow[])[0];
      const profitLossAccounts =
        (accountsResponse.data || []) as ProfitLossAccountRow[];

      const filteredSales = sales.filter((sale) =>
        isDateInRange(sale.invoice_date, fromDate, toDate)
      );

      const filteredExpenses = expenses.filter((expense) =>
        isDateInRange(expense.expense_date, fromDate, toDate)
      );

      const totalRevenue = toNumber(summary?.total_income);

      const totalCogs = profitLossAccounts
        .filter(
          (account) =>
            account.account_type === "Expense" &&
            isCostOfGoodsSoldAccount(account)
        )
        .reduce((total, account) => total + toNumber(account.amount), 0);

      const totalAccountingExpenses = toNumber(summary?.total_expense);
      const operatingExpenses = Math.max(0, totalAccountingExpenses - totalCogs);
      const grossProfit = totalRevenue - totalCogs;
      const netProfit = toNumber(summary?.net_profit);

      const totalGst = filteredSales.reduce(
        (total, sale) => total + toNumber(sale.gst_total),
        0
      );

      const profitRows = filteredSales
        .map((sale) => {
          const customer = getJoinedLedger(sale.customer);
          const cogsAmount = (sale.sale_items || []).reduce(
            (total, item) => total + toNumber(item.cogs_amount),
            0
          );

          const hasCogsSnapshot = (sale.sale_items || []).some(
            (item) => item.cogs_amount !== null && item.cogs_amount !== undefined
          );

          const netSales = Math.max(
            0,
            toNumber(sale.subtotal) - toNumber(sale.discount_total)
          );

          return {
            id: sale.id,
            invoiceNumber: sale.invoice_number || "Sales Invoice",
            date: sale.invoice_date || "",
            customerName: customer?.name || "Unknown Customer",
            netSales,
            cogsAmount,
            grossProfit: netSales - cogsAmount,
            hasCogsSnapshot,
          };
        })
        .sort((first, second) => second.date.localeCompare(first.date));

      setReportData({
        totalRevenue,
        totalCogs,
        grossProfit,
        operatingExpenses,
        netProfit,
        totalGst,
        grossMargin: calculateMargin(grossProfit, totalRevenue),
        netProfitMargin: calculateMargin(netProfit, totalRevenue),
        invoiceCount: profitRows.length,
        expenseCount: filteredExpenses.length,
        profitRows,
      });
    } catch (error) {
      setReportData(initialReportData);

      showMessage(
        error instanceof Error
          ? error.message
          : "Profit and loss data could not be loaded from the cloud database."
      );
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    loadReportData();

    const refreshEvents = [
      "vertexerp-products-updated",
      "vertexerp-sales-updated",
      "vertexerp-purchases-updated",
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
  }, [loadReportData]);

  const netProfitIsPositive = reportData.netProfit >= 0;
  const grossProfitIsPositive = reportData.grossProfit >= 0;
  const hasLegacyRows = useMemo(
    () => reportData.profitRows.some((row) => !row.hasCogsSnapshot),
    [reportData.profitRows]
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
                Profit &amp; Loss
              </h1>

              <p className="mt-2 text-base text-slate-600 sm:text-lg">
                Analyze accounting revenue, Cost of Goods Sold, operating
                expenses and net profit from posted vouchers.
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

          {hasLegacyRows && (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 sm:mb-6 sm:text-base">
              Some older invoices do not have COGS snapshots because they were
              recorded before the costing engine was enabled. Their invoice-wise
              COGS may show as zero until historical migration is performed.
            </div>
          )}

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3">
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">Sales Revenue</p>

              <h2 className="mt-3 break-words text-3xl font-bold text-blue-600 sm:text-4xl">
                {isLoading ? "..." : formatCurrency(reportData.totalRevenue)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Posted income excluding GST
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">
                Cost of Goods Sold
              </p>

              <h2 className="mt-3 break-words text-3xl font-bold text-purple-600 sm:text-4xl">
                {isLoading ? "..." : formatCurrency(reportData.totalCogs)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Actual cost from sale item snapshots
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">Gross Profit</p>

              <h2
                className={`mt-3 break-words text-3xl font-bold sm:text-4xl ${
                  grossProfitIsPositive ? "text-green-600" : "text-red-600"
                }`}
              >
                {isLoading ? "..." : formatCurrency(reportData.grossProfit)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Sales revenue minus COGS
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">
                Operating Expenses
              </p>

              <h2 className="mt-3 break-words text-3xl font-bold text-orange-500 sm:text-4xl">
                {isLoading
                  ? "..."
                  : formatCurrency(reportData.operatingExpenses)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                {isLoading
                  ? "Loading expenses..."
                  : `${reportData.expenseCount} expense${
                      reportData.expenseCount !== 1 ? "s" : ""
                    } included`}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">
                Accounting Net Profit
              </p>

              <h2
                className={`mt-3 break-words text-3xl font-bold sm:text-4xl ${
                  netProfitIsPositive ? "text-green-600" : "text-red-600"
                }`}
              >
                {isLoading ? "..." : formatCurrency(reportData.netProfit)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Gross profit minus operating expenses
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">
                Net Profit Margin
              </p>

              <h2
                className={`mt-3 break-words text-3xl font-bold sm:text-4xl ${
                  reportData.netProfitMargin >= 0
                    ? "text-emerald-600"
                    : "text-red-600"
                }`}
              >
                {isLoading
                  ? "..."
                  : `${reportData.netProfitMargin.toFixed(2)}%`}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Accounting profit percentage on revenue
              </p>
            </div>
          </section>

          <section className="mt-5 grid grid-cols-1 gap-4 sm:mt-6 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3">
            <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5 sm:p-6">
              <p className="font-semibold text-blue-800">
                GST Collected on Sales
              </p>

              <p className="mt-2 text-3xl font-bold text-blue-600">
                {isLoading ? "..." : formatCurrency(reportData.totalGst)}
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
                {isLoading
                  ? "..."
                  : `${reportData.grossMargin.toFixed(2)}%`}
              </p>

              <p className="mt-2 text-sm text-green-700">
                Margin after Cost of Goods Sold
              </p>
            </div>

            <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5 sm:p-6">
              <p className="font-semibold text-emerald-800">
                Calculation Source
              </p>

              <p className="mt-2 text-sm leading-6 text-emerald-700">
                Revenue, COGS, expenses and net profit are calculated from
                posted double-entry accounting vouchers.
              </p>
            </div>
          </section>

          <section className="mt-6 rounded-3xl border border-slate-100 bg-white p-4 shadow-lg sm:mt-8 sm:p-6">
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
                  : `${reportData.invoiceCount} Invoice${
                      reportData.invoiceCount !== 1 ? "s" : ""
                    } • ${reportData.expenseCount} Expense${
                      reportData.expenseCount !== 1 ? "s" : ""
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
          </section>

          <section className="mt-6 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl sm:mt-8">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 lg:py-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
                  Invoice-wise COGS Profit
                </h2>

                <p className="mt-1 text-sm text-slate-600 sm:text-base">
                  Sales revenue, COGS snapshot and gross profit for each saved
                  invoice.
                </p>
              </div>

              <div
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  netProfitIsPositive
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                Net Profit:{" "}
                {isLoading ? "..." : formatCurrency(reportData.netProfit)}
              </div>
            </div>

            <div className="p-4 md:hidden">
              {isLoading ? (
                <p className="py-10 text-center text-sm text-slate-500">
                  Loading report data from the cloud database...
                </p>
              ) : reportData.profitRows.length === 0 ? (
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
                  {reportData.profitRows.map((row) => {
                    const margin = calculateMargin(
                      row.grossProfit,
                      row.netSales
                    );

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
                              COGS
                            </p>

                            <p className="mt-1 break-words font-bold text-purple-700">
                              {formatCurrency(row.cogsAmount)}
                            </p>

                            {!row.hasCogsSnapshot && (
                              <p className="mt-1 text-xs font-medium text-amber-600">
                                Legacy invoice
                              </p>
                            )}
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
                      COGS
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
                  ) : reportData.profitRows.length === 0 ? (
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
                    reportData.profitRows.map((row) => {
                      const margin = calculateMargin(
                        row.grossProfit,
                        row.netSales
                      );

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

                            {!row.hasCogsSnapshot && (
                              <p className="mt-1 text-xs font-medium text-amber-600">
                                Legacy invoice
                              </p>
                            )}
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
                            {formatCurrency(row.cogsAmount)}
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
          </section>
        </main>
      </div>
    </div>
  );
}