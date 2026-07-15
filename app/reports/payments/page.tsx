"use client";

import Link from "next/link";
import {
  Download,
  RefreshCw,
  Search,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ReportPageShell from "@/components/ReportPageShell";
import { usePermissions } from "@/hooks/usePermissions";
import { createClient } from "@/lib/supabase/client";

type PaymentType = "Customer Receipt" | "Supplier Payment";

type ProfileRow = {
  active_company_id: string | null;
};

type LedgerRow = {
  id: string;
  name: string;
};

type PaymentRow = {
  id: string;
  payment_type: PaymentType;
  party_id: string;
  payment_date: string;
  amount: number | string | null;
  payment_mode: string;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
};

type PaymentReportItem = {
  id: string;
  type: PaymentType;
  partyName: string;
  date: string;
  amount: number;
  paymentMode: string;
  referenceNumber: string;
  notes: string;
  createdAt: string;
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number) {
  return `₹${toNumber(value).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string) {
  if (!value) {
    return "—";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");

  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function PaymentReportPage() {
  return (
    <ReportPageShell
      requiredPermission="reports.view"
      title="Payment Report"
      eyebrow="Cash Flow Analytics"
      description="Review customer receipts, supplier payments, payment modes, references and filtered cash movement."
      icon="💳"
    >
      <PaymentReportContent />
    </ReportPageShell>
  );
}

function PaymentReportContent() {
  const { can } = usePermissions();
  const canViewPayments = can("payments.view");

  const [payments, setPayments] = useState<PaymentReportItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | PaymentType>("ALL");
  const [modeFilter, setModeFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(""), 4500);
  }

  async function loadPayments() {
    setIsLoading(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Please sign in to view the payment report.");
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("active_company_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      const companyId =
        (profile as ProfileRow | null)?.active_company_id || null;

      if (!companyId) {
        throw new Error(
          "Select an active company from the Companies page first."
        );
      }

      const [paymentsResponse, ledgersResponse] = await Promise.all([
        supabase
          .from("payments")
          .select(
            "id, payment_type, party_id, payment_date, amount, payment_mode, reference_number, notes, created_at"
          )
          .eq("company_id", companyId)
          .order("payment_date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("ledgers")
          .select("id, name")
          .eq("company_id", companyId),
      ]);

      if (paymentsResponse.error) {
        throw paymentsResponse.error;
      }

      if (ledgersResponse.error) {
        throw ledgersResponse.error;
      }

      const ledgerNames = new Map(
        ((ledgersResponse.data || []) as LedgerRow[]).map((ledger) => [
          ledger.id,
          ledger.name,
        ])
      );

      setPayments(
        ((paymentsResponse.data || []) as PaymentRow[]).map((payment) => ({
          id: payment.id,
          type: payment.payment_type,
          partyName: ledgerNames.get(payment.party_id) || "Unknown Party",
          date: payment.payment_date,
          amount: toNumber(payment.amount),
          paymentMode: payment.payment_mode || "Cash",
          referenceNumber: payment.reference_number || "",
          notes: payment.notes || "",
          createdAt: payment.created_at,
        }))
      );
    } catch (error) {
      setPayments([]);
      showMessage(
        error instanceof Error
          ? error.message
          : "Payment report data could not be loaded."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadPayments();

    const refreshEvents = [
      "vertexerp-payments-updated",
      "vertexerp-active-company-updated",
    ];

    refreshEvents.forEach((eventName) => {
      window.addEventListener(eventName, loadPayments);
    });

    return () => {
      refreshEvents.forEach((eventName) => {
        window.removeEventListener(eventName, loadPayments);
      });
    };
  }, []);

  const availableModes = useMemo(
    () =>
      Array.from(
        new Set(payments.map((payment) => payment.paymentMode).filter(Boolean))
      ).sort(),
    [payments]
  );

  const filteredPayments = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return payments.filter((payment) => {
      const matchesSearch =
        !search ||
        payment.partyName.toLowerCase().includes(search) ||
        payment.referenceNumber.toLowerCase().includes(search) ||
        payment.notes.toLowerCase().includes(search) ||
        payment.paymentMode.toLowerCase().includes(search);

      const matchesType =
        typeFilter === "ALL" || payment.type === typeFilter;
      const matchesMode =
        modeFilter === "ALL" || payment.paymentMode === modeFilter;
      const matchesFromDate = !fromDate || payment.date >= fromDate;
      const matchesToDate = !toDate || payment.date <= toDate;

      return (
        matchesSearch &&
        matchesType &&
        matchesMode &&
        matchesFromDate &&
        matchesToDate
      );
    });
  }, [payments, searchTerm, typeFilter, modeFilter, fromDate, toDate]);

  const totalReceipts = filteredPayments
    .filter((payment) => payment.type === "Customer Receipt")
    .reduce((total, payment) => total + payment.amount, 0);

  const totalSupplierPayments = filteredPayments
    .filter((payment) => payment.type === "Supplier Payment")
    .reduce((total, payment) => total + payment.amount, 0);

  const netCashMovement = totalReceipts - totalSupplierPayments;

  const averagePayment =
    filteredPayments.length > 0
      ? filteredPayments.reduce(
          (total, payment) => total + payment.amount,
          0
        ) / filteredPayments.length
      : 0;

  function resetFilters() {
    setSearchTerm("");
    setTypeFilter("ALL");
    setModeFilter("ALL");
    setFromDate("");
    setToDate("");
  }

  function exportPayments() {
    const rows: unknown[][] = [
      [
        "Date",
        "Type",
        "Party",
        "Payment Mode",
        "Reference",
        "Amount",
        "Notes",
      ],
      ...filteredPayments.map((payment) => [
        payment.date,
        payment.type,
        payment.partyName,
        payment.paymentMode,
        payment.referenceNumber,
        payment.amount,
        payment.notes,
      ]),
      [],
      ["Customer Receipts", totalReceipts],
      ["Supplier Payments", totalSupplierPayments],
      ["Net Cash Movement", netCashMovement],
    ];

    downloadCsv(
      `vertexerp-payment-report-${fromDate || "all"}-${toDate || "all"}.csv`,
      rows
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      {message && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 font-medium text-violet-700">
          {message}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-3xl border border-violet-100 bg-gradient-to-br from-white to-violet-50/60 p-5 shadow-xl shadow-violet-100/40 sm:p-6">
          <p className="font-medium text-slate-600">Customer Receipts</p>
          <p className="mt-3 break-words text-3xl font-black text-emerald-600 sm:text-4xl">
            {isLoading ? "..." : formatCurrency(totalReceipts)}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Money received from customers
          </p>
        </article>

        <article className="rounded-3xl border border-violet-100 bg-gradient-to-br from-white to-violet-50/60 p-5 shadow-xl shadow-violet-100/40 sm:p-6">
          <p className="font-medium text-slate-600">Supplier Payments</p>
          <p className="mt-3 break-words text-3xl font-black text-violet-700 sm:text-4xl">
            {isLoading ? "..." : formatCurrency(totalSupplierPayments)}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Money paid to suppliers
          </p>
        </article>

        <article className="rounded-3xl border border-violet-100 bg-gradient-to-br from-white to-violet-50/60 p-5 shadow-xl shadow-violet-100/40 sm:p-6">
          <p className="font-medium text-slate-600">Net Cash Movement</p>
          <p
            className={`mt-3 break-words text-3xl font-black sm:text-4xl ${
              netCashMovement >= 0 ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {isLoading ? "..." : formatCurrency(Math.abs(netCashMovement))}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {netCashMovement >= 0 ? "Net inflow" : "Net outflow"} in filtered
            entries
          </p>
        </article>

        <article className="rounded-3xl border border-violet-100 bg-gradient-to-br from-white to-violet-50/60 p-5 shadow-xl shadow-violet-100/40 sm:p-6">
          <p className="font-medium text-slate-600">Average Entry</p>
          <p className="mt-3 break-words text-3xl font-black text-violet-700 sm:text-4xl">
            {isLoading ? "..." : formatCurrency(averagePayment)}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Across {filteredPayments.length} filtered entries
          </p>
        </article>
      </section>

      <section className="rounded-3xl border border-violet-100 bg-white p-4 shadow-xl shadow-violet-100/40 sm:p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search party, reference, mode or notes..."
              className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-12 pr-4 text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(event.target.value as "ALL" | PaymentType)
            }
            className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
          >
            <option value="ALL">All Payment Types</option>
            <option value="Customer Receipt">Customer Receipts</option>
            <option value="Supplier Payment">Supplier Payments</option>
          </select>

          <select
            value={modeFilter}
            onChange={(event) => setModeFilter(event.target.value)}
            className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
          >
            <option value="ALL">All Modes</option>
            {availableModes.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={resetFilters}
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-50"
          >
            Reset Filters
          </button>

          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
          />

          <input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
          />

          <button
            type="button"
            onClick={loadPayments}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-5 py-3 font-bold text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            type="button"
            onClick={exportPayments}
            disabled={isLoading || filteredPayments.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-5 w-5" />
            Export CSV
          </button>

          {canViewPayments ? (
            <Link
              href="/payments"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <WalletCards className="h-5 w-5" />
              Open Payment Center
            </Link>
          ) : (
            <div className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-5 py-3 font-bold text-slate-500">
              <WalletCards className="h-5 w-5" />
              Payment access restricted
            </div>
          )}
        </div>
      </section>

      <section className="min-w-0 overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-xl shadow-violet-100/40">
        <div className="flex flex-col gap-3 border-b border-violet-200 bg-gradient-to-r from-violet-950 via-violet-800 to-violet-600 px-4 py-5 text-white sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 lg:py-6">
          <div>
            <h2 className="text-xl font-black text-white sm:text-2xl">
              Payment Entries
            </h2>
            <p className="mt-1 text-sm text-violet-100 sm:text-base">
              {isLoading
                ? "Loading payment report..."
                : `${filteredPayments.length} entr${
                    filteredPayments.length === 1 ? "y" : "ies"
                  } found`}
            </p>
          </div>

          <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white backdrop-blur">
            Net: {isLoading ? "..." : formatCurrency(netCashMovement)}
          </span>
        </div>

        <div className="p-4 md:hidden">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-slate-500">
              Loading payment report...
            </p>
          ) : filteredPayments.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              No payment entries match the selected filters.
            </p>
          ) : (
            <div className="space-y-4">
              {filteredPayments.map((payment) => {
                const isReceipt = payment.type === "Customer Receipt";

                return (
                  <article
                    key={payment.id}
                    className="rounded-2xl border border-violet-100 bg-violet-50/40 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-black text-slate-900">
                          {payment.partyName}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatDate(payment.date)} · {payment.paymentMode}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                          isReceipt
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-violet-100 text-violet-700"
                        }`}
                      >
                        {isReceipt ? "Receipt" : "Payment"}
                      </span>
                    </div>

                    <p
                      className={`mt-4 text-2xl font-black ${
                        isReceipt ? "text-emerald-600" : "text-violet-700"
                      }`}
                    >
                      {formatCurrency(payment.amount)}
                    </p>

                    <div className="mt-3 rounded-xl bg-white p-3 text-sm text-slate-600">
                      <p>
                        Reference: {payment.referenceNumber || "—"}
                      </p>
                      {payment.notes && (
                        <p className="mt-1 leading-6">{payment.notes}</p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="hidden max-w-full overflow-x-auto md:block">
          <table className="w-full min-w-[1050px] table-fixed">
            <colgroup>
              <col className="w-[130px]" />
              <col className="w-[190px]" />
              <col className="w-[220px]" />
              <col className="w-[150px]" />
              <col className="w-[180px]" />
              <col className="w-[150px]" />
              <col className="w-[260px]" />
            </colgroup>
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-left">
                {[
                  "Date",
                  "Type",
                  "Party",
                  "Mode",
                  "Reference",
                  "Amount",
                  "Notes",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="px-6 py-4 text-sm font-bold text-slate-700"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-14 text-center text-slate-500">
                    Loading payment report...
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-14 text-center text-slate-500">
                    No payment entries match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => {
                  const isReceipt = payment.type === "Customer Receipt";

                  return (
                    <tr
                      key={payment.id}
                      className="border-b border-slate-100 transition hover:bg-violet-50/60"
                    >
                      <td className="px-6 py-5 text-slate-700">
                        {formatDate(payment.date)}
                      </td>
                      <td className="px-6 py-5">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            isReceipt
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-violet-100 text-violet-700"
                          }`}
                        >
                          {payment.type}
                        </span>
                      </td>
                      <td className="px-6 py-5 font-bold text-slate-900">
                        {payment.partyName}
                      </td>
                      <td className="px-6 py-5 text-slate-700">
                        {payment.paymentMode}
                      </td>
                      <td className="px-6 py-5 text-slate-700">
                        {payment.referenceNumber || "—"}
                      </td>
                      <td
                        className={`px-6 py-5 text-right text-lg font-black ${
                          isReceipt ? "text-emerald-600" : "text-violet-700"
                        }`}
                      >
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="px-6 py-5 text-sm leading-6 text-slate-600">
                        {payment.notes || "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}