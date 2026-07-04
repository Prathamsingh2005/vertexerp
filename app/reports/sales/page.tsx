"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

type SaleItem = {
  productId: string;
  productName: string;
  quantity: number;
  rate: number;
  amount: number;
};

type Sale = {
  id: string;
  invoiceNumber: string;
  date: string;
  paymentMode: string;
  customerName: string;
  customerMobile: string;
  grandTotal: number;
  items: SaleItem[];
};

const SALES_KEY = "VertexERP_sales";

function formatCurrency(amount: number) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

export default function SalesReportPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    try {
      const savedSales = window.localStorage.getItem(SALES_KEY);
      const parsedSales = savedSales ? JSON.parse(savedSales) : [];

      setSales(Array.isArray(parsedSales) ? parsedSales : []);
    } catch {
      setSales([]);
    }
  }, []);

  const filteredSales = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return sales.filter((sale) => {
      const matchesSearch =
        !search ||
        sale.invoiceNumber.toLowerCase().includes(search) ||
        sale.customerName.toLowerCase().includes(search) ||
        (sale.customerMobile || "").includes(search);

      const matchesFromDate = !fromDate || sale.date >= fromDate;
      const matchesToDate = !toDate || sale.date <= toDate;

      return matchesSearch && matchesFromDate && matchesToDate;
    });
  }, [sales, searchTerm, fromDate, toDate]);

  const totalSales = filteredSales.reduce(
    (total, sale) => total + Number(sale.grandTotal || 0),
    0
  );

  const paidSales = filteredSales
    .filter((sale) => sale.paymentMode !== "Credit")
    .reduce((total, sale) => total + Number(sale.grandTotal || 0), 0);

  const pendingSales = filteredSales
    .filter((sale) => sale.paymentMode === "Credit")
    .reduce((total, sale) => total + Number(sale.grandTotal || 0), 0);

  function resetFilters() {
    setSearchTerm("");
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
                🛒 Sales Report
              </h1>

              <p className="mt-2 text-lg text-slate-600">
                Review sales invoices, customer details and payment status.
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
              <p className="font-medium text-slate-600">Total Sales</p>

              <h2 className="mt-3 text-4xl font-bold text-blue-600">
                {formatCurrency(totalSales)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                From filtered invoices
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">Paid Amount</p>

              <h2 className="mt-3 text-4xl font-bold text-green-600">
                {formatCurrency(paidSales)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Cash, UPI, bank transfer and card payments
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">Pending Amount</p>

              <h2 className="mt-3 text-4xl font-bold text-orange-500">
                {formatCurrency(pendingSales)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Credit invoices pending for collection
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
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
              className="mt-4 rounded-xl border border-slate-300 bg-white px-5 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Reset Filters
            </button>
          </div>

          <div className="mt-8 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-8 py-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Sales Invoices
                </h2>

                <p className="mt-1 text-slate-600">
                  {filteredSales.length} invoice
                  {filteredSales.length !== 1 ? "s" : ""} found
                </p>
              </div>

              <div className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                Total: {formatCurrency(totalSales)}
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
                  {filteredSales.length === 0 ? (
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
                    filteredSales.map((sale) => (
                      <tr
                        key={sale.id}
                        className="border-b border-slate-100 transition hover:bg-blue-50"
                      >
                        <td className="px-6 py-5">
                          <p className="font-bold text-blue-600">
                            {sale.invoiceNumber}
                          </p>
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
                          {sale.date}
                        </td>

                        <td className="px-6 py-5 text-slate-700">
                          {sale.items.length} Item
                          {sale.items.length !== 1 ? "s" : ""}
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
                              sale.paymentMode === "Credit"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {sale.paymentMode === "Credit"
                              ? "Pending"
                              : "Paid"}
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