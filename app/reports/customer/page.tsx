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

type Sale = {
  id: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  paymentMode: string;
  grandTotal: number;
};

type CustomerReportRow = {
  id: string;
  name: string;
  mobile: string;
  email: string;
  gst: string;
  openingBalance: number;
  invoiceCount: number;
  totalSales: number;
  pendingAmount: number;
};

const LEDGERS_KEY = "VertexERP_ledgers";
const SALES_KEY = "VertexERP_sales";

function formatCurrency(amount: number) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

export default function CustomerReportPage() {
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    try {
      const savedLedgers = window.localStorage.getItem(LEDGERS_KEY);
      const savedSales = window.localStorage.getItem(SALES_KEY);

      const parsedLedgers = savedLedgers ? JSON.parse(savedLedgers) : [];
      const parsedSales = savedSales ? JSON.parse(savedSales) : [];

      setLedgers(Array.isArray(parsedLedgers) ? parsedLedgers : []);
      setSales(Array.isArray(parsedSales) ? parsedSales : []);
    } catch {
      setLedgers([]);
      setSales([]);
    }
  }, []);

  const customerRows = useMemo(() => {
    const customerLedgers = ledgers.filter(
      (ledger) => ledger.group === "Customer"
    );

    const customerMap = new Map<string, CustomerReportRow>();

    customerLedgers.forEach((customer) => {
      customerMap.set(customer.id, {
        id: customer.id,
        name: customer.name,
        mobile: customer.mobile || "",
        email: customer.email || "",
        gst: customer.gst || "",
        openingBalance: Number(customer.openingBalance || 0),
        invoiceCount: 0,
        totalSales: 0,
        pendingAmount: 0,
      });
    });

    sales.forEach((sale) => {
      const customerId = sale.customerId || sale.customerName;

      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          id: customerId,
          name: sale.customerName || "Unknown Customer",
          mobile: sale.customerMobile || "",
          email: "",
          gst: "",
          openingBalance: 0,
          invoiceCount: 0,
          totalSales: 0,
          pendingAmount: 0,
        });
      }

      const customer = customerMap.get(customerId);

      if (!customer) {
        return;
      }

      customer.invoiceCount += 1;
      customer.totalSales += Number(sale.grandTotal || 0);

      if (sale.paymentMode === "Credit") {
        customer.pendingAmount += Number(sale.grandTotal || 0);
      }
    });

    return Array.from(customerMap.values()).sort(
      (a, b) => b.totalSales - a.totalSales
    );
  }, [ledgers, sales]);

  const filteredCustomers = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    if (!search) {
      return customerRows;
    }

    return customerRows.filter(
      (customer) =>
        customer.name.toLowerCase().includes(search) ||
        customer.mobile.includes(search) ||
        customer.email.toLowerCase().includes(search)
    );
  }, [customerRows, searchTerm]);

  const totalSales = customerRows.reduce(
    (total, customer) => total + customer.totalSales,
    0
  );

  const totalPending = customerRows.reduce(
    (total, customer) => total + customer.pendingAmount,
    0
  );

  const activeCustomers = customerRows.filter(
    (customer) => customer.invoiceCount > 0
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
                👥 Customer Report
              </h1>

              <p className="mt-2 text-lg text-slate-600">
                Review customer sales, invoice activity and pending balances.
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
              <p className="font-medium text-slate-600">Total Customers</p>

              <h2 className="mt-3 text-4xl font-bold text-blue-600">
                {customerRows.length}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Customer ledgers and saved invoice customers
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">Active Customers</p>

              <h2 className="mt-3 text-4xl font-bold text-green-600">
                {activeCustomers}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Customers with at least one invoice
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">Total Customer Sales</p>

              <h2 className="mt-3 text-4xl font-bold text-purple-600">
                {formatCurrency(totalSales)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Revenue from all saved sales invoices
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">Pending Amount</p>

              <h2 className="mt-3 text-4xl font-bold text-orange-500">
                {formatCurrency(totalPending)}
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
                placeholder="Search customer by name, mobile or email..."
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
                  Customer Summary
                </h2>

                <p className="mt-1 text-slate-600">
                  {filteredCustomers.length} customer
                  {filteredCustomers.length !== 1 ? "s" : ""} found
                </p>
              </div>

              <div className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                Sales: {formatCurrency(totalSales)}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1150px]">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200 text-left">
                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Customer
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
                      Invoices
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Total Sales
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Pending Amount
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-6 py-12 text-center text-slate-500"
                      >
                        <p className="text-lg font-semibold text-slate-700">
                          No customers found
                        </p>

                        <p className="mt-2">
                          Add a Customer ledger or create an invoice.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((customer) => (
                      <tr
                        key={customer.id}
                        className="border-b border-slate-100 transition hover:bg-blue-50"
                      >
                        <td className="px-6 py-5">
                          <p className="font-bold text-slate-900">
                            {customer.name}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {customer.email || "No email added"}
                          </p>
                        </td>

                        <td className="px-6 py-5 text-slate-700">
                          {customer.mobile || "—"}
                        </td>

                        <td className="px-6 py-5 text-slate-700">
                          {customer.gst || "—"}
                        </td>

                        <td className="px-6 py-5 font-semibold text-slate-700">
                          {formatCurrency(customer.openingBalance)}
                        </td>

                        <td className="px-6 py-5 font-semibold text-slate-700">
                          {customer.invoiceCount}
                        </td>

                        <td className="px-6 py-5 font-bold text-blue-700">
                          {formatCurrency(customer.totalSales)}
                        </td>

                        <td className="px-6 py-5 font-bold text-orange-600">
                          {formatCurrency(customer.pendingAmount)}
                        </td>

                        <td className="px-6 py-5">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              customer.pendingAmount > 0
                                ? "bg-orange-100 text-orange-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {customer.pendingAmount > 0 ? "Payment Due" : "Clear"}
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