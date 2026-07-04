"use client";

import { type FormEvent, useState } from "react";

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

type ProductFormProps = {
  onAddProduct: (product: ProductInput) => void;
};

const initialForm = {
  name: "",
  sku: "",
  category: "",
  unit: "Piece",
  purchasePrice: "",
  sellingPrice: "",
  quantity: "",
  lowStockAlert: "5",
  gst: "18",
  description: "",
};

export default function ProductForm({ onAddProduct }: ProductFormProps) {
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.name.trim() || !form.sku.trim()) {
      setMessage("Product Name aur SKU dono fill karo.");
      return;
    }

    onAddProduct({
      name: form.name.trim(),
      sku: form.sku.trim().toUpperCase(),
      category: form.category || "Uncategorized",
      unit: form.unit,
      purchasePrice: Number(form.purchasePrice) || 0,
      sellingPrice: Number(form.sellingPrice) || 0,
      quantity: Number(form.quantity) || 0,
      lowStockAlert: Number(form.lowStockAlert) || 0,
      gst: Number(form.gst) || 0,
      description: form.description.trim(),
    });

    setForm(initialForm);
    setMessage("Product successfully added to inventory.");

    window.setTimeout(() => {
      setMessage("");
    }, 3000);
  }

  function resetForm() {
    setForm(initialForm);
    setMessage("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 rounded-3xl border border-slate-100 bg-white p-8 shadow-xl"
    >
      <div className="mb-8 flex flex-col gap-3 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Add New Product
          </h2>

          <p className="mt-1 text-slate-600">
            Enter product and stock details below.
          </p>
        </div>

        <div className="w-fit rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
          New Inventory Item
        </div>
      </div>

      {message && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 font-medium text-blue-700">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <div>
          <label className="mb-2 block font-semibold text-slate-800">
            Product Name *
          </label>

          <input
            type="text"
            value={form.name}
            onChange={(event) =>
              setForm({ ...form, name: event.target.value })
            }
            placeholder="Enter product name"
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <div>
          <label className="mb-2 block font-semibold text-slate-800">
            Product SKU / Code *
          </label>

          <input
            type="text"
            value={form.sku}
            onChange={(event) =>
              setForm({ ...form, sku: event.target.value })
            }
            placeholder="Example: PRD-1001"
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <div>
          <label className="mb-2 block font-semibold text-slate-800">
            Category
          </label>

          <select
            value={form.category}
            onChange={(event) =>
              setForm({ ...form, category: event.target.value })
            }
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
          >
            <option value="">Select category</option>
            <option>Electronics</option>
            <option>Grocery</option>
            <option>Clothing</option>
            <option>Furniture</option>
            <option>Stationery</option>
            <option>Other</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block font-semibold text-slate-800">
            Unit
          </label>

          <select
            value={form.unit}
            onChange={(event) =>
              setForm({ ...form, unit: event.target.value })
            }
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
          >
            <option>Piece</option>
            <option>Kg</option>
            <option>Gram</option>
            <option>Litre</option>
            <option>Box</option>
            <option>Packet</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block font-semibold text-slate-800">
            Purchase Price
          </label>

          <input
            type="number"
            min="0"
            value={form.purchasePrice}
            onChange={(event) =>
              setForm({ ...form, purchasePrice: event.target.value })
            }
            placeholder="₹ 0.00"
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <div>
          <label className="mb-2 block font-semibold text-slate-800">
            Selling Price
          </label>

          <input
            type="number"
            min="0"
            value={form.sellingPrice}
            onChange={(event) =>
              setForm({ ...form, sellingPrice: event.target.value })
            }
            placeholder="₹ 0.00"
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <div>
          <label className="mb-2 block font-semibold text-slate-800">
            Opening Quantity
          </label>

          <input
            type="number"
            min="0"
            value={form.quantity}
            onChange={(event) =>
              setForm({ ...form, quantity: event.target.value })
            }
            placeholder="Enter quantity"
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <div>
          <label className="mb-2 block font-semibold text-slate-800">
            Low Stock Alert At
          </label>

          <input
            type="number"
            min="0"
            value={form.lowStockAlert}
            onChange={(event) =>
              setForm({ ...form, lowStockAlert: event.target.value })
            }
            placeholder="Example: 5"
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <div>
          <label className="mb-2 block font-semibold text-slate-800">
            GST Percentage
          </label>

          <select
            value={form.gst}
            onChange={(event) =>
              setForm({ ...form, gst: event.target.value })
            }
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
          >
            <option value="0">0%</option>
            <option value="5">5%</option>
            <option value="12">12%</option>
            <option value="18">18%</option>
            <option value="28">28%</option>
          </select>
        </div>
      </div>

      <div className="mt-6">
        <label className="mb-2 block font-semibold text-slate-800">
          Product Description
        </label>

        <textarea
          rows={4}
          value={form.description}
          onChange={(event) =>
            setForm({ ...form, description: event.target.value })
          }
          placeholder="Write a short description about this product..."
          className="w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
        />
      </div>

      <div className="mt-8 flex flex-wrap gap-4">
        <button
          type="submit"
          className="rounded-xl bg-blue-600 px-7 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-700 hover:shadow-xl"
        >
          Save Product
        </button>

        <button
          type="button"
          onClick={resetForm}
          className="rounded-xl border border-slate-300 bg-white px-7 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          Reset
        </button>
      </div>
    </form>
  );
}