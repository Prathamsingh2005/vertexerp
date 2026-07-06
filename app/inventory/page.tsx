"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import InventoryManager from "@/components/InventoryManager";
import { createClient } from "@/lib/supabase/client";

type ProductStatRow = {
  quantity: number | string | null;
  purchase_price: number | string | null;
  low_stock_alert: number | string | null;
};

type ProfileRow = {
  active_company_id: string | null;
};

function formatCurrency(amount: number) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

export default function InventoryPage() {
  const [products, setProducts] = useState<ProductStatRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  async function loadProductStats() {
    setIsLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setProducts([]);
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
        return;
      }

      const { data, error } = await supabase
        .from("products")
        .select("quantity, purchase_price, low_stock_alert")
        .eq("company_id", activeCompanyId);

      if (error) {
        throw error;
      }

      setProducts(data || []);
    } catch {
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadProductStats();

    window.addEventListener("vertexerp-products-updated", loadProductStats);
    window.addEventListener(
      "vertexerp-active-company-updated",
      loadProductStats
    );

    return () => {
      window.removeEventListener(
        "vertexerp-products-updated",
        loadProductStats
      );
      window.removeEventListener(
        "vertexerp-active-company-updated",
        loadProductStats
      );
    };
  }, []);

  const productStats = useMemo(() => {
    const totalProducts = products.length;
    const inStockProducts = products.filter(
      (product) => Number(product.quantity || 0) > 0
    ).length;
    const lowStockProducts = products.filter((product) => {
      const quantity = Number(product.quantity || 0);
      const lowStockAlert = Number(product.low_stock_alert || 0);

      return quantity > 0 && lowStockAlert > 0 && quantity <= lowStockAlert;
    }).length;

    const stockValue = products.reduce(
      (total, product) =>
        total +
        Number(product.quantity || 0) * Number(product.purchase_price || 0),
      0
    );

    return {
      totalProducts,
      inStockProducts,
      lowStockProducts,
      stockValue,
    };
  }, [products]);

  function scrollToAddProductForm() {
    document
      .querySelector("form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <div className="min-w-0 flex-1">
        <Navbar />

        <main className="p-4 sm:p-6 lg:p-8">
          <div className="mb-6 flex flex-col gap-5 lg:mb-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
                📦 Inventory Management
              </h1>

              <p className="mt-2 max-w-3xl text-base text-slate-600 sm:text-lg">
                Manage products, stock levels and inventory details.
              </p>
            </div>

            <button
              type="button"
              onClick={scrollToAddProductForm}
              className="w-full rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-700 hover:shadow-xl active:scale-[0.98] sm:w-fit"
            >
              + Add Product
            </button>
          </div>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
            <div className="rounded-3xl border border-blue-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">Total Products</p>
              <h2 className="mt-3 text-3xl font-bold text-blue-600 sm:text-4xl">
                {isLoading ? "..." : productStats.totalProducts}
              </h2>
              <p className="mt-2 text-sm text-slate-500">Items in catalogue</p>
            </div>

            <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">In Stock</p>
              <h2 className="mt-3 text-3xl font-bold text-emerald-600 sm:text-4xl">
                {isLoading ? "..." : productStats.inStockProducts}
              </h2>
              <p className="mt-2 text-sm text-slate-500">Available products</p>
            </div>

            <div className="rounded-3xl border border-orange-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">Low Stock</p>
              <h2 className="mt-3 text-3xl font-bold text-orange-500 sm:text-4xl">
                {isLoading ? "..." : productStats.lowStockProducts}
              </h2>
              <p className="mt-2 text-sm text-slate-500">Needs attention</p>
            </div>

            <div className="rounded-3xl border border-purple-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">Stock Value</p>
              <h2 className="mt-3 break-words text-3xl font-bold text-purple-600 sm:text-4xl">
                {isLoading ? "..." : formatCurrency(productStats.stockValue)}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Current inventory value
              </p>
            </div>
          </section>

          <section className="mt-6 rounded-3xl border border-slate-100 bg-white p-4 shadow-lg sm:mt-8 sm:p-5">
            <div className="relative">
              <span className="absolute left-5 top-3.5 text-lg text-slate-400">
                🔍
              </span>

              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search product by name, SKU or category..."
                className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-14 pr-5 text-slate-900 placeholder:text-sm placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 sm:placeholder:text-base"
              />
            </div>
          </section>

          <InventoryManager searchQuery={searchQuery} />
        </main>
      </div>
    </div>
  );
}