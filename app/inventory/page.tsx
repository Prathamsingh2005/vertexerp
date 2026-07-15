"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import InventoryManager from "@/components/InventoryManager";
import { usePermissions } from "@/hooks/usePermissions";
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
  const {
    access,
    can,
    error: permissionError,
    isLoading: isPermissionLoading,
  } = usePermissions();

  const [products, setProducts] = useState<ProductStatRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const canViewInventory = can("inventory.view");
  const canCreateProduct = can("inventory.create");
  const canEditProduct = can("inventory.edit");
  const canDeleteProduct = can("inventory.delete");
  const hasWriteAccess =
    canCreateProduct || canEditProduct || canDeleteProduct;

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
    if (!canCreateProduct) {
      return;
    }

    document.getElementById("product-form")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <div className="flex min-h-screen bg-[#f3f6fb]">
      <Sidebar />

      <div className="min-w-0 flex-1 overflow-x-hidden">
        <Navbar />

        <main className="min-w-0 p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
          <section className="overflow-hidden rounded-[30px] bg-gradient-to-br from-violet-950 via-violet-800 to-violet-600 p-6 text-white shadow-2xl shadow-violet-900/20 sm:p-8 lg:p-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-violet-100 backdrop-blur">
                  <span>📦</span>
                  Inventory Control Center
                </div>

                <h1 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                  Inventory Management
                </h1>

                <p className="mt-3 max-w-2xl text-base leading-7 text-violet-100 sm:text-lg">
                  Manage products, GST setup, stock levels and inventory value
                  from one permission-aware workspace.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
                <div className="rounded-2xl border border-white/15 bg-slate-950/25 px-5 py-4 backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-200">
                    Active Access
                  </p>

                  <p className="mt-1 text-lg font-black">
                    {isPermissionLoading
                      ? "Loading..."
                      : access?.roleName || "No active role"}
                  </p>

                  <p className="mt-1 text-sm text-violet-100">
                    {hasWriteAccess ? "Operational access" : "Read-only access"}
                  </p>
                </div>

                {!isPermissionLoading && canCreateProduct && (
                  <button
                    type="button"
                    onClick={scrollToAddProductForm}
                    className="w-full rounded-2xl bg-white px-6 py-3.5 font-black text-violet-800 shadow-xl transition hover:-translate-y-0.5 hover:bg-violet-50 active:translate-y-0 sm:w-fit"
                  >
                    + Add Product
                  </button>
                )}
              </div>
            </div>
          </section>

          {permissionError && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-semibold text-red-700">
              {permissionError}
            </div>
          )}

          {!isPermissionLoading && !canViewInventory ? (
            <section className="mt-6 rounded-3xl border border-red-200 bg-white p-6 text-center shadow-xl sm:p-10">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl">
                🔒
              </div>

              <h2 className="mt-5 text-2xl font-black text-slate-900">
                Inventory Access Restricted
              </h2>

              <p className="mx-auto mt-3 max-w-2xl leading-7 text-slate-600">
                Your current role does not include the inventory.view
                permission. Ask the company Owner or Admin to update your role.
              </p>
            </section>
          ) : (
            <>
              {!isPermissionLoading && !hasWriteAccess && (
                <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 text-violet-900">
                  <p className="font-black">Read-only inventory access</p>
                  <p className="mt-1 text-sm leading-6 text-violet-700">
                    You can review products, stock and GST details. Add, edit,
                    stock adjustment and delete actions are hidden for your
                    current role.
                  </p>
                </div>
              )}

              <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
                <StatCard
                  eyebrow="Catalogue"
                  label="Total Products"
                  value={
                    isLoading ? "..." : String(productStats.totalProducts)
                  }
                  description="Items and services in catalogue"
                  accentClassName="from-violet-600 to-fuchsia-500"
                />

                <StatCard
                  eyebrow="Availability"
                  label="In Stock"
                  value={
                    isLoading ? "..." : String(productStats.inStockProducts)
                  }
                  description="Products currently available"
                  accentClassName="from-emerald-500 to-teal-500"
                />

                <StatCard
                  eyebrow="Attention"
                  label="Low Stock"
                  value={
                    isLoading ? "..." : String(productStats.lowStockProducts)
                  }
                  description="Products near alert level"
                  accentClassName="from-amber-500 to-orange-500"
                />

                <StatCard
                  eyebrow="Valuation"
                  label="Stock Value"
                  value={
                    isLoading
                      ? "..."
                      : formatCurrency(productStats.stockValue)
                  }
                  description="Current inventory purchase value"
                  accentClassName="from-indigo-600 to-violet-600"
                />
              </section>

              <section className="mt-6 rounded-3xl border border-violet-100 bg-white p-4 shadow-xl shadow-slate-200/60 sm:mt-8 sm:p-5">
                <div className="relative">
                  <span className="absolute left-5 top-3.5 text-lg text-violet-400">
                    🔍
                  </span>

                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search product by name, SKU, HSN/SAC or category..."
                    className="w-full rounded-2xl border border-violet-200 bg-violet-50/40 py-3 pl-14 pr-5 text-slate-900 placeholder:text-sm placeholder:text-slate-500 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100 sm:placeholder:text-base"
                  />
                </div>
              </section>

              <InventoryManager
                searchQuery={searchQuery}
                canCreate={canCreateProduct}
                canEdit={canEditProduct}
                canDelete={canDeleteProduct}
              />
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function StatCard({
  eyebrow,
  label,
  value,
  description,
  accentClassName,
}: {
  eyebrow: string;
  label: string;
  value: string;
  description: string;
  accentClassName: string;
}) {
  return (
    <article className="group relative overflow-hidden rounded-3xl border border-violet-100 bg-white p-5 shadow-xl shadow-slate-200/60 transition hover:-translate-y-1 sm:p-6">
      <div
        className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${accentClassName}`}
      />

      <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-500">
        {eyebrow}
      </p>

      <p className="mt-2 font-semibold text-slate-600">{label}</p>

      <h2 className="mt-3 break-words text-3xl font-black text-slate-950 sm:text-4xl">
        {value}
      </h2>

      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </article>
  );
}