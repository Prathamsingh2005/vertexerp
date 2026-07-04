"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import InventoryManager from "@/components/InventoryManager";

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

const PRODUCTS_KEY = "VertexERP_products";
const PRODUCT_EVENT = "VertexERP-products-updated";
const PURCHASE_EVENT = "VertexERP-purchases-updated";
const SALES_EVENT = "VertexERP-sales-updated";

function formatCurrency(amount: number) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  function loadProducts() {
    try {
      const savedProducts = window.localStorage.getItem(PRODUCTS_KEY);

      if (!savedProducts) {
        setProducts([]);
        return;
      }

      const parsedProducts = JSON.parse(savedProducts);

      if (Array.isArray(parsedProducts)) {
        setProducts(parsedProducts);
      } else {
        setProducts([]);
      }
    } catch {
      setProducts([]);
    }
  }

  useEffect(() => {
    loadProducts();

    window.addEventListener(PRODUCT_EVENT, loadProducts);
    window.addEventListener(PURCHASE_EVENT, loadProducts);
    window.addEventListener(SALES_EVENT, loadProducts);
    window.addEventListener("storage", loadProducts);

    return () => {
      window.removeEventListener(PRODUCT_EVENT, loadProducts);
      window.removeEventListener(PURCHASE_EVENT, loadProducts);
      window.removeEventListener(SALES_EVENT, loadProducts);
      window.removeEventListener("storage", loadProducts);
    };
  }, []);

  const totalProducts = products.length;

  const inStockProducts = products.filter(
    (product) => Number(product.quantity || 0) > 0
  ).length;

  const lowStockProducts = products.filter((product) => {
    const quantity = Number(product.quantity || 0);
    const lowStockAlert = Number(product.lowStockAlert || 0);

    return quantity > 0 && lowStockAlert > 0 && quantity <= lowStockAlert;
  }).length;

  const stockValue = products.reduce((total, product) => {
    const quantity = Number(product.quantity || 0);
    const purchasePrice = Number(product.purchasePrice || 0);

    return total + quantity * purchasePrice;
  }, 0);

  function scrollToAddProductForm() {
    document
      .querySelector("form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <div className="flex-1">
        <Navbar />

        <main className="p-8">
          <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-900">
                📦 Inventory Management
              </h1>

              <p className="mt-2 text-lg text-slate-600">
                Manage products, stock levels and inventory details.
              </p>
            </div>

            <button
              type="button"
              onClick={scrollToAddProductForm}
              className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-700 hover:shadow-xl"
            >
              + Add Product
            </button>
          </div>

          <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">Total Products</p>

              <h2 className="mt-3 text-4xl font-bold text-blue-600">
                {totalProducts}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Items in catalogue
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">In Stock</p>

              <h2 className="mt-3 text-4xl font-bold text-green-600">
                {inStockProducts}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Available products
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">Low Stock</p>

              <h2 className="mt-3 text-4xl font-bold text-orange-500">
                {lowStockProducts}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Needs attention
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">Stock Value</p>

              <h2 className="mt-3 text-4xl font-bold text-purple-600">
                {formatCurrency(stockValue)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Current inventory value
              </p>
            </div>
          </section>

          <section className="mt-8 rounded-3xl border border-slate-100 bg-white p-5 shadow-lg">
            <div className="relative">
              <span className="absolute left-5 top-3.5 text-lg text-slate-400">
                🔍
              </span>

              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search product by name, SKU or category..."
                className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-14 pr-5 text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </section>

          <InventoryManager searchQuery={searchQuery} />
        </main>
      </div>
    </div>
  );
}