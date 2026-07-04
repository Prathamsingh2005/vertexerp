"use client";

import { useEffect, useState } from "react";

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
  monthlySales: number;
  monthlyPurchase: number;
  customerReceivable: number;
  supplierPayable: number;
  stockValue: number;
  lowStockCount: number;
};

const initialReportData: ReportData = {
  monthlySales: 0,
  monthlyPurchase: 0,
  customerReceivable: 0,
  supplierPayable: 0,
  stockValue: 0,
  lowStockCount: 0,
};

function isCurrentMonth(dateValue: string) {
  if (!dateValue) {
    return false;
  }

  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const today = new Date();

  return (
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export default function ReportsSummary() {
  const [reportData, setReportData] =
    useState<ReportData>(initialReportData);

  useEffect(() => {
    try {
      const savedProducts = window.localStorage.getItem("VertexERP_products");
      const savedSales = window.localStorage.getItem("VertexERP_sales");
      const savedPurchases =
        window.localStorage.getItem("VertexERP_purchases");

      const products: Product[] = savedProducts
        ? JSON.parse(savedProducts)
        : [];

      const sales: Sale[] = savedSales ? JSON.parse(savedSales) : [];

      const purchases: Purchase[] = savedPurchases
        ? JSON.parse(savedPurchases)
        : [];

      const monthlySales = sales
        .filter((sale) => isCurrentMonth(sale.date))
        .reduce(
          (total, sale) => total + Number(sale.grandTotal || 0),
          0
        );

      const monthlyPurchase = purchases
        .filter((purchase) => isCurrentMonth(purchase.date))
        .reduce(
          (total, purchase) =>
            total + Number(purchase.grandTotal || 0),
          0
        );

      const customerReceivable = sales
        .filter((sale) => sale.paymentMode === "Credit")
        .reduce(
          (total, sale) => total + Number(sale.grandTotal || 0),
          0
        );

      const supplierPayable = purchases
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

      setReportData({
        monthlySales,
        monthlyPurchase,
        customerReceivable,
        supplierPayable,
        stockValue,
        lowStockCount,
      });
    } catch {
      setReportData(initialReportData);
    }
  }, []);

  return (
    <>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
          <p className="font-medium text-slate-600">This Month&apos;s Sales</p>

          <h2 className="mt-3 text-4xl font-bold text-blue-600">
            ₹{reportData.monthlySales.toLocaleString("en-IN")}
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Revenue from saved invoices
          </p>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
          <p className="font-medium text-slate-600">
            This Month&apos;s Purchase
          </p>

          <h2 className="mt-3 text-4xl font-bold text-purple-600">
            ₹{reportData.monthlyPurchase.toLocaleString("en-IN")}
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Value of saved purchase bills
          </p>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
          <p className="font-medium text-slate-600">
            Customer Receivable
          </p>

          <h2 className="mt-3 text-4xl font-bold text-orange-500">
            ₹{reportData.customerReceivable.toLocaleString("en-IN")}
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Credit invoice amount pending
          </p>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
          <p className="font-medium text-slate-600">Stock Value</p>

          <h2 className="mt-3 text-4xl font-bold text-green-600">
            ₹{reportData.stockValue.toLocaleString("en-IN")}
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            {reportData.lowStockCount} low-stock product
            {reportData.lowStockCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-3xl border border-orange-100 bg-orange-50 p-6">
          <p className="font-semibold text-orange-800">Supplier Payable</p>

          <p className="mt-2 text-3xl font-bold text-orange-600">
            ₹{reportData.supplierPayable.toLocaleString("en-IN")}
          </p>

          <p className="mt-2 text-sm text-orange-700">
            Credit purchases pending for payment
          </p>
        </div>

        <div className="rounded-3xl border border-blue-100 bg-blue-50 p-6">
          <p className="font-semibold text-blue-800">Inventory Alert</p>

          <p className="mt-2 text-3xl font-bold text-blue-600">
            {reportData.lowStockCount}
          </p>

          <p className="mt-2 text-sm text-blue-700">
            Products currently at or below their low-stock alert level
          </p>
        </div>
      </div>
    </>
  );
}