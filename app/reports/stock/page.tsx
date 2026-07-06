"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";

type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  unit: string | null;
  purchase_price: number | string | null;
  selling_price: number | string | null;
  quantity: number | string | null;
  low_stock_alert: number | string | null;
  gst_rate: number | string | null;
  description: string | null;
};

type ProfileRow = {
  active_company_id: string | null;
};

type Product = {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  quantity: number;
  lowStockAlert: number;
  gst: number;
  description: string;
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

function getStockStatus(product: Product) {
  const quantity = toNumber(product.quantity);
  const alertLevel = toNumber(product.lowStockAlert);

  if (quantity === 0) {
    return {
      label: "Out of Stock",
      className: "bg-red-100 text-red-700",
    };
  }

  if (quantity <= alertLevel) {
    return {
      label: "Low Stock",
      className: "bg-orange-100 text-orange-700",
    };
  }

  return {
    label: "In Stock",
    className: "bg-green-100 text-green-700",
  };
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name || "Unnamed Product",
    sku: row.sku || "—",
    category: row.category || "Uncategorized",
    unit: row.unit || "Unit",
    purchasePrice: toNumber(row.purchase_price),
    sellingPrice: toNumber(row.selling_price),
    quantity: toNumber(row.quantity),
    lowStockAlert: toNumber(row.low_stock_alert),
    gst: toNumber(row.gst_rate),
    description: row.description || "",
  };
}

export default function StockReportPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);

    window.setTimeout(() => {
      setMessage("");
    }, 4500);
  }

  async function loadProducts() {
    setIsLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setProducts([]);
        showMessage("Please sign in to view the stock report.");
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
        showMessage("Select an active company from the Companies page first.");
        return;
      }

      const { data, error } = await supabase
        .from("products")
        .select(
          "id, name, sku, category, unit, purchase_price, selling_price, quantity, low_stock_alert, gst_rate, description"
        )
        .eq("company_id", activeCompanyId)
        .order("name", { ascending: true });

      if (error) {
        throw error;
      }

      setProducts(((data || []) as ProductRow[]).map(mapProduct));
    } catch (error) {
      setProducts([]);

      showMessage(
        error instanceof Error
          ? error.message
          : "Stock report data could not be loaded from the cloud database."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();

    const refreshEvents = [
      "vertexerp-products-updated",
      "vertexerp-active-company-updated",
    ];

    refreshEvents.forEach((eventName) => {
      window.addEventListener(eventName, loadProducts);
    });

    return () => {
      refreshEvents.forEach((eventName) => {
        window.removeEventListener(eventName, loadProducts);
      });
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return products.filter((product) => {
      const status = getStockStatus(product);

      const matchesSearch =
        !search ||
        product.name.toLowerCase().includes(search) ||
        product.sku.toLowerCase().includes(search) ||
        product.category.toLowerCase().includes(search);

      const matchesStatus =
        statusFilter === "All" || status.label === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [products, searchTerm, statusFilter]);

  const stockValue = products.reduce(
    (total, product) => total + product.quantity * product.purchasePrice,
    0
  );

  const lowStockCount = products.filter((product) => {
    const quantity = toNumber(product.quantity);
    const alertLevel = toNumber(product.lowStockAlert);

    return quantity > 0 && quantity <= alertLevel;
  }).length;

  const outOfStockCount = products.filter(
    (product) => toNumber(product.quantity) === 0
  ).length;

  function resetFilters() {
    setSearchTerm("");
    setStatusFilter("All");
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
                📦 Stock Report
              </h1>

              <p className="mt-2 text-base text-slate-600 sm:text-lg">
                Review product availability, stock value and inventory alerts.
              </p>
            </div>

            <Link
              href="/reports"
              className="w-full rounded-xl border border-slate-300 bg-white px-6 py-3 text-center font-semibold text-slate-700 transition hover:bg-slate-100 sm:w-fit"
            >
              ← Back to Reports
            </Link>
          </div>

          {message && (
            <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 sm:mb-6 sm:text-base">
              {message}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">Total Products</p>

              <h2 className="mt-3 break-words text-3xl font-bold text-blue-600 sm:text-4xl">
                {isLoading ? "..." : products.length}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Products in active company inventory
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">Stock Value</p>

              <h2 className="mt-3 break-words text-3xl font-bold text-green-600 sm:text-4xl">
                {isLoading ? "..." : formatCurrency(stockValue)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Based on current purchase prices
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">Low Stock Items</p>

              <h2 className="mt-3 break-words text-3xl font-bold text-orange-500 sm:text-4xl">
                {isLoading ? "..." : lowStockCount}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Products at or below alert level
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">Out of Stock</p>

              <h2 className="mt-3 break-words text-3xl font-bold text-red-600 sm:text-4xl">
                {isLoading ? "..." : outOfStockCount}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Products requiring restocking
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-slate-100 bg-white p-4 shadow-lg sm:mt-8 sm:p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search product, SKU or category..."
                className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none placeholder:text-slate-500 transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 lg:col-span-3"
              />

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              >
                <option>All</option>
                <option>In Stock</option>
                <option>Low Stock</option>
                <option>Out of Stock</option>
              </select>
            </div>

            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-5 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-100 sm:w-auto"
            >
              Reset Filters
            </button>
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl sm:mt-8">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 lg:py-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
                  Inventory Products
                </h2>

                <p className="mt-1 text-sm text-slate-600 sm:text-base">
                  {isLoading
                    ? "Loading cloud inventory..."
                    : `${filteredProducts.length} product${
                        filteredProducts.length !== 1 ? "s" : ""
                      } found`}
                </p>
              </div>

              <div className="rounded-full bg-green-50 px-4 py-2 text-sm font-semibold text-green-700">
                Stock Value: {isLoading ? "..." : formatCurrency(stockValue)}
              </div>
            </div>

            <div className="p-4 md:hidden">
              {isLoading ? (
                <p className="py-10 text-center text-sm text-slate-500">
                  Loading inventory from the cloud database...
                </p>
              ) : filteredProducts.length === 0 ? (
                <div className="py-10 text-center text-slate-500">
                  <p className="text-lg font-semibold text-slate-700">
                    No products found
                  </p>

                  <p className="mt-2 text-sm">
                    Change filters or add products from Inventory.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredProducts.map((product) => {
                    const status = getStockStatus(product);
                    const productStockValue =
                      product.quantity * product.purchasePrice;

                    return (
                      <article
                        key={product.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-lg font-bold text-slate-900">
                              {product.name}
                            </p>

                            <p className="mt-1 truncate text-sm text-slate-500">
                              {product.category} · SKU: {product.sku}
                            </p>
                          </div>

                          <span
                            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${status.className}`}
                          >
                            {status.label}
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div className="rounded-xl bg-white p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Available Stock
                            </p>

                            <p className="mt-1 font-bold text-slate-900">
                              {product.quantity} {product.unit}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              Alert at {product.lowStockAlert}
                            </p>
                          </div>

                          <div className="rounded-xl bg-white p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Stock Value
                            </p>

                            <p className="mt-1 break-words font-bold text-green-700">
                              {formatCurrency(productStockValue)}
                            </p>
                          </div>

                          <div className="rounded-xl bg-white p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Purchase Price
                            </p>

                            <p className="mt-1 font-semibold text-slate-800">
                              {formatCurrency(product.purchasePrice)}
                            </p>
                          </div>

                          <div className="rounded-xl bg-white p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Selling Price
                            </p>

                            <p className="mt-1 font-semibold text-slate-800">
                              {formatCurrency(product.sellingPrice)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                          <span>Unit: {product.unit}</span>
                          <span>GST: {product.gst}%</span>
                        </div>

                        {product.description && (
                          <p className="mt-3 rounded-xl bg-white p-3 text-sm leading-6 text-slate-700">
                            {product.description}
                          </p>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1100px]">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200 text-left">
                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Product
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      SKU
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Category
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Available Stock
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Purchase Price
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Selling Price
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Stock Value
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-6 py-12 text-center text-slate-500"
                      >
                        Loading inventory from the cloud database...
                      </td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-6 py-12 text-center text-slate-500"
                      >
                        <p className="text-lg font-semibold text-slate-700">
                          No products found
                        </p>

                        <p className="mt-2">
                          Change filters or add products from Inventory.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((product) => {
                      const status = getStockStatus(product);
                      const productStockValue =
                        product.quantity * product.purchasePrice;

                      return (
                        <tr
                          key={product.id}
                          className="border-b border-slate-100 transition hover:bg-green-50"
                        >
                          <td className="px-6 py-5">
                            <p className="font-bold text-slate-900">
                              {product.name}
                            </p>

                            <p className="mt-1 text-sm text-slate-500">
                              Unit: {product.unit} • GST: {product.gst}%
                            </p>
                          </td>

                          <td className="px-6 py-5 font-medium text-slate-700">
                            {product.sku}
                          </td>

                          <td className="px-6 py-5 text-slate-700">
                            {product.category}
                          </td>

                          <td className="px-6 py-5">
                            <p className="font-bold text-slate-900">
                              {product.quantity} {product.unit}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              Alert at {product.lowStockAlert}
                            </p>
                          </td>

                          <td className="px-6 py-5 text-slate-700">
                            {formatCurrency(product.purchasePrice)}
                          </td>

                          <td className="px-6 py-5 font-semibold text-slate-900">
                            {formatCurrency(product.sellingPrice)}
                          </td>

                          <td className="px-6 py-5 font-bold text-green-700">
                            {formatCurrency(productStockValue)}
                          </td>

                          <td className="px-6 py-5">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${status.className}`}
                            >
                              {status.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}