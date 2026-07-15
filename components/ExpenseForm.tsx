"use client";

import { type FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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

type ProfileRow = {
  active_company_id: string | null;
};

type EditableExpense = {
  id: string;
  date: string;
  category: string;
  amount: number;
  paymentMode: string;
  description: string;
};

type ExpenseFormProps = {
  canCreateExpense: boolean;
  canEditExpense: boolean;
};

function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

function formatCurrency(amount: number) {
  return `₹${Number(amount || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

export default function ExpenseForm({
  canCreateExpense,
  canEditExpense,
}: ExpenseFormProps) {
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [activeCompanyName, setActiveCompanyName] = useState("");
  const [isLoadingCompany, setIsLoadingCompany] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingExpense, setEditingExpense] =
    useState<EditableExpense | null>(null);

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

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });

    window.setTimeout(() => {
      setMessage(null);
    }, 4500);
  }

  async function loadActiveCompany() {
    setIsLoadingCompany(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setActiveCompanyId(null);
        setActiveCompanyName("");
        showMessage("error", "Please sign in before recording an expense.");
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
        setActiveCompanyName("");
        showMessage(
          "error",
          "Select an active company from the Companies page first."
        );
        return;
      }

      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select("name")
        .eq("id", companyId)
        .maybeSingle();

      if (companyError) {
        throw companyError;
      }

      setActiveCompanyName(company?.name || "");
    } catch (error) {
      setActiveCompanyId(null);
      setActiveCompanyName("");

      showMessage(
        "error",
        error instanceof Error
          ? error.message
          : "Active company could not be loaded."
      );
    } finally {
      setIsLoadingCompany(false);
    }
  }

  useEffect(() => {
    loadActiveCompany();

    window.addEventListener(
      "vertexerp-active-company-updated",
      loadActiveCompany
    );

    return () => {
      window.removeEventListener(
        "vertexerp-active-company-updated",
        loadActiveCompany
      );
    };
  }, []);

  function resetForm() {
    setDate(getTodayDate());
    setCategory("Rent");
    setAmount("");
    setPaymentMode("Cash");
    setDescription("");
  }

  function cancelExpenseEdit() {
    setEditingExpense(null);
    resetForm();
  }

  useEffect(() => {
    function handleEditExpense(event: Event) {
      const expense = (event as CustomEvent<EditableExpense>).detail;

      if (!expense?.id) {
        return;
      }

      if (!canEditExpense) {
        showMessage(
          "error",
          "You do not have permission to edit expense entries."
        );
        return;
      }

      setEditingExpense(expense);
      setDate(expense.date);
      setCategory(expense.category || "Other");
      setAmount(String(expense.amount));
      setPaymentMode(expense.paymentMode || "Cash");
      setDescription(expense.description || "");

      window.setTimeout(() => {
        document
          .getElementById("expense-entry-form")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    }

    window.addEventListener("vertexerp-edit-expense", handleEditExpense);

    return () => {
      window.removeEventListener(
        "vertexerp-edit-expense",
        handleEditExpense
      );
    };
  }, [canEditExpense]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (editingExpense ? !canEditExpense : !canCreateExpense) {
      showMessage(
        "error",
        editingExpense
          ? "You do not have permission to edit expense entries."
          : "You do not have permission to create expense entries."
      );
      return;
    }

    if (!activeCompanyId) {
      showMessage(
        "error",
        "Select an active company before saving an expense."
      );
      return;
    }

    if (!date || !amount || expenseAmount <= 0) {
      showMessage("error", "Please enter a valid date and amount.");
      return;
    }

    setIsSaving(true);

    try {
      const supabase = createClient();

      const { error } = editingExpense
        ? await supabase.rpc("update_expense_entry", {
            p_expense_id: editingExpense.id,
            p_expense_date: date,
            p_category: category,
            p_description: description.trim(),
            p_payment_mode: paymentMode,
            p_amount: expenseAmount,
          })
        : await supabase.from("expenses").insert({
            company_id: activeCompanyId,
            expense_date: date,
            category,
            amount: expenseAmount,
            payment_mode: paymentMode,
            description: description.trim() || null,
          });

      if (error) {
        throw error;
      }

      const successMessage = editingExpense
        ? "Expense updated successfully. An UPDATE record was saved in Audit History."
        : "Expense saved to the cloud database.";

      setEditingExpense(null);
      resetForm();

      window.dispatchEvent(new Event("vertexerp-expenses-updated"));

      showMessage("success", successMessage);
    } catch (error) {
      showMessage(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to save the expense. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  }

  const categoryOptions = categories.includes(category)
    ? categories
    : [category, ...categories];

  const canSubmitCurrentExpense = editingExpense
    ? canEditExpense
    : canCreateExpense;

  const isFormDisabled =
    isLoadingCompany ||
    !activeCompanyId ||
    isSaving ||
    !canSubmitCurrentExpense;

  if (!canCreateExpense && !editingExpense) {
    return null;
  }

  return (
    <section
      id="expense-entry-form"
      className="min-w-0 overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-xl shadow-slate-200/60"
    >
      <div className="bg-gradient-to-r from-violet-950 via-violet-900 to-violet-700 px-4 py-5 text-white sm:px-6 sm:py-6 md:px-8 md:py-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-200">
              Expense Entry
            </p>

            <h2 className="mt-2 text-xl font-bold sm:text-2xl">
              {editingExpense ? "Edit Business Expense" : "Add a Business Expense"}
            </h2>

            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
              {editingExpense
                ? "Update this expense securely. The previous values will remain available in Audit History."
                : "Record operational expenses to keep your profit and loss report accurate."}
            </p>
          </div>

          <div className="w-fit rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Amount Preview
            </p>

            <p className="mt-1 text-2xl font-bold">
              {formatCurrency(expenseAmount)}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 sm:p-6 md:p-8">
        {!isLoadingCompany && !activeCompanyId && (
          <div className="mb-5 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700 sm:mb-6 sm:text-base">
            Select an active company from the <strong>Companies</strong> page
            before saving expenses.
          </div>
        )}

        {editingExpense && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 sm:mb-6 sm:text-base">
            Editing the {editingExpense.category} expense from {editingExpense.date}.
            Save Changes to retain an UPDATE record in Audit History.
          </div>
        )}

        {activeCompanyId && (
          <div className="mb-5 rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 sm:mb-6">
            <p className="text-sm font-semibold text-violet-700">
              Saving expense for
            </p>

            <p className="mt-1 font-bold text-slate-900">
              {activeCompanyName || "Active Company"}
            </p>
          </div>
        )}

        <fieldset disabled={isFormDisabled}>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
            <div className="space-y-5 lg:col-span-2">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Expense Category
                  </label>

                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                  >
                    {categoryOptions.map((item) => (
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

                  <div className="flex overflow-hidden rounded-xl border border-slate-300 bg-white transition focus-within:border-violet-500 focus-within:ring-4 focus-within:ring-violet-100">
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
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
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
                  rows={3}
                  placeholder="Example: Office electricity bill for July"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                />
              </div>
            </div>


            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:hidden">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Entry Summary
              </p>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Category
                  </p>
                  <p className="mt-1 truncate font-bold text-slate-900">
                    {category}
                  </p>
                </div>

                <div className="rounded-xl bg-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Payment Mode
                  </p>
                  <p className="mt-1 truncate font-bold text-slate-900">
                    {paymentMode}
                  </p>
                </div>

                <div className="rounded-xl bg-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Date
                  </p>
                  <p className="mt-1 truncate font-bold text-slate-900">
                    {date || "Not selected"}
                  </p>
                </div>

                <div className="rounded-xl bg-violet-600 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-100">
                    Total
                  </p>
                  <p className="mt-1 text-lg font-bold text-white">
                    {formatCurrency(expenseAmount)}
                  </p>
                </div>
              </div>
            </div>

            <aside className="hidden rounded-2xl border border-slate-200 bg-slate-50 p-5 lg:block">
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

                  <p className="mt-1 text-2xl font-bold text-violet-600">
                    {formatCurrency(expenseAmount)}
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </fieldset>

        <div className="mt-6 flex flex-col gap-4 border-t border-slate-200 pt-5 sm:mt-7 sm:flex-row sm:items-center sm:justify-between sm:pt-6">
          <div>
            {message ? (
              <p
                className={
                  message.type === "success"
                    ? "font-medium text-green-600"
                    : "font-medium text-red-600"
                }
              >
                {message.text}
              </p>
            ) : (
              <p className="text-sm text-slate-500">
                Expense data is saved securely in the cloud database.
              </p>
            )}
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            {editingExpense && (
              <button
                type="button"
                onClick={cancelExpenseEdit}
                disabled={isSaving}
                className="w-full rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-7"
              >
                Cancel Edit
              </button>
            )}

            <button
              type="submit"
              disabled={isFormDisabled}
              className="w-full rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-7"
            >
              {isSaving
                ? editingExpense
                  ? "Saving Changes..."
                  : "Saving Expense..."
                : editingExpense
                  ? "Save Changes"
                  : "Save Expense"}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}