"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

type PaymentType = "Customer Receipt" | "Supplier Payment";

type Sale = {
  id: string;
  invoiceNumber: string;
  date: string;
  paymentMode: string;
  customerId: string;
  customerName: string;
  grandTotal: number;
};

type Purchase = {
  id: string;
  billNumber: string;
  date: string;
  paymentMode: string;
  supplierId: string;
  supplierName: string;
  grandTotal: number;
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

const SALES_KEY = "smarterp_sales";
const PURCHASES_KEY = "smarterp_purchases";
const PAYMENTS_KEY = "smarterp_payments";

const SALES_EVENT = "smarterp-sales-updated";
const PURCHASE_EVENT = "smarterp-purchases-updated";
const PAYMENTS_EVENT = "smarterp-payments-updated";

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
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
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
    }, 3500);
  }

  function loadData() {
    try {
      const savedSales = window.localStorage.getItem(SALES_KEY);
      const savedPurchases = window.localStorage.getItem(PURCHASES_KEY);
      const savedPayments = window.localStorage.getItem(PAYMENTS_KEY);

      const parsedSales = savedSales ? JSON.parse(savedSales) : [];
      const parsedPurchases = savedPurchases
        ? JSON.parse(savedPurchases)
        : [];
      const parsedPayments = savedPayments ? JSON.parse(savedPayments) : [];

      setSales(Array.isArray(parsedSales) ? parsedSales : []);
      setPurchases(Array.isArray(parsedPurchases) ? parsedPurchases : []);
      setPayments(Array.isArray(parsedPayments) ? parsedPayments : []);
    } catch {
      setSales([]);
      setPurchases([]);
      setPayments([]);
    }
  }

  useEffect(() => {
    loadData();

    window.addEventListener(SALES_EVENT, loadData);
    window.addEventListener(PURCHASE_EVENT, loadData);
    window.addEventListener(PAYMENTS_EVENT, loadData);
    window.addEventListener("storage", loadData);

    return () => {
      window.removeEventListener(SALES_EVENT, loadData);
      window.removeEventListener(PURCHASE_EVENT, loadData);
      window.removeEventListener(PAYMENTS_EVENT, loadData);
      window.removeEventListener("storage", loadData);
    };
  }, []);

  const customerCreditEntries = useMemo(() => {
    return sales
      .filter((sale) => isCreditPayment(sale.paymentMode))
      .map((sale) => ({
        partyId: sale.customerId || sale.customerName || sale.id,
        partyName: sale.customerName || "Unknown Customer",
        amount: toNumber(sale.grandTotal),
      }));
  }, [sales]);

  const supplierCreditEntries = useMemo(() => {
    return purchases
      .filter((purchase) => isCreditPayment(purchase.paymentMode))
      .map((purchase) => ({
        partyId: purchase.supplierId || purchase.supplierName || purchase.id,
        partyName: purchase.supplierName || "Unknown Supplier",
        amount: toNumber(purchase.grandTotal),
      }));
  }, [purchases]);

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const paymentAmount = toNumber(form.amount);

    if (!selectedParty) {
      showMessage("Please select a customer or supplier.");
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

    const newPayment: Payment = {
      id: crypto.randomUUID(),
      type: form.type,
      partyId: selectedParty.id,
      partyName: selectedParty.name,
      date: form.date,
      amount: paymentAmount,
      paymentMode: form.paymentMode,
      referenceNumber: form.referenceNumber.trim(),
      notes: form.notes.trim(),
      createdAt: new Date().toISOString(),
    };

    try {
      const updatedPayments = [newPayment, ...payments];

      window.localStorage.setItem(
        PAYMENTS_KEY,
        JSON.stringify(updatedPayments)
      );

      setPayments(updatedPayments);

      window.dispatchEvent(new Event(PAYMENTS_EVENT));

      resetForm();

      showMessage(
        `${form.type} of ${formatCurrency(paymentAmount)} saved successfully.`
      );
    } catch {
      showMessage("Payment could not be saved. Please try again.");
    }
  }

  function handleDeletePayment(payment: Payment) {
    const confirmed = window.confirm(
      `Delete this ${payment.type.toLowerCase()} of ${formatCurrency(
        payment.amount
      )} for ${payment.partyName}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      const updatedPayments = payments.filter(
        (item) => item.id !== payment.id
      );

      window.localStorage.setItem(
        PAYMENTS_KEY,
        JSON.stringify(updatedPayments)
      );

      setPayments(updatedPayments);

      window.dispatchEvent(new Event(PAYMENTS_EVENT));

      showMessage(
        `Payment of ${formatCurrency(payment.amount)} deleted successfully.`
      );
    } catch {
      showMessage("Payment could not be deleted. Please try again.");
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <div className="min-w-0 flex-1">
        <Navbar />

        <main className="p-6 md:p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-slate-900">
              💳 Record Payment
            </h1>

            <p className="mt-2 text-lg text-slate-600">
              Record customer receipts and supplier payments.
            </p>
          </div>

          <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-blue-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">
                Customer Receivable
              </p>

              <h2
                className="mt-3 text-3xl font-bold"
                style={{ color: "#2563eb" }}
              >
                {formatCurrency(totalReceivable)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Pending amount to collect from customers
              </p>
            </div>

            <div className="rounded-3xl border border-purple-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">
                Supplier Payable
              </p>

              <h2
                className="mt-3 text-3xl font-bold"
                style={{ color: "#7e22ce" }}
              >
                {formatCurrency(totalPayable)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Pending amount payable to suppliers
              </p>
            </div>
          </section>

          <form
            onSubmit={handleSubmit}
            className="mt-10 rounded-3xl border border-slate-100 bg-white p-6 shadow-xl md:p-8"
          >
            <div className="border-b border-slate-200 pb-6">
              <h2 className="text-2xl font-bold text-slate-900">
                New Payment Entry
              </h2>

              <p className="mt-1 text-slate-600">
                Record a full or partial payment against credit transactions.
              </p>
            </div>

            {message && (
              <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 font-medium text-blue-700">
                {message}
              </div>
            )}

            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              <div>
                <label className="mb-2 block font-semibold text-slate-800">
                  Transaction Type *
                </label>

                <select
                  value={form.type}
                  onChange={(event) => {
                    const nextType = event.target.value as PaymentType;

                    resetForm(nextType);
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

                {partyOptions.length === 0 && (
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
              <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-sm font-bold text-emerald-800">
                  Available Outstanding Balance
                </p>

                <div className="mt-2 flex items-center justify-between gap-4">
                  <p className="text-lg font-bold text-slate-900">
                    {selectedParty.name}
                  </p>

                  <p
                    className="text-2xl font-bold"
                    style={{ color: "#059669" }}
                  >
                    {formatCurrency(selectedParty.outstanding)}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-6">
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

            <div className="mt-8 flex flex-wrap gap-4">
              <button
                type="submit"
                className="rounded-xl px-7 py-3 font-bold text-white shadow-lg transition hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  backgroundColor: "#059669",
                  color: "#ffffff",
                }}
              >
                Save Payment
              </button>

              <button
                type="button"
                onClick={() => resetForm()}
                className="rounded-xl border border-slate-300 bg-white px-7 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Reset
              </button>
            </div>
          </form>

          <section className="mt-10 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Payment History
                </h2>

                <p className="mt-1 text-slate-600">
                  Customer receipts and supplier payment entries.
                </p>
              </div>

              <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">
                Entries: {payments.length}
              </span>
            </div>

            <div className="overflow-x-auto">
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
                  {payments.length === 0 ? (
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
                              onClick={() => handleDeletePayment(payment)}
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
    </div>
  );
}