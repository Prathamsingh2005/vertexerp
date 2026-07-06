"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";

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

type ProfileRow = {
  active_company_id: string | null;
};

type SupplierRow = {
  id: string;
  name: string;
  mobile: string | null;
  gst_number: string | null;
};

type PurchaseRow = {
  id: string;
  bill_number: string;
  purchase_date: string;
  payment_mode: string;
  subtotal: number | string | null;
  gst_total: number | string | null;
  discount_total: number | string | null;
  grand_total: number | string | null;
  created_at: string;
  supplier_id: string | null;
  supplier: SupplierRow | SupplierRow[] | null;
  purchase_items:
    | {
        product_id: string | null;
        product_name: string;
        quantity: number | string | null;
        rate: number | string | null;
        gst_rate: number | string | null;
        discount: number | string | null;
        base_amount: number | string | null;
        gst_amount: number | string | null;
        amount: number | string | null;
      }[]
    | null;
};

function formatCurrency(amount: number) {
  return `₹${Number(amount || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function getSupplier(
  supplier: PurchaseRow["supplier"]
): SupplierRow | null {
  return Array.isArray(supplier) ? supplier[0] || null : supplier;
}

function mapPurchaseRow(row: PurchaseRow): Purchase {
  const supplier = getSupplier(row.supplier);

  return {
    id: row.id,
    billNumber: row.bill_number || "",
    date: row.purchase_date || "",
    paymentMode: row.payment_mode || "Cash",
    supplierId: row.supplier_id || supplier?.id || "",
    supplierName: supplier?.name || "Unknown Supplier",
    supplierMobile: supplier?.mobile || "",
    supplierGst: supplier?.gst_number || "",
    items: (row.purchase_items || []).map((item) => ({
      productId: item.product_id || "",
      productName: item.product_name || "Product",
      quantity: Number(item.quantity || 0),
      rate: Number(item.rate || 0),
      gst: Number(item.gst_rate || 0),
      discount: Number(item.discount || 0),
      baseAmount: Number(item.base_amount || 0),
      gstAmount: Number(item.gst_amount || 0),
      amount: Number(item.amount || 0),
    })),
    subtotal: Number(row.subtotal || 0),
    gstTotal: Number(row.gst_total || 0),
    discountTotal: Number(row.discount_total || 0),
    grandTotal: Number(row.grand_total || 0),
    createdAt: row.created_at || "",
  };
}

export default function PurchaseBillPreviewPage() {
  const params = useParams();
  const billId =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : "";

  const [bill, setBill] = useState<Purchase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadPurchaseBill() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        if (!billId) {
          setBill(null);
          setErrorMessage("Purchase bill ID is missing.");
          return;
        }

        const supabase = createClient();

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          setBill(null);
          setErrorMessage("Please sign in to view this purchase bill.");
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
          setBill(null);
          setErrorMessage(
            "Select an active company from the Companies page first."
          );
          return;
        }

        const { data, error } = await supabase
          .from("purchases")
          .select(
            `
              id,
              bill_number,
              purchase_date,
              payment_mode,
              subtotal,
              gst_total,
              discount_total,
              grand_total,
              created_at,
              supplier_id,
              supplier:ledgers!purchases_supplier_id_fkey(
                id,
                name,
                mobile,
                gst_number
              ),
              purchase_items(
                product_id,
                product_name,
                quantity,
                rate,
                gst_rate,
                discount,
                base_amount,
                gst_amount,
                amount
              )
            `
          )
          .eq("id", billId)
          .eq("company_id", activeCompanyId)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!data) {
          setBill(null);
          setErrorMessage(
            "This purchase bill is unavailable for the currently active company."
          );
          return;
        }

        setBill(mapPurchaseRow(data as unknown as PurchaseRow));
      } catch (error) {
        setBill(null);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Purchase bill could not be loaded."
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadPurchaseBill();
  }, [billId]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-slate-100">
        <Sidebar />

        <div className="min-w-0 flex-1">
          <Navbar />

          <main className="p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
            <div className="rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-xl sm:p-10">
              <p className="text-lg font-semibold text-slate-700">
                Loading purchase bill from the cloud database...
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="flex min-h-screen bg-slate-100">
        <Sidebar />

        <div className="min-w-0 flex-1">
          <Navbar />

          <main className="p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-lg sm:p-10">
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                Purchase Bill Not Found
              </h1>

              <p className="mt-3 text-slate-600">
                {errorMessage ||
                  "This purchase bill may have been deleted or is unavailable."}
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

  const items = bill.items;
  const isCreditPayment =
    bill.paymentMode.trim().toLowerCase() === "credit";

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
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .purchase-sidebar-print,
          .purchase-navbar-print,
          .purchase-actions-print {
            display: none !important;
          }

          .purchase-page-print,
          .purchase-content-print,
          .purchase-main-print {
            display: block !important;
            min-height: auto !important;
            width: 100% !important;
            background: white !important;
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
            font-size: 10px !important;
          }

          .purchase-table-print th,
          .purchase-table-print td {
            padding: 7px !important;
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

          <main className="purchase-main-print p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
            <div className="purchase-actions-print mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <Link
                href="/purchase"
                className="flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-100 sm:inline-flex sm:w-auto"
              >
                ← Back to Purchase
              </Link>

              <button
                type="button"
                onClick={() => window.print()}
                className="flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 font-bold text-white shadow-lg transition hover:scale-[1.02] hover:opacity-90 active:scale-[0.98] sm:inline-flex sm:w-auto"
                style={{ backgroundColor: "#7e22ce" }}
              >
                <span className="text-lg">🖨️</span>
                Print Bill
              </button>
            </div>

            <section className="purchase-card-print mx-auto max-w-6xl rounded-3xl border border-slate-200 bg-white p-4 shadow-xl sm:p-6 md:p-8">
              <div className="flex flex-col gap-5 border-b border-slate-200 pb-5 sm:gap-6 sm:pb-6 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-bold tracking-[0.2em] text-purple-600">
                    PURCHASE BILL
                  </p>

                  <h1 className="mt-3 break-words text-2xl font-bold text-slate-900 sm:text-3xl">
                    {bill.billNumber}
                  </h1>

                  <p className="mt-2 text-slate-600">
                    Bill Date: {bill.date}
                  </p>
                </div>

                <div className="w-full rounded-2xl bg-purple-50 px-5 py-4 print:border print:border-slate-200 print:bg-white sm:w-auto">
                  <p className="text-sm font-semibold text-purple-700">
                    Grand Total
                  </p>

                  <p className="mt-2 break-words text-2xl font-bold text-purple-600 sm:text-3xl">
                    {formatCurrency(bill.grandTotal)}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 border-b border-slate-200 pb-6 sm:mt-8 sm:gap-8 sm:pb-8 md:grid-cols-2">
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

              <div className="mt-6 sm:mt-8">
                <h2 className="text-xl font-bold text-slate-900">
                  Purchased Items
                </h2>

                <p className="mt-1 text-slate-600">
                  {items.length} item{items.length !== 1 ? "s" : ""} included
                  in this bill.
                </p>

                <div className="mt-5 space-y-4 md:hidden">
                  {items.map((item, index) => (
                    <article
                      key={`${item.productId}-${index}`}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Item {index + 1}
                          </p>

                          <p className="mt-1 break-words text-base font-bold text-slate-900">
                            {item.productName}
                          </p>
                        </div>

                        <p className="shrink-0 text-lg font-bold text-purple-700">
                          {formatCurrency(item.amount)}
                        </p>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-white p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Quantity
                          </p>

                          <p className="mt-1 font-semibold text-slate-800">
                            {item.quantity}
                          </p>
                        </div>

                        <div className="rounded-xl bg-white p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Rate
                          </p>

                          <p className="mt-1 break-words font-semibold text-slate-800">
                            {formatCurrency(item.rate)}
                          </p>
                        </div>

                        <div className="rounded-xl bg-white p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            GST
                          </p>

                          <p className="mt-1 font-semibold text-slate-800">
                            {item.gst}%
                          </p>
                        </div>

                        <div className="rounded-xl bg-white p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Discount
                          </p>

                          <p className="mt-1 break-words font-semibold text-slate-800">
                            {formatCurrency(item.discount)}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="purchase-table-wrap-print mt-5 hidden overflow-x-auto rounded-2xl border border-slate-200 md:block">
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
                            {formatCurrency(item.discount)}
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

              <div className="mt-5 w-full max-w-sm rounded-2xl border border-slate-200 bg-slate-50 p-4 print:bg-white sm:ml-auto sm:mt-8 sm:p-5">
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