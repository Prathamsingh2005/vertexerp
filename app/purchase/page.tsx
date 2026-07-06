"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import PurchaseForm from "@/components/PurchaseForm";
import PurchaseTable from "@/components/PurchaseTable";
import { createClient } from "@/lib/supabase/client";

type Purchase = {
  purchase_date: string;
  payment_mode: string;
  supplier_id: string | null;
  grand_total: number | string | null;
};

type Payment = {
  payment_type: string;
  party_id: string;
  amount: number | string | null;
};

type ProfileRow = {
  active_company_id: string | null;
};

function toNumber(value: unknown) {
  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function formatCurrency(amount: number) {
  return `₹${toNumber(amount).toLocaleString("en-IN")}`;
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function isCurrentMonth(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`);
  const today = new Date();

  return (
    !Number.isNaN(date.getTime()) &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

function isCreditPayment(paymentMode: string) {
  return String(paymentMode || "").trim().toLowerCase() === "credit";
}

export default function PurchasePage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function loadPurchaseData() {
    setIsLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setPurchases([]);
        setPayments([]);
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
        setPurchases([]);
        setPayments([]);
        return;
      }

      const [purchasesResponse, paymentsResponse] = await Promise.all([
        supabase
          .from("purchases")
          .select("purchase_date, payment_mode, supplier_id, grand_total")
          .eq("company_id", activeCompanyId),
        supabase
          .from("payments")
          .select("payment_type, party_id, amount")
          .eq("company_id", activeCompanyId),
      ]);

      if (purchasesResponse.error) {
        throw purchasesResponse.error;
      }

      if (paymentsResponse.error) {
        throw paymentsResponse.error;
      }

      setPurchases(purchasesResponse.data || []);
      setPayments(paymentsResponse.data || []);
    } catch {
      setPurchases([]);
      setPayments([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadPurchaseData();

    window.addEventListener(
      "vertexerp-purchases-updated",
      loadPurchaseData
    );
    window.addEventListener(
      "vertexerp-payments-updated",
      loadPurchaseData
    );
    window.addEventListener(
      "vertexerp-active-company-updated",
      loadPurchaseData
    );

    return () => {
      window.removeEventListener(
        "vertexerp-purchases-updated",
        loadPurchaseData
      );
      window.removeEventListener(
        "vertexerp-payments-updated",
        loadPurchaseData
      );
      window.removeEventListener(
        "vertexerp-active-company-updated",
        loadPurchaseData
      );
    };
  }, []);

  const purchaseStats = useMemo(() => {
    const todayPurchase = purchases
      .filter((purchase) => purchase.purchase_date === getToday())
      .reduce(
        (total, purchase) => total + toNumber(purchase.grand_total),
        0
      );

    const monthlyPurchase = purchases
      .filter((purchase) => isCurrentMonth(purchase.purchase_date))
      .reduce(
        (total, purchase) => total + toNumber(purchase.grand_total),
        0
      );

    const creditAmountBySupplier = new Map<string, number>();

    purchases
      .filter((purchase) => isCreditPayment(purchase.payment_mode))
      .forEach((purchase) => {
        const supplierId = purchase.supplier_id;

        if (!supplierId) {
          return;
        }

        creditAmountBySupplier.set(
          supplierId,
          (creditAmountBySupplier.get(supplierId) || 0) +
            toNumber(purchase.grand_total)
        );
      });

    const paidAmountBySupplier = new Map<string, number>();

    payments
      .filter((payment) => payment.payment_type === "Supplier Payment")
      .forEach((payment) => {
        paidAmountBySupplier.set(
          payment.party_id,
          (paidAmountBySupplier.get(payment.party_id) || 0) +
            toNumber(payment.amount)
        );
      });

    const supplierPayable = Array.from(
      creditAmountBySupplier.entries()
    ).reduce((total, [supplierId, creditAmount]) => {
      return (
        total +
        Math.max(0, creditAmount - (paidAmountBySupplier.get(supplierId) || 0))
      );
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

        <main className="p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
          <div className="mb-6 flex flex-col gap-5 lg:mb-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
                🧾 Purchase & Stock Entry
              </h1>

              <p className="mt-2 max-w-3xl text-base text-slate-600 sm:text-lg">
                Record supplier purchases and keep your inventory stock updated.
              </p>
            </div>

            <button
              type="button"
              onClick={scrollToPurchaseForm}
              className="w-full rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-700 hover:shadow-xl active:scale-[0.98] sm:w-fit"
            >
              + Create Purchase
            </button>
          </div>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
            <div className="rounded-3xl border border-blue-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">
                Today&apos;s Purchase
              </p>

              <h2 className="mt-3 break-words text-3xl font-bold text-blue-600 sm:text-4xl">
                {isLoading
                  ? "..."
                  : formatCurrency(purchaseStats.todayPurchase)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Purchase amount recorded today
              </p>
            </div>

            <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">
                Purchase Bills
              </p>

              <h2 className="mt-3 text-3xl font-bold text-emerald-600 sm:text-4xl">
                {isLoading ? "..." : purchaseStats.totalBills}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                All saved supplier purchase bills
              </p>
            </div>

            <div className="rounded-3xl border border-orange-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">
                Supplier Payable
              </p>

              <h2 className="mt-3 break-words text-3xl font-bold text-orange-600 sm:text-4xl">
                {isLoading
                  ? "..."
                  : formatCurrency(purchaseStats.supplierPayable)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Credit amount still payable to suppliers
              </p>
            </div>

            <div className="rounded-3xl border border-purple-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">
                This Month&apos;s Purchase
              </p>

              <h2 className="mt-3 break-words text-3xl font-bold text-purple-700 sm:text-4xl">
                {isLoading
                  ? "..."
                  : formatCurrency(purchaseStats.monthlyPurchase)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Total purchase amount for current month
              </p>
            </div>
          </section>

          <section className="mt-6 rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:mt-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="pt-0.5 text-xl">📄</span>

                <div>
                  <p className="font-bold text-slate-900">
                    Purchase Bill Register
                  </p>

                  <p className="mt-1 text-sm text-slate-600">
                    Saved purchase bills appear in the table below.
                  </p>
                </div>
              </div>

              <span className="w-fit rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
                Bills: {isLoading ? "..." : purchaseStats.totalBills}
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