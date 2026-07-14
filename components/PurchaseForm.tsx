"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Product = {
  id: string;
  name: string;
  sku: string;
  purchasePrice: number;
  gst: number;
  hsnSacCode: string;
};

type Supplier = {
  id: string;
  name: string;
  mobile: string;
  gst: string;
  state: string;
  stateCode: string;
};

type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  purchase_price: number | string | null;
  gst_rate: number | string | null;
  hsn_sac_code: string | null;
  is_service: boolean | null;
};

type SupplierRow = {
  id: string;
  name: string;
  mobile: string | null;
  gst_number: string | null;
  state: string | null;
  state_code: string | null;
};

type CompanyRow = {
  state: string | null;
  state_code: string | null;
};

type ProfileRow = {
  active_company_id: string | null;
};

type PurchaseItemForm = {
  productId: string;
  quantity: string;
  rate: string;
  gst: string;
  discount: string;
};

type TaxType = "UNCLASSIFIED" | "INTRA_STATE" | "INTER_STATE" | "EXEMPT";

type CalculatedPurchaseItem = {
  productId: string;
  productName: string;
  hsnSacCode: string;
  quantity: number;
  rate: number;
  gst: number;
  discount: number;
  baseAmount: number;
  taxableAmount: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  amount: number;
};

type EditablePurchaseItem = {
  productId: string;
  productName: string;
  quantity: number;
  rate: number;
  gst: number;
  discount: number;
  baseAmount: number;
  gstAmount: number;
  amount: number;
};

type EditablePurchase = {
  id: string;
  billNumber: string;
  date: string;
  paymentMode: string;
  supplierId: string;
  supplierName: string;
  items: EditablePurchaseItem[];
};

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function createEmptyItem(): PurchaseItemForm {
  return {
    productId: "",
    quantity: "",
    rate: "",
    gst: "18",
    discount: "0",
  };
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number) {
  return `₹${toNumber(value).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name || "",
    sku: row.sku || "",
    purchasePrice: toNumber(row.purchase_price),
    gst: toNumber(row.gst_rate),
    hsnSacCode: row.hsn_sac_code || "",
  };
}

function mapSupplier(row: SupplierRow): Supplier {
  return {
    id: row.id,
    name: row.name || "",
    mobile: row.mobile || "",
    gst: row.gst_number || "",
    state: row.state || "",
    stateCode: row.state_code || "",
  };
}

function getTaxType(
  companyStateCode: string,
  supplierStateCode: string,
  gstTotal: number,
): TaxType {
  if (gstTotal <= 0) {
    return "EXEMPT";
  }

  if (
    !/^[0-9]{2}$/.test(companyStateCode) ||
    !/^[0-9]{2}$/.test(supplierStateCode)
  ) {
    return "UNCLASSIFIED";
  }

  return companyStateCode === supplierStateCode ? "INTRA_STATE" : "INTER_STATE";
}

function getTaxTypeLabel(taxType: TaxType) {
  if (taxType === "INTRA_STATE") {
    return "Intra-State · CGST + SGST";
  }

  if (taxType === "INTER_STATE") {
    return "Inter-State · IGST";
  }

  if (taxType === "EXEMPT") {
    return "Exempt / Nil GST";
  }

  return "GST Setup Pending";
}

export default function PurchaseForm() {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [companyState, setCompanyState] = useState("");
  const [companyStateCode, setCompanyStateCode] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingPurchase, setEditingPurchase] =
    useState<EditablePurchase | null>(null);

  const [form, setForm] = useState({
    billNumber: "",
    date: getToday(),
    paymentMode: "Cash",
    supplierId: "",
  });

  const [items, setItems] = useState<PurchaseItemForm[]>([createEmptyItem()]);

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(""), 5000);
  }

  async function loadFormData() {
    setIsLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setProducts([]);
        setSuppliers([]);
        setActiveCompanyId(null);
        setCompanyState("");
        setCompanyStateCode("");
        showMessage("Please sign in before creating a purchase bill.");
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
        setSuppliers([]);
        setCompanyState("");
        setCompanyStateCode("");
        showMessage("Select an active company from the Companies page first.");
        return;
      }

      const [productsResponse, suppliersResponse, companyResponse] =
        await Promise.all([
          supabase
            .from("products")
            .select(
              "id, name, sku, purchase_price, gst_rate, hsn_sac_code, is_service",
            )
            .eq("company_id", companyId)
            .eq("is_service", false)
            .order("name"),
          supabase
            .from("ledgers")
            .select("id, name, mobile, gst_number, state, state_code")
            .eq("company_id", companyId)
            .eq("ledger_type", "Supplier")
            .order("name"),
          supabase
            .from("companies")
            .select("state, state_code")
            .eq("id", companyId)
            .maybeSingle(),
        ]);

      if (productsResponse.error) {
        throw productsResponse.error;
      }

      if (suppliersResponse.error) {
        throw suppliersResponse.error;
      }

      if (companyResponse.error) {
        throw companyResponse.error;
      }

      const company = companyResponse.data as CompanyRow | null;

      setProducts(
        ((productsResponse.data || []) as ProductRow[]).map(mapProduct),
      );
      setSuppliers(
        ((suppliersResponse.data || []) as SupplierRow[]).map(mapSupplier),
      );
      setCompanyState(company?.state || "");
      setCompanyStateCode(company?.state_code || "");
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Purchase form data could not be loaded.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadFormData();

    const refreshEvents = [
      "vertexerp-active-company-updated",
      "vertexerp-ledgers-updated",
      "vertexerp-products-updated",
    ];

    refreshEvents.forEach((eventName) => {
      window.addEventListener(eventName, loadFormData);
    });

    return () => {
      refreshEvents.forEach((eventName) => {
        window.removeEventListener(eventName, loadFormData);
      });
    };
  }, []);

  useEffect(() => {
    function handleEditPurchase(event: Event) {
      const purchase = (event as CustomEvent<EditablePurchase>).detail;

      if (!purchase?.id) {
        return;
      }

      setEditingPurchase(purchase);
      setForm({
        billNumber: purchase.billNumber,
        date: purchase.date,
        paymentMode: purchase.paymentMode || "Cash",
        supplierId: purchase.supplierId,
      });
      setItems(
        purchase.items.length > 0
          ? purchase.items.map((item) => ({
              productId: item.productId,
              quantity: String(item.quantity),
              rate: String(item.rate),
              gst: String(item.gst),
              discount: String(item.discount),
            }))
          : [createEmptyItem()],
      );

      window.setTimeout(() => {
        document.getElementById("purchase-bill-form")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 0);
    }

    window.addEventListener("vertexerp-edit-purchase", handleEditPurchase);

    return () => {
      window.removeEventListener("vertexerp-edit-purchase", handleEditPurchase);
    };
  }, []);

  const selectedSupplier = suppliers.find(
    (supplier) => supplier.id === form.supplierId,
  );

  const itemBaseCalculations = useMemo(() => {
    return items.map((item) => {
      const selectedProduct = products.find(
        (product) => product.id === item.productId,
      );

      const quantity = Math.max(0, toNumber(item.quantity));
      const rate = Math.max(0, toNumber(item.rate));
      const gst = Math.max(0, toNumber(item.gst));
      const baseAmount = Number((quantity * rate).toFixed(2));
      const discount = Math.min(
        Math.max(0, toNumber(item.discount)),
        baseAmount,
      );
      const taxableAmount = Number(
        Math.max(0, baseAmount - discount).toFixed(2),
      );
      const gstAmount = Number(((taxableAmount * gst) / 100).toFixed(2));

      return {
        selectedProduct,
        quantity,
        rate,
        gst,
        discount,
        baseAmount,
        taxableAmount,
        gstAmount,
      };
    });
  }, [items, products]);

  const draftGstTotal = useMemo(
    () =>
      itemBaseCalculations.reduce((total, item) => total + item.gstAmount, 0),
    [itemBaseCalculations],
  );

  const taxType = getTaxType(
    companyStateCode,
    selectedSupplier?.stateCode || "",
    draftGstTotal,
  );

  const calculatedItems = useMemo<CalculatedPurchaseItem[]>(() => {
    return itemBaseCalculations.map((item, index) => {
      const cgstAmount =
        taxType === "INTRA_STATE" ? Number((item.gstAmount / 2).toFixed(2)) : 0;

      const sgstAmount =
        taxType === "INTRA_STATE"
          ? Number((item.gstAmount - cgstAmount).toFixed(2))
          : 0;

      const igstAmount = taxType === "INTER_STATE" ? item.gstAmount : 0;

      return {
        productId: items[index].productId,
        productName: item.selectedProduct?.name || "Select product",
        hsnSacCode: item.selectedProduct?.hsnSacCode || "",
        quantity: item.quantity,
        rate: item.rate,
        gst: item.gst,
        discount: item.discount,
        baseAmount: item.baseAmount,
        taxableAmount: item.taxableAmount,
        gstAmount: item.gstAmount,
        cgstAmount,
        sgstAmount,
        igstAmount,
        amount: Number((item.taxableAmount + item.gstAmount).toFixed(2)),
      };
    });
  }, [itemBaseCalculations, items, taxType]);

  const totals = useMemo(() => {
    return calculatedItems.reduce(
      (result, item) => ({
        subtotal: result.subtotal + item.baseAmount,
        taxableTotal: result.taxableTotal + item.taxableAmount,
        gstTotal: result.gstTotal + item.gstAmount,
        cgstTotal: result.cgstTotal + item.cgstAmount,
        sgstTotal: result.sgstTotal + item.sgstAmount,
        igstTotal: result.igstTotal + item.igstAmount,
        discountTotal: result.discountTotal + item.discount,
        grandTotal: result.grandTotal + item.amount,
      }),
      {
        subtotal: 0,
        taxableTotal: 0,
        gstTotal: 0,
        cgstTotal: 0,
        sgstTotal: 0,
        igstTotal: 0,
        discountTotal: 0,
        grandTotal: 0,
      },
    );
  }, [calculatedItems]);

  function updateItem(
    index: number,
    field: keyof PurchaseItemForm,
    value: string,
  ) {
    setItems((currentItems) =>
      currentItems.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        if (field === "productId") {
          const selectedProduct = products.find(
            (product) => product.id === value,
          );

          return {
            ...item,
            productId: value,
            rate: selectedProduct ? String(selectedProduct.purchasePrice) : "",
            gst: selectedProduct ? String(selectedProduct.gst) : "18",
          };
        }

        return {
          ...item,
          [field]: value,
        };
      }),
    );
  }

  function addItem() {
    setItems((currentItems) => [...currentItems, createEmptyItem()]);
  }

  function removeItem(index: number) {
    if (items.length === 1) {
      showMessage("At least one purchase item is required.");
      return;
    }

    setItems((currentItems) =>
      currentItems.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  function resetForm() {
    setForm({
      billNumber: "",
      date: getToday(),
      paymentMode: "Cash",
      supplierId: "",
    });
    setItems([createEmptyItem()]);
  }

  function cancelPurchaseEdit() {
    setEditingPurchase(null);
    resetForm();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeCompanyId) {
      showMessage("Select an active company before saving a purchase bill.");
      return;
    }

    if (!/^[0-9]{2}$/.test(companyStateCode)) {
      showMessage("Complete the active Company State and State Code first.");
      return;
    }

    if (!selectedSupplier) {
      showMessage("Please select a Supplier ledger.");
      return;
    }

    if (!/^[0-9]{2}$/.test(selectedSupplier.stateCode)) {
      showMessage(
        "Complete the selected Supplier State and State Code from the Ledger page.",
      );
      return;
    }

    if (!form.date) {
      showMessage("Please select a purchase date.");
      return;
    }

    const validItems = calculatedItems.filter(
      (item) =>
        item.productId &&
        item.quantity > 0 &&
        item.rate > 0 &&
        item.productName !== "Select product",
    );

    if (validItems.length === 0) {
      showMessage("Add at least one valid product with quantity and rate.");
      return;
    }

    const missingHsnItem = validItems.find(
      (item) => !/^[0-9]{4,8}$/.test(item.hsnSacCode),
    );

    if (missingHsnItem) {
      showMessage(
        `Complete the HSN Code for ${missingHsnItem.productName} from the Inventory page.`,
      );
      return;
    }

    if (totals.gstTotal > 0 && taxType === "UNCLASSIFIED") {
      showMessage(
        "GST Type could not be classified. Check Company and Supplier State Codes.",
      );
      return;
    }

    const enteredBillNumber = form.billNumber.trim();

    if (editingPurchase && !enteredBillNumber) {
      showMessage("Purchase bill number is required when editing a bill.");
      return;
    }

    const billNumber =
      enteredBillNumber || `PUR-${Date.now().toString().slice(-6)}`;

    const purchaseItems = validItems.map((item) => ({
      product_id: item.productId,
      product_name: item.productName,
      quantity: item.quantity,
      rate: item.rate,
      gst_rate: item.gst,
      discount: item.discount,
      base_amount: item.baseAmount,
      taxable_amount: item.taxableAmount,
      gst_amount: item.gstAmount,
      cgst_amount: item.cgstAmount,
      sgst_amount: item.sgstAmount,
      igst_amount: item.igstAmount,
      cess_amount: 0,
      hsn_sac_code: item.hsnSacCode,
      amount: item.amount,
    }));

    setIsSaving(true);

    try {
      const supabase = createClient();

      const { error } = editingPurchase
        ? await supabase.rpc("update_purchase_with_stock", {
            p_purchase_id: editingPurchase.id,
            p_supplier_id: selectedSupplier.id,
            p_bill_number: billNumber,
            p_purchase_date: form.date,
            p_payment_mode: form.paymentMode,
            p_subtotal: totals.subtotal,
            p_gst_total: totals.gstTotal,
            p_discount_total: totals.discountTotal,
            p_grand_total: totals.grandTotal,
            p_items: purchaseItems,
          })
        : await supabase.rpc("create_purchase_with_stock", {
            p_company_id: activeCompanyId,
            p_supplier_id: selectedSupplier.id,
            p_bill_number: billNumber,
            p_purchase_date: form.date,
            p_payment_mode: form.paymentMode,
            p_subtotal: totals.subtotal,
            p_gst_total: totals.gstTotal,
            p_discount_total: totals.discountTotal,
            p_grand_total: totals.grandTotal,
            p_items: purchaseItems,
          });

      if (error) {
        if (error.code === "23505") {
          showMessage(
            `Purchase bill number "${billNumber}" already exists for this company.`,
          );
          return;
        }

        throw error;
      }

      const successMessage = editingPurchase
        ? `Purchase bill ${billNumber} updated with ${getTaxTypeLabel(
            taxType,
          )} GST snapshots. Inventory was rebalanced safely.`
        : `Purchase bill ${billNumber} saved with ${getTaxTypeLabel(
            taxType,
          )} GST snapshots and stock updated.`;

      setEditingPurchase(null);
      resetForm();
      await loadFormData();

      window.dispatchEvent(new Event("vertexerp-purchases-updated"));
      window.dispatchEvent(new Event("vertexerp-products-updated"));
      window.dispatchEvent(new Event("vertexerp-gst-data-updated"));

      showMessage(successMessage);
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Purchase bill could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const isFormDisabled = isLoading || !activeCompanyId || isSaving;

  return (
    <form
      id="purchase-bill-form"
      onSubmit={handleSubmit}
      className="mt-6 rounded-3xl border border-slate-100 bg-white p-4 shadow-xl sm:mt-8 sm:p-6 lg:p-8"
    >
      <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-6 lg:mb-8 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
            {editingPurchase
              ? "Edit GST Purchase Bill"
              : "Create GST Purchase Bill"}
          </h2>

          <p className="mt-1 text-sm text-slate-600 sm:text-base">
            Automatic supplier-state classification, HSN snapshots and CGST/SGST
            or IGST input-tax split.
          </p>
        </div>

        <div
          className={`w-fit rounded-full px-4 py-2 text-sm font-semibold ${
            editingPurchase
              ? "bg-amber-50 text-amber-700"
              : "bg-blue-50 text-blue-700"
          }`}
        >
          {editingPurchase ? "Editing Bill" : "GST Classification Active"}
        </div>
      </div>

      {message && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 font-medium text-blue-700">
          {message}
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryBox
            label="Receiving Company"
            value={
              companyStateCode
                ? `${companyState} (${companyStateCode})`
                : "Setup Pending"
            }
          />

          <SummaryBox
            label="Supplier State"
            value={
              selectedSupplier?.stateCode
                ? `${selectedSupplier.state} (${selectedSupplier.stateCode})`
                : "Select Supplier"
            }
          />

          <SummaryBox
            label="GST Type"
            value={getTaxTypeLabel(taxType)}
            valueClassName={
              taxType === "UNCLASSIFIED"
                ? "text-amber-700"
                : taxType === "INTER_STATE"
                  ? "text-violet-700"
                  : "text-emerald-700"
            }
          />
        </div>
      </div>

      {editingPurchase && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Saving changes will rebalance inventory, weighted-average cost,
          accounting and audit history through the existing protected purchase
          workflow.
        </div>
      )}

      {!isLoading &&
        activeCompanyId &&
        !/^[0-9]{2}$/.test(companyStateCode) && (
          <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-orange-700">
            Complete the active company State from the{" "}
            <strong>Companies</strong> page.
          </div>
        )}

      {!isLoading && activeCompanyId && suppliers.length === 0 && (
        <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-orange-700">
          No Supplier ledger found. Create one from the <strong>Ledgers</strong>{" "}
          page.
        </div>
      )}

      {!isLoading && activeCompanyId && products.length === 0 && (
        <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-orange-700">
          No goods products found. Add inventory products before recording a
          purchase bill.
        </div>
      )}

      <fieldset disabled={isFormDisabled}>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          <Field
            label="Purchase Bill Number"
            value={form.billNumber}
            placeholder="Example: PUR-0001"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                billNumber: value,
              }))
            }
          />

          <Field
            label="Purchase Date *"
            type="date"
            value={form.date}
            placeholder=""
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                date: value,
              }))
            }
          />

          <SelectField
            label="Payment Mode"
            value={form.paymentMode}
            options={["Cash", "UPI", "Bank Transfer", "Credit", "Card"]}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                paymentMode: value,
              }))
            }
          />

          <div>
            <label className="mb-2 block font-semibold text-slate-800">
              Supplier Name *
            </label>

            <select
              value={form.supplierId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  supplierId: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
            >
              <option value="">Select supplier</option>

              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                  {supplier.stateCode
                    ? ` · ${supplier.stateCode}`
                    : " · State Pending"}
                </option>
              ))}
            </select>
          </div>

          <ReadOnlyField
            label="Supplier Mobile"
            value={selectedSupplier?.mobile || ""}
            placeholder="Supplier mobile"
          />

          <ReadOnlyField
            label="Supplier GST Number"
            value={selectedSupplier?.gst || ""}
            placeholder="Unregistered supplier"
          />
        </div>

        <div className="mt-8 sm:mt-10">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                Purchase Items
              </h3>

              <p className="mt-1 text-sm text-slate-600">
                HSN and GST rate are loaded from Inventory.
              </p>
            </div>

            <button
              type="button"
              onClick={addItem}
              className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 font-semibold text-blue-700 transition hover:bg-blue-100 sm:w-fit"
            >
              + Add Item
            </button>
          </div>

          <div className="space-y-4 md:hidden">
            {items.map((item, index) => {
              const calculated = calculatedItems[index];

              return (
                <div
                  key={index}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <p className="font-bold text-slate-900">
                      Purchase Item {index + 1}
                    </p>

                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-sm font-semibold text-red-500"
                    >
                      Remove
                    </button>
                  </div>

                  <ProductSelect
                    value={item.productId}
                    products={products}
                    onChange={(value) => updateItem(index, "productId", value)}
                  />

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <MiniField
                      label="Quantity"
                      value={item.quantity}
                      onChange={(value) => updateItem(index, "quantity", value)}
                    />

                    <MiniField
                      label="Purchase Rate"
                      value={item.rate}
                      onChange={(value) => updateItem(index, "rate", value)}
                    />

                    <MiniField
                      label="GST %"
                      value={item.gst}
                      onChange={(value) => updateItem(index, "gst", value)}
                    />

                    <MiniField
                      label="Discount"
                      value={item.discount}
                      onChange={(value) => updateItem(index, "discount", value)}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <SummaryBox
                      label="HSN"
                      value={calculated.hsnSacCode || "Pending"}
                    />
                    <SummaryBox
                      label="Taxable"
                      value={formatCurrency(calculated.taxableAmount)}
                    />
                    <SummaryBox
                      label="Input GST"
                      value={formatCurrency(calculated.gstAmount)}
                    />
                    <SummaryBox
                      label="Item Total"
                      value={formatCurrency(calculated.amount)}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 md:block">
            <table className="w-full min-w-[1120px]">
              <thead className="bg-slate-50">
                <tr className="text-left">
                  {[
                    "Product",
                    "HSN",
                    "Qty",
                    "Rate",
                    "GST",
                    "Discount",
                    "Taxable",
                    "Amount",
                    "Action",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="px-4 py-4 text-sm font-bold text-slate-700"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {items.map((item, index) => {
                  const calculated = calculatedItems[index];

                  return (
                    <tr key={index} className="border-t border-slate-200">
                      <td className="px-4 py-4">
                        <ProductSelect
                          value={item.productId}
                          products={products}
                          onChange={(value) =>
                            updateItem(index, "productId", value)
                          }
                        />
                      </td>

                      <td className="px-4 py-4 font-semibold text-slate-700">
                        {calculated.hsnSacCode || "—"}
                      </td>

                      <td className="px-4 py-4">
                        <TableInput
                          value={item.quantity}
                          onChange={(value) =>
                            updateItem(index, "quantity", value)
                          }
                        />
                      </td>

                      <td className="px-4 py-4">
                        <TableInput
                          value={item.rate}
                          onChange={(value) => updateItem(index, "rate", value)}
                        />
                      </td>

                      <td className="px-4 py-4">
                        <TableInput
                          value={item.gst}
                          onChange={(value) => updateItem(index, "gst", value)}
                        />
                      </td>

                      <td className="px-4 py-4">
                        <TableInput
                          value={item.discount}
                          onChange={(value) =>
                            updateItem(index, "discount", value)
                          }
                        />
                      </td>

                      <td className="px-4 py-4 font-semibold text-slate-700">
                        {formatCurrency(calculated.taxableAmount)}
                      </td>

                      <td className="px-4 py-4 font-bold text-slate-900">
                        {formatCurrency(calculated.amount)}
                      </td>

                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="font-semibold text-red-500"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 max-w-none rounded-2xl bg-slate-50 p-5 sm:mt-8 sm:p-6 md:ml-auto md:max-w-lg">
          <TotalRow label="Gross Subtotal" value={totals.subtotal} />
          <TotalRow label="Discount" value={totals.discountTotal} />
          <TotalRow label="Taxable Value" value={totals.taxableTotal} />

          {taxType === "INTRA_STATE" && (
            <>
              <TotalRow label="Input CGST" value={totals.cgstTotal} />
              <TotalRow label="Input SGST" value={totals.sgstTotal} />
            </>
          )}

          {taxType === "INTER_STATE" && (
            <TotalRow label="Input IGST" value={totals.igstTotal} />
          )}

          <div className="flex items-center justify-between pt-4">
            <span className="text-lg font-bold text-slate-900">
              Grand Total
            </span>

            <span className="text-2xl font-bold text-blue-600">
              {formatCurrency(totals.grandTotal)}
            </span>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:gap-4">
          <button
            type="submit"
            className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-700 sm:w-auto sm:px-7"
          >
            {isSaving
              ? "Saving..."
              : editingPurchase
                ? "Save GST Bill Changes"
                : "Save GST Purchase Bill"}
          </button>

          <button
            type="button"
            onClick={editingPurchase ? cancelPurchaseEdit : resetForm}
            className="w-full rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-100 sm:w-auto sm:px-7"
          >
            {editingPurchase ? "Cancel Edit" : "Reset"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-2 block font-semibold text-slate-800">{label}</label>

      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
      />
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
  placeholder,
}: {
  label: string;
  value: string;
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-2 block font-semibold text-slate-800">{label}</label>

      <input
        value={value}
        readOnly
        placeholder={placeholder}
        className="w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-slate-700"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block font-semibold text-slate-800">{label}</label>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </div>
  );
}

function ProductSelect({
  value,
  products,
  onChange,
}: {
  value: string;
  products: Product[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full min-w-[210px] rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-800 outline-none focus:border-blue-500"
    >
      <option value="">Select product</option>

      {products.map((product) => (
        <option key={product.id} value={product.id}>
          {product.name}
          {product.sku ? ` (${product.sku})` : ""}
          {product.hsnSacCode
            ? ` · HSN ${product.hsnSacCode}`
            : " · HSN Pending"}
        </option>
      ))}
    </select>
  );
}

function MiniField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <input
        type="number"
        min="0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
      />
    </div>
  );
}

function TableInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="number"
      min="0"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-24 rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
    />
  );
}

function SummaryBox({
  label,
  value,
  valueClassName = "text-slate-900",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl bg-white p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className={`mt-1 break-words font-bold ${valueClassName}`}>{value}</p>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 py-3 text-slate-700">
      <span>{label}</span>
      <span className="font-semibold">{formatCurrency(value)}</span>
    </div>
  );
}