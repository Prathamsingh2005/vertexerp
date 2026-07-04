"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

type PaymentType = "Customer Receipt" | "Supplier Payment";

type Payment = {
  id: string;
  type: PaymentType;
  partyId: string;
  partyName: string;
  date: string;
  amount: number;
  paymentMode: string;
  referenceNumber: string;
  notes: string;
  createdAt: string;
};

const PAYMENTS_KEY = "VertexERP_payments";
const PAYMENTS_EVENT = "VertexERP-payments-updated";

function toNumber(value: unknown) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatCurrency(amount: number) {
  return `₹${toNumber(amount).toLocaleString("en-IN")}`;
}

function formatDate(dateValue: string) {
  if (!dateValue) {
    return "Not available";
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

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

export default function PaymentReportPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState(getToday());
  const [paymentType, setPaymentType] = useState("All");
  const [paymentMode, setPaymentMode] = useState("All");

  function loadPayments() {
    try {
      const savedPayments = window.localStorage.getItem(PAYMENTS_KEY);

      if (!savedPayments) {
        setPayments([]);
        return;
      }

      const parsedPayments = JSON.parse(savedPayments);

      setPayments(Array.isArray(parsedPayments) ? parsedPayments : []);
    } catch {
      setPayments([]);
    }
  }

  useEffect(() => {
    loadPayments();

    window.addEventListener(PAYMENTS_EVENT, loadPayments);
    window.addEventListener("storage", loadPayments);

    return () => {
      window.removeEventListener(PAYMENTS_EVENT, loadPayments);
      window.removeEventListener("storage", loadPayments);
    };
  }, []);

  const availableModes = useMemo(() => {
    const modes = new Set(
      payments
        .map((payment) => payment.paymentMode?.trim())
        .filter(Boolean)
    );

    return Array.from(modes).sort();
  }, [payments]);

  const filteredPayments = useMemo(() => {
    return payments
      .filter((payment) => {
        const matchesType =
          paymentType === "All" || payment.type === paymentType;

        const matchesMode =
          paymentMode === "All" || payment.paymentMode === paymentMode;

        const matchesStartDate =
          !startDate || payment.date >= startDate;

        const matchesEndDate = !endDate || payment.date <= endDate;

        return (
          matchesType &&
          matchesMode &&
          matchesStartDate &&
          matchesEndDate
        );
      })
      .sort((first, second) => {
        return second.date.localeCompare(first.date);
      });
  }, [payments, startDate, endDate, paymentType, paymentMode]);

  const totalReceipts = useMemo(() => {
    return filteredPayments
      .filter((payment) => payment.type === "Customer Receipt")
      .reduce((total, payment) => total + toNumber(payment.amount), 0);
  }, [filteredPayments]);

  const totalSupplierPayments = useMemo(() => {
    return filteredPayments
      .filter((payment) => payment.type === "Supplier Payment")
      .reduce((total, payment) => total + toNumber(payment.amount), 0);
  }, [filteredPayments]);

  const netCollection = totalReceipts - totalSupplierPayments;

  const modeSummary = useMemo(() => {
    const summaryMap = new Map<string, number>();

    filteredPayments.forEach((payment) => {
      const mode = payment.paymentMode || "Unknown";
      const currentAmount = summaryMap.get(mode) || 0;

      summaryMap.set(mode, currentAmount + toNumber(payment.amount));
    });

    return Array.from(summaryMap.entries())
      .map(([mode, amount]) => ({
        mode,
        amount,
      }))
      .sort((first, second) => second.amount - first.amount);
  }, [filteredPayments]);

  function clearFilters() {
    setStartDate("");
    setEndDate(getToday());
    setPaymentType("All");
    setPaymentMode("All");
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <div className="payment-report-sidebar">
        <Sidebar />
      </div>

      <div className="min-w-0 flex-1">
        <div className="payment-report-navbar">
          <Navbar />
        </div>

        <main className="payment-report-main p-6 md:p-8">
          <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-900">
                💳 Payment Report
              </h1>

              <p className="mt-2 text-lg text-slate-600">
                Analyze customer receipts and supplier payments.
              </p>
            </div>

            <div className="payment-report-no-print flex flex-wrap gap-3">
              <Link
                href="/payments"
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-100"
              >
                ← Payments
              </Link>

              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl px-5 py-3 font-bold text-white shadow-lg transition hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  backgroundColor: "#7e22ce",
                  color: "#ffffff",
                }}
              >
                🖨️ Print Report
              </button>
            </div>
          </div>

          <section className="payment-report-no-print rounded-3xl border border-slate-100 bg-white p-6 shadow-xl">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900">
                Report Filters
              </h2>

              <p className="mt-1 text-slate-600">
                Filter payment entries by date, transaction type and mode.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-5">
              <div>
                <label className="mb-2 block font-semibold text-slate-800">
                  Start Date
                </label>

                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block font-semibold text-slate-800">
                  End Date
                </label>

                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block font-semibold text-slate-800">
                  Transaction Type
                </label>

                <select
                  value={paymentType}
                  onChange={(event) => setPaymentType(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-800 outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                >
                  <option value="All">All Transactions</option>
                  <option value="Customer Receipt">
                    Customer Receipts
                  </option>
                  <option value="Supplier Payment">
                    Supplier Payments
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-2 block font-semibold text-slate-800">
                  Payment Mode
                </label>

                <select
                  value={paymentMode}
                  onChange={(event) => setPaymentMode(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-800 outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                >
                  <option value="All">All Modes</option>

                  {availableModes.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="w-full rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-100"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </section>

          <section className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">
                Customer Receipts
              </p>

              <h2
                className="mt-3 text-3xl font-bold"
                style={{ color: "#059669" }}
              >
                {formatCurrency(totalReceipts)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Total amount received from customers
              </p>
            </div>

            <div className="rounded-3xl border border-purple-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">
                Supplier Payments
              </p>

              <h2
                className="mt-3 text-3xl font-bold"
                style={{ color: "#7e22ce" }}
              >
                {formatCurrency(totalSupplierPayments)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Total amount paid to suppliers
              </p>
            </div>

            <div className="rounded-3xl border border-blue-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">
                Net Collection
              </p>

              <h2
                className="mt-3 text-3xl font-bold"
                style={{
                  color: netCollection >= 0 ? "#2563eb" : "#dc2626",
                }}
              >
                {formatCurrency(Math.abs(netCollection))}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                {netCollection >= 0
                  ? "More received than paid"
                  : "More paid than received"}
              </p>
            </div>

            <div className="rounded-3xl border border-orange-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">
                Payment Entries
              </p>

              <h2
                className="mt-3 text-3xl font-bold"
                style={{ color: "#ea580c" }}
              >
                {filteredPayments.length}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Entries matching current filters
              </p>
            </div>
          </section>

          <section className="mt-10 grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl xl:col-span-1">
              <div className="border-b border-slate-200 px-6 py-5">
                <h2 className="text-xl font-bold text-slate-900">
                  Payment Mode Summary
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  Total payments by mode
                </p>
              </div>

              <div className="divide-y divide-slate-100">
                {modeSummary.length === 0 ? (
                  <p className="px-6 py-12 text-center text-slate-500">
                    No payment data found.
                  </p>
                ) : (
                  modeSummary.map((item) => (
                    <div
                      key={item.mode}
                      className="flex items-center justify-between gap-4 px-6 py-4"
                    >
                      <p className="font-bold text-slate-800">
                        {item.mode}
                      </p>

                      <p
                        className="font-bold"
                        style={{ color: "#2563eb" }}
                      >
                        {formatCurrency(item.amount)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl xl:col-span-2">
              <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Payment Transactions
                  </h2>

                  <p className="mt-1 text-sm text-slate-600">
                    Detailed entries matching selected filters
                  </p>
                </div>

                <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">
                  Entries: {filteredPayments.length}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200 text-left">
                      <th className="px-6 py-4 text-sm font-bold text-slate-700">
                        Date
                      </th>

                      <th className="px-6 py-4 text-sm font-bold text-slate-700">
                        Type
                      </th>

                      <th className="px-6 py-4 text-sm font-bold text-slate-700">
                        Party
                      </th>

                      <th className="px-6 py-4 text-sm font-bold text-slate-700">
                        Mode
                      </th>

                      <th className="px-6 py-4 text-sm font-bold text-slate-700">
                        Reference
                      </th>

                      <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">
                        Amount
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredPayments.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-14 text-center text-slate-500"
                        >
                          <p className="text-lg font-semibold text-slate-700">
                            No payment entries found
                          </p>

                          <p className="mt-2">
                            Change filters or record a payment first.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredPayments.map((payment) => {
                        const isReceipt =
                          payment.type === "Customer Receipt";

                        return (
                          <tr
                            key={payment.id}
                            className="border-b border-slate-100 transition hover:bg-slate-50"
                          >
                            <td className="px-6 py-5 text-slate-700">
                              {formatDate(payment.date)}
                            </td>

                            <td className="px-6 py-5">
                              <span
                                className={
                                  isReceipt
                                    ? "rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700"
                                    : "rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-700"
                                }
                              >
                                {payment.type}
                              </span>
                            </td>

                            <td className="px-6 py-5">
                              <p className="font-bold text-slate-900">
                                {payment.partyName}
                              </p>

                              {payment.notes && (
                                <p className="mt-1 max-w-[250px] truncate text-sm text-slate-500">
                                  {payment.notes}
                                </p>
                              )}
                            </td>

                            <td className="px-6 py-5 text-slate-700">
                              {payment.paymentMode}
                            </td>

                            <td className="px-6 py-5 text-slate-700">
                              {payment.referenceNumber || "—"}
                            </td>

                            <td
                              className="px-6 py-5 text-right text-lg font-bold"
                              style={{
                                color: isReceipt
                                  ? "#059669"
                                  : "#7e22ce",
                              }}
                            >
                              {formatCurrency(payment.amount)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </main>
      </div>

      <style jsx global>{`
  @page {
    size: A4 landscape;
    margin: 8mm;
  }

  @media print {
    .payment-report-sidebar,
    .payment-report-navbar,
    .payment-report-no-print {
      display: none !important;
    }

    html,
    body {
      width: 100%;
      background: white !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .payment-report-main {
      padding: 0 !important;
    }

    .payment-report-main > div:first-child {
      margin-bottom: 12px !important;
    }

    .payment-report-main h1 {
      font-size: 24px !important;
    }

    .payment-report-main h2 {
      font-size: 16px !important;
    }

    .payment-report-main p {
      font-size: 10px !important;
    }

    .payment-report-main > section:nth-of-type(2) {
      display: grid !important;
      grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
      gap: 8px !important;
      margin-top: 12px !important;
    }

    .payment-report-main > section:nth-of-type(2) > div {
      padding: 12px !important;
      border-radius: 12px !important;
      box-shadow: none !important;
    }

    .payment-report-main > section:nth-of-type(2) h2 {
      margin-top: 6px !important;
      font-size: 20px !important;
    }

    .payment-report-main > section:nth-of-type(3) {
      display: grid !important;
      grid-template-columns: 30% 70% !important;
      gap: 10px !important;
      margin-top: 14px !important;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .payment-report-main > section:nth-of-type(3) > div {
      box-shadow: none !important;
      border-radius: 12px !important;
    }

    .payment-report-main .overflow-x-auto {
      overflow: visible !important;
    }

    .payment-report-main table {
      width: 100% !important;
      min-width: 0 !important;
      font-size: 9px !important;
    }

    .payment-report-main th,
    .payment-report-main td {
      padding: 6px !important;
      white-space: normal !important;
    }

    .payment-report-main thead {
      display: table-header-group;
    }

    .payment-report-main tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }
  }
`}</style>
    </div>
  );
}