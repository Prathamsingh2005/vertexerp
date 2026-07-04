import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import ReportsManager from "@/components/ReportsManager";

export default function ReportsPage() {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <div className="min-w-0 flex-1">
        <Navbar />

        <main className="p-6 md:p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-slate-900">
              📈 Reports & Analytics
            </h1>

            <p className="mt-2 text-lg text-slate-600">
              Track sales, purchases, stock and business performance from one
              place.
            </p>
          </div>

          <ReportsManager />

          <section className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-3xl border border-slate-100 bg-white p-7 shadow-lg transition hover:-translate-y-1 hover:shadow-xl">
              <div className="text-4xl">🛒</div>

              <h2 className="mt-5 text-2xl font-bold text-slate-900">
                Sales Report
              </h2>

              <p className="mt-2 text-slate-600">
                View invoice-wise sales, customer sales and payment details.
              </p>

              <Link
                href="/reports/sales"
                className="mt-6 inline-block font-semibold text-blue-600 transition hover:text-blue-800"
              >
                View Sales Report →
              </Link>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-7 shadow-lg transition hover:-translate-y-1 hover:shadow-xl">
              <div className="text-4xl">🧾</div>

              <h2 className="mt-5 text-2xl font-bold text-slate-900">
                Purchase Report
              </h2>

              <p className="mt-2 text-slate-600">
                Track supplier purchases, bills and pending payment amounts.
              </p>

              <Link
                href="/reports/purchase"
                className="mt-6 inline-block font-semibold text-blue-600 transition hover:text-blue-800"
              >
                View Purchase Report →
              </Link>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-7 shadow-lg transition hover:-translate-y-1 hover:shadow-xl">
              <div className="text-4xl">📦</div>

              <h2 className="mt-5 text-2xl font-bold text-slate-900">
                Stock Report
              </h2>

              <p className="mt-2 text-slate-600">
                Check available stock, low-stock items and inventory value.
              </p>

              <Link
                href="/reports/stock"
                className="mt-6 inline-block font-semibold text-blue-600 transition hover:text-blue-800"
              >
                View Stock Report →
              </Link>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-7 shadow-lg transition hover:-translate-y-1 hover:shadow-xl">
              <div className="text-4xl">👥</div>

              <h2 className="mt-5 text-2xl font-bold text-slate-900">
                Customer Report
              </h2>

              <p className="mt-2 text-slate-600">
                Analyze customer-wise sales, balances and payment history.
              </p>

              <Link
                href="/reports/customer"
                className="mt-6 inline-block font-semibold text-blue-600 transition hover:text-blue-800"
              >
                View Customer Report →
              </Link>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-7 shadow-lg transition hover:-translate-y-1 hover:shadow-xl">
              <div className="text-4xl">🏢</div>

              <h2 className="mt-5 text-2xl font-bold text-slate-900">
                Supplier Report
              </h2>

              <p className="mt-2 text-slate-600">
                Review supplier bills, purchases and pending amounts.
              </p>

              <Link
                href="/reports/supplier"
                className="mt-6 inline-block font-semibold text-blue-600 transition hover:text-blue-800"
              >
                View Supplier Report →
              </Link>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-7 shadow-lg transition hover:-translate-y-1 hover:shadow-xl">
              <div className="text-4xl">💰</div>

              <h2 className="mt-5 text-2xl font-bold text-slate-900">
                Profit & Loss
              </h2>

              <p className="mt-2 text-slate-600">
                Compare sales, purchases and expenses to calculate profit.
              </p>

              <Link
                href="/reports/profit"
                className="mt-6 inline-block font-semibold text-blue-600 transition hover:text-blue-800"
              >
                View Profit & Loss →
              </Link>
            </div>

            <div className="rounded-3xl border border-emerald-100 bg-white p-7 shadow-lg transition hover:-translate-y-1 hover:shadow-xl">
              <div className="text-4xl">💳</div>

              <h2 className="mt-5 text-2xl font-bold text-slate-900">
                Payment Report
              </h2>

              <p className="mt-2 text-slate-600">
                Review customer receipts, supplier payments and collection
                summary.
              </p>

              <Link
                href="/reports/payments"
                className="mt-6 inline-block font-semibold text-emerald-600 transition hover:text-emerald-800"
              >
                View Payment Report →
              </Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}