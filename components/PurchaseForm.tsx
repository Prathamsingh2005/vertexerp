"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Product = {
  id: string;
  name: string;
  sku: string;
  purchasePrice: number;
  gst: number;
};

type Ledger = {
  id: string;
  name: string;
  mobile: string;
  gst: string;
};

type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  purchase_price: number | string | null;
  gst_rate: number | string | null;
};

type LedgerRow = {
  id: string;
  name: string;
  mobile: string | null;
  gst_number: string | null;
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

type CalculatedPurchaseItem = {
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

function mapProductRow(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name || "",
    sku: row.sku || "",
    purchasePrice: Number(row.purchase_price || 0),
    gst: Number(row.gst_rate || 0),
  };
}

function mapLedgerRow(row: LedgerRow): Ledger {
  return {
    id: row.id,
    name: row.name || "",
    mobile: row.mobile || "",
    gst: row.gst_number || "",
  };
}

export default function PurchaseForm() {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Ledger[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
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

  const [items, setItems] = useState<PurchaseItemForm[]>([
    createEmptyItem(),
  ]);

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);

    window.setTimeout(() => {
      setMessage("");
    }, 4000);
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
        showMessage("Select an active company from the Companies page first.");
        return;
      }

      const [productsResponse, suppliersResponse] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, sku, purchase_price, gst_rate")
          .eq("company_id", companyId)
          .order("name"),
        supabase
          .from("ledgers")
          .select("id, name, mobile, gst_number")
          .eq("company_id", companyId)
          .eq("ledger_type", "Supplier")
          .order("name"),
      ]);

      if (productsResponse.error) {
        throw productsResponse.error;
      }

      if (suppliersResponse.error) {
        throw suppliersResponse.error;
      }

      setProducts((productsResponse.data || []).map(mapProductRow));
      setSuppliers((suppliersResponse.data || []).map(mapLedgerRow));
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Purchase form data could not be loaded.";

      showMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadFormData();

    window.addEventListener(
      "vertexerp-active-company-updated",
      loadFormData
    );

    return () => {
      window.removeEventListener(
        "vertexerp-active-company-updated",
        loadFormData
      );
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
          : [createEmptyItem()]
      );

      window.setTimeout(() => {
        document
          .getElementById("purchase-bill-form")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    }

    window.addEventListener(
      "vertexerp-edit-purchase",
      handleEditPurchase
    );

    return () => {
      window.removeEventListener(
        "vertexerp-edit-purchase",
        handleEditPurchase
      );
    };
  }, []);

  const calculatedItems = useMemo<CalculatedPurchaseItem[]>(() => {
    return items.map((item) => {
      const selectedProduct = products.find(
        (product) => product.id === item.productId
      );

      const quantity = Math.max(0, Number(item.quantity) || 0);
      const rate = Math.max(0, Number(item.rate) || 0);
      const gst = Math.max(0, Number(item.gst) || 0);
      const discount = Math.max(0, Number(item.discount) || 0);

      const baseAmount = quantity * rate;
      const taxableAmount = Math.max(baseAmount - discount, 0);
      const gstAmount = (taxableAmount * gst) / 100;
      const amount = taxableAmount + gstAmount;

      return {
        productId: item.productId,
        productName: selectedProduct?.name || "Select product",
        quantity,
        rate,
        gst,
        discount,
        baseAmount,
        gstAmount,
        amount,
      };
    });
  }, [items, products]);

  const totals = useMemo(() => {
    return calculatedItems.reduce(
      (result, item) => ({
        subtotal: result.subtotal + item.baseAmount,
        gstTotal: result.gstTotal + item.gstAmount,
        discountTotal: result.discountTotal + item.discount,
        grandTotal: result.grandTotal + item.amount,
      }),
      {
        subtotal: 0,
        gstTotal: 0,
        discountTotal: 0,
        grandTotal: 0,
      }
    );
  }, [calculatedItems]);

  function updateItem(
    index: number,
    field: keyof PurchaseItemForm,
    value: string
  ) {
    setItems((currentItems) =>
      currentItems.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        if (field === "productId") {
          const selectedProduct = products.find(
            (product) => product.id === value
          );

          return {
            ...item,
            productId: value,
            rate: selectedProduct
              ? String(selectedProduct.purchasePrice)
              : "",
            gst: selectedProduct ? String(selectedProduct.gst) : "18",
          };
        }

        return {
          ...item,
          [field]: value,
        };
      })
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
      currentItems.filter((_, itemIndex) => itemIndex !== index)
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
      showMessage(
        editingPurchase
          ? "Select an active company before updating a purchase bill."
          : "Select an active company before creating a purchase bill."
      );
      return;
    }

    const selectedSupplier = suppliers.find(
      (supplier) => supplier.id === form.supplierId
    );

    const validItems = calculatedItems.filter(
      (item) =>
        item.productId &&
        item.quantity > 0 &&
        item.rate > 0 &&
        item.productName !== "Select product"
    );

    if (!form.date) {
      showMessage("Please select a purchase date.");
      return;
    }

    if (!selectedSupplier) {
      showMessage(
        "Please select a supplier. Create a ledger with the Supplier group first."
      );
      return;
    }

    if (validItems.length === 0) {
      showMessage("Add at least one valid product with quantity and rate.");
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
      gst_amount: item.gstAmount,
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
            `Purchase bill number "${billNumber}" already exists for this company.`
          );
          return;
        }

        throw error;
      }

      const successMessage = editingPurchase
        ? `Purchase bill ${billNumber} updated, inventory rebalanced and audit history saved.`
        : `Purchase bill ${billNumber} saved and product stock updated successfully.`;

      setEditingPurchase(null);
      resetForm();
      await loadFormData();

      window.dispatchEvent(new Event("vertexerp-purchases-updated"));
      window.dispatchEvent(new Event("vertexerp-products-updated"));

      showMessage(successMessage);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Purchase bill could not be saved.";

      showMessage(errorMessage);
    } finally {
      setIsSaving(false);
    }
  }

  const selectedSupplier = suppliers.find(
    (supplier) => supplier.id === form.supplierId
  );

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
            {editingPurchase ? "Edit Purchase Bill" : "Create Purchase Bill"}
          </h2>

          <p className="mt-1 text-sm text-slate-600 sm:text-base">
            {editingPurchase
              ? "Update supplier bill details and received quantities safely. Inventory is rebalanced and the previous version remains in Audit History."
              : "Save supplier purchase bills and automatically increase product stock."}
          </p>
        </div>

        <div
          className={`w-fit rounded-full px-4 py-2 text-sm font-semibold ${
            editingPurchase
              ? "bg-amber-50 text-amber-700"
              : "bg-blue-50 text-blue-700"
          }`}
        >
          {editingPurchase ? "Editing Bill" : "Cloud Stock Entry"}
        </div>
      </div>

      {message && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 sm:text-base">
          {message}
        </div>
      )}

      {editingPurchase && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 sm:text-base">
          Editing purchase bill <strong>{editingPurchase.billNumber}</strong>{" "}
          from <strong>{editingPurchase.supplierName}</strong>. Save Changes
          will rebalance inventory and create an UPDATE record in Audit
          History.
        </div>
      )}

      {!isLoading && !activeCompanyId && (
        <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700 sm:text-base">
          Select an active company from the <strong>Companies</strong> page
          before creating a purchase bill.
        </div>
      )}

      {!isLoading && activeCompanyId && suppliers.length === 0 && (
        <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700 sm:text-base">
          No supplier ledger found. Create a ledger with the{" "}
          <strong>Supplier</strong> group from the Ledger page first.
        </div>
      )}

      {!isLoading && activeCompanyId && products.length === 0 && (
        <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700 sm:text-base">
          No products found. Add products from the <strong>Inventory</strong>{" "}
          page first.
        </div>
      )}

      <fieldset disabled={isFormDisabled}>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="mb-2 block font-semibold text-slate-800">
              Purchase Bill Number
            </label>

            <input
              type="text"
              value={form.billNumber}
              onChange={(event) =>
                setForm({ ...form, billNumber: event.target.value })
              }
              placeholder="Example: PUR-0001"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="mb-2 block font-semibold text-slate-800">
              Purchase Date *
            </label>

            <input
              type="date"
              value={form.date}
              onChange={(event) =>
                setForm({ ...form, date: event.target.value })
              }
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="mb-2 block font-semibold text-slate-800">
              Payment Mode
            </label>

            <select
              value={form.paymentMode}
              onChange={(event) =>
                setForm({ ...form, paymentMode: event.target.value })
              }
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed"
            >
              <option>Cash</option>
              <option>UPI</option>
              <option>Bank Transfer</option>
              <option>Credit</option>
              <option>Card</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block font-semibold text-slate-800">
              Supplier Name *
            </label>

            <select
              value={form.supplierId}
              onChange={(event) =>
                setForm({ ...form, supplierId: event.target.value })
              }
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed"
            >
              <option value="">Select supplier</option>

              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block font-semibold text-slate-800">
              Supplier Mobile
            </label>

            <input
              type="text"
              value={selectedSupplier?.mobile || ""}
              readOnly
              placeholder="Supplier mobile will appear here"
              className="w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-slate-700 placeholder:text-slate-500 outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block font-semibold text-slate-800">
              Supplier GST Number
            </label>

            <input
              type="text"
              value={selectedSupplier?.gst || ""}
              readOnly
              placeholder="Supplier GST will appear here"
              className="w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-slate-700 placeholder:text-slate-500 outline-none"
            />
          </div>
        </div>

        <div className="mt-8 sm:mt-10">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                Purchase Items
              </h3>

              <p className="mt-1 text-sm text-slate-600">
                Select products received from the supplier.
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

          {/* Phone layout: each purchase item is a readable card. */}
          <div className="space-y-4 md:hidden">
            {items.map((item, index) => (
              <div
                key={index}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="mb-4 flex items-center justify-between">
                  <p className="font-bold text-slate-900">
                    Item {index + 1}
                  </p>

                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="text-sm font-semibold text-red-500 transition hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Product
                  </label>

                  <select
                    value={item.productId}
                    onChange={(event) =>
                      updateItem(index, "productId", event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-800 outline-none focus:border-blue-500"
                  >
                    <option value="">Select product</option>

                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                        {product.sku ? ` (${product.sku})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Quantity
                    </label>

                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(event) =>
                        updateItem(index, "quantity", event.target.value)
                      }
                      placeholder="0"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Purchase Rate
                    </label>

                    <input
                      type="number"
                      min="0"
                      value={item.rate}
                      onChange={(event) =>
                        updateItem(index, "rate", event.target.value)
                      }
                      placeholder="₹ 0"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      GST
                    </label>

                    <select
                      value={item.gst}
                      onChange={(event) =>
                        updateItem(index, "gst", event.target.value)
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-800 outline-none focus:border-blue-500"
                    >
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                      <option value="28">28%</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Discount
                    </label>

                    <input
                      type="number"
                      min="0"
                      value={item.discount}
                      onChange={(event) =>
                        updateItem(index, "discount", event.target.value)
                      }
                      placeholder="₹ 0"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between rounded-xl bg-white px-4 py-3">
                  <span className="text-sm font-semibold text-slate-600">
                    Amount
                  </span>

                  <span className="font-bold text-slate-900">
                    ₹
                    {calculatedItems[index].amount.toLocaleString("en-IN", {
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop/tablet layout: horizontal table remains efficient for rapid entry. */}
          <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 md:block">
            <table className="w-full min-w-[1000px]">
              <thead className="bg-slate-50">
                <tr className="text-left">
                  <th className="px-5 py-4 text-sm font-bold text-slate-700">
                    Product
                  </th>
                  <th className="px-5 py-4 text-sm font-bold text-slate-700">
                    Quantity
                  </th>
                  <th className="px-5 py-4 text-sm font-bold text-slate-700">
                    Purchase Rate
                  </th>
                  <th className="px-5 py-4 text-sm font-bold text-slate-700">
                    GST
                  </th>
                  <th className="px-5 py-4 text-sm font-bold text-slate-700">
                    Discount
                  </th>
                  <th className="px-5 py-4 text-sm font-bold text-slate-700">
                    Amount
                  </th>
                  <th className="px-5 py-4 text-sm font-bold text-slate-700">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {items.map((item, index) => (
                  <tr key={index} className="border-t border-slate-200">
                    <td className="px-5 py-4">
                      <select
                        value={item.productId}
                        onChange={(event) =>
                          updateItem(index, "productId", event.target.value)
                        }
                        className="w-full min-w-[190px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 outline-none focus:border-blue-500"
                      >
                        <option value="">Select product</option>

                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                            {product.sku ? ` (${product.sku})` : ""}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-5 py-4">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(index, "quantity", event.target.value)
                        }
                        placeholder="0"
                        className="w-24 rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                      />
                    </td>

                    <td className="px-5 py-4">
                      <input
                        type="number"
                        min="0"
                        value={item.rate}
                        onChange={(event) =>
                          updateItem(index, "rate", event.target.value)
                        }
                        placeholder="₹ 0"
                        className="w-28 rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                      />
                    </td>

                    <td className="px-5 py-4">
                      <select
                        value={item.gst}
                        onChange={(event) =>
                          updateItem(index, "gst", event.target.value)
                        }
                        className="w-24 rounded-xl border border-slate-300 px-3 py-2 text-slate-800 outline-none focus:border-blue-500"
                      >
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                        <option value="28">28%</option>
                      </select>
                    </td>

                    <td className="px-5 py-4">
                      <input
                        type="number"
                        min="0"
                        value={item.discount}
                        onChange={(event) =>
                          updateItem(index, "discount", event.target.value)
                        }
                        placeholder="₹ 0"
                        className="w-28 rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                      />
                    </td>

                    <td className="px-5 py-4 font-bold text-slate-900">
                      ₹
                      {calculatedItems[index].amount.toLocaleString("en-IN", {
                        maximumFractionDigits: 2,
                      })}
                    </td>

                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="font-semibold text-red-500 transition hover:text-red-700"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 max-w-none rounded-2xl bg-slate-50 p-5 sm:mt-8 sm:p-6 md:ml-auto md:max-w-md">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 text-slate-700">
            <span>Subtotal</span>
            <span className="font-semibold">
              ₹{totals.subtotal.toLocaleString("en-IN")}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-slate-200 py-3 text-slate-700">
            <span>Total GST</span>
            <span className="font-semibold">
              ₹{totals.gstTotal.toLocaleString("en-IN")}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-slate-200 py-3 text-slate-700">
            <span>Discount</span>
            <span className="font-semibold">
              ₹{totals.discountTotal.toLocaleString("en-IN")}
            </span>
          </div>

          <div className="flex items-center justify-between pt-4">
            <span className="text-lg font-bold text-slate-900">Grand Total</span>
            <span className="text-2xl font-bold text-blue-600">
              ₹{totals.grandTotal.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:gap-4">
          <button
            type="submit"
            className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-700 hover:shadow-xl sm:w-auto sm:px-7"
          >
            {isSaving
              ? editingPurchase
                ? "Saving Changes..."
                : "Saving Purchase..."
              : editingPurchase
                ? "Save Changes & Rebalance Stock"
                : "Save Purchase & Update Stock"}
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