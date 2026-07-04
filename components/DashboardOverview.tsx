"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

type Product = {
  id: string;
  name: string;
  quantity: number;
  purchasePrice: number;
  lowStockAlert: number;
};

type SaleItem = {
  productId: string;
  quantity: number;
  baseAmount?: number;
  gstAmount?: number;
  discount?: number;
  amount?: number;
};

type Sale = {
  id: string;
  invoiceNumber: string;
  date: string;
  paymentMode: string;
  customerName: string;
  grandTotal: number;
  subtotal?: number;
  discountTotal?: number;
  createdAt?: string;
  items?: SaleItem[];
};

type Purchase = {
  id: string;
  billNumber: string;
  date: string;
  paymentMode: string;
  supplierName: string;
  grandTotal: number;
  createdAt?: string;
};

type Expense = {
  id: string;
  date: string;
  category: string;
  amount: number;
  paymentMode: string;
  description: string;
  createdAt?: string;
};

type Transaction = {
  id: string;
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
  monthlyEstimatedCost: number;
  monthlyNetProfit: number;
  stockValue: number;
  lowStockCount: number;
  recentTransactions: Transaction[];
};

const PRODUCTS_KEY = "VertexERP_products";
const SALES_KEY = "VertexERP_sales";
const PURCHASES_KEY = "VertexERP_purchases";
const EXPENSES_KEY = "VertexERP_expenses";

const SALES_EVENT = "VertexERP-sales-updated";
const PURCHASES_EVENT = "VertexERP-purchases-updated";
const EXPENSES_EVENT = "VertexERP-expenses-updated";

const initialDashboardData: DashboardData = {
  totalProducts: 0,
  monthlyRevenue: 0,
  monthlyPurchase: 0,
  monthlyExpenses: 0,
  monthlyEstimatedCost: 0,
  monthlyNetProfit: 0,
  stockValue: 0,
  lowStockCount: 0,
  recentTransactions: [],
};

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
  return `₹${Number(amount || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function getNetSales(sale: Sale) {
  if (typeof sale.subtotal === "number") {
    return Math.max(
      0,
      Number(sale.subtotal || 0) - Number(sale.discountTotal || 0)
    );
  }

  if (!Array.isArray(sale.items) || sale.items.length === 0) {
    return Number(sale.grandTotal || 0);
  }

  return sale.items.reduce((total, item) => {
    const baseAmount =
      typeof item.baseAmount === "number"
        ? item.baseAmount
        : Number(item.amount || 0) - Number(item.gstAmount || 0);

    return total + Math.max(0, baseAmount - Number(item.discount || 0));
  }, 0);
}

export default function DashboardOverview() {
  const [dashboardData, setDashboardData] =
    useState<DashboardData>(initialDashboardData);

  function loadDashboardData() {
    try {
      const savedProducts = window.localStorage.getItem(PRODUCTS_KEY);
      const savedSales = window.localStorage.getItem(SALES_KEY);
      const savedPurchases = window.localStorage.getItem(PURCHASES_KEY);
      const savedExpenses = window.localStorage.getItem(EXPENSES_KEY);

      const parsedProducts = savedProducts ? JSON.parse(savedProducts) : [];
      const parsedSales = savedSales ? JSON.parse(savedSales) : [];
      const parsedPurchases = savedPurchases
        ? JSON.parse(savedPurchases)
        : [];
      const parsedExpenses = savedExpenses ? JSON.parse(savedExpenses) : [];

      const products: Product[] = Array.isArray(parsedProducts)
        ? parsedProducts
        : [];

      const sales: Sale[] = Array.isArray(parsedSales) ? parsedSales : [];

      const purchases: Purchase[] = Array.isArray(parsedPurchases)
        ? parsedPurchases
        : [];

      const expenses: Expense[] = Array.isArray(parsedExpenses)
        ? parsedExpenses
        : [];

      const productCostMap = new Map<string, number>();

      products.forEach((product) => {
        productCostMap.set(
          product.id,
          Number(product.purchasePrice || 0)
        );
      });

      const currentMonthSales = sales.filter((sale) =>
        isCurrentMonth(sale.date)
      );

      const currentMonthPurchases = purchases.filter((purchase) =>
        isCurrentMonth(purchase.date)
      );

      const currentMonthExpenses = expenses.filter((expense) =>
        isCurrentMonth(expense.date)
      );

      const monthlyRevenue = currentMonthSales.reduce(
        (total, sale) => total + getNetSales(sale),
        0
      );

      const monthlyEstimatedCost = currentMonthSales.reduce(
        (total, sale) => {
          const saleCost = (sale.items || []).reduce(
            (itemTotal, item) => {
              const purchasePrice =
                productCostMap.get(item.productId) || 0;

              return (
                itemTotal +
                Number(item.quantity || 0) * Number(purchasePrice || 0)
              );
            },
            0
          );

          return total + saleCost;
        },
        0
      );

      const monthlyPurchase = currentMonthPurchases.reduce(
        (total, purchase) => total + Number(purchase.grandTotal || 0),
        0
      );

      const monthlyExpenses = currentMonthExpenses.reduce(
        (total, expense) => total + Number(expense.amount || 0),
        0
      );

      const stockValue = products.reduce(
        (total, product) =>
          total +
          Number(product.quantity || 0) *
            Number(product.purchasePrice || 0),
        0
      );

      const lowStockCount = products.filter(
        (product) =>
          Number(product.quantity || 0) <=
          Number(product.lowStockAlert || 0)
      ).length;

      const saleTransactions: Transaction[] = sales.map((sale) => ({
        id: `sale-${sale.id}`,
        title: sale.invoiceNumber || "Sales Invoice",
        subtitle: `Sale to ${sale.customerName || "Customer"}`,
        amount: Number(sale.grandTotal || 0),
        type: "sale",
        date: sale.createdAt || sale.date,
      }));

      const purchaseTransactions: Transaction[] = purchases.map(
        (purchase) => ({
          id: `purchase-${purchase.id}`,
          title: purchase.billNumber || "Purchase Bill",
          subtitle: `Purchase from ${purchase.supplierName || "Supplier"}`,
          amount: Number(purchase.grandTotal || 0),
          type: "purchase",
          date: purchase.createdAt || purchase.date,
        })
      );

      const expenseTransactions: Transaction[] = expenses.map((expense) => ({
        id: `expense-${expense.id}`,
        title: expense.category || "Business Expense",
        subtitle: expense.description || `Paid by ${expense.paymentMode}`,
        amount: Number(expense.amount || 0),
        type: "expense",
        date: expense.createdAt || expense.date,
      }));

      const recentTransactions = [
        ...saleTransactions,
        ...purchaseTransactions,
        ...expenseTransactions,
      ]
        .sort((a, b) => {
          const firstDate = toValidDate(a.date)?.getTime() || 0;
          const secondDate = toValidDate(b.date)?.getTime() || 0;

          return secondDate - firstDate;
        })
        .slice(0, 7);

      setDashboardData({
        totalProducts: products.length,
        monthlyRevenue,
        monthlyPurchase,
        monthlyExpenses,
        monthlyEstimatedCost,
        monthlyNetProfit:
          monthlyRevenue - monthlyEstimatedCost - monthlyExpenses,
        stockValue,
        lowStockCount,
        recentTransactions,
      });
    } catch {
      setDashboardData(initialDashboardData);
    }
  }

  useEffect(() => {
    function handleStorageChange(event: StorageEvent) {
      const relevantKeys = [
        PRODUCTS_KEY,
        SALES_KEY,
        PURCHASES_KEY,
        EXPENSES_KEY,
      ];

      if (event.key && relevantKeys.includes(event.key)) {
        loadDashboardData();
      }
    }

    loadDashboardData();

    window.addEventListener(SALES_EVENT, loadDashboardData);
    window.addEventListener(PURCHASES_EVENT, loadDashboardData);
    window.addEventListener(EXPENSES_EVENT, loadDashboardData);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener(SALES_EVENT, loadDashboardData);
      window.removeEventListener(PURCHASES_EVENT, loadDashboardData);
      window.removeEventListener(EXPENSES_EVENT, loadDashboardData);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const currentMonthLabel = new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(new Date());

  const netProfitIsPositive = dashboardData.monthlyNetProfit >= 0;

  return (
    <>
      <section className="relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-white via-blue-50 to-indigo-100 p-6 shadow-xl shadow-blue-950/5 md:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blue-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-indigo-300/20 blur-3xl" />

        <div className="relative flex flex-col gap-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-700">
                Business Pulse
              </p>

              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                Your {currentMonthLabel} performance at a glance.
              </h2>

              <p className="mt-3 max-w-xl leading-7 text-slate-600">
                Track revenue, operating expenses, inventory and estimated
                monthly net profit from one clean workspace.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/sales"
                className="min-w-[155px] flex-1 rounded-2xl border border-blue-200 bg-white/90 px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
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
                className="min-w-[155px] flex-1 rounded-2xl border border-orange-200 bg-white/90 px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md"
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
                href="/reports/profit"
                className="min-w-[155px] flex-1 rounded-2xl border border-emerald-200 bg-white/90 px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
              >
                <div className="flex items-center gap-2 text-slate-900">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-semibold">View P&amp;L</span>
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  Analyze profit
                </p>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 border-t border-slate-200 pt-6 sm:grid-cols-3">
            <div className="rounded-2xl border border-white bg-white/70 px-4 py-4 shadow-sm">
              <p className="text-sm font-medium text-slate-500">
                Monthly Revenue
              </p>

              <p className="mt-1 text-2xl font-bold text-blue-700">
                {formatCurrency(dashboardData.monthlyRevenue)}
              </p>
            </div>

            <div className="rounded-2xl border border-white bg-white/70 px-4 py-4 shadow-sm">
              <p className="text-sm font-medium text-slate-500">
                Operating Expenses
              </p>

              <p className="mt-1 text-2xl font-bold text-orange-600">
                {formatCurrency(dashboardData.monthlyExpenses)}
              </p>
            </div>

            <div className="rounded-2xl border border-white bg-white/70 px-4 py-4 shadow-sm">
              <p className="text-sm font-medium text-slate-500">
                Estimated Net Profit
              </p>

              <p
  className="mt-1 text-2xl font-bold"
  style={{
    color: netProfitIsPositive ? "#059669" : "#dc2626",
  }}
>
  {formatCurrency(dashboardData.monthlyNetProfit)}
</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <div className="group rounded-3xl border border-blue-100 bg-white p-6 shadow-lg shadow-blue-950/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl">
          <div className="flex items-start justify-between">
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
              <TrendingUp className="h-6 w-6" />
            </div>

            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              This Month
            </span>
          </div>

          <p className="mt-6 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Sales Revenue
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-900">
            {formatCurrency(dashboardData.monthlyRevenue)}
          </p>

          <p className="mt-3 text-sm text-slate-500">
            Revenue excluding GST from saved invoices.
          </p>
        </div>

        <div className="group rounded-3xl border border-orange-100 bg-white p-6 shadow-lg shadow-orange-950/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl">
          <div className="flex items-start justify-between">
            <div className="rounded-2xl bg-orange-50 p-3 text-orange-600">
              <WalletCards className="h-6 w-6" />
            </div>

            <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
              This Month
            </span>
          </div>

          <p className="mt-6 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Operating Expenses
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-900">
            {formatCurrency(dashboardData.monthlyExpenses)}
          </p>

          <p className="mt-3 text-sm text-slate-500">
            Rent, salary, transport and other saved expenses.
          </p>
        </div>

        <div className="group rounded-3xl border border-emerald-100 bg-white p-6 shadow-lg shadow-emerald-950/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl">
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
  Estimated
</span>
          </div>

          <p className="mt-6 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Net Profit
          </p>

          <p
  className="mt-2 text-3xl font-bold"
  style={{
    color: netProfitIsPositive ? "#059669" : "#dc2626",
  }}
>
  {formatCurrency(dashboardData.monthlyNetProfit)}
</p>

          <p className="mt-3 text-sm text-slate-500">
            Revenue minus product cost and operating expenses.
          </p>
        </div>

        <div className="group rounded-3xl border border-purple-100 bg-white p-6 shadow-lg shadow-purple-950/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl">
          <div className="flex items-start justify-between">
            <div className="rounded-2xl bg-purple-50 p-3 text-purple-600">
              <ReceiptText className="h-6 w-6" />
            </div>

            <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700">
              This Month
            </span>
          </div>

          <p className="mt-6 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Purchase Bills
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-900">
            {formatCurrency(dashboardData.monthlyPurchase)}
          </p>

          <p className="mt-3 text-sm text-slate-500">
            Total value of saved purchase bills.
          </p>
        </div>

        <div className="group rounded-3xl border border-indigo-100 bg-white p-6 shadow-lg shadow-indigo-950/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl">
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

          <p className="mt-6 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Total Products
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-900">
            {dashboardData.totalProducts}
          </p>

          <p className="mt-3 text-sm text-slate-500">
            Active products currently in your inventory.
          </p>
        </div>

        <div className="group rounded-3xl border border-red-100 bg-white p-6 shadow-lg shadow-red-950/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl">
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

          <p className="mt-6 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Low Stock Alert
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-900">
            {dashboardData.lowStockCount}
          </p>

          <p className="mt-3 text-sm text-slate-500">
            Products at or below their alert quantity.
          </p>
        </div>
      </section>

      <section className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-950/5 xl:col-span-2">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-6 md:flex-row md:items-center md:justify-between md:px-8">
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
              {dashboardData.recentTransactions.length} Recent
            </span>
          </div>

          <div className="p-5 md:p-6">
            {dashboardData.recentTransactions.length === 0 ? (
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
                         {isSale ? (
                         <Link
                       href={`/sales/invoice/${transaction.id.replace("sale-", "")}`}
                         className="block truncate font-bold text-blue-600 transition hover:text-blue-800 hover:underline"
                          >
                              {transaction.title}
                            </Link>
                            ) : (
  <p className="truncate font-bold text-slate-900">
    {transaction.title}
  </p>
                            )}
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

        <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5">
          <div className="flex items-center justify-between">
            <div>
              <p
  className="text-sm font-semibold uppercase tracking-[0.18em]"
  style={{ color: "#4f46e5" }}
>
  Business Health
</p>

              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                Monthly Summary
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

          <div className="mt-7 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <span className="text-sm font-medium text-slate-600">
                Sales Revenue
              </span>

              <span className="font-bold text-blue-700">
                {formatCurrency(dashboardData.monthlyRevenue)}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <span className="text-sm font-medium text-slate-600">
                Estimated Product Cost
              </span>

              <span className="font-bold text-purple-700">
                {formatCurrency(dashboardData.monthlyEstimatedCost)}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <span className="text-sm font-medium text-slate-600">
                Operating Expenses
              </span>

              <span className="font-bold text-orange-600">
                {formatCurrency(dashboardData.monthlyExpenses)}
              </span>
            </div>

            <div className="rounded-2xl bg-slate-900 p-5 text-white">
              <p className="text-sm font-medium text-slate-300">
                Estimated Net Profit
              </p>

              <p
  className="mt-2 text-3xl font-bold"
  style={{
    color: netProfitIsPositive ? "#6ee7b7" : "#fca5a5",
  }}
>
  {formatCurrency(dashboardData.monthlyNetProfit)}
</p>

              <p className="mt-2 text-xs leading-5 text-slate-400">
                Based on current product purchase prices and saved expenses.
              </p>
            </div>
          </div>

          <div
  className="mt-6 rounded-2xl border p-5"
  style={{
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
  }}
>
  <p
    className="font-semibold"
    style={{ color: "#1e3a8a" }}
  >
    Inventory Value
  </p>

  <p
    className="mt-2 text-3xl font-bold"
    style={{ color: "#2563eb" }}
  >
    {formatCurrency(dashboardData.stockValue)}
  </p>

  <p
    className="mt-2 text-sm leading-6"
    style={{ color: "#1d4ed8" }}
  >
    Current stock value based on available quantity and purchase
    prices.
  </p>
</div>

          <Link
            href="/reports/profit"
            className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            Open Profit &amp; Loss Report
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </aside>
      </section>
    </>
  );
}