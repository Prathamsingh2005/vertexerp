"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Box,
  CreditCard,
  Package,
  Plus,
  ReceiptText,
  ShoppingCart,
  TrendingUp,
  TriangleAlert,
  WalletCards,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type ProductRow = {
  id: string;
  name: string;
  quantity: number | string | null;
  purchase_price: number | string | null;
  inventory_value: number | string | null;
  low_stock_alert: number | string | null;
};

type LedgerRow = {
  id: string;
  name: string;
};

type SaleItemRow = {
  product_id: string | null;
  quantity: number | string | null;
};

type SaleRow = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  payment_mode: string;
  customer_id: string | null;
  subtotal: number | string | null;
  discount_total: number | string | null;
  grand_total: number | string | null;
  created_at: string;
  customer: LedgerRow | LedgerRow[] | null;
  sale_items: SaleItemRow[] | null;
};

type PurchaseRow = {
  id: string;
  bill_number: string;
  purchase_date: string;
  payment_mode: string;
  supplier_id: string | null;
  grand_total: number | string | null;
  created_at: string;
  supplier: LedgerRow | LedgerRow[] | null;
};

type ExpenseRow = {
  id: string;
  expense_date: string;
  category: string;
  amount: number | string | null;
  payment_mode: string;
  description: string | null;
  created_at: string;
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

type Transaction = {
  id: string;
  targetId: string;
  title: string;
  subtitle: string;
  amount: number;
  type: "sale" | "purchase" | "expense";
  date: string;
};

type DashboardData = {
  totalProducts: number;
  monthlyRevenue: number;
  monthlyPurchase: number;
  monthlyExpenses: number;
  monthlyCogs: number;
  monthlyNetProfit: number;
  stockValue: number;
  lowStockCount: number;
  recentTransactions: Transaction[];
};

const initialDashboardData: DashboardData = {
  totalProducts: 0,
  monthlyRevenue: 0,
  monthlyPurchase: 0,
  monthlyExpenses: 0,
  monthlyCogs: 0,
  monthlyNetProfit: 0,
  stockValue: 0,
  lowStockCount: 0,
  recentTransactions: [],
};

function toNumber(value: unknown) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function toValidDate(dateValue: string) {
  if (!dateValue) {
    return null;
  }

  const normalizedDate = dateValue.includes("T")
    ? dateValue
    : `${dateValue}T00:00:00`;

  const date = new Date(normalizedDate);

  return Number.isNaN(date.getTime()) ? null : date;
}

function isCurrentMonth(dateValue: string) {
  const date = toValidDate(dateValue);

  if (!date) {
    return false;
  }

  const today = new Date();

  return (
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

function formatDateForQuery(date: Date) {
  const timezoneSafeDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );

  return timezoneSafeDate.toISOString().slice(0, 10);
}

function getCurrentMonthRange() {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  return {
    monthStartDate: formatDateForQuery(monthStart),
    monthEndDate: formatDateForQuery(monthEnd),
  };
}

function isCostOfGoodsSoldAccount(account: ProfitLossAccountRow) {
  return (
    account.account_code === "5000" ||
    account.account_name.trim().toLowerCase() === "cost of goods sold"
  );
}

function formatDate(dateValue: string) {
  const date = toValidDate(dateValue);

  if (!date) {
    return "—";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(amount: number) {
  return `₹${toNumber(amount).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function getJoinedLedger(
  ledger: LedgerRow | LedgerRow[] | null
): LedgerRow | null {
  return Array.isArray(ledger) ? ledger[0] || null : ledger;
}

export default function DashboardOverview() {
  const [dashboardData, setDashboardData] =
    useState<DashboardData>(initialDashboardData);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);

    window.setTimeout(() => {
      setMessage("");
    }, 4500);
  }

  async function loadDashboardData() {
    setIsLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setDashboardData(initialDashboardData);
        showMessage("Please sign in to view dashboard data.");
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
        setDashboardData(initialDashboardData);
        showMessage("Select an active company from the Companies page first.");
        return;
      }

      const { monthStartDate, monthEndDate } = getCurrentMonthRange();

      const [
        productsResponse,
        salesResponse,
        purchasesResponse,
        expensesResponse,
        profitLossSummaryResponse,
        profitLossAccountsResponse,
      ] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, quantity, purchase_price, inventory_value, low_stock_alert")
          .eq("company_id", activeCompanyId),
        supabase
          .from("sales")
          .select(
            `
              id,
              invoice_number,
              invoice_date,
              payment_mode,
              customer_id,
              subtotal,
              discount_total,
              grand_total,
              created_at,
              customer:ledgers!sales_customer_id_fkey(
                id,
                name
              ),
              sale_items(
                product_id,
                quantity
              )
            `
          )
          .eq("company_id", activeCompanyId),
        supabase
          .from("purchases")
          .select(
            `
              id,
              bill_number,
              purchase_date,
              payment_mode,
              supplier_id,
              grand_total,
              created_at,
              supplier:ledgers!purchases_supplier_id_fkey(
                id,
                name
              )
            `
          )
          .eq("company_id", activeCompanyId),
        supabase
          .from("expenses")
          .select(
            "id, expense_date, category, amount, payment_mode, description, created_at"
          )
          .eq("company_id", activeCompanyId),
        supabase.rpc("get_profit_loss_summary", {
          p_company_id: activeCompanyId,
          p_from_date: monthStartDate,
          p_to_date: monthEndDate,
        }),
        supabase.rpc("get_profit_loss_accounts", {
          p_company_id: activeCompanyId,
          p_from_date: monthStartDate,
          p_to_date: monthEndDate,
        }),
      ]);

      if (productsResponse.error) {
        throw productsResponse.error;
      }

      if (salesResponse.error) {
        throw salesResponse.error;
      }

      if (purchasesResponse.error) {
        throw purchasesResponse.error;
      }

      if (expensesResponse.error) {
        throw expensesResponse.error;
      }

      if (profitLossSummaryResponse.error) {
        throw profitLossSummaryResponse.error;
      }

      if (profitLossAccountsResponse.error) {
        throw profitLossAccountsResponse.error;
      }

      const products = (productsResponse.data || []) as ProductRow[];
      const sales = (salesResponse.data || []) as unknown as SaleRow[];
      const purchases =
        (purchasesResponse.data || []) as unknown as PurchaseRow[];
      const expenses = (expensesResponse.data || []) as ExpenseRow[];

      const profitLossSummary = (
        (profitLossSummaryResponse.data || []) as ProfitLossSummaryRow[]
      )[0];

      const profitLossAccounts =
        (profitLossAccountsResponse.data || []) as ProfitLossAccountRow[];

      const monthlyRevenue = toNumber(profitLossSummary?.total_income);

      const monthlyCogs = profitLossAccounts
        .filter(
          (account) =>
            account.account_type === "Expense" &&
            isCostOfGoodsSoldAccount(account)
        )
        .reduce((total, account) => total + toNumber(account.amount), 0);

      const monthlyAccountingExpenses = toNumber(
        profitLossSummary?.total_expense
      );

      const monthlyExpenses = Math.max(
        0,
        monthlyAccountingExpenses - monthlyCogs
      );

      const currentMonthPurchases = purchases.filter((purchase) =>
        isCurrentMonth(purchase.purchase_date)
      );

      const monthlyPurchase = currentMonthPurchases.reduce(
        (total, purchase) => total + toNumber(purchase.grand_total),
        0
      );

      const stockValue = products.reduce(
        (total, product) => total + toNumber(product.inventory_value),
        0
      );

      const lowStockCount = products.filter(
        (product) =>
          toNumber(product.quantity) <=
          toNumber(product.low_stock_alert)
      ).length;

      const saleTransactions: Transaction[] = sales.map((sale) => {
        const customer = getJoinedLedger(sale.customer);

        return {
          id: `sale-${sale.id}`,
          targetId: sale.id,
          title: sale.invoice_number || "Sales Invoice",
          subtitle: `Sale to ${customer?.name || "Customer"}`,
          amount: toNumber(sale.grand_total),
          type: "sale",
          date: sale.created_at || sale.invoice_date,
        };
      });

      const purchaseTransactions: Transaction[] = purchases.map(
        (purchase) => {
          const supplier = getJoinedLedger(purchase.supplier);

          return {
            id: `purchase-${purchase.id}`,
            targetId: purchase.id,
            title: purchase.bill_number || "Purchase Bill",
            subtitle: `Purchase from ${supplier?.name || "Supplier"}`,
            amount: toNumber(purchase.grand_total),
            type: "purchase",
            date: purchase.created_at || purchase.purchase_date,
          };
        }
      );

      const expenseTransactions: Transaction[] = expenses.map((expense) => ({
        id: `expense-${expense.id}`,
        targetId: expense.id,
        title: expense.category || "Business Expense",
        subtitle:
          expense.description ||
          `Paid by ${expense.payment_mode || "Cash"}`,
        amount: toNumber(expense.amount),
        type: "expense",
        date: expense.created_at || expense.expense_date,
      }));

      const recentTransactions = [
        ...saleTransactions,
        ...purchaseTransactions,
        ...expenseTransactions,
      ]
        .sort((first, second) => {
          const firstDate = toValidDate(first.date)?.getTime() || 0;
          const secondDate = toValidDate(second.date)?.getTime() || 0;

          return secondDate - firstDate;
        })
        .slice(0, 7);

      setDashboardData({
        totalProducts: products.length,
        monthlyRevenue,
        monthlyPurchase,
        monthlyExpenses,
        monthlyCogs,
        monthlyNetProfit: toNumber(profitLossSummary?.net_profit),
        stockValue,
        lowStockCount,
        recentTransactions,
      });
    } catch (error) {
      setDashboardData(initialDashboardData);

      showMessage(
        error instanceof Error
          ? error.message
          : "Dashboard data could not be loaded from the cloud database."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadDashboardData();

    const refreshEvents = [
      "vertexerp-products-updated",
      "vertexerp-sales-updated",
      "vertexerp-purchases-updated",
      "vertexerp-expenses-updated",
      "vertexerp-active-company-updated",
    ];

    refreshEvents.forEach((eventName) => {
      window.addEventListener(eventName, loadDashboardData);
    });

    return () => {
      refreshEvents.forEach((eventName) => {
        window.removeEventListener(eventName, loadDashboardData);
      });
    };
  }, []);

  const currentMonthLabel = new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(new Date());

  const netProfitIsPositive = dashboardData.monthlyNetProfit >= 0;

  const loadingValue = (value: string) => (isLoading ? "..." : value);

  return (
    <>
      {message && (
        <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 sm:mb-6 sm:text-base">
          {message}
        </div>
      )}

      <section className="relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-white via-blue-50 to-indigo-100 p-4 shadow-xl shadow-blue-950/5 sm:p-6 md:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blue-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-indigo-300/20 blur-3xl" />

        <div className="relative flex flex-col gap-5 sm:gap-7">
          <div className="flex flex-col gap-5 sm:gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-700">
                Business Pulse
              </p>

              <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl md:text-4xl">
                Your {currentMonthLabel} performance at a glance.
              </h2>

              <p className="mt-3 max-w-xl leading-7 text-slate-600">
                Track revenue, operating expenses, inventory and accounting
                monthly net profit from one clean workspace.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Link
                href="/sales"
                className="min-w-0 rounded-2xl border border-blue-200 bg-white/90 px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
              >
                <div className="flex items-center gap-2 text-slate-900">
                  <ShoppingCart className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-semibold">New Sale</span>
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  Create invoice
                </p>
              </Link>

              <Link
                href="/expenses"
                className="min-w-0 rounded-2xl border border-orange-200 bg-white/90 px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md"
              >
                <div className="flex items-center gap-2 text-slate-900">
                  <WalletCards className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-semibold">Add Expense</span>
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  Record cost
                </p>
              </Link>

              <Link
                href="/reports"
                className="min-w-0 rounded-2xl border border-emerald-200 bg-white/90 px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
              >
                <div className="flex items-center gap-2 text-slate-900">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-semibold">View Reports</span>
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  Analyze profit
                </p>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 border-t border-slate-200 pt-5 sm:grid-cols-3 sm:pt-6">
            <div className="rounded-2xl border border-white bg-white/70 px-4 py-4 shadow-sm">
              <p className="text-sm font-medium text-slate-500">
                Monthly Revenue
              </p>

              <p className="mt-1 text-2xl font-bold text-blue-700">
                {loadingValue(formatCurrency(dashboardData.monthlyRevenue))}
              </p>
            </div>

            <div className="rounded-2xl border border-white bg-white/70 px-4 py-4 shadow-sm">
              <p className="text-sm font-medium text-slate-500">
                Operating Expenses
              </p>

              <p className="mt-1 text-2xl font-bold text-orange-600">
                {loadingValue(formatCurrency(dashboardData.monthlyExpenses))}
              </p>
            </div>

            <div className="rounded-2xl border border-white bg-white/70 px-4 py-4 shadow-sm">
              <p className="text-sm font-medium text-slate-500">
                Accounting Net Profit
              </p>

              <p
                className="mt-1 text-2xl font-bold"
                style={{
                  color: netProfitIsPositive ? "#059669" : "#dc2626",
                }}
              >
                {loadingValue(
                  formatCurrency(dashboardData.monthlyNetProfit)
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 sm:mt-8 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
        <div className="group rounded-3xl border border-blue-100 bg-white p-4 shadow-lg shadow-blue-950/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl sm:p-6">
          <div className="flex items-start justify-between">
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
              <TrendingUp className="h-6 w-6" />
            </div>

            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              This Month
            </span>
          </div>

          <p className="mt-4 text-sm font-semibold uppercase tracking-wider text-slate-500 sm:mt-6">
            Sales Revenue
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-900">
            {loadingValue(formatCurrency(dashboardData.monthlyRevenue))}
          </p>

          <p className="mt-3 text-sm text-slate-500">
            Revenue from posted accounting vouchers.
          </p>
        </div>

        <div className="group rounded-3xl border border-orange-100 bg-white p-4 shadow-lg shadow-orange-950/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl sm:p-6">
          <div className="flex items-start justify-between">
            <div className="rounded-2xl bg-orange-50 p-3 text-orange-600">
              <WalletCards className="h-6 w-6" />
            </div>

            <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
              This Month
            </span>
          </div>

          <p className="mt-4 text-sm font-semibold uppercase tracking-wider text-slate-500 sm:mt-6">
            Operating Expenses
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-900">
            {loadingValue(formatCurrency(dashboardData.monthlyExpenses))}
          </p>

          <p className="mt-3 text-sm text-slate-500">
            Rent, salary, transport and other saved expenses.
          </p>
        </div>

        <div className="group rounded-3xl border border-emerald-100 bg-white p-4 shadow-lg shadow-emerald-950/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl sm:p-6">
          <div className="flex items-start justify-between">
            <div
              className="rounded-2xl p-3"
              style={{
                backgroundColor: netProfitIsPositive ? "#ecfdf5" : "#fef2f2",
                color: netProfitIsPositive ? "#059669" : "#dc2626",
              }}
            >
              {netProfitIsPositive ? (
                <ArrowUpRight className="h-6 w-6" />
              ) : (
                <ArrowDownRight className="h-6 w-6" />
              )}
            </div>

            <span
              className="rounded-full px-3 py-1 text-xs font-bold"
              style={{
                backgroundColor: netProfitIsPositive ? "#ecfdf5" : "#fef2f2",
                color: netProfitIsPositive ? "#047857" : "#b91c1c",
              }}
            >
              Accounting
            </span>
          </div>

          <p className="mt-4 text-sm font-semibold uppercase tracking-wider text-slate-500 sm:mt-6">
            Net Profit
          </p>

          <p
            className="mt-2 text-3xl font-bold"
            style={{
              color: netProfitIsPositive ? "#059669" : "#dc2626",
            }}
          >
            {loadingValue(formatCurrency(dashboardData.monthlyNetProfit))}
          </p>

          <p className="mt-3 text-sm text-slate-500">
            Revenue minus COGS and accounting expenses.
          </p>
        </div>

        <div className="group rounded-3xl border border-purple-100 bg-white p-4 shadow-lg shadow-purple-950/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl sm:p-6">
          <div className="flex items-start justify-between">
            <div className="rounded-2xl bg-purple-50 p-3 text-purple-600">
              <ReceiptText className="h-6 w-6" />
            </div>

            <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700">
              This Month
            </span>
          </div>

          <p className="mt-4 text-sm font-semibold uppercase tracking-wider text-slate-500 sm:mt-6">
            Purchase Bills
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-900">
            {loadingValue(formatCurrency(dashboardData.monthlyPurchase))}
          </p>

          <p className="mt-3 text-sm text-slate-500">
            Total value of saved purchase bills.
          </p>
        </div>

        <div className="group rounded-3xl border border-indigo-100 bg-white p-4 shadow-lg shadow-indigo-950/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl sm:p-6">
          <div className="flex items-start justify-between">
            <div
              className="rounded-2xl p-3"
              style={{
                backgroundColor: "#eef2ff",
                color: "#4f46e5",
              }}
            >
              <Package className="h-6 w-6" />
            </div>

            <span
              className="rounded-full px-3 py-1 text-xs font-bold"
              style={{
                backgroundColor: "#eef2ff",
                color: "#4338ca",
              }}
            >
              Inventory
            </span>
          </div>

          <p className="mt-4 text-sm font-semibold uppercase tracking-wider text-slate-500 sm:mt-6">
            Total Products
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-900">
            {isLoading ? "..." : dashboardData.totalProducts}
          </p>

          <p className="mt-3 text-sm text-slate-500">
            Active products currently in your inventory.
          </p>
        </div>

        <div className="group rounded-3xl border border-red-100 bg-white p-4 shadow-lg shadow-red-950/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl sm:p-6">
          <div className="flex items-start justify-between">
            <div className="rounded-2xl bg-red-50 p-3 text-red-600">
              <TriangleAlert className="h-6 w-6" />
            </div>

            <span
              className="rounded-full px-3 py-1 text-xs font-bold"
              style={{
                backgroundColor:
                  dashboardData.lowStockCount > 0 ? "#fef2f2" : "#ecfdf5",
                color:
                  dashboardData.lowStockCount > 0 ? "#b91c1c" : "#047857",
              }}
            >
              {dashboardData.lowStockCount > 0 ? "Action Needed" : "Healthy"}
            </span>
          </div>

          <p className="mt-4 text-sm font-semibold uppercase tracking-wider text-slate-500 sm:mt-6">
            Low Stock Alert
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-900">
            {isLoading ? "..." : dashboardData.lowStockCount}
          </p>

          <p className="mt-3 text-sm text-slate-500">
            Products at or below their alert quantity.
          </p>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-5 sm:mt-8 sm:gap-6 xl:grid-cols-3">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-950/5 xl:col-span-2">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 md:px-8 md:py-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
                Live Activity
              </p>

              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                Recent Transactions
              </h2>

              <p className="mt-1 text-slate-600">
                Latest sales, purchases and operating expenses.
              </p>
            </div>

            <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
              {isLoading ? "..." : dashboardData.recentTransactions.length} Recent
            </span>
          </div>

          <div className="p-4 sm:p-5 md:p-6">
            {isLoading ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
                <p className="text-lg font-bold text-slate-800">
                  Loading cloud transactions...
                </p>
              </div>
            ) : dashboardData.recentTransactions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm">
                  <Plus className="h-6 w-6" />
                </div>

                <p className="mt-4 text-lg font-bold text-slate-800">
                  No transactions available yet
                </p>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Create a sale, purchase bill or business expense to see your
                  latest activity here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {dashboardData.recentTransactions.map((transaction) => {
                  const isSale = transaction.type === "sale";
                  const isPurchase = transaction.type === "purchase";
                  const linkHref = isSale
                    ? `/sales/invoice/${transaction.targetId}`
                    : isPurchase
                      ? `/purchase/bill/${transaction.targetId}`
                      : null;

                  const transactionTitle = linkHref ? (
                    <Link
                      href={linkHref}
                      className={`block truncate font-bold transition hover:underline ${
                        isSale
                          ? "text-blue-600 hover:text-blue-800"
                          : "text-purple-600 hover:text-purple-800"
                      }`}
                    >
                      {transaction.title}
                    </Link>
                  ) : (
                    <p className="truncate font-bold text-slate-900">
                      {transaction.title}
                    </p>
                  );

                  return (
                    <div
                      key={transaction.id}
                      className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 transition hover:border-slate-200 hover:bg-white hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                            isSale
                              ? "bg-emerald-100 text-emerald-700"
                              : isPurchase
                                ? "bg-purple-100 text-purple-700"
                                : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {isSale ? (
                            <ShoppingCart className="h-5 w-5" />
                          ) : isPurchase ? (
                            <ReceiptText className="h-5 w-5" />
                          ) : (
                            <CreditCard className="h-5 w-5" />
                          )}
                        </div>

                        <div className="min-w-0">
                          {transactionTitle}
                          <p className="mt-1 truncate text-sm text-slate-600">
                            {transaction.subtitle}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 sm:text-right">
                        <p
                          className="font-bold"
                          style={{
                            color: isSale
                              ? "#16a34a"
                              : isPurchase
                                ? "#9333ea"
                                : "#ea580c",
                          }}
                        >
                          {isSale ? "+" : "-"}
                          {formatCurrency(transaction.amount)}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {formatDate(transaction.date)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-950/5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p
                className="text-sm font-semibold uppercase tracking-[0.18em]"
                style={{ color: "#4f46e5" }}
              >
                Business Health
              </p>

              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                Accounting Summary
              </h2>
            </div>

            <div
              className="rounded-2xl p-3"
              style={{
                backgroundColor: "#eef2ff",
                color: "#4f46e5",
              }}
            >
              <Box className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-5 space-y-4 sm:mt-7">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <span className="text-sm font-medium text-slate-600">
                Sales Revenue
              </span>

              <span className="font-bold text-blue-700">
                {loadingValue(formatCurrency(dashboardData.monthlyRevenue))}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <span className="text-sm font-medium text-slate-600">
                Cost of Goods Sold
              </span>

              <span className="font-bold text-purple-700">
                {loadingValue(
                  formatCurrency(dashboardData.monthlyCogs)
                )}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <span className="text-sm font-medium text-slate-600">
                Operating Expenses
              </span>

              <span className="font-bold text-orange-600">
                {loadingValue(formatCurrency(dashboardData.monthlyExpenses))}
              </span>
            </div>

            <div className="rounded-2xl bg-slate-900 p-5 text-white">
              <p className="text-sm font-medium text-slate-300">
                Accounting Net Profit
              </p>

              <p
                className="mt-2 text-3xl font-bold"
                style={{
                  color: netProfitIsPositive ? "#6ee7b7" : "#fca5a5",
                }}
              >
                {loadingValue(
                  formatCurrency(dashboardData.monthlyNetProfit)
                )}
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-400">
                Based on posted accounting vouchers and COGS snapshots.
              </p>
            </div>
          </div>

          <div
            className="mt-5 rounded-2xl border p-4 sm:mt-6 sm:p-5"
            style={{
              backgroundColor: "#eff6ff",
              borderColor: "#bfdbfe",
            }}
          >
            <p className="font-semibold" style={{ color: "#1e3a8a" }}>
              Inventory Value
            </p>

            <p
              className="mt-2 text-3xl font-bold"
              style={{ color: "#2563eb" }}
            >
              {loadingValue(formatCurrency(dashboardData.stockValue))}
            </p>

            <p
              className="mt-2 text-sm leading-6"
              style={{ color: "#1d4ed8" }}
            >
              Current stock value based on weighted-average inventory
              value.
            </p>
          </div>

          <Link
            href="/reports"
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 sm:mt-6"
          >
            Open Accounting Reports
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </aside>
      </section>
    </>
  );
}