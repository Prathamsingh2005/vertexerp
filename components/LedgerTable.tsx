"use client";

import { type ReactNode } from "react";

type Ledger = {
  id: string;
  name: string;
  group: string;
  openingBalance: number;
  mobile: string;
  email: string;
  gst: string;
  state: string;
  stateCode: string;
  pincode: string;
  address: string;
};

type LedgerTableProps = {
  ledgers: Ledger[];
  onEditLedger: (ledger: Ledger) => void;
  onDeleteLedger: (id: string) => void;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

function isPartyLedger(group: string) {
  return group === "Customer" || group === "Supplier";
}

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

function getGstStateStatus(ledger: Ledger) {
  if (!isPartyLedger(ledger.group)) {
    return {
      label: "Not Required",
      className: "bg-slate-100 text-slate-600",
    };
  }

  if (/^[0-9]{2}$/.test(ledger.stateCode)) {
    return {
      label: "State Ready",
      className: "bg-emerald-100 text-emerald-700",
    };
  }

  return {
    label: "State Missing",
    className: "bg-amber-100 text-amber-700",
  };
}

export default function LedgerTable({
  ledgers,
  onEditLedger,
  onDeleteLedger,
  canCreate,
  canEdit,
  canDelete,
}: LedgerTableProps) {
  const hasActions = canEdit || canDelete;

  async function handleDelete(ledgerId: string) {
    if (!canDelete) {
      window.alert("You do not have permission to delete ledgers.");
      return;
    }

    await onDeleteLedger(ledgerId);
  }

  return (
    <section className="mt-6 min-w-0 overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-xl shadow-slate-200/60 sm:mt-8 lg:mt-10">
      <div className="flex flex-col gap-4 bg-gradient-to-r from-violet-950 via-violet-800 to-violet-700 px-4 py-5 text-white sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 lg:py-6">
        <div>
          <h2 className="text-xl font-black text-white sm:text-2xl">
            Ledger List
          </h2>

          <p className="mt-1 text-sm text-violet-100 sm:text-base">
            Edit Customer and Supplier State details to prepare
            automatic GST classification.
          </p>
        </div>

        <div className="w-fit rounded-full bg-white/15 px-4 py-2 text-sm font-black text-white ring-1 ring-white/20">
          Total Ledgers: {ledgers.length}
        </div>
      </div>

      {ledgers.length === 0 ? (
        <div className="px-4 py-12 text-center text-slate-500 sm:px-6">
          <p className="text-lg font-semibold text-slate-700">
            No ledgers added yet
          </p>

          <p className="mt-2 text-sm">
            {canCreate
              ? "Add your first customer, supplier or bank ledger above."
              : "Your current role has read-only access to ledger records."}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-4 p-4 md:hidden">
            {ledgers.map((ledger) => {
              const gstStatus = getGstStateStatus(ledger);

              return (
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
                    <InfoBox
                      label="Opening Balance"
                      value={formatCurrency(ledger.openingBalance)}
                    />

                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        GST Setup
                      </p>

                      <span
                        className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${gstStatus.className}`}
                      >
                        {gstStatus.label}
                      </span>
                    </div>

                    <InfoBox
                      label="Party State"
                      value={
                        ledger.state
                          ? `${ledger.state} (${ledger.stateCode || "—"})`
                          : "—"
                      }
                    />

                    <InfoBox
                      label="GST Number"
                      value={ledger.gst || "—"}
                    />
                  </div>

                  <div className="mt-4 rounded-xl bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Contact Details
                    </p>

                    <p className="mt-1 break-words font-semibold text-slate-800">
                      {ledger.mobile || "No mobile added"}
                    </p>

                    <p className="mt-2 break-words text-sm text-slate-600">
                      Pincode: {ledger.pincode || "—"}
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

                  {hasActions && (
                    <div
                      className={`mt-4 grid gap-3 ${
                        canEdit && canDelete ? "grid-cols-2" : "grid-cols-1"
                      }`}
                    >
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => onEditLedger(ledger)}
                          className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-bold text-violet-700 transition hover:bg-violet-100"
                        >
                          Edit Ledger
                        </button>
                      )}

                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => void handleDelete(ledger.id)}
                          className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100"
                        >
                          Delete Ledger
                        </button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <div className="hidden max-w-full overflow-x-auto md:block">
            <table className="w-full min-w-[1100px]">
              <thead className="bg-violet-50">
                <tr className="border-b border-slate-200 text-left">
                  <Header>Ledger</Header>
                  <Header>Group</Header>
                  <Header>Opening Balance</Header>
                  <Header>Party State</Header>
                  <Header>GST Number</Header>
                  <Header>GST Setup</Header>
                  {hasActions && <Header>Action</Header>}
                </tr>
              </thead>

              <tbody>
                {ledgers.map((ledger) => {
                  const gstStatus = getGstStateStatus(ledger);

                  return (
                    <tr
                      key={ledger.id}
                      className="border-b border-slate-100 transition hover:bg-violet-50/70"
                    >
                      <td className="px-6 py-5">
                        <p className="font-bold text-slate-900">
                          {ledger.name}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {ledger.email || ledger.mobile || "No contact added"}
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

                      <td className="px-6 py-5">
                        <p className="font-semibold text-slate-800">
                          {ledger.state || "—"}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {ledger.stateCode
                            ? `State Code ${ledger.stateCode}`
                            : "No State Code"}
                        </p>
                      </td>

                      <td className="px-6 py-5 text-slate-700">
                        {ledger.gst || "—"}
                      </td>

                      <td className="px-6 py-5">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${gstStatus.className}`}
                        >
                          {gstStatus.label}
                        </span>
                      </td>

                      {hasActions && (
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-4">
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => onEditLedger(ledger)}
                                className="font-semibold text-violet-600 transition hover:text-violet-800"
                              >
                                Edit
                              </button>
                            )}

                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => void handleDelete(ledger.id)}
                                className="font-semibold text-red-500 transition hover:text-red-700"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function Header({ children }: { children: ReactNode }) {
  return (
    <th className="px-6 py-4 text-sm font-black text-violet-950">
      {children}
    </th>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-1 break-words font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}