import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import DebitNotesManager from "@/components/DebitNotesManager";

export default function DebitNotesPage() {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <div className="min-w-0 flex-1">
        <Navbar />

        <main className="p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
          <section className="mb-6 rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:mb-8 sm:p-7">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-600">
              Purchase Return
            </p>

            <h1 className="mt-3 text-3xl font-bold text-slate-950 sm:text-4xl">
              Debit Notes
            </h1>

            <p className="mt-2 max-w-3xl text-sm text-slate-600 sm:text-base">
              Return goods to suppliers without deleting purchase bills.
              Debit notes adjust stock, inventory value, Input GST and
              supplier payable with complete accounting and audit history.
            </p>
          </section>

          <DebitNotesManager />
        </main>
      </div>
    </div>
  );
}