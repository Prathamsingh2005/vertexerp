"use client";

import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import ExpenseForm from "@/components/ExpenseForm";
import ExpenseTable from "@/components/ExpenseTable";

export default function ExpensesPage() {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <div className="min-w-0 flex-1">
        <Navbar />

        <main className="p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
          <div className="mb-6 lg:mb-8">
            <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
              💳 Expenses
            </h1>

            <p className="mt-2 max-w-3xl text-base text-slate-600 sm:text-lg">
              Track business expenses such as rent, salary, transport and
              utilities.
            </p>
          </div>

          <ExpenseForm />
          <ExpenseTable />
        </main>
      </div>
    </div>
  );
}