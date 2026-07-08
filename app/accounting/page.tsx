import Sidebar from "@/components/Sidebar";
import AccountingManager from "@/components/AccountingManager";

export default function AccountingPage() {
  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <Sidebar />

      <div className="min-w-0 flex-1">
        <main className="p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
          <section className="mb-6 rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:mb-8 sm:p-7">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-600">
              Accounting
            </p>

            <h1 className="mt-3 text-3xl font-bold text-slate-950 sm:text-4xl">
              Accounting Management
            </h1>

            <p className="mt-2 max-w-3xl text-sm text-slate-600 sm:text-base">
              Create custom accounts, post Journal vouchers, record Contra
              entries, and manage manual voucher history with audit-safe
              controls.
            </p>
          </section>

          <AccountingManager />
        </main>
      </div>
    </div>
  );
}