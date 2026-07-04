"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import SalesInvoiceForm from "@/components/SalesInvoiceForm";
import SalesInvoiceTable from "@/components/SalesInvoiceTable";

type Sale = {
  id: string;
  invoiceNumber: string;
  date: string;
  paymentMode: string;
  customerId: string;
  customerName: string;
  grandTotal: number;
};

type Payment = {
  id: string;
  type: "Customer Receipt" | "Supplier Payment";
  partyId: string;
  amount: number;
};

const SALES_KEY = "VertexERP_sales";
const PAYMENTS_KEY = "VertexERP_payments";

const SALES_EVENT = "VertexERP-sales-updated";
const PAYMENTS_EVENT = "VertexERP-payments-updated";

function toNumber(value: unknown) {
  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function formatCurrency(amount: number) {
  return `₹${toNumber(amount).toLocaleString("en-IN")}`;
}

function getToday() {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isCurrentMonth(dateValue: string) {
  if (!dateValue) {
    return false;
  }

  const normalizedDate = dateValue.includes("T")
    ? dateValue
    : `${dateValue}T00:00:00`;

  const date = new Date(normalizedDate);
  const today = new Date();

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return (
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

function isCreditPayment(paymentMode: string) {
  return String(paymentMode || "").trim().toLowerCase() === "credit";
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

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
const [payments, setPayments] = useState<Payment[]>([]);
const [salesRefreshKey, setSalesRefreshKey] = useState(0);

  function loadSalesData() {
    const savedSales = readSavedArray<Sale>(SALES_KEY);
    const savedPayments = readSavedArray<Payment>(PAYMENTS_KEY);

    setSales(savedSales);
setPayments(savedPayments);
setSalesRefreshKey((currentKey) => currentKey + 1);
  }

  useEffect(() => {
    function handleStorageChange(event: StorageEvent) {
      const relevantKeys = [SALES_KEY, PAYMENTS_KEY];

      if (!event.key || relevantKeys.includes(event.key)) {
        loadSalesData();
      }
    }

    loadSalesData();

    window.addEventListener(SALES_EVENT, loadSalesData);
    window.addEventListener(PAYMENTS_EVENT, loadSalesData);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener(SALES_EVENT, loadSalesData);
      window.removeEventListener(PAYMENTS_EVENT, loadSalesData);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const salesStats = useMemo(() => {
    const today = getToday();

    const todaySales = sales
      .filter((sale) => sale.date === today)
      .reduce(
        (total, sale) => total + toNumber(sale.grandTotal),
        0
      );

    const currentMonthSales = sales.filter((sale) =>
      isCurrentMonth(sale.date)
    );

    const monthlySales = currentMonthSales.reduce(
      (total, sale) => total + toNumber(sale.grandTotal),
      0
    );

    const creditAmountByCustomer = new Map<string, number>();

    sales
      .filter((sale) => isCreditPayment(sale.paymentMode))
      .forEach((sale) => {
        const customerId = String(
          sale.customerId || sale.customerName || sale.id
        );

        const currentAmount = creditAmountByCustomer.get(customerId) || 0;

        creditAmountByCustomer.set(
          customerId,
          currentAmount + toNumber(sale.grandTotal)
        );
      });

    const receivedAmountByCustomer = new Map<string, number>();

    payments
      .filter((payment) => payment.type === "Customer Receipt")
      .forEach((payment) => {
        const currentAmount =
          receivedAmountByCustomer.get(payment.partyId) || 0;

        receivedAmountByCustomer.set(
          payment.partyId,
          currentAmount + toNumber(payment.amount)
        );
      });

    const pendingPayments = Array.from(
      creditAmountByCustomer.entries()
    ).reduce((total, [customerId, creditAmount]) => {
      const receivedAmount =
        receivedAmountByCustomer.get(customerId) || 0;

      return total + Math.max(0, creditAmount - receivedAmount);
    }, 0);

    return {
      todaySales,
      totalInvoices: sales.length,
      pendingPayments,
      monthlySales,
    };
  }, [sales, payments]);

  function scrollToInvoiceForm() {
    document
      .getElementById("create-sales-invoice")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <div className="min-w-0 flex-1">
        <Navbar />

        <main className="p-6 md:p-8">
          <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-900">
                🛒 Sales & Billing
              </h1>

              <p className="mt-2 text-lg text-slate-600">
                Create invoices, manage sales and track customer payments.
              </p>
            </div>

            <button
              type="button"
              onClick={scrollToInvoiceForm}
              className="rounded-xl px-6 py-3 font-semibold text-white shadow-lg transition hover:scale-[1.02] active:scale-[0.98]"
              style={{
                backgroundColor: "#2563eb",
                color: "#ffffff",
              }}
            >
              + Create Invoice
            </button>
          </div>

          <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-blue-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">
                Today&apos;s Sales
              </p>

              <h2
                className="mt-3 text-4xl font-bold"
                style={{ color: "#2563eb" }}
              >
                {formatCurrency(salesStats.todaySales)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Total sales recorded today
              </p>
            </div>

            <div className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">
                Total Invoices
              </p>

              <h2
                className="mt-3 text-4xl font-bold"
                style={{ color: "#059669" }}
              >
                {salesStats.totalInvoices}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                All saved sales invoices
              </p>
            </div>

            <div className="rounded-3xl border border-orange-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">
                Pending Payments
              </p>

              <h2
                className="mt-3 text-4xl font-bold"
                style={{ color: "#ea580c" }}
              >
                {formatCurrency(salesStats.pendingPayments)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Credit amount still to receive
              </p>
            </div>

            <div className="rounded-3xl border border-purple-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">
                This Month&apos;s Sales
              </p>

              <h2
                className="mt-3 text-4xl font-bold"
                style={{ color: "#7e22ce" }}
              >
                {formatCurrency(salesStats.monthlySales)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Total invoice value for current month
              </p>
            </div>
          </section>

          <section className="mt-8 rounded-3xl border border-slate-100 bg-white p-5 shadow-lg">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">📄</span>

                <div>
                  <p className="font-bold text-slate-900">
                    Sales Invoice Register
                  </p>

                  <p className="text-sm text-slate-600">
                    Saved invoices appear in the table below.
                  </p>
                </div>
              </div>

              <span className="w-fit rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
                Invoices: {salesStats.totalInvoices}
              </span>
            </div>
          </section>

          <div id="create-sales-invoice">
            <SalesInvoiceForm />
          </div>

          <SalesInvoiceTable refreshKey={salesRefreshKey} />
        </main>
      </div>
    </div>
  );
}