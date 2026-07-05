"use client";

import { useEffect, useMemo, useState } from "react";
import ProductForm from "./ProductForm";
import ProductTable from "./ProductTable";
import { createClient } from "@/lib/supabase/client";

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

type CompanyRow = {
  name: string;
};

type InventoryManagerProps = {
  searchQuery: string;
};

function mapProductRow(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name || "",
    sku: row.sku || "",
    category: row.category || "",
    unit: row.unit || "Piece",
    purchasePrice: Number(row.purchase_price || 0),
    sellingPrice: Number(row.selling_price || 0),
    quantity: Number(row.quantity || 0),
    lowStockAlert: Number(row.low_stock_alert || 0),
    gst: Number(row.gst_rate || 0),
    description: row.description || "",
  };
}

export default function InventoryManager({
  searchQuery,
}: InventoryManagerProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [activeCompanyName, setActiveCompanyName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);

    window.setTimeout(() => {
      setMessage("");
    }, 4000);
  }

  function notifyProductUpdate() {
    window.dispatchEvent(new Event("vertexerp-products-updated"));
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
        setActiveCompanyId(null);
        setActiveCompanyName("");
        showMessage("Please sign in before managing inventory.");
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

      const companyId =
        (profile as ProfileRow | null)?.active_company_id || null;

      setActiveCompanyId(companyId);

      if (!companyId) {
        setProducts([]);
        setActiveCompanyName("");
        showMessage("Select an active company from the Companies page first.");
        return;
      }

      const [productsResponse, companyResponse] = await Promise.all([
        supabase
          .from("products")
          .select(
            "id, name, sku, category, unit, purchase_price, selling_price, quantity, low_stock_alert, gst_rate, description"
          )
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),
        supabase
          .from("companies")
          .select("name")
          .eq("id", companyId)
          .maybeSingle(),
      ]);

      if (productsResponse.error) {
        throw productsResponse.error;
      }

      if (companyResponse.error) {
        throw companyResponse.error;
      }

      const company = companyResponse.data as CompanyRow | null;

      setActiveCompanyName(company?.name || "");
      setProducts((productsResponse.data || []).map(mapProductRow));
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Products could not be loaded from the cloud database.";

      setProducts([]);
      showMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();

    window.addEventListener(
      "vertexerp-active-company-updated",
      loadProducts
    );

    return () => {
      window.removeEventListener(
        "vertexerp-active-company-updated",
        loadProducts
      );
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return products;
    }

    return products.filter((product) => {
      const searchableText = [
        product.name,
        product.sku,
        product.category,
        product.unit,
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [products, searchQuery]);

  async function addProduct(productInput: ProductInput) {
    if (!activeCompanyId) {
      showMessage("Select an active company before adding a product.");
      return;
    }

    const productName = productInput.name.trim();

    if (!productName) {
      showMessage("Please enter a product name.");
      return;
    }

    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("products")
        .insert({
          company_id: activeCompanyId,
          name: productName,
          sku: productInput.sku.trim() || null,
          category: productInput.category.trim() || null,
          unit: productInput.unit.trim() || "Piece",
          purchase_price: Number(productInput.purchasePrice || 0),
          selling_price: Number(productInput.sellingPrice || 0),
          quantity: Number(productInput.quantity || 0),
          low_stock_alert: Number(productInput.lowStockAlert || 0),
          gst_rate: Number(productInput.gst || 0),
          description: productInput.description.trim() || null,
        })
        .select(
          "id, name, sku, category, unit, purchase_price, selling_price, quantity, low_stock_alert, gst_rate, description"
        )
        .single();

      if (error) {
        if (error.code === "23505") {
          showMessage(
            "This SKU already exists in the active company. Use a different SKU."
          );
          return;
        }

        throw error;
      }

      setProducts((currentProducts) => [
        mapProductRow(data),
        ...currentProducts,
      ]);

      notifyProductUpdate();
      showMessage("Product saved to the cloud database successfully.");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Product could not be saved.";

      showMessage(errorMessage);
    }
  }

  async function deleteProduct(productId: string) {
    const shouldDelete = window.confirm(
      "Delete this product? Existing sales or purchase records will keep their item name, but this product will no longer be available for new transactions."
    );

    if (!shouldDelete) {
      return;
    }

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", productId);

      if (error) {
        throw error;
      }

      setProducts((currentProducts) =>
        currentProducts.filter((product) => product.id !== productId)
      );

      notifyProductUpdate();
      showMessage("Product deleted successfully.");
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Product could not be deleted.";

      showMessage(errorMessage);
    }
  }

  async function updateProductStock(
    productId: string,
    nextQuantity: number
  ) {
    const safeQuantity = Math.max(0, Number(nextQuantity) || 0);

    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("products")
        .update({ quantity: safeQuantity })
        .eq("id", productId)
        .select(
          "id, name, sku, category, unit, purchase_price, selling_price, quantity, low_stock_alert, gst_rate, description"
        )
        .single();

      if (error) {
        throw error;
      }

      setProducts((currentProducts) =>
        currentProducts.map((product) =>
          product.id === productId ? mapProductRow(data) : product
        )
      );

      notifyProductUpdate();
      showMessage("Product stock updated successfully.");
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Product stock could not be updated.";

      showMessage(errorMessage);
    }
  }

  return (
    <>
      <section className="mt-8 rounded-3xl border border-blue-100 bg-blue-50 p-5">
        <p className="text-sm font-bold text-blue-800">Active Company</p>

        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xl font-bold text-slate-900">
            {isLoading
              ? "Loading company..."
              : activeCompanyName || "No active company selected"}
          </p>

          <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-bold text-blue-700 shadow-sm">
            {activeCompanyId
              ? "Products are saved in cloud"
              : "Select a company first"}
          </span>
        </div>
      </section>

      {message && (
        <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 font-medium text-blue-700">
          {message}
        </div>
      )}

      <div
        className={
          !activeCompanyId && !isLoading
            ? "pointer-events-none opacity-60"
            : ""
        }
      >
        <ProductForm onAddProduct={addProduct} />
      </div>

      {isLoading ? (
        <div className="mt-10 rounded-3xl border border-slate-100 bg-white p-10 text-center text-slate-500 shadow-xl">
          Loading products from the cloud database...
        </div>
      ) : (
        <ProductTable
          products={filteredProducts}
          onDeleteProduct={deleteProduct}
          onUpdateStock={updateProductStock}
        />
      )}
    </>
  );
}