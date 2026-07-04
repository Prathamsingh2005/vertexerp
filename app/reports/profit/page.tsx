"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

type Product = {
  id: string;
  name: string;
  purchasePrice: number;
};

type SaleItem = {
  productId: string;
  productName: string;
  quantity: number;
  rate?: number;
  discount?: number;
  baseAmount?: number;
  gstAmount?: number;
  amount?: number;
};

type Sale = {
  id: string;
  invoiceNumber: string;
  date: string;
  customerName: string;
  paymentMode: string;
  subtotal?: number;
  gstTotal?: number;
  discountTotal?: number;
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

const PRODUCTS_KEY = "VertexERP_products";
const SALES_KEY = "VertexERP_sales";
const EXPENSES_KEY = "VertexERP_expenses";

const SALES_EVENT = "VertexERP-sales-updated";
const EXPENSES_EVENT = "VertexERP-expenses-updated";

function formatCurrency(amount: number) {
  return `₹${Number(amount || 0).toLocaleString("en-IN", {
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

function getNetSales(sale: Sale) {
  if (typeof sale.subtotal === "number") {
    return Math.max(
      0,
      Number(sale.subtotal || 0) - Number(sale.discountTotal || 0)
    );
  }

  return sale.items.reduce((total, item) => {
    const baseAmount =
      typeof item.baseAmount === "number"
        ? item.baseAmount
        : Number(item.amount || 0) - Number(item.gstAmount || 0);

    return total + Math.max(0, baseAmount - Number(item.discount || 0));
  }, 0);
}

function getGstAmount(sale: Sale) {
  if (typeof sale.gstTotal === "number") {
    return Number(sale.gstTotal || 0);
  }

  return sale.items.reduce(
    (total, item) => total + Number(item.gstAmount || 0),
    0
  );
}

export default function ProfitReportPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    function loadReportData() {
      try {
        const savedProducts = window.localStorage.getItem(PRODUCTS_KEY);
        const savedSales = window.localStorage.getItem(SALES_KEY);
        const savedExpenses = window.localStorage.getItem(EXPENSES_KEY);

        const parsedProducts = savedProducts
          ? JSON.parse(savedProducts)
          : [];

        const parsedSales = savedSales ? JSON.parse(savedSales) : [];

        const parsedExpenses = savedExpenses
          ? JSON.parse(savedExpenses)
          : [];

        setProducts(Array.isArray(parsedProducts) ? parsedProducts : []);
        setSales(Array.isArray(parsedSales) ? parsedSales : []);
        setExpenses(Array.isArray(parsedExpenses) ? parsedExpenses : []);
      } catch {
        setProducts([]);
        setSales([]);
        setExpenses([]);
      }
    }

    loadReportData();

    window.addEventListener(SALES_EVENT, loadReportData);
    window.addEventListener(EXPENSES_EVENT, loadReportData);

    return () => {
      window.removeEventListener(SALES_EVENT, loadReportData);
      window.removeEventListener(EXPENSES_EVENT, loadReportData);
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
      productCostMap.set(product.id, Number(product.purchasePrice || 0));
    });

    return filteredSales
      .map((sale) => {
        const netSales = getNetSales(sale);

        const estimatedCost = sale.items.reduce((total, item) => {
          const purchasePrice = productCostMap.get(item.productId) || 0;

          return total + Number(item.quantity || 0) * purchasePrice;
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
      .sort((a, b) => b.date.localeCompare(a.date));
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
    (total, expense) => total + Number(expense.amount || 0),
    0
  );

  const netProfit = grossProfit - totalOperatingExpenses;

  const grossMargin =
    totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  const netProfitMargin =
    totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  const totalGst = filteredSales.reduce(
    (total, sale) => total + getGstAmount(sale),
    0
  );

  function resetFilters() {
    setFromDate("");
    setToDate("");
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <div className="flex-1">
        <Navbar />

        <main className="p-8">
          <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-900">
                💰 Profit & Loss
              </h1>

              <p className="mt-2 text-lg text-slate-600">
                Analyze sales revenue, product cost, expenses and net profit.
              </p>
            </div>

            <Link
              href="/reports"
              className="w-fit rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              ← Back to Reports
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">Sales Revenue</p>

              <h2 className="mt-3 text-4xl font-bold text-blue-600">
                {formatCurrency(totalRevenue)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Sales excluding GST
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">
                Estimated Product Cost
              </p>

              <h2 className="mt-3 text-4xl font-bold text-purple-600">
                {formatCurrency(totalEstimatedCost)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Based on current purchase prices
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">
                Gross Profit Estimate
              </p>

              <h2
                className={`mt-3 text-4xl font-bold ${
                  grossProfit >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {formatCurrency(grossProfit)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Revenue minus product cost
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">
                Operating Expenses
              </p>

              <h2 className="mt-3 text-4xl font-bold text-orange-500">
                {formatCurrency(totalOperatingExpenses)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                {filteredExpenses.length} expense
                {filteredExpenses.length !== 1 ? "s" : ""} included
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">
                Net Profit Estimate
              </p>

              <h2
                className={`mt-3 text-4xl font-bold ${
                  netProfit >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {formatCurrency(netProfit)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Gross profit minus expenses
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">
                Net Profit Margin
              </p>

              <h2
                className={`mt-3 text-4xl font-bold ${
                  netProfitMargin >= 0
                    ? "text-emerald-600"
                    : "text-red-600"
                }`}
              >
                {netProfitMargin.toFixed(2)}%
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Profit percentage on revenue
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-3xl border border-blue-100 bg-blue-50 p-6">
              <p className="font-semibold text-blue-800">
                GST Collected on Sales
              </p>

              <p className="mt-2 text-3xl font-bold text-blue-600">
                {formatCurrency(totalGst)}
              </p>

              <p className="mt-2 text-sm text-blue-700">
                GST amount included in filtered sales invoices
              </p>
            </div>

            <div className="rounded-3xl border border-green-100 bg-green-50 p-6">
              <p className="font-semibold text-green-800">
                Gross Profit Margin
              </p>

              <p className="mt-2 text-3xl font-bold text-green-600">
                {grossMargin.toFixed(2)}%
              </p>

              <p className="mt-2 text-sm text-green-700">
                Margin before operating expenses
              </p>
            </div>

            <div className="rounded-3xl border border-orange-100 bg-orange-50 p-6">
              <p className="font-semibold text-orange-800">
                Calculation Note
              </p>

              <p className="mt-2 text-sm leading-6 text-orange-700">
                Net profit includes saved expenses. Product cost is still
                estimated using the current purchase price of each product.
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
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
                {profitRows.length} Invoice
                {profitRows.length !== 1 ? "s" : ""} •{" "}
                {filteredExpenses.length} Expense
                {filteredExpenses.length !== 1 ? "s" : ""}
              </div>

              <button
                type="button"
                onClick={resetFilters}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Reset Filters
              </button>
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-8 py-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Invoice-wise Profit Estimate
                </h2>

                <p className="mt-1 text-slate-600">
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
                Net Profit: {formatCurrency(netProfit)}
              </div>
            </div>

            <div className="overflow-x-auto">
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
                  {profitRows.length === 0 ? (
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
                            <p className="font-bold text-blue-600">
                              {row.invoiceNumber}
                            </p>
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