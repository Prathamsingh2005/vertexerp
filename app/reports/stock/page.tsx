"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

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

function formatCurrency(amount: number) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

function getStockStatus(product: Product) {
  const quantity = Number(product.quantity || 0);
  const alertLevel = Number(product.lowStockAlert || 0);

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

export default function StockReportPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    try {
      const savedProducts = window.localStorage.getItem(PRODUCTS_KEY);

      const parsedProducts = savedProducts
        ? JSON.parse(savedProducts)
        : [];

      setProducts(Array.isArray(parsedProducts) ? parsedProducts : []);
    } catch {
      setProducts([]);
    }
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
    (total, product) =>
      total +
      Number(product.quantity || 0) *
        Number(product.purchasePrice || 0),
    0
  );

  const lowStockCount = products.filter((product) => {
    const quantity = Number(product.quantity || 0);
    const alertLevel = Number(product.lowStockAlert || 0);

    return quantity > 0 && quantity <= alertLevel;
  }).length;

  const outOfStockCount = products.filter(
    (product) => Number(product.quantity || 0) === 0
  ).length;

  function resetFilters() {
    setSearchTerm("");
    setStatusFilter("All");
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
                📦 Stock Report
              </h1>

              <p className="mt-2 text-lg text-slate-600">
                Review product availability, stock value and inventory alerts.
              </p>
            </div>

            <Link
              href="/reports"
              className="w-fit rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              ← Back to Reports
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">Total Products</p>

              <h2 className="mt-3 text-4xl font-bold text-blue-600">
                {products.length}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Products in inventory
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">Stock Value</p>

              <h2 className="mt-3 text-4xl font-bold text-green-600">
                {formatCurrency(stockValue)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Based on purchase prices
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">Low Stock Items</p>

              <h2 className="mt-3 text-4xl font-bold text-orange-500">
                {lowStockCount}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Products at or below alert level
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">Out of Stock</p>

              <h2 className="mt-3 text-4xl font-bold text-red-600">
                {outOfStockCount}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Products requiring restocking
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
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
              className="mt-4 rounded-xl border border-slate-300 bg-white px-5 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Reset Filters
            </button>
          </div>

          <div className="mt-8 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-8 py-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Inventory Products
                </h2>

                <p className="mt-1 text-slate-600">
                  {filteredProducts.length} product
                  {filteredProducts.length !== 1 ? "s" : ""} found
                </p>
              </div>

              <div className="rounded-full bg-green-50 px-4 py-2 text-sm font-semibold text-green-700">
                Stock Value: {formatCurrency(stockValue)}
              </div>
            </div>

            <div className="overflow-x-auto">
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
                  {filteredProducts.length === 0 ? (
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
                        Number(product.quantity || 0) *
                        Number(product.purchasePrice || 0);

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