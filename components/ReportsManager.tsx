"use client";

import { useEffect, useMemo, useState } from "react";

type Product = {
  quantity: number;
  purchasePrice: number;
  lowStockAlert: number;
};

type Sale = {
  date: string;
  paymentMode: string;
  grandTotal: number;
};

type Purchase = {
  date: string;
  paymentMode: string;
  grandTotal: number;
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

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
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

export default function ReportsManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [appliedFromDate, setAppliedFromDate] = useState("");
  const [appliedToDate, setAppliedToDate] = useState("");

  const [message, setMessage] = useState("");

  function loadSavedData() {
    try {
      const savedProducts = window.localStorage.getItem("VertexERP_products");
      const savedSales = window.localStorage.getItem("VertexERP_sales");
      const savedPurchases =
        window.localStorage.getItem("VertexERP_purchases");

      const parsedProducts = savedProducts
        ? JSON.parse(savedProducts)
        : [];

      const parsedSales = savedSales ? JSON.parse(savedSales) : [];

      const parsedPurchases = savedPurchases
        ? JSON.parse(savedPurchases)
        : [];

      setProducts(Array.isArray(parsedProducts) ? parsedProducts : []);
      setSales(Array.isArray(parsedSales) ? parsedSales : []);
      setPurchases(
        Array.isArray(parsedPurchases) ? parsedPurchases : []
      );
    } catch {
      setProducts([]);
      setSales([]);
      setPurchases([]);
    }
  }

  useEffect(() => {
    loadSavedData();

    window.addEventListener(
      "VertexERP-sales-updated",
      loadSavedData
    );

    window.addEventListener(
      "VertexERP-purchases-updated",
      loadSavedData
    );

    return () => {
      window.removeEventListener(
        "VertexERP-sales-updated",
        loadSavedData
      );

      window.removeEventListener(
        "VertexERP-purchases-updated",
        loadSavedData
      );
    };
  }, []);

  const reportData = useMemo(() => {
    const filteredSales = sales.filter((sale) =>
      isDateInRange(
        sale.date,
        appliedFromDate,
        appliedToDate
      )
    );

    const filteredPurchases = purchases.filter((purchase) =>
      isDateInRange(
        purchase.date,
        appliedFromDate,
        appliedToDate
      )
    );

    const totalSales = filteredSales.reduce(
      (total, sale) => total + Number(sale.grandTotal || 0),
      0
    );

    const totalPurchase = filteredPurchases.reduce(
      (total, purchase) =>
        total + Number(purchase.grandTotal || 0),
      0
    );

    const customerReceivable = filteredSales
      .filter((sale) => sale.paymentMode === "Credit")
      .reduce(
        (total, sale) => total + Number(sale.grandTotal || 0),
        0
      );

    const supplierPayable = filteredPurchases
      .filter((purchase) => purchase.paymentMode === "Credit")
      .reduce(
        (total, purchase) =>
          total + Number(purchase.grandTotal || 0),
        0
      );

    const stockValue = products.reduce(
      (total, product) =>
        total +
        Number(product.quantity || 0) *
          Number(product.purchasePrice || 0),
      0
    );

    const lowStockCount = products.filter(
      (product) =>
        Number(product.quantity || 0) <=
        Number(product.lowStockAlert || 0)
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
    appliedFromDate,
    appliedToDate,
  ]);

  function handleGenerateReport() {
    if (fromDate && toDate && fromDate > toDate) {
      setMessage("From Date cannot be later than To Date.");
      return;
    }

    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);
    setMessage("Report generated successfully.");

    window.setTimeout(() => {
      setMessage("");
    }, 2500);
  }

  function resetFilter() {
    setFromDate("");
    setToDate("");
    setAppliedFromDate("");
    setAppliedToDate("");
    setMessage("Filters cleared. Showing all saved data.");

    window.setTimeout(() => {
      setMessage("");
    }, 2500);
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

    return "All saved data";
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
          <p className="font-medium text-slate-600">Sales Revenue</p>

          <h2 className="mt-3 text-4xl font-bold text-blue-600">
            {formatCurrency(reportData.totalSales)}
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Sales within selected date range
          </p>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
          <p className="font-medium text-slate-600">Purchase Value</p>

          <h2 className="mt-3 text-4xl font-bold text-purple-600">
            {formatCurrency(reportData.totalPurchase)}
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Purchases within selected date range
          </p>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
          <p className="font-medium text-slate-600">
            Customer Receivable
          </p>

          <h2 className="mt-3 text-4xl font-bold text-orange-500">
            {formatCurrency(reportData.customerReceivable)}
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Credit invoice amount pending
          </p>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
          <p className="font-medium text-slate-600">Stock Value</p>

          <h2 className="mt-3 text-4xl font-bold text-green-600">
            {formatCurrency(reportData.stockValue)}
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            {reportData.lowStockCount} low-stock product
            {reportData.lowStockCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-3xl border border-orange-100 bg-orange-50 p-6">
          <p className="font-semibold text-orange-800">
            Supplier Payable
          </p>

          <p className="mt-2 text-3xl font-bold text-orange-600">
            {formatCurrency(reportData.supplierPayable)}
          </p>

          <p className="mt-2 text-sm text-orange-700">
            Credit purchases pending for payment
          </p>
        </div>

        <div className="rounded-3xl border border-blue-100 bg-blue-50 p-6">
          <p className="font-semibold text-blue-800">
            Inventory Alert
          </p>

          <p className="mt-2 text-3xl font-bold text-blue-600">
            {reportData.lowStockCount}
          </p>

          <p className="mt-2 text-sm text-blue-700">
            Products currently at or below their low-stock alert level
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Report Date Filter
            </h2>

            <p className="mt-1 text-slate-600">
              Select a date range to generate a filtered report.
            </p>
          </div>

          <span className="w-fit rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
            {getPeriodText()}
          </span>
        </div>

        {message && (
          <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 font-medium text-blue-700">
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
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <button
            type="button"
            onClick={handleGenerateReport}
            className="rounded-xl bg-blue-600 px-7 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-700 hover:shadow-xl"
          >
            Generate Report
          </button>

          <button
            type="button"
            onClick={resetFilter}
            className="rounded-xl border border-slate-300 bg-white px-7 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Reset Filter
          </button>
        </div>
      </div>
    </>
  );
}