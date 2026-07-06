"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";

type PaymentType = "Customer Receipt" | "Supplier Payment";

type SaleRow = {
  customer_id: string | null;
  payment_mode: string;
  grand_total: number | string | null;
};

type PurchaseRow = {
  supplier_id: string | null;
  payment_mode: string;
  grand_total: number | string | null;
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

type LedgerRow = {
  id: string;
  name: string;
  ledger_type: string;
};

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

type PartyBalance = {
  id: string;
  name: string;
  totalCredit: number;
  paidAmount: number;
  outstanding: number;
};

type ProfileRow = {
  active_company_id: string | null;
};

function toNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatCurrency(amount: number) {
  return `₹${toNumber(amount).toLocaleString("en-IN")}`;
}

function isCreditPayment(paymentMode: string) {
  return String(paymentMode || "").trim().toLowerCase() === "credit";
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
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

function getBalances(
  entries: {
    partyId: string;
    partyName: string;
    amount: number;
  }[],
  paymentType: PaymentType,
  payments: Payment[]
) {
  const balanceMap = new Map<string, PartyBalance>();

  entries.forEach((entry) => {
    const existingParty = balanceMap.get(entry.partyId);

    if (existingParty) {
      existingParty.totalCredit += entry.amount;
      return;
    }

    balanceMap.set(entry.partyId, {
      id: entry.partyId,
      name: entry.partyName,
      totalCredit: entry.amount,
      paidAmount: 0,
      outstanding: 0,
    });
  });

  payments
    .filter((payment) => payment.type === paymentType)
    .forEach((payment) => {
      const party = balanceMap.get(payment.partyId);

      if (party) {
        party.paidAmount += toNumber(payment.amount);
      }
    });

  return Array.from(balanceMap.values())
    .map((party) => ({
      ...party,
      paidAmount: Math.min(party.paidAmount, party.totalCredit),
      outstanding: Math.max(0, party.totalCredit - party.paidAmount),
    }))
    .filter((party) => party.outstanding > 0)
    .sort((first, second) => second.outstanding - first.outstanding);
}

export default function PaymentsPage() {
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [ledgers, setLedgers] = useState<LedgerRow[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingPayment, setIsDeletingPayment] = useState(false);
  const [paymentPendingDeletion, setPaymentPendingDeletion] =
    useState<Payment | null>(null);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    type: "Customer Receipt" as PaymentType,
    partyId: "",
    date: getToday(),
    amount: "",
    paymentMode: "Cash",
    referenceNumber: "",
    notes: "",
  });

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);

    window.setTimeout(() => {
      setMessage("");
    }, 4000);
  }

  async function loadData() {
    setIsLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setSales([]);
        setPurchases([]);
        setPayments([]);
        setLedgers([]);
        setActiveCompanyId(null);
        showMessage("Please sign in before recording payments.");
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

      const companyId =
        (profile as ProfileRow | null)?.active_company_id || null;

      setActiveCompanyId(companyId);

      if (!companyId) {
        setSales([]);
        setPurchases([]);
        setPayments([]);
        setLedgers([]);
        showMessage("Select an active company from the Companies page first.");
        return;
      }

      const [
        salesResponse,
        purchasesResponse,
        paymentsResponse,
        ledgersResponse,
      ] = await Promise.all([
        supabase
          .from("sales")
          .select("customer_id, payment_mode, grand_total")
          .eq("company_id", companyId),
        supabase
          .from("purchases")
          .select("supplier_id, payment_mode, grand_total")
          .eq("company_id", companyId),
        supabase
          .from("payments")
          .select(
            "id, payment_type, party_id, payment_date, amount, payment_mode, reference_number, notes, created_at"
          )
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),
        supabase
          .from("ledgers")
          .select("id, name, ledger_type")
          .eq("company_id", companyId),
      ]);

      if (salesResponse.error) {
        throw salesResponse.error;
      }

      if (purchasesResponse.error) {
        throw purchasesResponse.error;
      }

      if (paymentsResponse.error) {
        throw paymentsResponse.error;
      }

      if (ledgersResponse.error) {
        throw ledgersResponse.error;
      }

      const nextLedgers = (ledgersResponse.data || []) as LedgerRow[];
      const ledgerNameById = new Map(
        nextLedgers.map((ledger) => [ledger.id, ledger.name])
      );

      setSales((salesResponse.data || []) as SaleRow[]);
      setPurchases((purchasesResponse.data || []) as PurchaseRow[]);
      setLedgers(nextLedgers);
      setPayments(
        ((paymentsResponse.data || []) as PaymentRow[]).map((payment) => ({
          id: payment.id,
          type: payment.payment_type,
          partyId: payment.party_id,
          partyName:
            ledgerNameById.get(payment.party_id) || "Unknown Party",
          date: payment.payment_date,
          amount: toNumber(payment.amount),
          paymentMode: payment.payment_mode || "Cash",
          referenceNumber: payment.reference_number || "",
          notes: payment.notes || "",
          createdAt: payment.created_at,
        }))
      );
    } catch (error) {
      setSales([]);
      setPurchases([]);
      setPayments([]);
      setLedgers([]);

      showMessage(
        error instanceof Error
          ? error.message
          : "Payment data could not be loaded from the cloud database."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();

    window.addEventListener(
      "vertexerp-sales-updated",
      loadData
    );
    window.addEventListener(
      "vertexerp-purchases-updated",
      loadData
    );
    window.addEventListener(
      "vertexerp-payments-updated",
      loadData
    );
    window.addEventListener(
      "vertexerp-active-company-updated",
      loadData
    );

    return () => {
      window.removeEventListener(
        "vertexerp-sales-updated",
        loadData
      );
      window.removeEventListener(
        "vertexerp-purchases-updated",
        loadData
      );
      window.removeEventListener(
        "vertexerp-payments-updated",
        loadData
      );
      window.removeEventListener(
        "vertexerp-active-company-updated",
        loadData
      );
    };
  }, []);

  const ledgerNameById = useMemo(() => {
    return new Map(ledgers.map((ledger) => [ledger.id, ledger.name]));
  }, [ledgers]);

  const customerCreditEntries = useMemo(() => {
    return sales
      .filter((sale) => isCreditPayment(sale.payment_mode))
      .filter((sale) => Boolean(sale.customer_id))
      .map((sale) => ({
        partyId: sale.customer_id as string,
        partyName:
          ledgerNameById.get(sale.customer_id as string) ||
          "Unknown Customer",
        amount: toNumber(sale.grand_total),
      }));
  }, [sales, ledgerNameById]);

  const supplierCreditEntries = useMemo(() => {
    return purchases
      .filter((purchase) => isCreditPayment(purchase.payment_mode))
      .filter((purchase) => Boolean(purchase.supplier_id))
      .map((purchase) => ({
        partyId: purchase.supplier_id as string,
        partyName:
          ledgerNameById.get(purchase.supplier_id as string) ||
          "Unknown Supplier",
        amount: toNumber(purchase.grand_total),
      }));
  }, [purchases, ledgerNameById]);

  const customerBalances = useMemo(() => {
    return getBalances(
      customerCreditEntries,
      "Customer Receipt",
      payments
    );
  }, [customerCreditEntries, payments]);

  const supplierBalances = useMemo(() => {
    return getBalances(
      supplierCreditEntries,
      "Supplier Payment",
      payments
    );
  }, [supplierCreditEntries, payments]);

  const partyOptions =
    form.type === "Customer Receipt"
      ? customerBalances
      : supplierBalances;

  const selectedParty = partyOptions.find(
    (party) => party.id === form.partyId
  );

  const totalReceivable = customerBalances.reduce(
    (total, customer) => total + customer.outstanding,
    0
  );

  const totalPayable = supplierBalances.reduce(
    (total, supplier) => total + supplier.outstanding,
    0
  );

  function resetForm(paymentType = form.type) {
    setForm({
      type: paymentType,
      partyId: "",
      date: getToday(),
      amount: "",
      paymentMode: "Cash",
      referenceNumber: "",
      notes: "",
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const paymentAmount = toNumber(form.amount);

    if (!activeCompanyId) {
      showMessage("Select an active company before recording a payment.");
      return;
    }

    if (!selectedParty) {
      showMessage("Please select a customer or supplier.");
      return;
    }

    if (!form.date) {
      showMessage("Please select a payment date.");
      return;
    }

    if (paymentAmount <= 0) {
      showMessage("Enter a valid payment amount.");
      return;
    }

    if (paymentAmount > selectedParty.outstanding) {
      showMessage(
        `Payment cannot exceed outstanding amount of ${formatCurrency(
          selectedParty.outstanding
        )}.`
      );
      return;
    }

    setIsSaving(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.rpc(
        "create_payment_with_validation",
        {
          p_company_id: activeCompanyId,
          p_payment_type: form.type,
          p_party_id: selectedParty.id,
          p_payment_date: form.date,
          p_amount: paymentAmount,
          p_payment_mode: form.paymentMode,
          p_reference_number: form.referenceNumber.trim(),
          p_notes: form.notes.trim(),
        }
      );

      if (error) {
        throw error;
      }

      resetForm();
      await loadData();

      window.dispatchEvent(new Event("vertexerp-payments-updated"));

      showMessage(
        `${form.type} of ${formatCurrency(
          paymentAmount
        )} saved successfully.`
      );
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Payment could not be saved."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmDeletePayment() {
    const payment = paymentPendingDeletion;

    if (!payment || isDeletingPayment) {
      return;
    }

    setIsDeletingPayment(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.rpc("delete_payment_entry", {
        p_payment_id: payment.id,
      });

      if (error) {
        throw error;
      }

      await loadData();
      window.dispatchEvent(new Event("vertexerp-payments-updated"));

      setPaymentPendingDeletion(null);

      showMessage(
        `Payment of ${formatCurrency(payment.amount)} deleted successfully.`
      );
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Payment could not be deleted."
      );
    } finally {
      setIsDeletingPayment(false);
    }
  }

  const isFormDisabled = isLoading || !activeCompanyId || isSaving;

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <div className="min-w-0 flex-1">
        <Navbar />

        <main className="p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
          <div className="mb-6 lg:mb-8">
            <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
              💳 Record Payment
            </h1>

            <p className="mt-2 text-base text-slate-600 sm:text-lg">
              Record customer receipts and supplier payments.
            </p>
          </div>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
            <div className="rounded-3xl border border-blue-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">
                Customer Receivable
              </p>

              <h2
                className="mt-3 break-words text-3xl font-bold sm:text-4xl"
                style={{ color: "#2563eb" }}
              >
                {isLoading ? "..." : formatCurrency(totalReceivable)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Pending amount to collect from customers
              </p>
            </div>

            <div className="rounded-3xl border border-purple-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">
                Supplier Payable
              </p>

              <h2
                className="mt-3 break-words text-3xl font-bold sm:text-4xl"
                style={{ color: "#7e22ce" }}
              >
                {isLoading ? "..." : formatCurrency(totalPayable)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Pending amount payable to suppliers
              </p>
            </div>
          </section>

          <form
            onSubmit={handleSubmit}
            className="mt-6 rounded-3xl border border-slate-100 bg-white p-4 shadow-xl sm:mt-8 sm:p-6 lg:mt-10 lg:p-8"
          >
            <div className="border-b border-slate-200 pb-5 sm:pb-6">
              <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
                New Payment Entry
              </h2>

              <p className="mt-1 text-sm text-slate-600 sm:text-base">
                Record a full or partial payment against credit transactions.
              </p>
            </div>

            {message && (
              <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 sm:mt-6 sm:text-base">
                {message}
              </div>
            )}

            {!isLoading && !activeCompanyId && (
              <div className="mt-5 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700 sm:mt-6 sm:text-base">
                Select an active company from the <strong>Companies</strong>{" "}
                page before recording a payment.
              </div>
            )}

            <fieldset disabled={isFormDisabled}>
              <div className="mt-6 grid grid-cols-1 gap-5 sm:mt-8 md:grid-cols-2 xl:grid-cols-3">
                <div>
                  <label className="mb-2 block font-semibold text-slate-800">
                    Transaction Type *
                  </label>

                  <select
                    value={form.type}
                    onChange={(event) => {
                      resetForm(event.target.value as PaymentType);
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="Customer Receipt">
                      Customer Receipt
                    </option>

                    <option value="Supplier Payment">
                      Supplier Payment
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block font-semibold text-slate-800">
                    {form.type === "Customer Receipt"
                      ? "Customer *"
                      : "Supplier *"}
                  </label>

                  <select
                    value={form.partyId}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        partyId: event.target.value,
                        amount: "",
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="">
                      Select{" "}
                      {form.type === "Customer Receipt"
                        ? "customer"
                        : "supplier"}
                    </option>

                    {partyOptions.map((party) => (
                      <option key={party.id} value={party.id}>
                        {party.name} — {formatCurrency(party.outstanding)}
                      </option>
                    ))}
                  </select>

                  {!isLoading && partyOptions.length === 0 && (
                    <p className="mt-2 text-sm font-medium text-orange-600">
                      No pending outstanding balance found.
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block font-semibold text-slate-800">
                    Payment Date *
                  </label>

                  <input
                    type="date"
                    value={form.date}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        date: event.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-semibold text-slate-800">
                    Payment Amount *
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    max={selectedParty?.outstanding || undefined}
                    value={form.amount}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        amount: event.target.value,
                      })
                    }
                    placeholder="Enter amount"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-semibold text-slate-800">
                    Payment Mode
                  </label>

                  <select
                    value={form.paymentMode}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        paymentMode: event.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    <option>Cash</option>
                    <option>UPI</option>
                    <option>Bank Transfer</option>
                    <option>Card</option>
                    <option>Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block font-semibold text-slate-800">
                    Reference Number
                  </label>

                  <input
                    type="text"
                    value={form.referenceNumber}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        referenceNumber: event.target.value,
                      })
                    }
                    placeholder="UPI / Cheque / Bank reference"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>
              </div>

              {selectedParty && (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:mt-6 sm:p-5">
                  <p className="text-sm font-bold text-emerald-800">
                    Available Outstanding Balance
                  </p>

                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <p className="text-lg font-bold text-slate-900">
                      {selectedParty.name}
                    </p>

                    <p
                      className="text-xl font-bold sm:text-2xl"
                      style={{ color: "#059669" }}
                    >
                      {formatCurrency(selectedParty.outstanding)}
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-5 sm:mt-6">
                <label className="mb-2 block font-semibold text-slate-800">
                  Notes
                </label>

                <textarea
                  rows={4}
                  value={form.notes}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      notes: event.target.value,
                    })
                  }
                  placeholder="Optional note for this payment..."
                  className="w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:gap-4">
                <button
                  type="submit"
                  className="w-full rounded-xl px-5 py-3 font-bold text-white shadow-lg transition hover:scale-[1.02] active:scale-[0.98] sm:w-auto sm:px-7"
                  style={{
                    backgroundColor: "#059669",
                    color: "#ffffff",
                  }}
                >
                  {isSaving ? "Saving Payment..." : "Save Payment"}
                </button>

                <button
                  type="button"
                  onClick={() => resetForm()}
                  className="w-full rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-100 sm:w-auto sm:px-7"
                >
                  Reset
                </button>
              </div>
            </fieldset>
          </form>

          <section className="mt-6 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl sm:mt-8 lg:mt-10">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 lg:py-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
                  Payment History
                </h2>

                <p className="mt-1 text-sm text-slate-600 sm:text-base">
                  Customer receipts and supplier payment entries.
                </p>
              </div>

              <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">
                Entries: {payments.length}
              </span>
            </div>

            <div className="p-4 md:hidden">
              {isLoading ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  Loading payment history from the cloud database...
                </div>
              ) : payments.length === 0 ? (
                <div className="py-10 text-center text-slate-500">
                  <p className="text-lg font-semibold text-slate-700">
                    No payment entries yet
                  </p>

                  <p className="mt-2 text-sm">
                    Record a receipt or supplier payment from the form above.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {payments.map((payment) => {
                    const isCustomerReceipt =
                      payment.type === "Customer Receipt";

                    return (
                      <article
                        key={payment.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-lg font-bold text-slate-900">
                              {payment.partyName}
                            </p>

                            <p className="mt-1 text-sm text-slate-500">
                              {formatDate(payment.date)}
                            </p>
                          </div>

                          <span
                            className={
                              isCustomerReceipt
                                ? "shrink-0 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700"
                                : "shrink-0 rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-700"
                            }
                          >
                            {isCustomerReceipt ? "Receipt" : "Payment"}
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div className="rounded-xl bg-white p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Payment Mode
                            </p>

                            <p className="mt-1 font-semibold text-slate-800">
                              {payment.paymentMode}
                            </p>
                          </div>

                          <div className="rounded-xl bg-white p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Amount
                            </p>

                            <p
                              className={
                                isCustomerReceipt
                                  ? "mt-1 font-bold text-emerald-700"
                                  : "mt-1 font-bold text-purple-700"
                              }
                            >
                              {formatCurrency(payment.amount)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 rounded-xl bg-white p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Reference
                          </p>

                          <p className="mt-1 break-words font-semibold text-slate-800">
                            {payment.referenceNumber || "—"}
                          </p>
                        </div>

                        {payment.notes && (
                          <div className="mt-3 rounded-xl bg-white p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Notes
                            </p>

                            <p className="mt-1 text-sm leading-6 text-slate-700">
                              {payment.notes}
                            </p>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => setPaymentPendingDeletion(payment)}
                          className="mt-4 w-full rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700"
                        >
                          Delete Payment
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1050px]">
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

                    <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-14 text-center text-slate-500"
                      >
                        Loading payment history from the cloud database...
                      </td>
                    </tr>
                  ) : payments.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-14 text-center text-slate-500"
                      >
                        <p className="text-lg font-semibold text-slate-700">
                          No payment entries yet
                        </p>

                        <p className="mt-2">
                          Record a receipt or supplier payment from the form
                          above.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    payments.map((payment) => {
                      const isCustomerReceipt =
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
                                isCustomerReceipt
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
                              <p className="mt-1 max-w-[220px] truncate text-sm text-slate-500">
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
                              color: isCustomerReceipt
                                ? "#059669"
                                : "#7e22ce",
                            }}
                          >
                            {formatCurrency(payment.amount)}
                          </td>

                          <td className="px-6 py-5 text-right">
                            <button
                              type="button"
                              onClick={() => setPaymentPendingDeletion(payment)}
                              className="rounded-lg px-4 py-2 text-sm font-bold text-white transition hover:scale-[1.03] active:scale-[0.97]"
                              style={{
                                backgroundColor: "#dc2626",
                                color: "#ffffff",
                              }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>

      <ConfirmDeleteModal
        isOpen={Boolean(paymentPendingDeletion)}
        title="Delete payment entry?"
        description={
          paymentPendingDeletion
            ? `This will remove the ${paymentPendingDeletion.type.toLowerCase()} of ${formatCurrency(
                paymentPendingDeletion.amount
              )} for ${paymentPendingDeletion.partyName}.`
            : ""
        }
        confirmLabel="Delete Payment"
        isDeleting={isDeletingPayment}
        onCancel={() => {
          if (!isDeletingPayment) {
            setPaymentPendingDeletion(null);
          }
        }}
        onConfirm={confirmDeletePayment}
      />
    </div>
  );
}