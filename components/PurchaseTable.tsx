"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  supplier:
    | {
        id: string;
        name: string;
        mobile: string | null;
        gst_number: string | null;
      }
    | {
        id: string;
        name: string;
        mobile: string | null;
        gst_number: string | null;
      }[]
    | null;
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

function getSupplier(
  supplier: PurchaseRow["supplier"]
): {
  id: string;
  name: string;
  mobile: string | null;
  gst_number: string | null;
} | null {
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

function formatCurrency(value: number) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

export default function PurchaseTable() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);

    window.setTimeout(() => {
      setMessage("");
    }, 4000);
  }

  async function loadPurchases() {
    setIsLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setPurchases([]);
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
        .eq("company_id", activeCompanyId)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setPurchases(
        ((data || []) as unknown as PurchaseRow[]).map(mapPurchaseRow)
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Purchase bills could not be loaded.";

      setPurchases([]);
      showMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadPurchases();

    window.addEventListener(
      "vertexerp-purchases-updated",
      loadPurchases
    );
    window.addEventListener(
      "vertexerp-active-company-updated",
      loadPurchases
    );

    return () => {
      window.removeEventListener(
        "vertexerp-purchases-updated",
        loadPurchases
      );
      window.removeEventListener(
        "vertexerp-active-company-updated",
        loadPurchases
      );
    };
  }, []);

  async function deletePurchase(purchase: Purchase) {
    const shouldDelete = window.confirm(
      `Delete purchase bill ${purchase.billNumber}?\n\nThe purchased quantity will be reversed from inventory. Deletion is blocked if any of this stock has already been sold or adjusted.`
    );

    if (!shouldDelete) {
      return;
    }

    try {
      const supabase = createClient();

      const { error } = await supabase.rpc("delete_purchase_with_stock", {
        p_purchase_id: purchase.id,
      });

      if (error) {
        throw error;
      }

      setPurchases((currentPurchases) =>
        currentPurchases.filter((item) => item.id !== purchase.id)
      );

      window.dispatchEvent(new Event("vertexerp-purchases-updated"));
      window.dispatchEvent(new Event("vertexerp-products-updated"));

      showMessage("Purchase bill deleted and inventory stock reversed.");
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Purchase bill could not be deleted.";

      showMessage(errorMessage);
    }
  }

  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl sm:mt-8 lg:mt-10">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 lg:py-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
            Recent Purchase Bills
          </h2>

          <p className="mt-1 text-sm text-slate-600 sm:text-base">
            View saved supplier purchases and stock-entry history.
          </p>
        </div>

        <div className="w-fit rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
          Total Bills: {purchases.length}
        </div>
      </div>

      {message && (
        <div className="mx-4 mt-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 sm:mx-6 sm:mt-6 sm:text-base">
          {message}
        </div>
      )}

      {isLoading ? (
        <div className="px-4 py-12 text-center text-slate-500 sm:px-6">
          Loading purchase bills from the cloud database...
        </div>
      ) : purchases.length === 0 ? (
        <div className="px-4 py-12 text-center text-slate-500 sm:px-6">
          <p className="text-lg font-semibold text-slate-700">
            No purchase bills saved yet
          </p>

          <p className="mt-2">Save a purchase bill using the form above.</p>
        </div>
      ) : (
        <>
          {/* Phone layout: billing cards are easier to review than a wide table. */}
          <div className="space-y-4 p-4 md:hidden">
            {purchases.map((purchase) => (
              <article
                key={purchase.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/purchase/bill/${purchase.id}`}
                      className="block truncate text-lg font-bold text-blue-600 transition hover:text-blue-800 hover:underline"
                    >
                      {purchase.billNumber}
                    </Link>

                    <p className="mt-1 text-sm text-slate-500">
                      {purchase.items.length} Item
                      {purchase.items.length !== 1 ? "s" : ""} ·{" "}
                      {purchase.date || "No date"}
                    </p>
                  </div>

                  <span className="shrink-0 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                    Saved
                  </span>
                </div>

                <div className="mt-4 rounded-xl bg-white p-3">
                  <p className="font-bold text-slate-900">
                    {purchase.supplierName}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {purchase.supplierMobile || "No mobile added"}
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Payment Mode
                    </p>
                    <p className="mt-1 font-semibold text-slate-800">
                      {purchase.paymentMode}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Amount
                    </p>
                    <p className="mt-1 font-bold text-slate-900">
                      {formatCurrency(purchase.grandTotal)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Link
                    href={`/purchase/bill/${purchase.id}`}
                    className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-center text-sm font-bold text-blue-700 transition hover:bg-blue-100"
                  >
                    View Bill
                  </Link>

                  <button
                    type="button"
                    onClick={() => deletePurchase(purchase)}
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>

          {/* Desktop/tablet layout: table stays available for faster comparison. */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1000px]">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-left">
                  <th className="px-6 py-4 text-sm font-bold text-slate-700">
                    Bill No.
                  </th>

                  <th className="px-6 py-4 text-sm font-bold text-slate-700">
                    Supplier
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
                {purchases.map((purchase) => (
                  <tr
                    key={purchase.id}
                    className="border-b border-slate-100 transition hover:bg-blue-50"
                  >
                    <td className="px-6 py-5">
                      <Link
                        href={`/purchase/bill/${purchase.id}`}
                        className="font-bold text-blue-600 transition hover:text-blue-800 hover:underline"
                      >
                        {purchase.billNumber}
                      </Link>

                      <p className="mt-1 text-xs text-slate-500">
                        {purchase.items.length} Item
                        {purchase.items.length !== 1 ? "s" : ""}
                      </p>
                    </td>

                    <td className="px-6 py-5">
                      <p className="font-bold text-slate-900">
                        {purchase.supplierName}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {purchase.supplierMobile || "No mobile added"}
                      </p>
                    </td>

                    <td className="px-6 py-5 text-slate-700">
                      {purchase.date}
                    </td>

                    <td className="px-6 py-5 text-slate-700">
                      {purchase.paymentMode}
                    </td>

                    <td className="px-6 py-5 font-bold text-slate-900">
                      {formatCurrency(purchase.grandTotal)}
                    </td>

                    <td className="px-6 py-5">
                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                        Saved
                      </span>
                    </td>

                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <Link
                          href={`/purchase/bill/${purchase.id}`}
                          className="font-semibold text-blue-600 transition hover:text-blue-800"
                        >
                          View
                        </Link>

                        <button
                          type="button"
                          onClick={() => deletePurchase(purchase)}
                          className="font-semibold text-red-500 transition hover:text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}