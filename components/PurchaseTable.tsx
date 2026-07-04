"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

type Product = {
  id: string;
  name: string;
  quantity: number;
  [key: string]: unknown;
};

const PURCHASES_KEY = "VertexERP_purchases";
const PRODUCTS_KEY = "VertexERP_products";

const PURCHASE_EVENT = "VertexERP-purchases-updated";
const PRODUCT_EVENT = "VertexERP-products-updated";

export default function PurchaseTable() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  function loadPurchases() {
    try {
      const savedPurchases = window.localStorage.getItem(PURCHASES_KEY);

      if (!savedPurchases) {
        setPurchases([]);
        return;
      }

      const parsedPurchases = JSON.parse(savedPurchases);

      if (Array.isArray(parsedPurchases)) {
        setPurchases(parsedPurchases);
      } else {
        setPurchases([]);
      }
    } catch {
      setPurchases([]);
    }
  }

  useEffect(() => {
    loadPurchases();

    window.addEventListener(PURCHASE_EVENT, loadPurchases);

    return () => {
      window.removeEventListener(PURCHASE_EVENT, loadPurchases);
    };
  }, []);

  function deletePurchase(purchaseId: string, billNumber: string) {
    const purchaseToDelete = purchases.find(
      (purchase) => purchase.id === purchaseId
    );

    if (!purchaseToDelete) {
      window.alert("Purchase bill not found.");
      return;
    }

    const shouldDelete = window.confirm(
      `Delete purchase bill ${billNumber}?\n\nThis will also remove the purchased quantity from inventory.`
    );

    if (!shouldDelete) {
      return;
    }

    try {
      const savedProducts = window.localStorage.getItem(PRODUCTS_KEY);

      const parsedProducts: Product[] = savedProducts
        ? JSON.parse(savedProducts)
        : [];

      if (!Array.isArray(parsedProducts)) {
        window.alert("Inventory data is invalid. Purchase bill was not deleted.");
        return;
      }

      const purchaseItems = Array.isArray(purchaseToDelete.items)
        ? purchaseToDelete.items
        : [];

      const quantityByProduct = new Map<string, number>();

      purchaseItems.forEach((item) => {
        const currentQuantity = quantityByProduct.get(item.productId) || 0;

        quantityByProduct.set(
          item.productId,
          currentQuantity + Number(item.quantity || 0)
        );
      });

      const missingProduct = Array.from(quantityByProduct.keys()).find(
        (productId) =>
          !parsedProducts.some((product) => product.id === productId)
      );

      if (missingProduct) {
        window.alert(
          "This purchase bill cannot be deleted because one or more products no longer exist in inventory."
        );
        return;
      }

      const insufficientStock = Array.from(
        quantityByProduct.entries()
      ).find(([productId, purchasedQuantity]) => {
        const product = parsedProducts.find(
          (savedProduct) => savedProduct.id === productId
        );

        return Number(product?.quantity || 0) < purchasedQuantity;
      });

      if (insufficientStock) {
        const [productId] = insufficientStock;

        const product = parsedProducts.find(
          (savedProduct) => savedProduct.id === productId
        );

        window.alert(
          `Cannot delete this purchase bill because some stock of "${product?.name || "this product"}" has already been sold or adjusted.`
        );

        return;
      }

      const updatedProducts = parsedProducts.map((product) => {
        const quantityToReverse = quantityByProduct.get(product.id) || 0;

        if (quantityToReverse === 0) {
          return product;
        }

        return {
          ...product,
          quantity: Number(product.quantity || 0) - quantityToReverse,
        };
      });

      const updatedPurchases = purchases.filter(
        (purchase) => purchase.id !== purchaseId
      );

      window.localStorage.setItem(
        PRODUCTS_KEY,
        JSON.stringify(updatedProducts)
      );

      window.localStorage.setItem(
        PURCHASES_KEY,
        JSON.stringify(updatedPurchases)
      );

      setPurchases(updatedPurchases);

      window.dispatchEvent(new Event(PRODUCT_EVENT));
      window.dispatchEvent(new Event(PURCHASE_EVENT));
    } catch {
      window.alert(
        "Purchase bill could not be deleted. Please refresh the page and try again."
      );
    }
  }

  return (
    <div className="mt-10 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-8 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Recent Purchase Bills
          </h2>

          <p className="mt-1 text-slate-600">
            View saved supplier purchases and stock-entry history.
          </p>
        </div>

        <div className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
          Total Bills: {purchases.length}
        </div>
      </div>

      <div className="overflow-x-auto">
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
            {purchases.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-12 text-center text-slate-500"
                >
                  <p className="text-lg font-semibold text-slate-700">
                    No purchase bills saved yet
                  </p>

                  <p className="mt-2">
                    Save a purchase bill using the form above.
                  </p>
                </td>
              </tr>
            ) : (
              purchases.map((purchase) => (
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
                    ₹{Number(purchase.grandTotal).toLocaleString("en-IN")}
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
                        onClick={() =>
                          deletePurchase(purchase.id, purchase.billNumber)
                        }
                        className="font-semibold text-red-500 transition hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}