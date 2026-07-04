"use client";

import { FormEvent, useState } from "react";

const EXPENSES_KEY = "VertexERP_expenses";

const categories = [
  "Rent",
  "Electricity",
  "Salary",
  "Transport",
  "Internet",
  "Office Supplies",
  "Marketing",
  "Other",
];

const paymentModes = ["Cash", "UPI", "Bank Transfer", "Card"];

function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export default function ExpenseForm() {
  const [date, setDate] = useState(getTodayDate());
  const [category, setCategory] = useState("Rent");
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const expenseAmount = Number(amount || 0);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!date || !amount || expenseAmount <= 0) {
      setMessage({
        type: "error",
        text: "Please enter a valid date and amount.",
      });
      return;
    }

    const newExpense = {
      id: crypto.randomUUID(),
      date,
      category,
      amount: expenseAmount,
      paymentMode,
      description: description.trim(),
      createdAt: new Date().toISOString(),
    };

    try {
      const savedExpenses = window.localStorage.getItem(EXPENSES_KEY);

      const expenses = savedExpenses ? JSON.parse(savedExpenses) : [];

      window.localStorage.setItem(
        EXPENSES_KEY,
        JSON.stringify([newExpense, ...expenses])
      );

      window.dispatchEvent(new Event("VertexERP-expenses-updated"));

      setDate(getTodayDate());
      setCategory("Rent");
      setAmount("");
      setPaymentMode("Cash");
      setDescription("");

      setMessage({
        type: "success",
        text: "Expense saved successfully.",
      });
    } catch {
      setMessage({
        type: "error",
        text: "Unable to save the expense. Please try again.",
      });
    }
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 px-6 py-7 text-white md:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-200">
              Expense Entry
            </p>

            <h2 className="mt-2 text-2xl font-bold">
              Add a Business Expense
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Record operational expenses to keep your profit and loss report accurate.
            </p>
          </div>

          <div className="w-fit rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Amount Preview
            </p>

            <p className="mt-1 text-2xl font-bold">
              {formatCurrency(expenseAmount)}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 md:p-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700">
                  Expense Date
                  <span className="text-xs font-medium text-red-500">
                    Required
                  </span>
                </label>

                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Expense Category
                </label>

                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                >
                  {categories.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700">
                  Amount
                  <span className="text-xs font-medium text-red-500">
                    Required
                  </span>
                </label>

                <div className="flex overflow-hidden rounded-xl border border-slate-300 bg-white transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                  <span className="flex items-center border-r border-slate-200 bg-slate-50 px-4 font-bold text-slate-600">
                    ₹
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    className="w-full px-4 py-3 text-slate-800 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Payment Mode
                </label>

                <select
                  value={paymentMode}
                  onChange={(event) => setPaymentMode(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                >
                  {paymentModes.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Description
              </label>

              <textarea
                rows={4}
                placeholder="Example: Office electricity bill for July"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </div>

          <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Entry Summary
            </p>

            <div className="mt-5 space-y-4">
              <div className="border-b border-slate-200 pb-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Category
                </p>

                <p className="mt-1 font-bold text-slate-900">
                  {category}
                </p>
              </div>

              <div className="border-b border-slate-200 pb-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Payment Mode
                </p>

                <p className="mt-1 font-bold text-slate-900">
                  {paymentMode}
                </p>
              </div>

              <div className="border-b border-slate-200 pb-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Expense Date
                </p>

                <p className="mt-1 font-bold text-slate-900">
                  {date || "Not selected"}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total Expense
                </p>

                <p className="mt-1 text-2xl font-bold text-blue-600">
                  {formatCurrency(expenseAmount)}
                </p>
              </div>
            </div>
          </aside>
        </div>

        <div className="mt-7 flex flex-col gap-4 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {message && (
              <p
                className={
                  message.type === "success"
                    ? "font-medium text-green-600"
                    : "font-medium text-red-600"
                }
              >
                {message.text}
              </p>
            )}

            {!message && (
              <p className="text-sm text-slate-500">
                Expense data is saved locally in this browser.
              </p>
            )}
          </div>

          <button
            type="submit"
            className="rounded-xl bg-blue-600 px-7 py-3 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 hover:shadow-xl"
          >
            Save Expense
          </button>
        </div>
      </form>
    </section>
  );
}