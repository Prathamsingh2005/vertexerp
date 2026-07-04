"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

type PurchaseItem = {
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

type Purchase = {
  id: string;
  billNumber: string;
  date: string;
  paymentMode: string;
  supplierId: string;
  supplierName: string;
  supplierMobile: string;
  supplierGst: string;
  items: PurchaseItem[];
  subtotal: number;
  gstTotal: number;
  discountTotal: number;
  grandTotal: number;
  createdAt: string;
};

const PURCHASES_KEY = "VertexERP_purchases";

function formatCurrency(amount: number) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

export default function PurchaseBillPreviewPage() {
  const params = useParams();

  const billId = typeof params.id === "string" ? params.id : "";

  const [bill, setBill] = useState<Purchase | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const savedPurchases = window.localStorage.getItem(PURCHASES_KEY);

      const purchases: Purchase[] = savedPurchases
        ? JSON.parse(savedPurchases)
        : [];

      const selectedBill = purchases.find(
        (purchase) => purchase.id === billId
      );

      setBill(selectedBill || null);
    } catch {
      setBill(null);
    } finally {
      setIsLoaded(true);
    }
  }, [billId]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen bg-slate-100">
        <Sidebar />

        <div className="flex-1">
          <Navbar />

          <main className="p-8">
            <p className="text-lg font-semibold text-slate-700">
              Loading purchase bill...
            </p>
          </main>
        </div>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="flex min-h-screen bg-slate-100">
        <Sidebar />

        <div className="flex-1">
          <Navbar />

          <main className="p-8">
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-lg">
              <h1 className="text-3xl font-bold text-slate-900">
                Purchase Bill Not Found
              </h1>

              <p className="mt-3 text-slate-600">
                This purchase bill may have been deleted or is unavailable.
              </p>

              <Link
                href="/purchase"
                className="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
              >
                Back to Purchase
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const items = Array.isArray(bill.items) ? bill.items : [];

  const isCreditPayment =
    bill.paymentMode?.toLowerCase() === "credit";

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
          }

          html,
          body {
            background: white !important;
          }

          .purchase-sidebar-print,
          .purchase-navbar-print,
          .purchase-actions-print {
            display: none !important;
          }

          .purchase-page-print {
            display: block !important;
            min-height: auto !important;
            background: white !important;
          }

          .purchase-content-print {
            display: block !important;
            width: 100% !important;
          }

          .purchase-main-print {
            margin: 0 !important;
            padding: 0 !important;
          }

          .purchase-card-print {
            max-width: none !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
          }

          .purchase-table-wrap-print {
            overflow: visible !important;
            border-radius: 0 !important;
          }

          .purchase-table-print {
            min-width: 0 !important;
            font-size: 11px !important;
          }

          .purchase-table-print th,
          .purchase-table-print td {
            padding: 8px !important;
          }
        }
      `}</style>

      <div className="purchase-page-print flex min-h-screen bg-slate-100">
        <div className="purchase-sidebar-print">
          <Sidebar />
        </div>

        <div className="purchase-content-print min-w-0 flex-1">
          <div className="purchase-navbar-print">
            <Navbar />
          </div>

          <main className="purchase-main-print p-6 md:p-8">
            <div className="purchase-actions-print mb-6 flex flex-wrap items-center justify-between gap-3">
              <Link
                href="/purchase"
                className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                ← Back to Purchase
              </Link>

              <button
                    type="button"
                           onClick={() => window.print()}
                            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 font-bold text-white shadow-lg transition hover:scale-[1.02] hover:opacity-90 active:scale-[0.98]"
                           style={{
                             backgroundColor: "#7e22ce",
                           }}
>
  <span className="text-lg">🖨️</span>
  Print Bill
</button>
            </div>

            <section className="purchase-card-print mx-auto max-w-6xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl md:p-8">
              <div className="flex flex-col gap-6 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-bold tracking-[0.2em] text-purple-600">
                    PURCHASE BILL
                  </p>

                  <h1 className="mt-3 text-3xl font-bold text-slate-900">
                    {bill.billNumber}
                  </h1>

                  <p className="mt-2 text-slate-600">
                    Bill Date: {bill.date}
                  </p>
                </div>

                <div className="rounded-2xl bg-purple-50 px-5 py-4 print:border print:border-slate-200 print:bg-white">
                  <p className="text-sm font-semibold text-purple-700">
                    Grand Total
                  </p>

                  <p className="mt-2 text-3xl font-bold text-purple-600">
                    {formatCurrency(bill.grandTotal)}
                  </p>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-1 gap-8 border-b border-slate-200 pb-8 md:grid-cols-2">
                <div>
                  <p className="text-sm font-bold uppercase tracking-wider text-slate-500">
                    Supplier Details
                  </p>

                  <h2 className="mt-3 text-xl font-bold text-slate-900">
                    {bill.supplierName}
                  </h2>

                  <p className="mt-2 text-slate-600">
                    Mobile: {bill.supplierMobile || "Not provided"}
                  </p>

                  <p className="mt-1 text-slate-600">
                    GST Number: {bill.supplierGst || "Not provided"}
                  </p>
                </div>

                <div className="md:text-right">
                  <p className="text-sm font-bold uppercase tracking-wider text-slate-500">
                    Payment Details
                  </p>

                  <p className="mt-3 text-lg font-semibold text-slate-900">
                    {bill.paymentMode}
                  </p>

                  <p className="mt-2 text-slate-600">
                    Status:{" "}
                    <span
                      className={
                        isCreditPayment
                          ? "font-bold text-orange-600"
                          : "font-bold text-green-600"
                      }
                    >
                      {isCreditPayment ? "Pending" : "Paid"}
                    </span>
                  </p>
                </div>
              </div>

              <div className="mt-8">
                <h2 className="text-xl font-bold text-slate-900">
                  Purchased Items
                </h2>

                <p className="mt-1 text-slate-600">
                  {items.length} item{items.length !== 1 ? "s" : ""} included
                  in this bill.
                </p>

                <div className="purchase-table-wrap-print mt-5 overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="purchase-table-print w-full min-w-[850px]">
                    <thead className="bg-slate-50">
                      <tr className="border-b border-slate-200 text-left">
                        <th className="px-5 py-4 text-sm font-bold text-slate-700">
                          #
                        </th>

                        <th className="px-5 py-4 text-sm font-bold text-slate-700">
                          Product
                        </th>

                        <th className="px-5 py-4 text-sm font-bold text-slate-700">
                          Quantity
                        </th>

                        <th className="px-5 py-4 text-sm font-bold text-slate-700">
                          Rate
                        </th>

                        <th className="px-5 py-4 text-sm font-bold text-slate-700">
                          GST
                        </th>

                        <th className="px-5 py-4 text-sm font-bold text-slate-700">
                          Discount
                        </th>

                        <th className="px-5 py-4 text-right text-sm font-bold text-slate-700">
                          Amount
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {items.map((item, index) => (
                        <tr
                          key={`${item.productId}-${index}`}
                          className="border-b border-slate-100 last:border-b-0"
                        >
                          <td className="px-5 py-4 font-semibold text-slate-500">
                            {index + 1}
                          </td>

                          <td className="px-5 py-4">
                            <p className="font-bold text-slate-900">
                              {item.productName}
                            </p>
                          </td>

                          <td className="px-5 py-4 font-semibold text-slate-700">
                            {item.quantity}
                          </td>

                          <td className="px-5 py-4 text-slate-700">
                            {formatCurrency(item.rate)}
                          </td>

                          <td className="px-5 py-4 text-slate-700">
                            {item.gst}%
                          </td>

                          <td className="px-5 py-4 text-slate-700">
                            {item.discount}%
                          </td>

                          <td className="px-5 py-4 text-right font-bold text-slate-900">
                            {formatCurrency(item.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-8 ml-auto max-w-sm rounded-2xl border border-slate-200 bg-slate-50 p-5 print:bg-white">
                <div className="flex items-center justify-between gap-4 text-slate-700">
                  <span>Subtotal</span>

                  <span className="font-semibold">
                    {formatCurrency(bill.subtotal)}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between gap-4 text-slate-700">
                  <span>Discount</span>

                  <span className="font-semibold text-red-600">
                    - {formatCurrency(bill.discountTotal)}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between gap-4 text-slate-700">
                  <span>GST</span>

                  <span className="font-semibold">
                    {formatCurrency(bill.gstTotal)}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between gap-4 border-t border-slate-300 pt-4">
                  <span className="text-lg font-bold text-slate-900">
                    Grand Total
                  </span>

                  <span className="text-xl font-bold text-purple-600">
                    {formatCurrency(bill.grandTotal)}
                  </span>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </>
  );
}