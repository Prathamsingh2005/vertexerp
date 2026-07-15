"use client";

import { useEffect, useMemo, useState } from "react";
import ReportPageShell from "@/components/ReportPageShell";
import { createClient } from "@/lib/supabase/client";

type LedgerRow = {
  id: string;
  name: string;
  ledger_type: string;
  opening_balance: number | string | null;
  mobile: string | null;
  email: string | null;
  gst_number: string | null;
  address: string | null;
};

type PurchaseRow = {
  id: string;
  supplier_id: string | null;
  payment_mode: string;
  grand_total: number | string | null;
};

type PaymentRow = {
  id: string;
  payment_type: string;
  party_id: string | null;
  amount: number | string | null;
};

type DebitNoteRow = {
  id: string;
  source_purchase_id: string;
  grand_total: number | string | null;
  status: "POSTED" | "VOID";
};

type ProfileRow = {
  active_company_id: string | null;
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
  creditPurchase: number;
  debitNoteAmount: number;
  paidAmount: number;
  pendingAmount: number;
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

function isSupplierLedger(ledgerType: string) {
  return (
    String(ledgerType || "")
      .trim()
      .toLowerCase() === "supplier"
  );
}

function isCreditPayment(paymentMode: string) {
  return (
    String(paymentMode || "")
      .trim()
      .toLowerCase() === "credit"
  );
}

function isSupplierPayment(paymentType: string) {
  return (
    String(paymentType || "")
      .trim()
      .toLowerCase() === "supplier payment"
  );
}

export default function SupplierReportPage() {
  return (
    <ReportPageShell
      requiredPermission="reports.view"
      title="Supplier Report"
      eyebrow="Payable Analytics"
      description="Review supplier purchases, payments, Debit Note adjustments and outstanding payable balances."
      icon="🏢"
    >
      <SupplierReportContent />
    </ReportPageShell>
  );
}

function SupplierReportContent() {
  const [ledgers, setLedgers] = useState<LedgerRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [debitNotes, setDebitNotes] = useState<DebitNoteRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);

    window.setTimeout(() => {
      setMessage("");
    }, 4500);
  }

  async function loadSupplierReportData() {
    setIsLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setLedgers([]);
        setPurchases([]);
        setPayments([]);
        setDebitNotes([]);
        showMessage("Please sign in to view the supplier report.");
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
        setLedgers([]);
        setPurchases([]);
        setPayments([]);
        setDebitNotes([]);
        showMessage("Select an active company from the Companies page first.");
        return;
      }

      const [
        ledgersResponse,
        purchasesResponse,
        paymentsResponse,
        debitNotesResponse,
      ] = await Promise.all([
        supabase
          .from("ledgers")
          .select(
            "id, name, ledger_type, opening_balance, mobile, email, gst_number, address",
          )
          .eq("company_id", activeCompanyId)
          .order("name", { ascending: true }),
        supabase
          .from("purchases")
          .select("id, supplier_id, payment_mode, grand_total")
          .eq("company_id", activeCompanyId),
        supabase
          .from("payments")
          .select("id, payment_type, party_id, amount")
          .eq("company_id", activeCompanyId),
        supabase
          .from("debit_notes")
          .select("id, source_purchase_id, grand_total, status")
          .eq("company_id", activeCompanyId)
          .eq("status", "POSTED"),
      ]);

      if (ledgersResponse.error) {
        throw ledgersResponse.error;
      }

      if (purchasesResponse.error) {
        throw purchasesResponse.error;
      }

      if (paymentsResponse.error) {
        throw paymentsResponse.error;
      }

      if (debitNotesResponse.error) {
        throw debitNotesResponse.error;
      }

      setLedgers((ledgersResponse.data || []) as LedgerRow[]);
      setPurchases((purchasesResponse.data || []) as PurchaseRow[]);
      setPayments((paymentsResponse.data || []) as PaymentRow[]);
      setDebitNotes((debitNotesResponse.data || []) as DebitNoteRow[]);
    } catch (error) {
      setLedgers([]);
      setPurchases([]);
      setPayments([]);
      setDebitNotes([]);

      showMessage(
        error instanceof Error
          ? error.message
          : "Supplier report data could not be loaded from the cloud database.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadSupplierReportData();

    const refreshEvents = [
      "vertexerp-ledgers-updated",
      "vertexerp-purchases-updated",
      "vertexerp-payments-updated",
      "vertexerp-gst-data-updated",
      "vertexerp-active-company-updated",
    ];

    refreshEvents.forEach((eventName) => {
      window.addEventListener(eventName, loadSupplierReportData);
    });

    return () => {
      refreshEvents.forEach((eventName) => {
        window.removeEventListener(eventName, loadSupplierReportData);
      });
    };
  }, []);

  const supplierRows = useMemo<SupplierReportRow[]>(() => {
    const supplierMap = new Map<string, SupplierReportRow>();

    ledgers
      .filter((ledger) => isSupplierLedger(ledger.ledger_type))
      .forEach((supplier) => {
        supplierMap.set(supplier.id, {
          id: supplier.id,
          name: supplier.name || "Unnamed Supplier",
          mobile: supplier.mobile || "",
          email: supplier.email || "",
          gst: supplier.gst_number || "",
          openingBalance: toNumber(supplier.opening_balance),
          billCount: 0,
          totalPurchase: 0,
          creditPurchase: 0,
          debitNoteAmount: 0,
          paidAmount: 0,
          pendingAmount: 0,
        });
      });

    purchases.forEach((purchase) => {
      if (!purchase.supplier_id) {
        return;
      }

      const supplier = supplierMap.get(purchase.supplier_id);

      if (!supplier) {
        return;
      }

      const billAmount = toNumber(purchase.grand_total);

      supplier.billCount += 1;
      supplier.totalPurchase += billAmount;

      if (isCreditPayment(purchase.payment_mode)) {
        supplier.creditPurchase += billAmount;
      }
    });

    const purchaseById = new Map(
      purchases.map((purchase) => [purchase.id, purchase] as const),
    );

    debitNotes.forEach((note) => {
      const sourcePurchase = purchaseById.get(note.source_purchase_id);

      if (!sourcePurchase?.supplier_id) {
        return;
      }

      const supplier = supplierMap.get(sourcePurchase.supplier_id);

      if (!supplier) {
        return;
      }

      supplier.debitNoteAmount += toNumber(note.grand_total);
    });

    payments
      .filter((payment) => isSupplierPayment(payment.payment_type))
      .forEach((payment) => {
        if (!payment.party_id) {
          return;
        }

        const supplier = supplierMap.get(payment.party_id);

        if (!supplier) {
          return;
        }

        supplier.paidAmount += toNumber(payment.amount);
      });

    supplierMap.forEach((supplier) => {
      supplier.pendingAmount = Math.max(
        0,
        supplier.openingBalance +
          supplier.creditPurchase -
          supplier.debitNoteAmount -
          supplier.paidAmount,
      );
    });

    return Array.from(supplierMap.values()).sort(
      (first, second) => second.totalPurchase - first.totalPurchase,
    );
  }, [ledgers, purchases, payments, debitNotes]);

  const filteredSuppliers = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    if (!search) {
      return supplierRows;
    }

    return supplierRows.filter(
      (supplier) =>
        supplier.name.toLowerCase().includes(search) ||
        supplier.mobile.includes(search) ||
        supplier.email.toLowerCase().includes(search) ||
        supplier.gst.toLowerCase().includes(search),
    );
  }, [supplierRows, searchTerm]);

  const totalPurchase = supplierRows.reduce(
    (total, supplier) => total + supplier.totalPurchase,
    0,
  );

  const totalPending = supplierRows.reduce(
    (total, supplier) => total + supplier.pendingAmount,
    0,
  );

  const totalPaid = supplierRows.reduce(
    (total, supplier) => total + supplier.paidAmount,
    0,
  );

  const totalDebitNotes = supplierRows.reduce(
    (total, supplier) => total + supplier.debitNoteAmount,
    0,
  );

  const activeSuppliers = supplierRows.filter(
    (supplier) => supplier.billCount > 0,
  ).length;

  function resetSearch() {
    setSearchTerm("");
  }

  return (
    <div className="min-w-0 space-y-6">
      {message && (
        <div className="mb-5 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-medium text-violet-700 sm:mb-6 sm:text-base">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
        <div className="rounded-3xl border border-violet-100 bg-white p-5 shadow-lg sm:p-6">
          <p className="font-medium text-slate-600">Total Suppliers</p>

          <h2 className="mt-3 break-words text-3xl font-bold text-violet-700 sm:text-4xl">
            {isLoading ? "..." : supplierRows.length}
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Supplier ledgers in active company
          </p>
        </div>

        <div className="rounded-3xl border border-violet-100 bg-white p-5 shadow-lg sm:p-6">
          <p className="font-medium text-slate-600">Active Suppliers</p>

          <h2 className="mt-3 break-words text-3xl font-bold text-green-600 sm:text-4xl">
            {isLoading ? "..." : activeSuppliers}
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Suppliers with at least one purchase bill
          </p>
        </div>

        <div className="rounded-3xl border border-violet-100 bg-white p-5 shadow-lg sm:p-6">
          <p className="font-medium text-slate-600">Total Purchase Value</p>

          <h2 className="mt-3 break-words text-3xl font-bold text-violet-700 sm:text-4xl">
            {isLoading ? "..." : formatCurrency(totalPurchase)}
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Total value of all cloud purchase bills
          </p>
        </div>

        <div className="rounded-3xl border border-violet-100 bg-white p-5 shadow-lg sm:p-6">
          <p className="font-medium text-slate-600">Outstanding Payable</p>

          <h2 className="mt-3 break-words text-3xl font-bold text-orange-500 sm:text-4xl">
            {isLoading ? "..." : formatCurrency(totalPending)}
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Credit purchases minus supplier payments
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:mt-6 sm:grid-cols-2 sm:gap-6">
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5 sm:p-6">
          <p className="font-semibold text-emerald-800">
            Supplier Payments
          </p>

          <p className="mt-2 text-3xl font-bold text-emerald-600">
            {isLoading ? "..." : formatCurrency(totalPaid)}
          </p>

          <p className="mt-2 text-sm text-emerald-700">
            Payments recorded · Debit Note adjustments:{" "}
            {formatCurrency(totalDebitNotes)}
          </p>
        </div>

        <div className="rounded-3xl border border-violet-100 bg-violet-50 p-5 sm:p-6">
          <p className="font-semibold text-violet-800">Balance Calculation</p>

          <p className="mt-2 text-sm leading-6 text-violet-700">
            Outstanding = Opening Balance + Credit Purchases − Posted Debit
            Notes − Supplier Payments. VOID notes are excluded.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-violet-100 bg-white p-4 shadow-lg sm:mt-8 sm:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search supplier by name, mobile, email or GST..."
            className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none placeholder:text-slate-500 transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100 lg:col-span-3"
          />

          <button
            type="button"
            onClick={resetSearch}
            className="w-full rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-100 sm:w-auto"
          >
            Reset Search
          </button>
        </div>
      </div>

      <div className="mt-6 min-w-0 overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-xl sm:mt-8">
        <div className="flex flex-col gap-3 border-b border-violet-200 bg-gradient-to-r from-violet-950 via-violet-800 to-violet-600 px-4 py-5 text-white sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 lg:py-6">
          <div>
            <h2 className="text-xl font-black text-white sm:text-2xl">
              Supplier Summary
            </h2>

            <p className="mt-1 text-sm text-violet-100 sm:text-base">
              {isLoading
                ? "Loading supplier data from the cloud..."
                : `${filteredSuppliers.length} supplier${
                    filteredSuppliers.length !== 1 ? "s" : ""
                  } found`}
            </p>
          </div>

          <div className="rounded-full bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700">
            Purchases: {isLoading ? "..." : formatCurrency(totalPurchase)}
          </div>
        </div>

        <div className="p-4 md:hidden">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-slate-500">
              Loading supplier report from the cloud database...
            </p>
          ) : filteredSuppliers.length === 0 ? (
            <div className="py-10 text-center text-slate-500">
              <p className="text-lg font-semibold text-slate-700">
                No suppliers found
              </p>

              <p className="mt-2 text-sm">
                Add a Supplier ledger or create a purchase bill.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSuppliers.map((supplier) => (
                <article
                  key={supplier.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-bold text-slate-900">
                        {supplier.name}
                      </p>

                      <p className="mt-1 truncate text-sm text-slate-500">
                        {supplier.mobile ||
                          supplier.email ||
                          "No contact details"}
                      </p>
                    </div>

                    <span
                      className={
                        supplier.pendingAmount > 0
                          ? "shrink-0 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700"
                          : "shrink-0 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700"
                      }
                    >
                      {supplier.pendingAmount > 0 ? "Payment Due" : "Clear"}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Purchase Bills
                      </p>
                      <p className="mt-1 font-bold text-slate-900">
                        {supplier.billCount}
                      </p>
                    </div>

                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Opening Balance
                      </p>
                      <p className="mt-1 break-words font-semibold text-slate-800">
                        {formatCurrency(supplier.openingBalance)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Total Purchase
                      </p>
                      <p className="mt-1 break-words font-bold text-violet-700">
                        {formatCurrency(supplier.totalPurchase)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Debit Notes
                      </p>
                      <p className="mt-1 break-words font-bold text-orange-700">
                        {formatCurrency(supplier.debitNoteAmount)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Payments
                      </p>
                      <p className="mt-1 break-words font-bold text-emerald-700">
                        {formatCurrency(supplier.paidAmount)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl bg-orange-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">
                      Outstanding Payable
                    </p>

                    <p className="mt-1 text-xl font-bold text-orange-700">
                      {formatCurrency(supplier.pendingAmount)}
                    </p>
                  </div>

                  {(supplier.gst || supplier.email) && (
                    <div className="mt-3 space-y-1 text-sm text-slate-600">
                      {supplier.email && (
                        <p className="truncate">{supplier.email}</p>
                      )}
                      {supplier.gst && (
                        <p className="break-words">GST: {supplier.gst}</p>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="hidden max-w-full overflow-x-auto md:block">
          <table className="w-full min-w-[1380px]">
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
                  Debit Notes
                </th>

                <th className="px-6 py-4 text-sm font-bold text-slate-700">
                  Payments
                </th>

                <th className="px-6 py-4 text-sm font-bold text-slate-700">
                  Outstanding
                </th>

                <th className="px-6 py-4 text-sm font-bold text-slate-700">
                  Status
                </th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    Loading supplier report from the cloud database...
                  </td>
                </tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
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
                    className="border-b border-slate-100 transition hover:bg-violet-50"
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

                    <td className="px-6 py-5 font-bold text-violet-700">
                      {formatCurrency(supplier.totalPurchase)}
                    </td>

                    <td className="px-6 py-5 font-bold text-orange-700">
                      {formatCurrency(supplier.debitNoteAmount)}
                    </td>

                    <td className="px-6 py-5 font-bold text-emerald-600">
                      {formatCurrency(supplier.paidAmount)}
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
    </div>
  );
}