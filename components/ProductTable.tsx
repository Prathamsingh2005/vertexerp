"use client";

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

type ProductTableProps = {
  products: Product[];
  onDeleteProduct: (productId: string) => void;
  onUpdateStock: (productId: string, nextQuantity: number) => void;
};

function formatCurrency(amount: number) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

function getProductStatus(quantity: number, lowStockAlert: number) {
  const isOutOfStock = quantity <= 0;
  const isLowStock =
    !isOutOfStock && lowStockAlert > 0 && quantity <= lowStockAlert;

  if (isOutOfStock) {
    return {
      label: "Out of Stock",
      className: "bg-red-100 text-red-700",
    };
  }

  if (isLowStock) {
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

export default function ProductTable({
  products,
  onDeleteProduct,
  onUpdateStock,
}: ProductTableProps) {
  function handleDelete(productId: string, productName: string) {
    const shouldDelete = window.confirm(
      `Delete "${productName}" from inventory?`
    );

    if (!shouldDelete) {
      return;
    }

    onDeleteProduct(productId);
  }

  function handleAdjustStock(
    productId: string,
    productName: string,
    currentQuantity: number
  ) {
    const enteredQuantity = window.prompt(
      `Set available stock for "${productName}"`,
      String(currentQuantity)
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

    onUpdateStock(productId, nextQuantity);
  }

  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl sm:mt-8 lg:mt-10">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 lg:py-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
            Inventory Products
          </h2>

          <p className="mt-1 text-sm text-slate-600 sm:text-base">
            View product details, available stock and pricing.
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
          {/* Mobile: product cards avoid wide, hard-to-read table scrolling. */}
          <div className="space-y-4 p-4 md:hidden">
            {products.map((product) => {
              const quantity = Number(product.quantity || 0);
              const lowStockAlert = Number(product.lowStockAlert || 0);
              const status = getProductStatus(quantity, lowStockAlert);

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
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Category
                      </p>
                      <p className="mt-1 truncate font-semibold text-slate-800">
                        {product.category || "Uncategorized"}
                      </p>
                    </div>

                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        GST
                      </p>
                      <p className="mt-1 font-semibold text-slate-800">
                        {product.gst}%
                      </p>
                    </div>

                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Purchase Price
                      </p>
                      <p className="mt-1 font-bold text-slate-900">
                        {formatCurrency(product.purchasePrice)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Selling Price
                      </p>
                      <p className="mt-1 font-bold text-slate-900">
                        {formatCurrency(product.sellingPrice)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-xl bg-white px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">
                        Available Stock
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Alert at {lowStockAlert} {product.unit}
                      </p>
                    </div>

                    <p className="text-lg font-black text-slate-900">
                      {quantity}{" "}
                      <span className="text-sm font-semibold text-slate-500">
                        {product.unit}
                      </span>
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        handleAdjustStock(
                          product.id,
                          product.name,
                          quantity
                        )
                      }
                      className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-bold text-blue-700 transition hover:bg-blue-100"
                    >
                      Adjust Stock
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(product.id, product.name)}
                      className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Desktop/tablet: dense table stays efficient for inventory review. */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1150px]">
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
                    Purchase Price
                  </th>

                  <th className="px-6 py-4 text-sm font-bold text-slate-700">
                    Selling Price
                  </th>

                  <th className="px-6 py-4 text-sm font-bold text-slate-700">
                    Stock
                  </th>

                  <th className="px-6 py-4 text-sm font-bold text-slate-700">
                    GST
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
                {products.map((product) => {
                  const quantity = Number(product.quantity || 0);
                  const lowStockAlert = Number(product.lowStockAlert || 0);
                  const status = getProductStatus(quantity, lowStockAlert);

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
                          {product.description || "No description added"}
                        </p>
                      </td>

                      <td className="px-6 py-5 font-semibold text-blue-600">
                        {product.sku}
                      </td>

                      <td className="px-6 py-5 text-slate-700">
                        {product.category || "Uncategorized"}
                      </td>

                      <td className="px-6 py-5 text-slate-700">
                        {formatCurrency(product.purchasePrice)}
                      </td>

                      <td className="px-6 py-5 font-semibold text-slate-900">
                        {formatCurrency(product.sellingPrice)}
                      </td>

                      <td className="px-6 py-5">
                        <p className="font-bold text-slate-900">
                          {quantity} {product.unit}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Alert at {lowStockAlert}
                        </p>
                      </td>

                      <td className="px-6 py-5 text-slate-700">
                        {product.gst}%
                      </td>

                      <td className="px-6 py-5">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>

                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            onClick={() =>
                              handleAdjustStock(
                                product.id,
                                product.name,
                                quantity
                              )
                            }
                            className="font-semibold text-blue-600 transition hover:text-blue-800"
                          >
                            Adjust Stock
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleDelete(product.id, product.name)
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