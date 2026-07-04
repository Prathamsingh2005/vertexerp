"use client";

import { useEffect, useMemo, useState } from "react";
import ProductForm from "./ProductForm";
import ProductTable from "./ProductTable";

type ProductInput = {
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

type Product = ProductInput & {
  id: string;
};

type PurchaseItem = {
  productId?: string;
  productName?: string;
  quantity?: number;
  rate?: number;
  gst?: number;
};

type Purchase = {
  items?: PurchaseItem[];
};

type SaleItem = {
  productId?: string;
  quantity?: number;
  rate?: number;
  price?: number;
  sellingPrice?: number;
};

type Sale = {
  items?: SaleItem[];
};

type RecoveryProduct = {
  id: string;
  name: string;
  purchasePrice: number;
  sellingPrice: number;
  gst: number;
  purchasedQuantity: number;
};

type InventoryManagerProps = {
  searchQuery: string;
};

const STORAGE_KEY = "VertexERP_products";
const PURCHASES_KEY = "VertexERP_purchases";
const SALES_KEY = "VertexERP_sales";

const PRODUCT_EVENT = "VertexERP-products-updated";

function toNumber(value: unknown) {
  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function createRecoveredSku(productId: string) {
  const shortId = productId
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8)
    .toUpperCase();

  return `REC-${shortId || "PRODUCT"}`;
}

export default function InventoryManager({
  searchQuery,
}: InventoryManagerProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const savedProducts = window.localStorage.getItem(STORAGE_KEY);

      if (savedProducts) {
        const parsedProducts = JSON.parse(savedProducts);

        if (Array.isArray(parsedProducts)) {
          setProducts(parsedProducts);
        } else {
          setProducts([]);
        }
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
      setProducts([]);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(products));

    window.dispatchEvent(new Event(PRODUCT_EVENT));
  }, [products, isLoaded]);

  function addProduct(productInput: ProductInput) {
    const newProduct: Product = {
      ...productInput,
      id: crypto.randomUUID(),
    };

    setProducts((currentProducts) => [newProduct, ...currentProducts]);
  }

  
function deleteProduct(productId: string) {
  setProducts((currentProducts) =>
    currentProducts.filter((product) => product.id !== productId)
  );
}

function updateProductStock(productId: string, nextQuantity: number) {
  const safeQuantity = Math.max(0, toNumber(nextQuantity));

  setProducts((currentProducts) =>
    currentProducts.map((product) =>
      product.id === productId
        ? {
            ...product,
            quantity: safeQuantity,
          }
        : product
    )
  );
}

  const filteredProducts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return products;
    }

    return products.filter((product) => {
      const name = String(product.name || "").toLowerCase();
      const sku = String(product.sku || "").toLowerCase();
      const category = String(product.category || "").toLowerCase();

      return (
        name.includes(normalizedQuery) ||
        sku.includes(normalizedQuery) ||
        category.includes(normalizedQuery)
      );
    });
  }, [products, searchQuery]);

  function restoreInventoryFromPurchaseHistory() {
    if (products.length > 0) {
      window.alert(
        "Inventory already has products. Restore is only available when inventory is empty."
      );
      return;
    }

    const shouldRestore = window.confirm(
      "Restore inventory from saved purchase history?\n\nThis will recreate products from purchase records."
    );

    if (!shouldRestore) {
      return;
    }

    try {
      const savedPurchases = window.localStorage.getItem(PURCHASES_KEY);
      const savedSales = window.localStorage.getItem(SALES_KEY);

      const purchases: Purchase[] = savedPurchases
        ? JSON.parse(savedPurchases)
        : [];

      const sales: Sale[] = savedSales ? JSON.parse(savedSales) : [];

      if (!Array.isArray(purchases) || purchases.length === 0) {
        window.alert(
          "No purchase history was found. Add products manually from the form below."
        );
        return;
      }

      const recoveredProducts = new Map<string, RecoveryProduct>();

      purchases.forEach((purchase) => {
        const purchaseItems = Array.isArray(purchase.items)
          ? purchase.items
          : [];

        purchaseItems.forEach((item) => {
          const productId = String(item.productId || "").trim();
          const productName = String(item.productName || "").trim();

          if (!productId || !productName) {
            return;
          }

          const existingProduct = recoveredProducts.get(productId);

          if (existingProduct) {
            existingProduct.purchasedQuantity += toNumber(item.quantity);
            existingProduct.purchasePrice = toNumber(item.rate);
            existingProduct.gst = toNumber(item.gst);
            return;
          }

          recoveredProducts.set(productId, {
            id: productId,
            name: productName,
            purchasePrice: toNumber(item.rate),
            sellingPrice: 0,
            gst: toNumber(item.gst),
            purchasedQuantity: toNumber(item.quantity),
          });
        });
      });

      const soldQuantityByProduct = new Map<string, number>();
      const sellingPriceByProduct = new Map<string, number>();

      if (Array.isArray(sales)) {
        sales.forEach((sale) => {
          const saleItems = Array.isArray(sale.items) ? sale.items : [];

          saleItems.forEach((item) => {
            const productId = String(item.productId || "").trim();

            if (!productId) {
              return;
            }

            const currentSoldQuantity =
              soldQuantityByProduct.get(productId) || 0;

            soldQuantityByProduct.set(
              productId,
              currentSoldQuantity + toNumber(item.quantity)
            );

            const saleRate =
              toNumber(item.rate) ||
              toNumber(item.price) ||
              toNumber(item.sellingPrice);

            if (saleRate > 0) {
              sellingPriceByProduct.set(productId, saleRate);
            }
          });
        });
      }

      const restoredProducts: Product[] = Array.from(
        recoveredProducts.values()
      ).map((product) => {
        const soldQuantity = soldQuantityByProduct.get(product.id) || 0;
        const sellingPrice = sellingPriceByProduct.get(product.id) || 0;

        return {
          id: product.id,
          name: product.name,
          sku: createRecoveredSku(product.id),
          category: "Recovered",
          unit: "Piece",
          purchasePrice: product.purchasePrice,
          sellingPrice,
          quantity: Math.max(0, product.purchasedQuantity - soldQuantity),
          lowStockAlert: 5,
          gst: product.gst,
          description: "Recovered automatically from purchase history.",
        };
      });

      if (restoredProducts.length === 0) {
        window.alert(
          "Products could not be restored because purchase item details are missing."
        );
        return;
      }

      setProducts(restoredProducts);

      window.alert(
        `${restoredProducts.length} product(s) restored successfully.`
      );
    } catch {
      window.alert(
        "Inventory could not be restored. Please refresh the page and try again."
      );
    }
  }

  return (
    <>
      {isLoaded && products.length === 0 && (
        <section className="mt-8 overflow-hidden rounded-3xl border border-orange-200 bg-white shadow-lg">
          <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-sm"
                style={{
                  backgroundColor: "#fff0e6",
                  border: "1px solid #fed7aa",
                }}
              >
                📦
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2
                    className="text-xl font-bold"
                    style={{ color: "#9a3412" }}
                  >
                    Restore Missing Inventory
                  </h2>

                  <span
                    className="rounded-full px-3 py-1 text-xs font-bold"
                    style={{
                      backgroundColor: "#ffedd5",
                      color: "#c2410c",
                    }}
                  >
                    Recovery Available
                  </span>
                </div>

                <p
                  className="mt-2 max-w-3xl leading-6"
                  style={{ color: "#7c2d12" }}
                >
                  Your product catalog is empty, but saved purchase bills may
                  contain product history. Restore products automatically.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={restoreInventoryFromPurchaseHistory}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-6 py-3 font-bold shadow-md transition hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
              style={{
                backgroundColor: "#ea580c",
                color: "#ffffff",
              }}
            >
              <span className="text-lg">↻</span>
              Restore Inventory
            </button>
          </div>

          <div
            className="h-1 w-full"
            style={{
              background:
                "linear-gradient(90deg, #f97316 0%, #fb923c 50%, #fed7aa 100%)",
            }}
          />
        </section>
      )}

      <ProductForm onAddProduct={addProduct} />

      <ProductTable
  products={filteredProducts}
  onDeleteProduct={deleteProduct}
  onUpdateStock={updateProductStock}
/>
    </>
  );
}