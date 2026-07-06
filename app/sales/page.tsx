"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import SalesInvoiceForm from "@/components/SalesInvoiceForm";
import SalesInvoiceTable from "@/components/SalesInvoiceTable";
import { createClient } from "@/lib/supabase/client";

type Sale = {
  invoice_date: string;
  payment_mode: string;
  customer_id: string | null;
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
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function loadSalesData() {
    setIsLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setSales([]);
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
        setSales([]);
        setPayments([]);
        return;
      }

      const [salesResponse, paymentsResponse] = await Promise.all([
        supabase
          .from("sales")
          .select("invoice_date, payment_mode, customer_id, grand_total")
          .eq("company_id", activeCompanyId),
        supabase
          .from("payments")
          .select("payment_type, party_id, amount")
          .eq("company_id", activeCompanyId),
      ]);

      if (salesResponse.error) {
        throw salesResponse.error;
      }

      if (paymentsResponse.error) {
        throw paymentsResponse.error;
      }

      setSales(salesResponse.data || []);
      setPayments(paymentsResponse.data || []);
    } catch {
      setSales([]);
      setPayments([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadSalesData();

    window.addEventListener("vertexerp-sales-updated", loadSalesData);
    window.addEventListener("vertexerp-payments-updated", loadSalesData);
    window.addEventListener(
      "vertexerp-active-company-updated",
      loadSalesData
    );

    return () => {
      window.removeEventListener("vertexerp-sales-updated", loadSalesData);
      window.removeEventListener(
        "vertexerp-payments-updated",
        loadSalesData
      );
      window.removeEventListener(
        "vertexerp-active-company-updated",
        loadSalesData
      );
    };
  }, []);

  const salesStats = useMemo(() => {
    const todaySales = sales
      .filter((sale) => sale.invoice_date === getToday())
      .reduce((total, sale) => total + toNumber(sale.grand_total), 0);

    const monthlySales = sales
      .filter((sale) => isCurrentMonth(sale.invoice_date))
      .reduce((total, sale) => total + toNumber(sale.grand_total), 0);

    const creditByCustomer = new Map<string, number>();

    sales
      .filter((sale) => sale.payment_mode.trim().toLowerCase() === "credit")
      .forEach((sale) => {
        if (!sale.customer_id) {
          return;
        }

        creditByCustomer.set(
          sale.customer_id,
          (creditByCustomer.get(sale.customer_id) || 0) +
            toNumber(sale.grand_total)
        );
      });

    const receivedByCustomer = new Map<string, number>();

    payments
      .filter((payment) => payment.payment_type === "Customer Receipt")
      .forEach((payment) => {
        receivedByCustomer.set(
          payment.party_id,
          (receivedByCustomer.get(payment.party_id) || 0) +
            toNumber(payment.amount)
        );
      });

    const pendingPayments = Array.from(creditByCustomer.entries()).reduce(
      (total, [customerId, creditAmount]) =>
        total +
        Math.max(
          0,
          creditAmount - (receivedByCustomer.get(customerId) || 0)
        ),
      0
    );

    return {
      todaySales,
      totalInvoices: sales.length,
      pendingPayments,
      monthlySales,
    };
  }, [sales, payments]);

  function scrollToInvoiceForm() {
    document.getElementById("create-sales-invoice")?.scrollIntoView({
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
                🛒 Sales & Billing
              </h1>

              <p className="mt-2 max-w-3xl text-base text-slate-600 sm:text-lg">
                Create invoices, manage sales and track customer payments.
              </p>
            </div>

            <button
              type="button"
              onClick={scrollToInvoiceForm}
              className="w-full rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-700 hover:shadow-xl active:scale-[0.98] sm:w-fit"
            >
              + Create Invoice
            </button>
          </div>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
            <div className="rounded-3xl border border-blue-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">Today&apos;s Sales</p>

              <h2 className="mt-3 break-words text-3xl font-bold text-blue-600 sm:text-4xl">
                {isLoading ? "..." : formatCurrency(salesStats.todaySales)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Total sales recorded today
              </p>
            </div>

            <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">Total Invoices</p>

              <h2 className="mt-3 text-3xl font-bold text-emerald-600 sm:text-4xl">
                {isLoading ? "..." : salesStats.totalInvoices}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                All saved sales invoices
              </p>
            </div>

            <div className="rounded-3xl border border-orange-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">Pending Payments</p>

              <h2 className="mt-3 break-words text-3xl font-bold text-orange-600 sm:text-4xl">
                {isLoading
                  ? "..."
                  : formatCurrency(salesStats.pendingPayments)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Credit amount still to receive
              </p>
            </div>

            <div className="rounded-3xl border border-purple-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">
                This Month&apos;s Sales
              </p>

              <h2 className="mt-3 break-words text-3xl font-bold text-purple-700 sm:text-4xl">
                {isLoading ? "..." : formatCurrency(salesStats.monthlySales)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Total invoice value for current month
              </p>
            </div>
          </section>

          <section className="mt-6 rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:mt-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="pt-0.5 text-xl">📄</span>

                <div>
                  <p className="font-bold text-slate-900">
                    Sales Invoice Register
                  </p>

                  <p className="mt-1 text-sm text-slate-600">
                    Saved invoices appear in the table below.
                  </p>
                </div>
              </div>

              <span className="w-fit rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
                Invoices: {isLoading ? "..." : salesStats.totalInvoices}
              </span>
            </div>
          </section>

          <div id="create-sales-invoice">
            <SalesInvoiceForm />
          </div>

          <SalesInvoiceTable />
        </main>
      </div>
    </div>
  );
}