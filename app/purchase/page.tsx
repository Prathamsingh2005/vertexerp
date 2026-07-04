"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import PurchaseForm from "@/components/PurchaseForm";
import PurchaseTable from "@/components/PurchaseTable";

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
  type: "Customer Receipt" | "Supplier Payment";
  partyId: string;
  amount: number;
};

const PURCHASES_KEY = "VertexERP_purchases";
const PAYMENTS_KEY = "VertexERP_payments";

const PURCHASE_EVENT = "VertexERP-purchases-updated";
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

export default function PurchasePage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  function loadPurchaseData() {
    const savedPurchases = readSavedArray<Purchase>(PURCHASES_KEY);
    const savedPayments = readSavedArray<Payment>(PAYMENTS_KEY);

    setPurchases(savedPurchases);
    setPayments(savedPayments);
  }

  useEffect(() => {
    function handleStorageChange(event: StorageEvent) {
      const relevantKeys = [PURCHASES_KEY, PAYMENTS_KEY];

      if (!event.key || relevantKeys.includes(event.key)) {
        loadPurchaseData();
      }
    }

    loadPurchaseData();

    window.addEventListener(PURCHASE_EVENT, loadPurchaseData);
    window.addEventListener(PAYMENTS_EVENT, loadPurchaseData);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener(PURCHASE_EVENT, loadPurchaseData);
      window.removeEventListener(PAYMENTS_EVENT, loadPurchaseData);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const purchaseStats = useMemo(() => {
    const today = getToday();

    const todayPurchase = purchases
      .filter((purchase) => purchase.date === today)
      .reduce(
        (total, purchase) => total + toNumber(purchase.grandTotal),
        0
      );

    const currentMonthPurchases = purchases.filter((purchase) =>
      isCurrentMonth(purchase.date)
    );

    const monthlyPurchase = currentMonthPurchases.reduce(
      (total, purchase) => total + toNumber(purchase.grandTotal),
      0
    );

    const creditAmountBySupplier = new Map<string, number>();

    purchases
      .filter((purchase) => isCreditPayment(purchase.paymentMode))
      .forEach((purchase) => {
        const supplierId = String(
          purchase.supplierId || purchase.supplierName || purchase.id
        );

        const currentAmount =
          creditAmountBySupplier.get(supplierId) || 0;

        creditAmountBySupplier.set(
          supplierId,
          currentAmount + toNumber(purchase.grandTotal)
        );
      });

    const paidAmountBySupplier = new Map<string, number>();

    payments
      .filter((payment) => payment.type === "Supplier Payment")
      .forEach((payment) => {
        const currentAmount =
          paidAmountBySupplier.get(payment.partyId) || 0;

        paidAmountBySupplier.set(
          payment.partyId,
          currentAmount + toNumber(payment.amount)
        );
      });

    const supplierPayable = Array.from(
      creditAmountBySupplier.entries()
    ).reduce((total, [supplierId, creditAmount]) => {
      const paidAmount = paidAmountBySupplier.get(supplierId) || 0;

      return total + Math.max(0, creditAmount - paidAmount);
    }, 0);

    return {
      todayPurchase,
      totalBills: purchases.length,
      supplierPayable,
      monthlyPurchase,
    };
  }, [purchases, payments]);

  function scrollToPurchaseForm() {
    document
      .getElementById("create-purchase-bill")
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
                🧾 Purchase & Stock Entry
              </h1>

              <p className="mt-2 text-lg text-slate-600">
                Record supplier purchases and keep your inventory stock updated.
              </p>
            </div>

            <button
              type="button"
              onClick={scrollToPurchaseForm}
              className="rounded-xl px-6 py-3 font-semibold text-white shadow-lg transition hover:scale-[1.02] active:scale-[0.98]"
              style={{
                backgroundColor: "#2563eb",
                color: "#ffffff",
              }}
            >
              + Create Purchase
            </button>
          </div>

          <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-blue-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">
                Today&apos;s Purchase
              </p>

              <h2
                className="mt-3 text-4xl font-bold"
                style={{ color: "#2563eb" }}
              >
                {formatCurrency(purchaseStats.todayPurchase)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Purchase amount recorded today
              </p>
            </div>

            <div className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">
                Purchase Bills
              </p>

              <h2
                className="mt-3 text-4xl font-bold"
                style={{ color: "#059669" }}
              >
                {purchaseStats.totalBills}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                All saved supplier purchase bills
              </p>
            </div>

            <div className="rounded-3xl border border-orange-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">
                Supplier Payable
              </p>

              <h2
                className="mt-3 text-4xl font-bold"
                style={{ color: "#ea580c" }}
              >
                {formatCurrency(purchaseStats.supplierPayable)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Credit amount still payable to suppliers
              </p>
            </div>

            <div className="rounded-3xl border border-purple-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">
                This Month&apos;s Purchase
              </p>

              <h2
                className="mt-3 text-4xl font-bold"
                style={{ color: "#7e22ce" }}
              >
                {formatCurrency(purchaseStats.monthlyPurchase)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Total purchase amount for current month
              </p>
            </div>
          </section>

          <section className="mt-8 rounded-3xl border border-slate-100 bg-white p-5 shadow-lg">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">📄</span>

                <div>
                  <p className="font-bold text-slate-900">
                    Purchase Bill Register
                  </p>

                  <p className="text-sm text-slate-600">
                    Saved purchase bills appear in the table below.
                  </p>
                </div>
              </div>

              <span className="w-fit rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
                Bills: {purchaseStats.totalBills}
              </span>
            </div>
          </section>

          <div id="create-purchase-bill">
            <PurchaseForm />
          </div>

          <PurchaseTable />
        </main>
      </div>
    </div>
  );
}