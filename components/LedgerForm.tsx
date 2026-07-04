"use client";

import { type FormEvent, useState } from "react";

type LedgerInput = {
  name: string;
  group: string;
  openingBalance: number;
  mobile: string;
  email: string;
  gst: string;
  address: string;
};

type LedgerFormProps = {
  onAddLedger: (ledger: LedgerInput) => void;
};

const initialForm = {
  name: "",
  group: "Customer",
  openingBalance: "",
  mobile: "",
  email: "",
  gst: "",
  address: "",
};

export default function LedgerForm({ onAddLedger }: LedgerFormProps) {
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.name.trim()) {
      setMessage("Ledger Name fill karo.");
      return;
    }

    onAddLedger({
      name: form.name.trim(),
      group: form.group,
      openingBalance: Number(form.openingBalance) || 0,
      mobile: form.mobile.trim(),
      email: form.email.trim(),
      gst: form.gst.trim().toUpperCase(),
      address: form.address.trim(),
    });

    setForm(initialForm);
    setMessage("Ledger successfully added.");

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
      className="mb-10 mt-8 rounded-3xl border border-slate-100 bg-white p-8 shadow-xl"
    >
      <div className="mb-8 flex flex-col gap-3 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Add New Ledger
          </h2>

          <p className="mt-1 text-slate-600">
            Create a customer, supplier, bank or expense ledger.
          </p>
        </div>

        <div className="w-fit rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
          New Ledger
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
            Ledger Name *
          </label>

          <input
            type="text"
            value={form.name}
            onChange={(event) =>
              setForm({ ...form, name: event.target.value })
            }
            placeholder="Enter ledger name"
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <div>
          <label className="mb-2 block font-semibold text-slate-800">
            Ledger Group
          </label>

          <select
            value={form.group}
            onChange={(event) =>
              setForm({ ...form, group: event.target.value })
            }
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
          >
            <option>Customer</option>
            <option>Supplier</option>
            <option>Bank</option>
            <option>Cash</option>
            <option>Expense</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block font-semibold text-slate-800">
            Opening Balance
          </label>

          <input
            type="number"
            min="0"
            value={form.openingBalance}
            onChange={(event) =>
              setForm({ ...form, openingBalance: event.target.value })
            }
            placeholder="₹ 0.00"
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <div>
          <label className="mb-2 block font-semibold text-slate-800">
            Mobile Number
          </label>

          <input
            type="tel"
            value={form.mobile}
            onChange={(event) =>
              setForm({ ...form, mobile: event.target.value })
            }
            placeholder="Enter mobile number"
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <div>
          <label className="mb-2 block font-semibold text-slate-800">
            Email Address
          </label>

          <input
            type="email"
            value={form.email}
            onChange={(event) =>
              setForm({ ...form, email: event.target.value })
            }
            placeholder="Enter email address"
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <div>
          <label className="mb-2 block font-semibold text-slate-800">
            GST Number
          </label>

          <input
            type="text"
            value={form.gst}
            onChange={(event) =>
              setForm({ ...form, gst: event.target.value })
            }
            placeholder="Optional GST number"
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
        </div>
      </div>

      <div className="mt-6">
        <label className="mb-2 block font-semibold text-slate-800">
          Address
        </label>

        <textarea
          rows={4}
          value={form.address}
          onChange={(event) =>
            setForm({ ...form, address: event.target.value })
          }
          placeholder="Enter address"
          className="w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
        />
      </div>

      <div className="mt-8 flex flex-wrap gap-4">
        <button
          type="submit"
          className="rounded-xl bg-blue-600 px-7 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-700 hover:shadow-xl"
        >
          Save Ledger
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