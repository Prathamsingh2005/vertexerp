"use client";
import Link from "next/link";

import { useEffect, useState } from "react";

type SalesItem = {
  productId: string;
  productName: string;
  quantity: number;
  rate: number;
  gst: number;
  discount: number;
  baseAmount: number;
  gstAmount: number;
  amount: number;
};

type Sale = {
  id: string;
  invoiceNumber: string;
  date: string;
  paymentMode: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  customerGst: string;
  items: SalesItem[];
  subtotal: number;
  gstTotal: number;
  discountTotal: number;
  grandTotal: number;
  createdAt: string;
};

type Product = {
  id: string;
  quantity: number;
};

const SALES_KEY = "VertexERP_sales";
const PRODUCTS_KEY = "VertexERP_products";
const SALES_EVENT = "VertexERP-sales-updated";


type SalesInvoiceTableProps = {
  refreshKey?: number;
};

export default function SalesInvoiceTable({
  refreshKey = 0,
}: SalesInvoiceTableProps) {
  const [sales, setSales] = useState<Sale[]>([]);

  function loadSales() {
    try {
      const savedSales = window.localStorage.getItem(SALES_KEY);

      if (!savedSales) {
        setSales([]);
        return;
      }

      const parsedSales = JSON.parse(savedSales);

      if (Array.isArray(parsedSales)) {
        setSales(parsedSales);
      } else {
        setSales([]);
      }
    } catch {
      setSales([]);
    }
  }

  useEffect(() => {
    loadSales();

    window.addEventListener(SALES_EVENT, loadSales);

    return () => {
      window.removeEventListener(SALES_EVENT, loadSales);
    };
  }, [refreshKey]);

  function deleteInvoice(invoice: Sale) {
    const shouldDelete = window.confirm(
      `Delete invoice ${invoice.invoiceNumber}? Product stock will be restored.`
    );

    if (!shouldDelete) {
      return;
    }

    try {
      const savedProducts = window.localStorage.getItem(PRODUCTS_KEY);

      const products: Product[] = savedProducts
        ? JSON.parse(savedProducts)
        : [];

      const updatedProducts = products.map((product) => {
        const soldQuantity = invoice.items
          .filter((item) => item.productId === product.id)
          .reduce((sum, item) => sum + item.quantity, 0);

        if (soldQuantity === 0) {
          return product;
        }

        return {
          ...product,
          quantity: Number(product.quantity || 0) + soldQuantity,
        };
      });

      const updatedSales = sales.filter(
        (sale) => sale.id !== invoice.id
      );

      window.localStorage.setItem(
        PRODUCTS_KEY,
        JSON.stringify(updatedProducts)
      );

      window.localStorage.setItem(
        SALES_KEY,
        JSON.stringify(updatedSales)
      );

      setSales(updatedSales);

      window.dispatchEvent(new Event(SALES_EVENT));
    } catch {
      window.alert("Invoice could not be deleted. Please try again.");
    }
  }

  function getPaymentStatus(paymentMode: string) {
    if (paymentMode === "Credit") {
      return {
        label: "Pending",
        className: "bg-orange-100 text-orange-700",
      };
    }

    return {
      label: "Paid",
      className: "bg-green-100 text-green-700",
    };
  }

  return (
    <div className="mt-10 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-8 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Recent Sales Invoices
          </h2>

          <p className="mt-1 text-slate-600">
            View saved invoices, customer details and payment status.
          </p>
        </div>

        <div className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
          Total Invoices: {sales.length}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px]">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200 text-left">
              <th className="px-6 py-4 text-sm font-bold text-slate-700">
                Invoice No.
              </th>

              <th className="px-6 py-4 text-sm font-bold text-slate-700">
                Customer
              </th>

              <th className="px-6 py-4 text-sm font-bold text-slate-700">
                Date
              </th>

              <th className="px-6 py-4 text-sm font-bold text-slate-700">
                Payment Mode
              </th>

              <th className="px-6 py-4 text-sm font-bold text-slate-700">
                Amount
              </th>

              <th className="px-6 py-4 text-sm font-bold text-slate-700">
                Status
              </th>

              <th className="px-6 py-4 text-sm font-bold text-slate-700">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {sales.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-12 text-center text-slate-500"
                >
                  <p className="text-lg font-semibold text-slate-700">
                    No sales invoices saved yet
                  </p>

                  <p className="mt-2">
                    Create an invoice using the form above.
                  </p>
                </td>
              </tr>
            ) : (
              sales.map((sale) => {
                const status = getPaymentStatus(sale.paymentMode);

                return (
                  <tr
                    key={sale.id}
                    className="border-b border-slate-100 transition hover:bg-blue-50"
                  >
                    <td className="px-6 py-5">
                      <p className="font-bold text-blue-600">
                        {sale.invoiceNumber}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {sale.items.length} Item
                        {sale.items.length !== 1 ? "s" : ""}
                      </p>
                    </td>

                    <td className="px-6 py-5">
                      <p className="font-bold text-slate-900">
                        {sale.customerName}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {sale.customerMobile || "No mobile added"}
                      </p>
                    </td>

                    <td className="px-6 py-5 text-slate-700">
                      {sale.date}
                    </td>

                    <td className="px-6 py-5 text-slate-700">
                      {sale.paymentMode}
                    </td>

                    <td className="px-6 py-5 font-bold text-slate-900">
                      ₹{Number(sale.grandTotal).toLocaleString("en-IN")}
                    </td>

                    <td className="px-6 py-5">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </td>

                    <td className="px-6 py-5">
  <div className="flex items-center gap-4">
    <Link
      href={`/sales/invoice/${sale.id}`}
      className="font-semibold text-blue-600 transition hover:text-blue-800"
    >
      View
    </Link>

    <button
      type="button"
      onClick={() => deleteInvoice(sale)}
      className="font-semibold text-red-500 transition hover:text-red-700"
    >
      Delete
    </button>
  </div>
</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}