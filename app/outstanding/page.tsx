"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

type CreditEntry = {
  partyId: string;
  partyName: string;
  date: string;
  amount: number;
};

type PartyOutstanding = {
  id: string;
  name: string;
  totalCredit: number;
  paidAmount: number;
  outstanding: number;
  billCount: number;
  latestDate: string;
};

const SALES_KEY = "smarterp_sales";
const PURCHASES_KEY = "smarterp_purchases";
const PAYMENTS_KEY = "smarterp_payments";

const SALES_EVENT = "smarterp-sales-updated";
const PURCHASE_EVENT = "smarterp-purchases-updated";
const PAYMENTS_EVENT = "smarterp-payments-updated";

function toNumber(value: unknown) {
  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function formatCurrency(amount: number) {
  return `₹${toNumber(amount).toLocaleString("en-IN")}`;
}

function isCreditPayment(paymentMode: string) {
  return String(paymentMode || "").trim().toLowerCase() === "credit";
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

function readSavedArray<T>(storageKey: string): T[] {
  try {
    const savedData = window.localStorage.getItem(storageKey);

    if (!savedData) {
      return [];
    }

    const parsedData = JSON.parse(savedData);

    return Array.isArray(parsedData) ? (parsedData as T[]) : [];
  } catch {
    return [];
  }
}

function buildOutstanding(
  entries: CreditEntry[],
  payments: Payment[],
  paymentType: PaymentType
) {
  const partyMap = new Map<string, PartyOutstanding>();

  entries.forEach((entry) => {
    const existingParty = partyMap.get(entry.partyId);

    if (existingParty) {
      existingParty.totalCredit += toNumber(entry.amount);
      existingParty.billCount += 1;

      if (entry.date > existingParty.latestDate) {
        existingParty.latestDate = entry.date;
      }

      return;
    }

    partyMap.set(entry.partyId, {
      id: entry.partyId,
      name: entry.partyName,
      totalCredit: toNumber(entry.amount),
      paidAmount: 0,
      outstanding: 0,
      billCount: 1,
      latestDate: entry.date,
    });
  });

  payments
    .filter((payment) => payment.type === paymentType)
    .forEach((payment) => {
      const party = partyMap.get(payment.partyId);

      if (party) {
        party.paidAmount += toNumber(payment.amount);
      }
    });

  return Array.from(partyMap.values())
    .map((party) => ({
      ...party,
      paidAmount: Math.min(party.paidAmount, party.totalCredit),
      outstanding: Math.max(0, party.totalCredit - party.paidAmount),
    }))
    .filter((party) => party.outstanding > 0)
    .sort((first, second) => second.outstanding - first.outstanding);
}

export default function OutstandingPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  function loadOutstandingData() {
    const savedSales = readSavedArray<Sale>(SALES_KEY);
    const savedPurchases = readSavedArray<Purchase>(PURCHASES_KEY);
    const savedPayments = readSavedArray<Payment>(PAYMENTS_KEY);

    setSales(savedSales);
    setPurchases(savedPurchases);
    setPayments(savedPayments);
    setIsLoaded(true);
  }

  useEffect(() => {
    loadOutstandingData();

    window.addEventListener(SALES_EVENT, loadOutstandingData);
    window.addEventListener(PURCHASE_EVENT, loadOutstandingData);
    window.addEventListener(PAYMENTS_EVENT, loadOutstandingData);
    window.addEventListener("storage", loadOutstandingData);

    return () => {
      window.removeEventListener(SALES_EVENT, loadOutstandingData);
      window.removeEventListener(PURCHASE_EVENT, loadOutstandingData);
      window.removeEventListener(PAYMENTS_EVENT, loadOutstandingData);
      window.removeEventListener("storage", loadOutstandingData);
    };
  }, []);

  const creditSales = useMemo(
    () => sales.filter((sale) => isCreditPayment(sale.paymentMode)),
    [sales]
  );

  const creditPurchases = useMemo(
    () =>
      purchases.filter((purchase) => isCreditPayment(purchase.paymentMode)),
    [purchases]
  );

  const customerCreditEntries = useMemo(() => {
    return creditSales.map((sale) => ({
      partyId: sale.customerId || sale.customerName || sale.id,
      partyName: sale.customerName || "Unknown Customer",
      date: sale.date,
      amount: toNumber(sale.grandTotal),
    }));
  }, [creditSales]);

  const supplierCreditEntries = useMemo(() => {
    return creditPurchases.map((purchase) => ({
      partyId: purchase.supplierId || purchase.supplierName || purchase.id,
      partyName: purchase.supplierName || "Unknown Supplier",
      date: purchase.date,
      amount: toNumber(purchase.grandTotal),
    }));
  }, [creditPurchases]);

  const customerOutstanding = useMemo(() => {
    return buildOutstanding(
      customerCreditEntries,
      payments,
      "Customer Receipt"
    );
  }, [customerCreditEntries, payments]);

  const supplierOutstanding = useMemo(() => {
    return buildOutstanding(
      supplierCreditEntries,
      payments,
      "Supplier Payment"
    );
  }, [supplierCreditEntries, payments]);

  const totalReceivable = customerOutstanding.reduce(
    (total, customer) => total + customer.outstanding,
    0
  );

  const totalPayable = supplierOutstanding.reduce(
    (total, supplier) => total + supplier.outstanding,
    0
  );

  const totalCustomerPaid = customerOutstanding.reduce(
    (total, customer) => total + customer.paidAmount,
    0
  );

  const totalSupplierPaid = supplierOutstanding.reduce(
    (total, supplier) => total + supplier.paidAmount,
    0
  );

  const netOutstanding = totalReceivable - totalPayable;

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <div className="min-w-0 flex-1">
        <Navbar />

        <main className="p-6 md:p-8">
          <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-900">
                💰 Outstanding Management
              </h1>

              <p className="mt-2 text-lg text-slate-600">
                Track pending customer payments and supplier dues.
              </p>
            </div>

            <Link
              href="/payments"
              className="inline-flex w-fit items-center rounded-xl px-6 py-3 font-bold text-white shadow-lg transition hover:scale-[1.02] active:scale-[0.98]"
              style={{
                backgroundColor: "#059669",
                color: "#ffffff",
              }}
            >
              💳 Record Payment
            </Link>
          </div>

          <section
            className="mb-8 rounded-3xl border p-5 shadow-sm"
            style={{
              backgroundColor: "#fff7ed",
              borderColor: "#fed7aa",
            }}
          >
            <p className="font-bold" style={{ color: "#9a3412" }}>
              Outstanding Summary
            </p>

            <p
              className="mt-1 text-sm leading-6"
              style={{ color: "#7c2d12" }}
            >
              Only Credit sales and Credit purchase bills appear here. Recorded
              customer receipts and supplier payments automatically reduce the
              pending balance.
            </p>
          </section>

          <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
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
                Amount still to collect from customers
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
                Amount still payable to suppliers
              </p>
            </div>

            <div className="rounded-3xl border border-orange-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">
                Pending Customers
              </p>

              <h2
                className="mt-3 text-3xl font-bold"
                style={{ color: "#ea580c" }}
              >
                {customerOutstanding.length}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Customers with pending balance
              </p>
            </div>

            <div className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">
                Net Outstanding
              </p>

              <h2
                className="mt-3 text-3xl font-bold"
                style={{
                  color: netOutstanding >= 0 ? "#059669" : "#dc2626",
                }}
              >
                {formatCurrency(Math.abs(netOutstanding))}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                {netOutstanding >= 0
                  ? "More receivable than payable"
                  : "More payable than receivable"}
              </p>
            </div>
          </section>

          <section className="mt-10 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Customer Receivables
                </h2>

                <p className="mt-1 text-slate-600">
                  Credit sales after recorded customer receipts.
                </p>
              </div>

              <div className="rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
                Customers: {customerOutstanding.length}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px]">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200 text-left">
                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Customer
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Credit Invoices
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Latest Invoice
                    </th>

                    <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">
                      Received Amount
                    </th>

                    <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">
                      Receivable Amount
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {!isLoaded ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-12 text-center text-slate-500"
                      >
                        Loading receivable data...
                      </td>
                    </tr>
                  ) : customerOutstanding.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-12 text-center text-slate-500"
                      >
                        <p className="text-lg font-semibold text-slate-700">
                          No customer receivables found
                        </p>

                        <p className="mt-2">
                          All customer credit balances are cleared, or there
                          are no Credit sales invoices yet.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    customerOutstanding.map((customer) => (
                      <tr
                        key={customer.id}
                        className="border-b border-slate-100 transition hover:bg-blue-50"
                      >
                        <td className="px-6 py-5">
                          <p className="font-bold text-slate-900">
                            {customer.name}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            Customer Ledger
                          </p>
                        </td>

                        <td className="px-6 py-5">
                          <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-bold text-orange-700">
                            {customer.billCount} Invoice
                            {customer.billCount !== 1 ? "s" : ""}
                          </span>
                        </td>

                        <td className="px-6 py-5 text-slate-700">
                          {formatDate(customer.latestDate)}
                        </td>

                        <td
                          className="px-6 py-5 text-right font-bold"
                          style={{ color: "#059669" }}
                        >
                          {formatCurrency(customer.paidAmount)}
                        </td>

                        <td
                          className="px-6 py-5 text-right text-lg font-bold"
                          style={{ color: "#2563eb" }}
                        >
                          {formatCurrency(customer.outstanding)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-10 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Supplier Payables
                </h2>

                <p className="mt-1 text-slate-600">
                  Credit purchase bills after recorded supplier payments.
                </p>
              </div>

              <div className="rounded-full bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700">
                Suppliers: {supplierOutstanding.length}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px]">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200 text-left">
                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Supplier
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Credit Bills
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Latest Bill
                    </th>

                    <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">
                      Paid Amount
                    </th>

                    <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">
                      Payable Amount
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {!isLoaded ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-12 text-center text-slate-500"
                      >
                        Loading payable data...
                      </td>
                    </tr>
                  ) : supplierOutstanding.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-12 text-center text-slate-500"
                      >
                        <p className="text-lg font-semibold text-slate-700">
                          No supplier payables found
                        </p>

                        <p className="mt-2">
                          All supplier credit balances are cleared, or there
                          are no Credit purchase bills yet.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    supplierOutstanding.map((supplier) => (
                      <tr
                        key={supplier.id}
                        className="border-b border-slate-100 transition hover:bg-purple-50"
                      >
                        <td className="px-6 py-5">
                          <p className="font-bold text-slate-900">
                            {supplier.name}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            Supplier Ledger
                          </p>
                        </td>

                        <td className="px-6 py-5">
                          <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-bold text-orange-700">
                            {supplier.billCount} Bill
                            {supplier.billCount !== 1 ? "s" : ""}
                          </span>
                        </td>

                        <td className="px-6 py-5 text-slate-700">
                          {formatDate(supplier.latestDate)}
                        </td>

                        <td
                          className="px-6 py-5 text-right font-bold"
                          style={{ color: "#059669" }}
                        >
                          {formatCurrency(supplier.paidAmount)}
                        </td>

                        <td
                          className="px-6 py-5 text-right text-lg font-bold"
                          style={{ color: "#7e22ce" }}
                        >
                          {formatCurrency(supplier.outstanding)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-10 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl">
              <div className="border-b border-slate-200 px-6 py-5">
                <h2 className="text-xl font-bold text-slate-900">
                  Recent Credit Sales
                </h2>
              </div>

              <div className="divide-y divide-slate-100">
                {creditSales.slice(0, 5).map((sale) => (
                  <div
                    key={sale.id}
                    className="flex items-center justify-between gap-4 px-6 py-4"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/sales/invoice/${sale.id}`}
                        className="font-bold text-blue-600 transition hover:text-blue-800 hover:underline"
                      >
                        {sale.invoiceNumber}
                      </Link>

                      <p className="mt-1 truncate text-sm text-slate-500">
                        {sale.customerName} · {formatDate(sale.date)}
                      </p>
                    </div>

                    <p
                      className="shrink-0 font-bold"
                      style={{ color: "#2563eb" }}
                    >
                      {formatCurrency(sale.grandTotal)}
                    </p>
                  </div>
                ))}

                {creditSales.length === 0 && (
                  <p className="px-6 py-10 text-center text-slate-500">
                    No credit sales invoices yet.
                  </p>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl">
              <div className="border-b border-slate-200 px-6 py-5">
                <h2 className="text-xl font-bold text-slate-900">
                  Recent Credit Purchases
                </h2>
              </div>

              <div className="divide-y divide-slate-100">
                {creditPurchases.slice(0, 5).map((purchase) => (
                  <div
                    key={purchase.id}
                    className="flex items-center justify-between gap-4 px-6 py-4"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/purchase/bill/${purchase.id}`}
                        className="font-bold text-purple-600 transition hover:text-purple-800 hover:underline"
                      >
                        {purchase.billNumber}
                      </Link>

                      <p className="mt-1 truncate text-sm text-slate-500">
                        {purchase.supplierName} ·{" "}
                        {formatDate(purchase.date)}
                      </p>
                    </div>

                    <p
                      className="shrink-0 font-bold"
                      style={{ color: "#7e22ce" }}
                    >
                      {formatCurrency(purchase.grandTotal)}
                    </p>
                  </div>
                ))}

                {creditPurchases.length === 0 && (
                  <p className="px-6 py-10 text-center text-slate-500">
                    No credit purchase bills yet.
                  </p>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}