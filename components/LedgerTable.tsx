"use client";

type Ledger = {
  id: string;
  name: string;
  group: string;
  openingBalance: number;
  mobile: string;
  email: string;
  gst: string;
  address: string;
};

type LedgerTableProps = {
  ledgers: Ledger[];
  onDeleteLedger: (id: string) => void;
};

function getGroupStyle(group: string) {
  if (group === "Customer") {
    return "bg-blue-100 text-blue-700";
  }

  if (group === "Supplier") {
    return "bg-orange-100 text-orange-700";
  }

  if (group === "Bank") {
    return "bg-purple-100 text-purple-700";
  }

  if (group === "Cash") {
    return "bg-emerald-100 text-emerald-700";
  }

  return "bg-slate-200 text-slate-700";
}

function formatCurrency(amount: number) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

export default function LedgerTable({
  ledgers,
  onDeleteLedger,
}: LedgerTableProps) {
  function confirmDelete(ledger: Ledger) {
    const shouldDelete = window.confirm(`Delete ${ledger.name}?`);

    if (shouldDelete) {
      onDeleteLedger(ledger.id);
    }
  }

  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl sm:mt-8 lg:mt-10">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 lg:py-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
            Ledger List
          </h2>

          <p className="mt-1 text-sm text-slate-600 sm:text-base">
            Manage customers, suppliers, banks and other accounts.
          </p>
        </div>

        <div className="w-fit rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
          Total Ledgers: {ledgers.length}
        </div>
      </div>

      {ledgers.length === 0 ? (
        <div className="px-4 py-12 text-center text-slate-500 sm:px-6">
          <p className="text-lg font-semibold text-slate-700">
            No ledgers added yet
          </p>

          <p className="mt-2 text-sm">
            Add your first customer, supplier or bank ledger above.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-4 p-4 md:hidden">
            {ledgers.map((ledger) => (
              <article
                key={ledger.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold text-slate-900">
                      {ledger.name}
                    </p>

                    <p className="mt-1 truncate text-sm text-slate-500">
                      {ledger.email || "No email added"}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${getGroupStyle(
                      ledger.group
                    )}`}
                  >
                    {ledger.group}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Opening Balance
                    </p>

                    <p className="mt-1 font-bold text-slate-900">
                      {formatCurrency(ledger.openingBalance)}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </p>

                    <p className="mt-1 font-semibold text-emerald-700">
                      Active
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Contact Details
                  </p>

                  <p className="mt-1 break-words font-semibold text-slate-800">
                    {ledger.mobile || "No mobile added"}
                  </p>

                  <p className="mt-2 break-all text-sm text-slate-600">
                    GST: {ledger.gst || "—"}
                  </p>
                </div>

                {ledger.address && (
                  <div className="mt-3 rounded-xl bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Address
                    </p>

                    <p className="mt-1 text-sm leading-6 text-slate-700">
                      {ledger.address}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => confirmDelete(ledger)}
                  className="mt-4 w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100"
                >
                  Delete Ledger
                </button>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[950px]">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-left">
                  <th className="px-6 py-4 text-sm font-bold text-slate-700">
                    Ledger
                  </th>

                  <th className="px-6 py-4 text-sm font-bold text-slate-700">
                    Group
                  </th>

                  <th className="px-6 py-4 text-sm font-bold text-slate-700">
                    Opening Balance
                  </th>

                  <th className="px-6 py-4 text-sm font-bold text-slate-700">
                    Mobile
                  </th>

                  <th className="px-6 py-4 text-sm font-bold text-slate-700">
                    GST Number
                  </th>

                  <th className="px-6 py-4 text-sm font-bold text-slate-700">
                    Status
                  </th>

                  <th className="px-6 py-4 text-sm font-bold text-slate-700">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {ledgers.map((ledger) => (
                  <tr
                    key={ledger.id}
                    className="border-b border-slate-100 transition hover:bg-blue-50"
                  >
                    <td className="px-6 py-5">
                      <p className="font-bold text-slate-900">{ledger.name}</p>

                      <p className="mt-1 text-sm text-slate-500">
                        {ledger.email || "No email added"}
                      </p>
                    </td>

                    <td className="px-6 py-5">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${getGroupStyle(
                          ledger.group
                        )}`}
                      >
                        {ledger.group}
                      </span>
                    </td>

                    <td className="px-6 py-5 font-bold text-slate-900">
                      {formatCurrency(ledger.openingBalance)}
                    </td>

                    <td className="px-6 py-5 text-slate-700">
                      {ledger.mobile || "—"}
                    </td>

                    <td className="px-6 py-5 text-slate-700">
                      {ledger.gst || "—"}
                    </td>

                    <td className="px-6 py-5">
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                        Active
                      </span>
                    </td>

                    <td className="px-6 py-5">
                      <button
                        type="button"
                        onClick={() => confirmDelete(ledger)}
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
        </>
      )}
    </section>
  );
}