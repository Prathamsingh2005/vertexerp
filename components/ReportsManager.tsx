"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PaymentType = "Customer Receipt" | "Supplier Payment";

type ProductRow = {
  id: string;
  quantity: number | string | null;
  purchase_price: number | string | null;
  low_stock_alert: number | string | null;
};

type SaleRow = {
  id: string;
  invoice_date: string;
  payment_mode: string;
  customer_id: string | null;
  grand_total: number | string | null;
};

type PurchaseRow = {
  id: string;
  purchase_date: string;
  payment_mode: string;
  supplier_id: string | null;
  grand_total: number | string | null;
};

type PaymentRow = {
  id: string;
  payment_type: PaymentType;
  party_id: string;
  payment_date: string;
  amount: number | string | null;
};

type ProfileRow = {
  active_company_id: string | null;
};

type ReportData = {
  totalSales: number;
  totalPurchase: number;
  customerReceivable: number;
  supplierPayable: number;
  stockValue: number;
  lowStockCount: number;
};

const initialReportData: ReportData = {
  totalSales: 0,
  totalPurchase: 0,
  customerReceivable: 0,
  supplierPayable: 0,
  stockValue: 0,
  lowStockCount: 0,
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

function isDateInRange(
  dateValue: string,
  fromDate: string,
  toDate: string
) {
  if (!dateValue) {
    return false;
  }

  if (fromDate && dateValue < fromDate) {
    return false;
  }

  if (toDate && dateValue > toDate) {
    return false;
  }

  return true;
}

function isCreditPayment(paymentMode: string) {
  return String(paymentMode || "").trim().toLowerCase() === "credit";
}

function calculateOutstanding(
  entries: {
    partyId: string | null;
    amount: number;
  }[],
  payments: PaymentRow[],
  paymentType: PaymentType
) {
  const balanceByParty = new Map<string, number>();

  entries.forEach((entry) => {
    if (!entry.partyId) {
      return;
    }

    balanceByParty.set(
      entry.partyId,
      (balanceByParty.get(entry.partyId) || 0) + entry.amount
    );
  });

  payments
    .filter((payment) => payment.payment_type === paymentType)
    .forEach((payment) => {
      if (!balanceByParty.has(payment.party_id)) {
        return;
      }

      balanceByParty.set(
        payment.party_id,
        (balanceByParty.get(payment.party_id) || 0) -
          toNumber(payment.amount)
      );
    });

  return Array.from(balanceByParty.values()).reduce(
    (total, balance) => total + Math.max(0, balance),
    0
  );
}

export default function ReportsManager() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [appliedFromDate, setAppliedFromDate] = useState("");
  const [appliedToDate, setAppliedToDate] = useState("");

  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);

    window.setTimeout(() => {
      setMessage("");
    }, 3000);
  }

  async function loadCloudData() {
    setIsLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setProducts([]);
        setSales([]);
        setPurchases([]);
        setPayments([]);
        showMessage("Please sign in to view report data.");
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
        setProducts([]);
        setSales([]);
        setPurchases([]);
        setPayments([]);
        showMessage("Select an active company from the Companies page first.");
        return;
      }

      const [
        productsResponse,
        salesResponse,
        purchasesResponse,
        paymentsResponse,
      ] = await Promise.all([
        supabase
          .from("products")
          .select("id, quantity, purchase_price, low_stock_alert")
          .eq("company_id", activeCompanyId),
        supabase
          .from("sales")
          .select(
            "id, invoice_date, payment_mode, customer_id, grand_total"
          )
          .eq("company_id", activeCompanyId),
        supabase
          .from("purchases")
          .select(
            "id, purchase_date, payment_mode, supplier_id, grand_total"
          )
          .eq("company_id", activeCompanyId),
        supabase
          .from("payments")
          .select(
            "id, payment_type, party_id, payment_date, amount"
          )
          .eq("company_id", activeCompanyId),
      ]);

      if (productsResponse.error) {
        throw productsResponse.error;
      }

      if (salesResponse.error) {
        throw salesResponse.error;
      }

      if (purchasesResponse.error) {
        throw purchasesResponse.error;
      }

      if (paymentsResponse.error) {
        throw paymentsResponse.error;
      }

      setProducts((productsResponse.data || []) as ProductRow[]);
      setSales((salesResponse.data || []) as SaleRow[]);
      setPurchases((purchasesResponse.data || []) as PurchaseRow[]);
      setPayments((paymentsResponse.data || []) as PaymentRow[]);
    } catch (error) {
      setProducts([]);
      setSales([]);
      setPurchases([]);
      setPayments([]);

      showMessage(
        error instanceof Error
          ? error.message
          : "Report data could not be loaded from the cloud database."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadCloudData();

    const refreshEvents = [
      "vertexerp-products-updated",
      "vertexerp-sales-updated",
      "vertexerp-purchases-updated",
      "vertexerp-payments-updated",
      "vertexerp-active-company-updated",
    ];

    refreshEvents.forEach((eventName) => {
      window.addEventListener(eventName, loadCloudData);
    });

    return () => {
      refreshEvents.forEach((eventName) => {
        window.removeEventListener(eventName, loadCloudData);
      });
    };
  }, []);

  const reportData = useMemo<ReportData>(() => {
    const filteredSales = sales.filter((sale) =>
      isDateInRange(
        sale.invoice_date,
        appliedFromDate,
        appliedToDate
      )
    );

    const filteredPurchases = purchases.filter((purchase) =>
      isDateInRange(
        purchase.purchase_date,
        appliedFromDate,
        appliedToDate
      )
    );

    const filteredPayments = payments.filter((payment) =>
      isDateInRange(
        payment.payment_date,
        appliedFromDate,
        appliedToDate
      )
    );

    const totalSales = filteredSales.reduce(
      (total, sale) => total + toNumber(sale.grand_total),
      0
    );

    const totalPurchase = filteredPurchases.reduce(
      (total, purchase) => total + toNumber(purchase.grand_total),
      0
    );

    const customerCreditSales = filteredSales
      .filter((sale) => isCreditPayment(sale.payment_mode))
      .map((sale) => ({
        partyId: sale.customer_id,
        amount: toNumber(sale.grand_total),
      }));

    const supplierCreditPurchases = filteredPurchases
      .filter((purchase) => isCreditPayment(purchase.payment_mode))
      .map((purchase) => ({
        partyId: purchase.supplier_id,
        amount: toNumber(purchase.grand_total),
      }));

    const customerReceivable = calculateOutstanding(
      customerCreditSales,
      filteredPayments,
      "Customer Receipt"
    );

    const supplierPayable = calculateOutstanding(
      supplierCreditPurchases,
      filteredPayments,
      "Supplier Payment"
    );

    const stockValue = products.reduce(
      (total, product) =>
        total +
        toNumber(product.quantity) * toNumber(product.purchase_price),
      0
    );

    const lowStockCount = products.filter(
      (product) =>
        toNumber(product.quantity) <=
        toNumber(product.low_stock_alert)
    ).length;

    return {
      totalSales,
      totalPurchase,
      customerReceivable,
      supplierPayable,
      stockValue,
      lowStockCount,
    };
  }, [
    products,
    sales,
    purchases,
    payments,
    appliedFromDate,
    appliedToDate,
  ]);

  function handleGenerateReport() {
    if (fromDate && toDate && fromDate > toDate) {
      showMessage("From Date cannot be later than To Date.");
      return;
    }

    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);
    showMessage("Cloud report generated successfully.");
  }

  function resetFilter() {
    setFromDate("");
    setToDate("");
    setAppliedFromDate("");
    setAppliedToDate("");
    showMessage("Filters cleared. Showing all cloud data.");
  }

  function getPeriodText() {
    if (appliedFromDate && appliedToDate) {
      return `${appliedFromDate} to ${appliedToDate}`;
    }

    if (appliedFromDate) {
      return `From ${appliedFromDate}`;
    }

    if (appliedToDate) {
      return `Until ${appliedToDate}`;
    }

    return "All cloud data";
  }

  const dataStatus = isLoading ? "Loading..." : getPeriodText();

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:p-6">
          <p className="font-medium text-slate-600">Sales Revenue</p>

          <h2 className="mt-3 break-words text-3xl font-bold text-blue-600 sm:text-4xl">
            {isLoading ? "..." : formatCurrency(reportData.totalSales)}
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Sales within selected date range
          </p>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:p-6">
          <p className="font-medium text-slate-600">Purchase Value</p>

          <h2 className="mt-3 break-words text-3xl font-bold text-purple-600 sm:text-4xl">
            {isLoading ? "..." : formatCurrency(reportData.totalPurchase)}
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Purchases within selected date range
          </p>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:p-6">
          <p className="font-medium text-slate-600">
            Customer Receivable
          </p>

          <h2 className="mt-3 break-words text-3xl font-bold text-orange-500 sm:text-4xl">
            {isLoading
              ? "..."
              : formatCurrency(reportData.customerReceivable)}
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Credit sales minus receipts in selected period
          </p>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:p-6">
          <p className="font-medium text-slate-600">Stock Value</p>

          <h2 className="mt-3 break-words text-3xl font-bold text-green-600 sm:text-4xl">
            {isLoading ? "..." : formatCurrency(reportData.stockValue)}
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            {isLoading
              ? "Loading inventory..."
              : `${reportData.lowStockCount} low-stock product${
                  reportData.lowStockCount !== 1 ? "s" : ""
                }`}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:mt-6 sm:grid-cols-2 sm:gap-6">
        <div className="rounded-3xl border border-orange-100 bg-orange-50 p-5 sm:p-6">
          <p className="font-semibold text-orange-800">
            Supplier Payable
          </p>

          <p className="mt-2 text-3xl font-bold text-orange-600">
            {isLoading ? "..." : formatCurrency(reportData.supplierPayable)}
          </p>

          <p className="mt-2 text-sm text-orange-700">
            Credit purchases minus payments in selected period
          </p>
        </div>

        <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5 sm:p-6">
          <p className="font-semibold text-blue-800">
            Inventory Alert
          </p>

          <p className="mt-2 text-3xl font-bold text-blue-600">
            {isLoading ? "..." : reportData.lowStockCount}
          </p>

          <p className="mt-2 text-sm text-blue-700">
            Products currently at or below their low-stock alert level
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-slate-100 bg-white p-4 shadow-lg sm:mt-8 sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Report Date Filter
            </h2>

            <p className="mt-1 text-sm text-slate-600 sm:text-base">
              Select a date range to generate a filtered cloud report.
            </p>
          </div>

          <span className="w-fit max-w-full break-words rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
            {dataStatus}
          </span>
        </div>

        {message && (
          <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 sm:text-base">
            {message}
          </div>
        )}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label className="mb-2 block font-semibold text-slate-800">
              From Date
            </label>

            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div className="flex-1">
            <label className="mb-2 block font-semibold text-slate-800">
              To Date
            </label>

            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <button
            type="button"
            onClick={handleGenerateReport}
            disabled={isLoading}
            className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto lg:px-7"
          >
            Generate Report
          </button>

          <button
            type="button"
            onClick={resetFilter}
            disabled={isLoading}
            className="w-full rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto lg:px-7"
          >
            Reset Filter
          </button>
        </div>
      </div>
    </>
  );
}