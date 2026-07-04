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
    return "bg-green-100 text-green-700";
  }

  return "bg-slate-200 text-slate-700";
}

export default function LedgerTable({
  ledgers,
  onDeleteLedger,
}: LedgerTableProps) {
  return (
    <div className="mt-10 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-8 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Ledger List</h2>

          <p className="mt-1 text-slate-600">
            Manage customers, suppliers, banks and other accounts.
          </p>
        </div>

        <div className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
          Total Ledgers: {ledgers.length}
        </div>
      </div>

      <div className="overflow-x-auto">
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
            {ledgers.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-12 text-center text-slate-500"
                >
                  <p className="text-lg font-semibold text-slate-700">
                    No ledgers added yet
                  </p>

                  <p className="mt-2">
                    Add your first customer, supplier or bank ledger above.
                  </p>
                </td>
              </tr>
            ) : (
              ledgers.map((ledger) => (
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
                    ₹{ledger.openingBalance.toLocaleString("en-IN")}
                  </td>

                  <td className="px-6 py-5 text-slate-700">
                    {ledger.mobile || "—"}
                  </td>

                  <td className="px-6 py-5 text-slate-700">
                    {ledger.gst || "—"}
                  </td>

                  <td className="px-6 py-5">
                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                      Active
                    </span>
                  </td>

                  <td className="px-6 py-5">
                    <button
                      type="button"
                      onClick={() => {
                        const shouldDelete = window.confirm(
                          `Delete ${ledger.name}?`
                        );

                        if (shouldDelete) {
                          onDeleteLedger(ledger.id);
                        }
                      }}
                      className="font-semibold text-red-500 transition hover:text-red-700"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}