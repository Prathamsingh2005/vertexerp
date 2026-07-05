"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Expense = {
  id: string;
  date: string;
  category: string;
  amount: number;
  paymentMode: string;
  description: string;
  createdAt: string;
};

type ProfileRow = {
  active_company_id: string | null;
};

type ExpenseRow = {
  id: string;
  expense_date: string;
  category: string;
  amount: number | string | null;
  payment_mode: string;
  description: string | null;
  created_at: string;
};

function formatCurrency(amount: number) {
  return `₹${Number(amount || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
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

function mapExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    date: row.expense_date || "",
    category: row.category || "Other",
    amount: Number(row.amount || 0),
    paymentMode: row.payment_mode || "Cash",
    description: row.description || "",
    createdAt: row.created_at || "",
  };
}

export default function ExpenseTable() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);

    window.setTimeout(() => {
      setMessage("");
    }, 4000);
  }

  async function loadExpenses() {
    setIsLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setExpenses([]);
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

      const activeCompanyId =
        (profile as ProfileRow | null)?.active_company_id || null;

      if (!activeCompanyId) {
        setExpenses([]);
        return;
      }

      const { data, error } = await supabase
        .from("expenses")
        .select(
          "id, expense_date, category, amount, payment_mode, description, created_at"
        )
        .eq("company_id", activeCompanyId)
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setExpenses(
        ((data || []) as ExpenseRow[]).map(mapExpense)
      );
    } catch (error) {
      setExpenses([]);

      showMessage(
        error instanceof Error
          ? error.message
          : "Expenses could not be loaded from the cloud database."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadExpenses();

    window.addEventListener("vertexerp-expenses-updated", loadExpenses);
    window.addEventListener(
      "vertexerp-active-company-updated",
      loadExpenses
    );

    return () => {
      window.removeEventListener(
        "vertexerp-expenses-updated",
        loadExpenses
      );
      window.removeEventListener(
        "vertexerp-active-company-updated",
        loadExpenses
      );
    };
  }, []);

  async function deleteExpense(expense: Expense) {
    const shouldDelete = window.confirm(
      `Delete ${formatCurrency(expense.amount)} expense from ${formatDate(
        expense.date
      )}?`
    );

    if (!shouldDelete) {
      return;
    }

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", expense.id);

      if (error) {
        throw error;
      }

      setExpenses((currentExpenses) =>
        currentExpenses.filter((item) => item.id !== expense.id)
      );

      window.dispatchEvent(new Event("vertexerp-expenses-updated"));
      showMessage("Expense deleted successfully.");
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Unable to delete the expense. Please try again."
      );
    }
  }

  const totalExpenses = useMemo(
    () =>
      expenses.reduce(
        (total, expense) => total + Number(expense.amount || 0),
        0
      ),
    [expenses]
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
            {isLoading ? "..." : formatCurrency(totalExpenses)}
          </p>
        </div>
      </div>

      {message && (
        <div className="mx-6 mt-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 font-medium text-blue-700 md:mx-8">
          {message}
        </div>
      )}

      {isLoading ? (
        <div className="px-6 py-14 text-center md:px-8">
          <p className="text-lg font-bold text-slate-800">
            Loading expenses from the cloud database...
          </p>
        </div>
      ) : expenses.length === 0 ? (
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
                      onClick={() => deleteExpense(expense)}
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