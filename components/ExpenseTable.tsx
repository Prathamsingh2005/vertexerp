"use client";

import { useEffect, useState } from "react";

type Expense = {
  id: string;
  date: string;
  category: string;
  amount: number;
  paymentMode: string;
  description: string;
};

const EXPENSES_KEY = "VertexERP_expenses";
const EXPENSE_EVENT = "VertexERP-expenses-updated";

function formatCurrency(amount: number) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

function formatDate(dateValue: string) {
  if (!dateValue) {
    return "—";
  }

  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ExpenseTable() {
  const [expenses, setExpenses] = useState<Expense[]>([]);

  function loadExpenses() {
    try {
      const savedExpenses = window.localStorage.getItem(EXPENSES_KEY);

      const parsedExpenses: Expense[] = savedExpenses
        ? JSON.parse(savedExpenses)
        : [];

      setExpenses(parsedExpenses);
    } catch {
      setExpenses([]);
    }
  }

  useEffect(() => {
    loadExpenses();

    window.addEventListener(EXPENSE_EVENT, loadExpenses);

    return () => {
      window.removeEventListener(EXPENSE_EVENT, loadExpenses);
    };
  }, []);

  function deleteExpense(expenseId: string) {
    const shouldDelete = window.confirm(
      "Are you sure you want to delete this expense?"
    );

    if (!shouldDelete) {
      return;
    }

    try {
      const updatedExpenses = expenses.filter(
        (expense) => expense.id !== expenseId
      );

      window.localStorage.setItem(
        EXPENSES_KEY,
        JSON.stringify(updatedExpenses)
      );

      setExpenses(updatedExpenses);

      window.dispatchEvent(new Event(EXPENSE_EVENT));
    } catch {
      window.alert("Unable to delete the expense. Please try again.");
    }
  }

  const totalExpenses = expenses.reduce(
    (total, expense) => total + Number(expense.amount || 0),
    0
  );

  return (
    <section className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-6 md:flex-row md:items-center md:justify-between md:px-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
            Expense History
          </p>

          <h2 className="mt-2 text-2xl font-bold text-slate-900">
            Recent Expenses
          </h2>
        </div>

        <div className="rounded-2xl bg-blue-50 px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
            Total Saved Expenses
          </p>

          <p className="mt-1 text-xl font-bold text-blue-700">
            {formatCurrency(totalExpenses)}
          </p>
        </div>
      </div>

      {expenses.length === 0 ? (
        <div className="px-6 py-14 text-center md:px-8">
          <p className="text-lg font-bold text-slate-800">
            No expenses saved yet
          </p>

          <p className="mt-2 text-slate-500">
            Add your first business expense using the form above.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px]">
            <thead className="bg-slate-50">
              <tr className="text-left">
                <th className="px-6 py-4 text-sm font-bold text-slate-700">
                  Date
                </th>

                <th className="px-6 py-4 text-sm font-bold text-slate-700">
                  Category
                </th>

                <th className="px-6 py-4 text-sm font-bold text-slate-700">
                  Description
                </th>

                <th className="px-6 py-4 text-sm font-bold text-slate-700">
                  Payment Mode
                </th>

                <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">
                  Amount
                </th>

                <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {expenses.map((expense) => (
                <tr
                  key={expense.id}
                  className="border-t border-slate-100 transition hover:bg-slate-50"
                >
                  <td className="px-6 py-5 font-medium text-slate-700">
                    {formatDate(expense.date)}
                  </td>

                  <td className="px-6 py-5">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                      {expense.category}
                    </span>
                  </td>

                  <td className="max-w-xs px-6 py-5 text-slate-600">
                    {expense.description || "No description"}
                  </td>

                  <td className="px-6 py-5 text-slate-700">
                    {expense.paymentMode}
                  </td>

                  <td className="px-6 py-5 text-right font-bold text-slate-900">
                    {formatCurrency(expense.amount)}
                  </td>

                  <td className="px-6 py-5 text-right">
                    <button
                      type="button"
                      onClick={() => deleteExpense(expense.id)}
                      className="font-semibold text-red-500 transition hover:text-red-700"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}