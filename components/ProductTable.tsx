"use client";

import { type ReactNode } from "react";

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
  hsnSacCode: string;
  isService: boolean;
  description: string;
};

type ProductTableProps = {
  products: Product[];
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void | Promise<void>;
  onUpdateStock: (
    productId: string,
    nextQuantity: number
  ) => void | Promise<void>;
};

function formatCurrency(amount: number) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

function getProductStatus(product: Product) {
  if (product.isService) {
    return {
      label: "Service",
      className: "bg-violet-100 text-violet-700",
    };
  }

  if (product.quantity <= 0) {
    return {
      label: "Out of Stock",
      className: "bg-red-100 text-red-700",
    };
  }

  if (
    product.lowStockAlert > 0 &&
    product.quantity <= product.lowStockAlert
  ) {
    return {
      label: "Low Stock",
      className: "bg-orange-100 text-orange-700",
    };
  }

  return {
    label: "In Stock",
    className: "bg-emerald-100 text-emerald-700",
  };
}

function getHsnStatus(product: Product) {
  if (/^[0-9]{4,8}$/.test(product.hsnSacCode)) {
    return {
      label: product.isService ? "SAC Ready" : "HSN Ready",
      className: "bg-emerald-100 text-emerald-700",
    };
  }

  return {
    label: product.isService ? "SAC Missing" : "HSN Missing",
    className: "bg-amber-100 text-amber-700",
  };
}

export default function ProductTable({
  products,
  onEditProduct,
  onDeleteProduct,
  onUpdateStock,
}: ProductTableProps) {
  async function handleDelete(product: Product) {
    const shouldDelete = window.confirm(
      `Delete "${product.name}" from inventory?`
    );

    if (shouldDelete) {
      await onDeleteProduct(product.id);
    }
  }

  async function handleAdjustStock(product: Product) {
    if (product.isService) {
      window.alert(
        "Stock adjustment is not available for service items."
      );
      return;
    }

    const enteredQuantity = window.prompt(
      `Set available stock for "${product.name}"`,
      String(product.quantity)
    );

    if (enteredQuantity === null) {
      return;
    }

    const nextQuantity = Number(enteredQuantity);

    if (!Number.isFinite(nextQuantity) || nextQuantity < 0) {
      window.alert(
        "Enter a valid stock quantity greater than or equal to 0."
      );
      return;
    }

    await onUpdateStock(product.id, nextQuantity);
  }

  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl sm:mt-8 lg:mt-10">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 lg:py-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
            Inventory Products
          </h2>

          <p className="mt-1 text-sm text-slate-600 sm:text-base">
            Edit existing items to complete their HSN/SAC and GST setup.
          </p>
        </div>

        <div className="w-fit rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
          Total Products: {products.length}
        </div>
      </div>

      {products.length === 0 ? (
        <div className="px-4 py-12 text-center text-slate-500 sm:px-6">
          <p className="text-lg font-semibold text-slate-700">
            No products found in inventory
          </p>

          <p className="mt-2 text-sm">
            Add your first product using the form above.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-4 p-4 md:hidden">
            {products.map((product) => {
              const status = getProductStatus(product);
              const hsnStatus = getHsnStatus(product);

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
                      <p className="mt-1 text-sm font-semibold text-blue-600">
                        {product.sku || "No SKU"}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  <p className="mt-3 line-clamp-2 text-sm text-slate-600">
                    {product.description || "No description added"}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <InfoBox
                      label={
                        product.isService
                          ? "SAC Code"
                          : "HSN Code"
                      }
                      value={product.hsnSacCode || "—"}
                    />

                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        GST Setup
                      </p>
                      <span
                        className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${hsnStatus.className}`}
                      >
                        {hsnStatus.label}
                      </span>
                    </div>

                    <InfoBox
                      label="Selling Price"
                      value={formatCurrency(
                        product.sellingPrice
                      )}
                    />

                    <InfoBox
                      label="GST"
                      value={`${product.gst}%`}
                    />
                  </div>

                  {!product.isService && (
                    <div className="mt-4 flex items-center justify-between rounded-xl bg-white px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">
                          Available Stock
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Alert at {product.lowStockAlert}{" "}
                          {product.unit}
                        </p>
                      </div>

                      <p className="text-lg font-black text-slate-900">
                        {product.quantity}{" "}
                        <span className="text-sm font-semibold text-slate-500">
                          {product.unit}
                        </span>
                      </p>
                    </div>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => onEditProduct(product)}
                      className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm font-bold text-violet-700 transition hover:bg-violet-100"
                    >
                      Edit Product
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void handleAdjustStock(product)
                      }
                      disabled={product.isService}
                      className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-bold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      Adjust Stock
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleDelete(product)}
                      className="col-span-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100"
                    >
                      Delete Product
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1350px]">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-left">
                  <Header>Product</Header>
                  <Header>SKU</Header>
                  <Header>HSN/SAC</Header>
                  <Header>Category</Header>
                  <Header>Selling Price</Header>
                  <Header>Stock</Header>
                  <Header>GST</Header>
                  <Header>GST Setup</Header>
                  <Header>Action</Header>
                </tr>
              </thead>

              <tbody>
                {products.map((product) => {
                  const status = getProductStatus(product);
                  const hsnStatus = getHsnStatus(product);

                  return (
                    <tr
                      key={product.id}
                      className="border-b border-slate-100 transition hover:bg-blue-50"
                    >
                      <td className="px-6 py-5">
                        <p className="font-bold text-slate-900">
                          {product.name}
                        </p>
                        <p className="mt-1 max-w-[230px] truncate text-sm text-slate-500">
                          {product.description ||
                            "No description added"}
                        </p>
                      </td>

                      <td className="px-6 py-5 font-semibold text-blue-600">
                        {product.sku}
                      </td>

                      <td className="px-6 py-5">
                        <p className="font-semibold text-slate-800">
                          {product.hsnSacCode || "—"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {product.isService ? "SAC" : "HSN"}
                        </p>
                      </td>

                      <td className="px-6 py-5 text-slate-700">
                        {product.category || "Uncategorized"}
                      </td>

                      <td className="px-6 py-5 font-semibold text-slate-900">
                        {formatCurrency(
                          product.sellingPrice
                        )}
                      </td>

                      <td className="px-6 py-5">
                        {product.isService ? (
                          <span className="text-slate-500">
                            Not applicable
                          </span>
                        ) : (
                          <>
                            <p className="font-bold text-slate-900">
                              {product.quantity} {product.unit}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Alert at {product.lowStockAlert}
                            </p>
                          </>
                        )}
                      </td>

                      <td className="px-6 py-5 text-slate-700">
                        {product.gst}%
                      </td>

                      <td className="px-6 py-5">
                        <div className="flex flex-col items-start gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${hsnStatus.className}`}
                          >
                            {hsnStatus.label}
                          </span>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${status.className}`}
                          >
                            {status.label}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            onClick={() =>
                              onEditProduct(product)
                            }
                            className="font-semibold text-violet-600 transition hover:text-violet-800"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void handleAdjustStock(product)
                            }
                            disabled={product.isService}
                            className="font-semibold text-blue-600 transition hover:text-blue-800 disabled:cursor-not-allowed disabled:text-slate-400"
                          >
                            Adjust Stock
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void handleDelete(product)
                            }
                            className="font-semibold text-red-500 transition hover:text-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function Header({ children }: { children: ReactNode }) {
  return (
    <th className="px-6 py-4 text-sm font-bold text-slate-700">
      {children}
    </th>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-1 break-words font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}