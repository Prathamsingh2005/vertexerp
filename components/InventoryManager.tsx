"use client";

import { useEffect, useMemo, useState } from "react";
import ProductForm, {
  type EditableProduct,
  type ProductInput,
} from "./ProductForm";
import ProductTable from "./ProductTable";
import { createClient } from "@/lib/supabase/client";

type Product = EditableProduct;

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
  hsn_sac_code: string | null;
  is_service: boolean | null;
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
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

const PRODUCT_SELECT =
  "id, name, sku, category, unit, purchase_price, selling_price, quantity, low_stock_alert, gst_rate, hsn_sac_code, is_service, description";

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
    hsnSacCode: row.hsn_sac_code || "",
    isService: Boolean(row.is_service),
    description: row.description || "",
  };
}

function isValidHsnSac(value: string) {
  return /^[0-9]{4,8}$/.test(value);
}

export default function InventoryManager({
  searchQuery,
  canCreate,
  canEdit,
  canDelete,
}: InventoryManagerProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [activeCompanyName, setActiveCompanyName] = useState("");
  const [editingProductId, setEditingProductId] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(""), 4500);
  }

  function notifyProductUpdate() {
    window.dispatchEvent(new Event("vertexerp-products-updated"));
    window.dispatchEvent(new Event("vertexerp-gst-data-updated"));
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
        setEditingProductId(null);
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
      setEditingProductId(null);

      if (!companyId) {
        setProducts([]);
        setActiveCompanyName("");
        showMessage("Select an active company from the Companies page first.");
        return;
      }

      const [productsResponse, companyResponse] = await Promise.all([
        supabase
          .from("products")
          .select(PRODUCT_SELECT)
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
      setProducts(
        ((productsResponse.data || []) as ProductRow[]).map(mapProductRow)
      );
    } catch (error) {
      setProducts([]);
      showMessage(
        error instanceof Error
          ? error.message
          : "Products could not be loaded from the cloud database."
      );
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

  const editingProduct = useMemo(
    () =>
      products.find((product) => product.id === editingProductId) || null,
    [products, editingProductId]
  );

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
        product.hsnSacCode,
        product.isService ? "service sac" : "goods hsn",
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [products, searchQuery]);

  const hsnReadiness = useMemo(() => {
    const missing = products.filter(
      (product) => !isValidHsnSac(product.hsnSacCode)
    ).length;

    return {
      ready: products.length - missing,
      missing,
    };
  }, [products]);

  function validateProduct(productInput: ProductInput) {
    if (!productInput.name.trim()) {
      return "Please enter a product name.";
    }

    if (!productInput.sku.trim()) {
      return "Please enter a Product SKU / Code.";
    }

    if (!isValidHsnSac(productInput.hsnSacCode.trim())) {
      return "HSN/SAC Code must contain 4 to 8 digits.";
    }

    if (productInput.gst < 0 || productInput.gst > 100) {
      return "GST Percentage must be between 0 and 100.";
    }

    return null;
  }

  async function saveProduct(productInput: ProductInput) {
    if (editingProductId && !canEdit) {
      showMessage("You do not have permission to edit inventory products.");
      return false;
    }

    if (!editingProductId && !canCreate) {
      showMessage("You do not have permission to create inventory products.");
      return false;
    }

    if (!activeCompanyId) {
      showMessage("Select an active company before adding a product.");
      return false;
    }

    const validationMessage = validateProduct(productInput);

    if (validationMessage) {
      showMessage(validationMessage);
      return false;
    }

    setIsSaving(true);

    try {
      const supabase = createClient();

      const commonPayload = {
        name: productInput.name.trim(),
        category: productInput.category.trim() || null,
        unit: productInput.unit.trim() || "Piece",
        purchase_price: Number(productInput.purchasePrice || 0),
        selling_price: Number(productInput.sellingPrice || 0),
        low_stock_alert: Number(productInput.lowStockAlert || 0),
        gst_rate: Number(productInput.gst || 0),
        hsn_sac_code: productInput.hsnSacCode.trim(),
        is_service: Boolean(productInput.isService),
        description: productInput.description.trim() || null,
      };

      if (editingProductId) {
        const { data, error } = await supabase
          .from("products")
          .update(commonPayload)
          .eq("id", editingProductId)
          .eq("company_id", activeCompanyId)
          .select(PRODUCT_SELECT)
          .single();

        if (error) {
          throw error;
        }

        const updatedProduct = mapProductRow(data as ProductRow);

        setProducts((currentProducts) =>
          currentProducts.map((product) =>
            product.id === updatedProduct.id ? updatedProduct : product
          )
        );

        setEditingProductId(null);
        notifyProductUpdate();
        showMessage("Product and HSN/SAC details updated successfully.");
        return true;
      }

      const { data, error } = await supabase
        .from("products")
        .insert({
          company_id: activeCompanyId,
          sku: productInput.sku.trim().toUpperCase(),
          quantity: productInput.isService
            ? 0
            : Number(productInput.quantity || 0),
          ...commonPayload,
        })
        .select(PRODUCT_SELECT)
        .single();

      if (error) {
        if (error.code === "23505") {
          showMessage(
            "This SKU already exists in the active company. Use a different SKU."
          );
          return false;
        }

        throw error;
      }

      setProducts((currentProducts) => [
        mapProductRow(data as ProductRow),
        ...currentProducts,
      ]);

      notifyProductUpdate();
      showMessage("Product saved to the cloud database successfully.");
      return true;
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : "Product could not be saved."
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  function startEditProduct(product: Product) {
    if (!canEdit) {
      showMessage("You do not have permission to edit inventory products.");
      return;
    }

    setEditingProductId(product.id);
    setMessage("");

    window.setTimeout(() => {
      document.getElementById("product-form")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  function cancelEditProduct() {
    setEditingProductId(null);
    setMessage("");
  }

  async function deleteProduct(productId: string) {
    if (!canDelete) {
      showMessage("You do not have permission to delete inventory products.");
      return;
    }

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", productId)
        .eq("company_id", activeCompanyId);

      if (error) {
        throw error;
      }

      setProducts((currentProducts) =>
        currentProducts.filter((product) => product.id !== productId)
      );

      if (editingProductId === productId) {
        setEditingProductId(null);
      }

      notifyProductUpdate();
      showMessage("Product deleted successfully.");
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Product could not be deleted."
      );
    }
  }

  async function updateProductStock(
    productId: string,
    nextQuantity: number
  ) {
    if (!canEdit) {
      showMessage("You do not have permission to adjust inventory stock.");
      return;
    }

    const product = products.find((item) => item.id === productId);

    if (product?.isService) {
      showMessage("Stock adjustment is not available for service items.");
      return;
    }

    const safeQuantity = Math.max(0, Number(nextQuantity) || 0);

    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("products")
        .update({ quantity: safeQuantity })
        .eq("id", productId)
        .eq("company_id", activeCompanyId)
        .select(PRODUCT_SELECT)
        .single();

      if (error) {
        throw error;
      }

      setProducts((currentProducts) =>
        currentProducts.map((currentProduct) =>
          currentProduct.id === productId
            ? mapProductRow(data as ProductRow)
            : currentProduct
        )
      );

      notifyProductUpdate();
      showMessage("Product stock updated successfully.");
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Product stock could not be updated."
      );
    }
  }

  return (
    <>
      <section className="mt-6 overflow-hidden rounded-3xl border border-violet-200 bg-gradient-to-r from-violet-950 via-violet-800 to-violet-700 p-5 text-white shadow-xl shadow-violet-900/15 sm:mt-8 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-200">
              Active Company
            </p>

            <p className="mt-2 break-words text-xl font-black sm:text-2xl">
              {isLoading
                ? "Loading company..."
                : activeCompanyName || "No active company selected"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="w-fit rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black text-white backdrop-blur">
              {activeCompanyId
                ? "Products are saved in cloud"
                : "Select a company first"}
            </span>

            {activeCompanyId && (
              <span
                className={`w-fit rounded-full px-3 py-1.5 text-xs font-black shadow-sm ${
                  hsnReadiness.missing === 0
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {hsnReadiness.missing === 0
                  ? `${hsnReadiness.ready} HSN/SAC Ready`
                  : `${hsnReadiness.missing} HSN/SAC Pending`}
              </span>
            )}
          </div>
        </div>
      </section>

      {message && (
        <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-800 sm:mt-6 sm:text-base">
          {message}
        </div>
      )}

      {(canCreate || editingProduct) && (
        <div
          className={
            !activeCompanyId && !isLoading
              ? "pointer-events-none opacity-60"
              : ""
          }
        >
          <ProductForm
            onSaveProduct={saveProduct}
            editingProduct={editingProduct}
            onCancelEdit={cancelEditProduct}
            isSaving={isSaving}
            canCreate={canCreate}
            canEdit={canEdit}
          />
        </div>
      )}

      {isLoading ? (
        <div className="mt-6 rounded-3xl border border-violet-100 bg-white p-6 text-center text-slate-500 shadow-xl shadow-slate-200/60 sm:mt-10 sm:p-10">
          Loading products from the cloud database...
        </div>
      ) : (
        <ProductTable
          products={filteredProducts}
          onEditProduct={startEditProduct}
          onDeleteProduct={deleteProduct}
          onUpdateStock={updateProductStock}
          canCreate={canCreate}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}
    </>
  );
}