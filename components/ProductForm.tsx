"use client";

import { type FormEvent, useEffect, useState } from "react";

export type ProductInput = {
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

export type EditableProduct = ProductInput & {
  id: string;
};

type ProductFormProps = {
  onSaveProduct: (product: ProductInput) => Promise<boolean>;
  editingProduct: EditableProduct | null;
  onCancelEdit: () => void;
  isSaving: boolean;
};

type ProductFormState = {
  name: string;
  sku: string;
  category: string;
  unit: string;
  purchasePrice: string;
  sellingPrice: string;
  quantity: string;
  lowStockAlert: string;
  gst: string;
  hsnSacCode: string;
  isService: boolean;
  description: string;
};

const INITIAL_FORM: ProductFormState = {
  name: "",
  sku: "",
  category: "",
  unit: "Piece",
  purchasePrice: "",
  sellingPrice: "",
  quantity: "",
  lowStockAlert: "5",
  gst: "18",
  hsnSacCode: "",
  isService: false,
  description: "",
};

export default function ProductForm({
  onSaveProduct,
  editingProduct,
  onCancelEdit,
  isSaving,
}: ProductFormProps) {
  const [form, setForm] = useState<ProductFormState>(INITIAL_FORM);
  const [message, setMessage] = useState("");

  const isEditing = Boolean(editingProduct);

  useEffect(() => {
    if (!editingProduct) {
      setForm(INITIAL_FORM);
      setMessage("");
      return;
    }

    setForm({
      name: editingProduct.name,
      sku: editingProduct.sku,
      category: editingProduct.category,
      unit: editingProduct.unit,
      purchasePrice: String(editingProduct.purchasePrice || ""),
      sellingPrice: String(editingProduct.sellingPrice || ""),
      quantity: String(editingProduct.quantity || ""),
      lowStockAlert: String(editingProduct.lowStockAlert || ""),
      gst: String(editingProduct.gst || 0),
      hsnSacCode: editingProduct.hsnSacCode,
      isService: editingProduct.isService,
      description: editingProduct.description,
    });
    setMessage("");
  }, [editingProduct]);

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(""), 4000);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.name.trim() || !form.sku.trim()) {
      showMessage("Product Name and SKU are required.");
      return;
    }

    if (!/^[0-9]{4,8}$/.test(form.hsnSacCode.trim())) {
      showMessage("HSN/SAC Code must contain 4 to 8 digits.");
      return;
    }

    const saved = await onSaveProduct({
      name: form.name.trim(),
      sku: form.sku.trim().toUpperCase(),
      category: form.category || "Uncategorized",
      unit: form.isService ? "Service" : form.unit,
      purchasePrice: form.isService
        ? 0
        : Number(form.purchasePrice) || 0,
      sellingPrice: Number(form.sellingPrice) || 0,
      quantity: form.isService ? 0 : Number(form.quantity) || 0,
      lowStockAlert: form.isService
        ? 0
        : Number(form.lowStockAlert) || 0,
      gst: Number(form.gst) || 0,
      hsnSacCode: form.hsnSacCode.trim(),
      isService: form.isService,
      description: form.description.trim(),
    });

    if (saved && !isEditing) {
      setForm(INITIAL_FORM);
    }
  }

  function resetForm() {
    if (isEditing) {
      onCancelEdit();
      return;
    }

    setForm(INITIAL_FORM);
    setMessage("");
  }

  return (
    <form
      id="product-form"
      onSubmit={handleSubmit}
      className="mt-6 rounded-3xl border border-slate-100 bg-white p-4 shadow-xl sm:mt-8 sm:p-6 lg:p-8"
    >
      <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between lg:mb-8">
        <div>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
            {isEditing ? "Edit Product & GST Setup" : "Add New Product"}
          </h2>

          <p className="mt-1 text-sm text-slate-600 sm:text-base">
            {isEditing
              ? "Update product identity, HSN/SAC and tax details."
              : "Enter product, HSN/SAC, pricing and opening stock details."}
          </p>
        </div>

        <div className="w-fit rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
          {isEditing ? "Updating Product" : "New Inventory Item"}
        </div>
      </div>

      {message && (
        <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 sm:mb-6 sm:text-base">
          {message}
        </div>
      )}

      <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        HSN/SAC Code is required for GST reporting. Use an HSN code for
        goods and a SAC code for services. Enter only 4 to 8 digits.
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Field
          label="Product Name *"
          value={form.name}
          placeholder="Enter product name"
          onChange={(value) =>
            setForm((current) => ({ ...current, name: value }))
          }
        />

        <Field
          label="Product SKU / Code *"
          value={form.sku}
          placeholder="Example: PRD-1001"
          disabled={isEditing}
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              sku: value.toUpperCase(),
            }))
          }
        />

        <SelectField
          label="Item Type"
          value={form.isService ? "Service" : "Goods"}
          disabled={isEditing}
          options={["Goods", "Service"]}
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              isService: value === "Service",
              unit: value === "Service" ? "Service" : "Piece",
              purchasePrice:
                value === "Service" ? "" : current.purchasePrice,
              quantity: value === "Service" ? "" : current.quantity,
              lowStockAlert:
                value === "Service" ? "0" : current.lowStockAlert,
            }))
          }
        />

        <Field
          label={form.isService ? "SAC Code *" : "HSN Code *"}
          value={form.hsnSacCode}
          placeholder={form.isService ? "Example: 998314" : "Example: 847160"}
          maxLength={8}
          inputMode="numeric"
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              hsnSacCode: value.replace(/\D/g, "").slice(0, 8),
            }))
          }
        />

        <SelectField
          label="Category"
          value={form.category}
          options={[
            "",
            "Electronics",
            "Grocery",
            "Clothing",
            "Furniture",
            "Stationery",
            "Services",
            "Other",
          ]}
          optionLabels={{
            "": "Select category",
          }}
          onChange={(value) =>
            setForm((current) => ({ ...current, category: value }))
          }
        />

        <SelectField
          label="Unit"
          value={form.isService ? "Service" : form.unit}
          disabled={form.isService}
          options={[
            "Piece",
            "Kg",
            "Gram",
            "Litre",
            "Box",
            "Packet",
            "Service",
          ]}
          onChange={(value) =>
            setForm((current) => ({ ...current, unit: value }))
          }
        />

        <Field
          label="Purchase Price"
          type="number"
          value={form.purchasePrice}
          placeholder="₹ 0.00"
          disabled={form.isService}
          min="0"
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              purchasePrice: value,
            }))
          }
        />

        <Field
          label="Selling Price"
          type="number"
          value={form.sellingPrice}
          placeholder="₹ 0.00"
          min="0"
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              sellingPrice: value,
            }))
          }
        />

        <Field
          label="Opening Quantity"
          type="number"
          value={form.quantity}
          placeholder="Enter quantity"
          min="0"
          disabled={isEditing || form.isService}
          onChange={(value) =>
            setForm((current) => ({ ...current, quantity: value }))
          }
        />

        <Field
          label="Low Stock Alert At"
          type="number"
          value={form.lowStockAlert}
          placeholder="Example: 5"
          min="0"
          disabled={form.isService}
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              lowStockAlert: value,
            }))
          }
        />

        <SelectField
          label="GST Percentage"
          value={form.gst}
          options={["0", "5", "12", "18", "28"]}
          optionLabels={{
            "0": "0%",
            "5": "5%",
            "12": "12%",
            "18": "18%",
            "28": "28%",
          }}
          onChange={(value) =>
            setForm((current) => ({ ...current, gst: value }))
          }
        />
      </div>

      <div className="mt-5 sm:mt-6">
        <label className="mb-2 block font-semibold text-slate-800">
          Product Description
        </label>

        <textarea
          rows={4}
          value={form.description}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
          placeholder="Write a short description about this item..."
          className="w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
        />
      </div>

      {isEditing && (
        <p className="mt-4 text-sm font-medium text-amber-700">
          SKU, Item Type and Opening Quantity are locked during edit to
          protect inventory and transaction history. Use Adjust Stock for
          quantity corrections.
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:gap-4">
        <button
          type="submit"
          disabled={isSaving}
          className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-7"
        >
          {isSaving
            ? "Saving..."
            : isEditing
              ? "Update Product"
              : "Save Product"}
        </button>

        <button
          type="button"
          onClick={resetForm}
          disabled={isSaving}
          className="w-full rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-7"
        >
          {isEditing ? "Cancel Edit" : "Reset"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
  type = "text",
  maxLength,
  disabled = false,
  min,
  inputMode,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  type?: string;
  maxLength?: number;
  disabled?: boolean;
  min?: string;
  inputMode?: "text" | "numeric" | "decimal" | "tel" | "email";
}) {
  return (
    <div>
      <label className="mb-2 block font-semibold text-slate-800">
        {label}
      </label>

      <input
        type={type}
        value={value}
        maxLength={maxLength}
        disabled={disabled}
        min={min}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none transition ${
          disabled
            ? "cursor-not-allowed bg-slate-200 text-slate-600"
            : "bg-slate-50 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
        }`}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  disabled = false,
  optionLabels = {},
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
  optionLabels?: Record<string, string>;
}) {
  return (
    <div>
      <label className="mb-2 block font-semibold text-slate-800">
        {label}
      </label>

      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-800 outline-none transition ${
          disabled
            ? "cursor-not-allowed bg-slate-200"
            : "bg-slate-50 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
        }`}
      >
        {options.map((option) => (
          <option key={option || "empty"} value={option}>
            {optionLabels[option] || option}
          </option>
        ))}
      </select>
    </div>
  );
}