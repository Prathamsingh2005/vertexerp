import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import ExpenseForm from "@/components/ExpenseForm";
import ExpenseTable from "@/components/ExpenseTable";

export default function ExpensesPage() {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <div className="flex-1">
        <Navbar />

        <main className="p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-slate-900">
              💳 Expenses
            </h1>

            <p className="mt-2 text-lg text-slate-600">
              Track business expenses such as rent, salary, transport and utilities.
            </p>
          </div>

          <ExpenseForm />
          <ExpenseTable />
        </main>
      </div>
    </div>
  );
}