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
    <div className="mt-10 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-8 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Inventory Products
          </h2>

          <p className="mt-1 text-slate-600">
            View product details, available stock and pricing.
          </p>
        </div>

        <div className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
          Total Products: {products.length}
        </div>
      </div>

      <div className="overflow-x-auto">
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
            {products.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-6 py-14 text-center text-slate-500"
                >
                  <p className="text-lg font-semibold text-slate-700">
                    No products found in inventory
                  </p>

                  <p className="mt-2">
                    Add your first product using the form above.
                  </p>
                </td>
              </tr>
            ) : (
              products.map((product) => {
                const quantity = Number(product.quantity || 0);
                const lowStockAlert = Number(product.lowStockAlert || 0);

                const isOutOfStock = quantity <= 0;

                const isLowStock =
                  !isOutOfStock &&
                  lowStockAlert > 0 &&
                  quantity <= lowStockAlert;

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
                      {isOutOfStock ? (
                        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                          Out of Stock
                        </span>
                      ) : isLowStock ? (
                        <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">
                          Low Stock
                        </span>
                      ) : (
                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                          In Stock
                        </span>
                      )}
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
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}