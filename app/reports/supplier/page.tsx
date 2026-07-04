"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

type Ledger = {
  id: string;
  name: string;
  group: string;
  openingBalance: number;
  mobile: string;
  email: string;
  gst: string;
  address: string;
};

type Purchase = {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierMobile: string;
  paymentMode: string;
  grandTotal: number;
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
  pendingAmount: number;
};

const LEDGERS_KEY = "VertexERP_ledgers";
const PURCHASES_KEY = "VertexERP_purchases";

function formatCurrency(amount: number) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

export default function SupplierReportPage() {
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    try {
      const savedLedgers = window.localStorage.getItem(LEDGERS_KEY);
      const savedPurchases = window.localStorage.getItem(PURCHASES_KEY);

      const parsedLedgers = savedLedgers ? JSON.parse(savedLedgers) : [];
      const parsedPurchases = savedPurchases
        ? JSON.parse(savedPurchases)
        : [];

      setLedgers(Array.isArray(parsedLedgers) ? parsedLedgers : []);
      setPurchases(Array.isArray(parsedPurchases) ? parsedPurchases : []);
    } catch {
      setLedgers([]);
      setPurchases([]);
    }
  }, []);

  const supplierRows = useMemo(() => {
    const supplierLedgers = ledgers.filter(
      (ledger) => ledger.group === "Supplier"
    );

    const supplierMap = new Map<string, SupplierReportRow>();

    supplierLedgers.forEach((supplier) => {
      supplierMap.set(supplier.id, {
        id: supplier.id,
        name: supplier.name,
        mobile: supplier.mobile || "",
        email: supplier.email || "",
        gst: supplier.gst || "",
        openingBalance: Number(supplier.openingBalance || 0),
        billCount: 0,
        totalPurchase: 0,
        pendingAmount: 0,
      });
    });

    purchases.forEach((purchase) => {
      const supplierId = purchase.supplierId || purchase.supplierName;

      if (!supplierMap.has(supplierId)) {
        supplierMap.set(supplierId, {
          id: supplierId,
          name: purchase.supplierName || "Unknown Supplier",
          mobile: purchase.supplierMobile || "",
          email: "",
          gst: "",
          openingBalance: 0,
          billCount: 0,
          totalPurchase: 0,
          pendingAmount: 0,
        });
      }

      const supplier = supplierMap.get(supplierId);

      if (!supplier) {
        return;
      }

      supplier.billCount += 1;
      supplier.totalPurchase += Number(purchase.grandTotal || 0);

      if (purchase.paymentMode === "Credit") {
        supplier.pendingAmount += Number(purchase.grandTotal || 0);
      }
    });

    return Array.from(supplierMap.values()).sort(
      (a, b) => b.totalPurchase - a.totalPurchase
    );
  }, [ledgers, purchases]);

  const filteredSuppliers = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    if (!search) {
      return supplierRows;
    }

    return supplierRows.filter(
      (supplier) =>
        supplier.name.toLowerCase().includes(search) ||
        supplier.mobile.includes(search) ||
        supplier.email.toLowerCase().includes(search)
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

  const activeSuppliers = supplierRows.filter(
    (supplier) => supplier.billCount > 0
  ).length;

  function resetSearch() {
    setSearchTerm("");
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
                🏢 Supplier Report
              </h1>

              <p className="mt-2 text-lg text-slate-600">
                Review supplier purchases, bill activity and pending payables.
              </p>
            </div>

            <Link
              href="/reports"
              className="w-fit rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              ← Back to Reports
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">Total Suppliers</p>

              <h2 className="mt-3 text-4xl font-bold text-blue-600">
                {supplierRows.length}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Supplier ledgers and saved purchase suppliers
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">Active Suppliers</p>

              <h2 className="mt-3 text-4xl font-bold text-green-600">
                {activeSuppliers}
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
                {formatCurrency(totalPurchase)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Total value of all saved purchase bills
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">Pending Payable</p>

              <h2 className="mt-3 text-4xl font-bold text-orange-500">
                {formatCurrency(totalPending)}
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
                placeholder="Search supplier by name, mobile or email..."
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
                  {filteredSuppliers.length} supplier
                  {filteredSuppliers.length !== 1 ? "s" : ""} found
                </p>
              </div>

              <div className="rounded-full bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700">
                Purchases: {formatCurrency(totalPurchase)}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1150px]">
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
                      Pending Payable
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredSuppliers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
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