"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import SalesInvoiceForm from "@/components/SalesInvoiceForm";
import SalesInvoiceTable from "@/components/SalesInvoiceTable";
import { usePermissions } from "@/hooks/usePermissions";
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
  return `₹${toNumber(amount).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
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
  const { access, can, error: permissionError, isLoading: isPermissionLoading } =
    usePermissions();

  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const canCreateSale = can("sales.create");
  const canEditSale = can("sales.edit");
  const canDeleteSale = can("sales.delete");
  const hasWriteAccess = canCreateSale || canEditSale || canDeleteSale;

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
    if (!canCreateSale) {
      return;
    }

    document.getElementById("create-sales-invoice")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <div className="flex min-h-screen bg-[#f3f6fb]">
  <Sidebar />

  <div className="min-w-0 flex-1 overflow-x-hidden">
    <Navbar />

    <main className="min-w-0 p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
          <section className="overflow-hidden rounded-[30px] bg-gradient-to-br from-violet-950 via-violet-800 to-violet-600 p-6 text-white shadow-2xl shadow-violet-900/20 sm:p-8 lg:p-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-violet-100 backdrop-blur">
                  <span>🛒</span>
                  Sales Control Center
                </div>

                <h1 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                  Sales &amp; Billing
                </h1>

                <p className="mt-3 max-w-2xl text-base leading-7 text-violet-100 sm:text-lg">
                  Create GST invoices, review sales and track customer payment
                  exposure from one permission-aware workspace.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
                <div className="rounded-2xl border border-white/15 bg-slate-950/25 px-5 py-4 backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-200">
                    Active Access
                  </p>
                  <p className="mt-1 text-lg font-black">
                    {isPermissionLoading
                      ? "Loading..."
                      : access?.roleName || "No active role"}
                  </p>
                  <p className="mt-1 text-sm text-violet-100">
                    {hasWriteAccess ? "Operational access" : "Read-only access"}
                  </p>
                </div>

                {!isPermissionLoading && canCreateSale && (
                  <button
                    type="button"
                    onClick={scrollToInvoiceForm}
                    className="w-full rounded-2xl bg-white px-6 py-3.5 font-black text-violet-800 shadow-xl transition hover:-translate-y-0.5 hover:bg-violet-50 active:translate-y-0 sm:w-fit"
                  >
                    + Create Invoice
                  </button>
                )}
              </div>
            </div>
          </section>

          {permissionError && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-semibold text-red-700">
              {permissionError}
            </div>
          )}

          {!isPermissionLoading && !hasWriteAccess && (
            <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 text-violet-900">
              <p className="font-black">Read-only sales access</p>
              <p className="mt-1 text-sm leading-6 text-violet-700">
                You can view and print invoices. Create, edit and delete actions
                are hidden for your current role.
              </p>
            </div>
          )}

          <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
            <StatCard
              eyebrow="Today"
              label="Today's Sales"
              value={
                isLoading ? "..." : formatCurrency(salesStats.todaySales)
              }
              detail="Total sales recorded today"
              tone="violet"
            />

            <StatCard
              eyebrow="Invoices"
              label="Total Invoices"
              value={isLoading ? "..." : String(salesStats.totalInvoices)}
              detail="All saved sales invoices"
              tone="indigo"
            />

            <StatCard
              eyebrow="Receivables"
              label="Pending Payments"
              value={
                isLoading
                  ? "..."
                  : formatCurrency(salesStats.pendingPayments)
              }
              detail="Credit amount still to receive"
              tone="amber"
            />

            <StatCard
              eyebrow="Current Month"
              label="This Month's Sales"
              value={
                isLoading ? "..." : formatCurrency(salesStats.monthlySales)
              }
              detail="Total invoice value for current month"
              tone="purple"
            />
          </section>

          <section className="mt-6 rounded-3xl border border-violet-100 bg-white p-5 shadow-lg shadow-slate-200/70 sm:mt-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-xl">
                  📄
                </span>

                <div>
                  <p className="font-black text-slate-950">
                    Sales Invoice Register
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Saved invoices appear in the permission-aware table below.
                  </p>
                </div>
              </div>

              <span className="w-fit rounded-full bg-violet-100 px-4 py-2 text-sm font-black text-violet-800">
                Invoices: {isLoading ? "..." : salesStats.totalInvoices}
              </span>
            </div>
          </section>

          {(canCreateSale || canEditSale) && (
            <div id="create-sales-invoice">
              <SalesInvoiceForm
                canCreate={canCreateSale}
                canEdit={canEditSale}
              />
            </div>
          )}

          <SalesInvoiceTable
            canCreate={canCreateSale}
            canEdit={canEditSale}
            canDelete={canDeleteSale}
          />
        </main>
      </div>
    </div>
  );
}

function StatCard({
  eyebrow,
  label,
  value,
  detail,
  tone,
}: {
  eyebrow: string;
  label: string;
  value: string;
  detail: string;
  tone: "violet" | "indigo" | "amber" | "purple";
}) {
  const tones = {
    violet: "border-violet-100 bg-violet-50 text-violet-800",
    indigo: "border-indigo-100 bg-indigo-50 text-indigo-800",
    amber: "border-amber-100 bg-amber-50 text-amber-800",
    purple: "border-purple-100 bg-purple-50 text-purple-800",
  } as const;

  return (
    <article className="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/60 sm:p-6">
      <span
        className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${tones[tone]}`}
      >
        {eyebrow}
      </span>

      <p className="mt-4 font-bold text-slate-600">
        {label}
      </p>

      <h2 className="mt-2 whitespace-nowrap text-[clamp(1.65rem,2vw,2.5rem)] font-black leading-tight tracking-tight text-slate-950 tabular-nums">
        {value}
      </h2>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        {detail}
      </p>
    </article>
  );
}