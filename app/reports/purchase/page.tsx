"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

type PurchaseItem = {
  productId: string;
  productName: string;
  quantity: number;
  rate: number;
  amount: number;
};

type Purchase = {
  id: string;
  billNumber: string;
  date: string;
  paymentMode: string;
  supplierName: string;
  supplierMobile: string;
  grandTotal: number;
  items: PurchaseItem[];
};

const PURCHASES_KEY = "VertexERP_purchases";

function formatCurrency(amount: number) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

export default function PurchaseReportPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    try {
      const savedPurchases = window.localStorage.getItem(PURCHASES_KEY);

      const parsedPurchases = savedPurchases
        ? JSON.parse(savedPurchases)
        : [];

      setPurchases(
        Array.isArray(parsedPurchases) ? parsedPurchases : []
      );
    } catch {
      setPurchases([]);
    }
  }, []);

  const filteredPurchases = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return purchases.filter((purchase) => {
      const matchesSearch =
        !search ||
        purchase.billNumber.toLowerCase().includes(search) ||
        purchase.supplierName.toLowerCase().includes(search) ||
        (purchase.supplierMobile || "").includes(search);

      const matchesFromDate =
        !fromDate || purchase.date >= fromDate;

      const matchesToDate =
        !toDate || purchase.date <= toDate;

      return matchesSearch && matchesFromDate && matchesToDate;
    });
  }, [purchases, searchTerm, fromDate, toDate]);

  const totalPurchase = filteredPurchases.reduce(
    (total, purchase) =>
      total + Number(purchase.grandTotal || 0),
    0
  );

  const paidPurchase = filteredPurchases
    .filter((purchase) => purchase.paymentMode !== "Credit")
    .reduce(
      (total, purchase) =>
        total + Number(purchase.grandTotal || 0),
      0
    );

  const pendingPurchase = filteredPurchases
    .filter((purchase) => purchase.paymentMode === "Credit")
    .reduce(
      (total, purchase) =>
        total + Number(purchase.grandTotal || 0),
      0
    );

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
                🧾 Purchase Report
              </h1>

              <p className="mt-2 text-lg text-slate-600">
                Review supplier purchases, bill details and payment status.
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
              <p className="font-medium text-slate-600">
                Total Purchase
              </p>

              <h2 className="mt-3 text-4xl font-bold text-purple-600">
                {formatCurrency(totalPurchase)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                From filtered purchase bills
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">Paid Amount</p>

              <h2 className="mt-3 text-4xl font-bold text-green-600">
                {formatCurrency(paidPurchase)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Cash, UPI, bank transfer and card payments
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">
                Pending Amount
              </p>

              <h2 className="mt-3 text-4xl font-bold text-orange-500">
                {formatCurrency(pendingPurchase)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Credit purchases pending for payment
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
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
              className="mt-4 rounded-xl border border-slate-300 bg-white px-5 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Reset Filters
            </button>
          </div>

          <div className="mt-8 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-8 py-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Purchase Bills
                </h2>

                <p className="mt-1 text-slate-600">
                  {filteredPurchases.length} bill
                  {filteredPurchases.length !== 1 ? "s" : ""} found
                </p>
              </div>

              <div className="rounded-full bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700">
                Total: {formatCurrency(totalPurchase)}
              </div>
            </div>

            <div className="overflow-x-auto">
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
                  {filteredPurchases.length === 0 ? (
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
                    filteredPurchases.map((purchase) => (
                      <tr
                        key={purchase.id}
                        className="border-b border-slate-100 transition hover:bg-purple-50"
                      >
                        <td className="px-6 py-5">
                          <p className="font-bold text-purple-600">
                            {purchase.billNumber}
                          </p>
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
                          {purchase.date}
                        </td>

                        <td className="px-6 py-5 text-slate-700">
                          {purchase.items.length} Item
                          {purchase.items.length !== 1 ? "s" : ""}
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
                              purchase.paymentMode === "Credit"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {purchase.paymentMode === "Credit"
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