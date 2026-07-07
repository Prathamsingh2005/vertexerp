"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";

type ProfileRow = {
  active_company_id: string | null;
};

type LedgerRow = {
  id: string;
  name: string;
};

type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "RESTORE";

type AuditRow = {
  id: string;
  user_id: string | null;
  entity_type: string;
  entity_id: string;
  action: AuditAction;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type AuditDisplayRow = AuditRow & {
  title: string;
  subtitle: string;
  amount: number | null;
  partyName: string;
  stockStatus: string;
};

function formatCurrency(amount: number) {
  return `₹${Number(amount || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(dateValue: string) {
  if (!dateValue) {
    return "Not available";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRecord(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function isTrue(value: unknown) {
  return value === true || String(value).trim().toLowerCase() === "true";
}

function getNumber(value: unknown) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function getEntityLabel(entityType: string) {
  switch (entityType) {
    case "sale":
      return "Sales Invoice";
    case "purchase":
      return "Purchase Bill";
    case "payment":
      return "Payment Entry";
    case "expense":
      return "Expense Entry";
    default:
      return entityType || "Business Record";
  }
}

function getActionClassName(action: AuditAction) {
  switch (action) {
    case "DELETE":
      return "bg-red-100 text-red-700";
    case "UPDATE":
      return "bg-amber-100 text-amber-700";
    case "RESTORE":
      return "bg-emerald-100 text-emerald-700";
    default:
      return "bg-blue-100 text-blue-700";
  }
}

function getActionDescription(action: AuditAction) {
  switch (action) {
    case "DELETE":
      return "Deleted";
    case "UPDATE":
      return "Updated";
    case "RESTORE":
      return "Restored";
    default:
      return "Created";
  }
}

export default function AuditHistoryPage() {
  const [auditLogs, setAuditLogs] = useState<AuditRow[]>([]);
  const [ledgers, setLedgers] = useState<LedgerRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [entityFilter, setEntityFilter] = useState("All");

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);

    window.setTimeout(() => {
      setMessage("");
    }, 4500);
  }

  async function loadAuditHistory() {
    setIsLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setAuditLogs([]);
        setLedgers([]);
        showMessage("Please sign in to view audit history.");
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
        setAuditLogs([]);
        setLedgers([]);
        showMessage("Select an active company from the Companies page first.");
        return;
      }

      const [auditResponse, ledgersResponse] = await Promise.all([
        supabase
          .from("audit_logs")
          .select(
            "id, user_id, entity_type, entity_id, action, old_data, new_data, metadata, created_at"
          )
          .eq("company_id", activeCompanyId)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("ledgers")
          .select("id, name")
          .eq("company_id", activeCompanyId),
      ]);

      if (auditResponse.error) {
        throw auditResponse.error;
      }

      if (ledgersResponse.error) {
        throw ledgersResponse.error;
      }

      setAuditLogs((auditResponse.data || []) as AuditRow[]);
      setLedgers((ledgersResponse.data || []) as LedgerRow[]);
    } catch (error) {
      setAuditLogs([]);
      setLedgers([]);

      showMessage(
        error instanceof Error
          ? error.message
          : "Audit history could not be loaded from the cloud database."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadAuditHistory();

    window.addEventListener(
      "vertexerp-active-company-updated",
      loadAuditHistory
    );

    return () => {
      window.removeEventListener(
        "vertexerp-active-company-updated",
        loadAuditHistory
      );
    };
  }, []);

  const ledgerNameById = useMemo(
    () => new Map(ledgers.map((ledger) => [ledger.id, ledger.name])),
    [ledgers]
  );

  const displayRows = useMemo<AuditDisplayRow[]>(() => {
    return auditLogs.map((auditLog) => {
      const metadata = getRecord(auditLog.metadata);
      const oldData = getRecord(auditLog.old_data);
      const newData = getRecord(auditLog.new_data);
      const sourceData =
        auditLog.action === "UPDATE" && Object.keys(newData).length > 0
          ? newData
          : oldData;
      const sale = getRecord(sourceData.sale);
      const purchase = getRecord(sourceData.purchase);
      const payment = getRecord(sourceData.payment);
      const expense = getRecord(sourceData.expense);

      const partyId =
        getString(metadata.party_id) || getString(payment.party_id);
      const partyName = partyId
        ? ledgerNameById.get(partyId) || "Linked party"
        : "";

      let title = getEntityLabel(auditLog.entity_type);
      let subtitle = "";
      let amount: number | null = null;
      let stockStatus = "";

      if (auditLog.entity_type === "sale") {
        const invoiceNumber =
          getString(metadata.invoice_number) ||
          getString(sale.invoice_number) ||
          "Sales Invoice";

        title = invoiceNumber;
        subtitle = "Sales Invoice";
        amount = getNumber(sale.grand_total);
        stockStatus =
          isTrue(metadata.stock_restored)
            ? "Stock restored"
            : "";
      }

      if (auditLog.entity_type === "purchase") {
        const billNumber =
          getString(metadata.bill_number) ||
          getString(purchase.bill_number) ||
          "Purchase Bill";

        title = billNumber;
        subtitle = "Purchase Bill";
        amount = getNumber(purchase.grand_total);
        stockStatus =
          isTrue(metadata.stock_removed)
            ? "Stock removed"
            : "";
      }

      if (auditLog.entity_type === "payment") {
        const paymentType =
          getString(metadata.payment_type) ||
          getString(payment.payment_type) ||
          "Payment Entry";

        title = paymentType;
        subtitle = partyName || "Payment Entry";
        amount =
          getNumber(metadata.amount) ?? getNumber(payment.amount);
      }

      if (auditLog.entity_type === "expense") {
        const category =
          getString(metadata.category) ||
          getString(expense.category) ||
          "Expense Entry";

        title = category;
        subtitle =
          getString(metadata.payment_mode) ||
          getString(expense.payment_mode) ||
          "Expense Entry";
        amount =
          getNumber(metadata.amount) ?? getNumber(expense.amount);
      }

      return {
        ...auditLog,
        title,
        subtitle,
        amount,
        partyName,
        stockStatus,
      };
    });
  }, [auditLogs, ledgerNameById]);

  const filteredRows = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return displayRows.filter((row) => {
      const matchesEntity =
        entityFilter === "All" || row.entity_type === entityFilter;

      const searchableText = [
        row.title,
        row.subtitle,
        row.partyName,
        row.entity_type,
        row.action,
        row.stockStatus,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !search || searchableText.includes(search);

      return matchesEntity && matchesSearch;
    });
  }, [displayRows, entityFilter, searchTerm]);

  const summary = useMemo(() => {
    return {
      total: displayRows.length,
      sales: displayRows.filter((row) => row.entity_type === "sale").length,
      purchases: displayRows.filter(
        (row) => row.entity_type === "purchase"
      ).length,
      finance: displayRows.filter(
        (row) =>
          row.entity_type === "payment" || row.entity_type === "expense"
      ).length,
    };
  }, [displayRows]);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <div className="min-w-0 flex-1">
        <Navbar />

        <main className="p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
          <div className="mb-6 flex flex-col gap-5 lg:mb-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
                🛡️ Audit History
              </h1>

              <p className="mt-2 max-w-3xl text-base text-slate-600 sm:text-lg">
                Review protected records for deleted, updated and restored
                business transactions.
              </p>
            </div>

            <button
              type="button"
              onClick={loadAuditHistory}
              disabled={isLoading}
              className="w-full rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isLoading ? "Refreshing..." : "Refresh History"}
            </button>
          </div>

          {message && (
            <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 sm:mb-6 sm:text-base">
              {message}
            </div>
          )}

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">Total Records</p>
              <p className="mt-3 text-3xl font-bold text-blue-600 sm:text-4xl">
                {isLoading ? "..." : summary.total}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Latest 100 protected actions
              </p>
            </div>

            <div className="rounded-3xl border border-green-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">Sales Records</p>
              <p className="mt-3 text-3xl font-bold text-green-600 sm:text-4xl">
                {isLoading ? "..." : summary.sales}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Invoice audit events
              </p>
            </div>

            <div className="rounded-3xl border border-purple-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">Purchase Records</p>
              <p className="mt-3 text-3xl font-bold text-purple-600 sm:text-4xl">
                {isLoading ? "..." : summary.purchases}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Purchase bill audit events
              </p>
            </div>

            <div className="rounded-3xl border border-orange-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">Finance Records</p>
              <p className="mt-3 text-3xl font-bold text-orange-600 sm:text-4xl">
                {isLoading ? "..." : summary.finance}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Payment and expense events
              </p>
            </div>
          </section>

          <section className="mt-6 rounded-3xl border border-slate-100 bg-white p-4 shadow-lg sm:mt-8 sm:p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_220px]">
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search invoice, bill, category or party..."
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none placeholder:text-slate-500 transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />

              <select
                value={entityFilter}
                onChange={(event) => setEntityFilter(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              >
                <option value="All">All Record Types</option>
                <option value="sale">Sales Invoices</option>
                <option value="purchase">Purchase Bills</option>
                <option value="payment">Payments</option>
                <option value="expense">Expenses</option>
              </select>
            </div>
          </section>

          <section className="mt-6 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl sm:mt-8">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 lg:py-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
                  Protected Activity
                </h2>

                <p className="mt-1 text-sm text-slate-600 sm:text-base">
                  Audit records are retained even after the original entry is
                  deleted.
                </p>
              </div>

              <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">
                Showing: {isLoading ? "..." : filteredRows.length}
              </span>
            </div>

            <div className="p-4 md:hidden">
              {isLoading ? (
                <p className="py-10 text-center text-sm text-slate-500">
                  Loading audit history from the cloud database...
                </p>
              ) : filteredRows.length === 0 ? (
                <div className="py-10 text-center text-slate-500">
                  <p className="text-lg font-semibold text-slate-700">
                    No audit records found
                  </p>

                  <p className="mt-2 text-sm">
                    Deleted or updated records will appear here automatically.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredRows.map((row) => (
                    <article
                      key={row.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-bold text-slate-900">
                            {row.title}
                          </p>

                          <p className="mt-1 text-sm text-slate-600">
                            {row.subtitle}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${getActionClassName(
                            row.action
                          )}`}
                        >
                          {getActionDescription(row.action)}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-white p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Record Type
                          </p>

                          <p className="mt-1 font-semibold text-slate-800">
                            {getEntityLabel(row.entity_type)}
                          </p>
                        </div>

                        <div className="rounded-xl bg-white p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Amount
                          </p>

                          <p className="mt-1 break-words font-bold text-slate-800">
                            {row.amount === null
                              ? "—"
                              : formatCurrency(row.amount)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 rounded-xl bg-white p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Action Time
                        </p>

                        <p className="mt-1 text-sm font-semibold text-slate-800">
                          {formatDateTime(row.created_at)}
                        </p>

                        {row.stockStatus && (
                          <p className="mt-2 text-sm font-semibold text-emerald-700">
                            {row.stockStatus}
                          </p>
                        )}
                      </div>

                      <details className="mt-3 rounded-xl bg-white p-3">
                        <summary className="cursor-pointer text-sm font-bold text-blue-700">
                          View audit details
                        </summary>

                        <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                          {JSON.stringify(
                            {
                              before: row.old_data,
                              after: row.new_data,
                              metadata: row.metadata,
                            },
                            null,
                            2
                          )}
                        </pre>
                      </details>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1050px]">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200 text-left">
                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Date & Time
                    </th>
                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Record
                    </th>
                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Type
                    </th>
                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Amount
                    </th>
                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Stock Status
                    </th>
                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Action
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">
                      Details
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-14 text-center text-slate-500"
                      >
                        Loading audit history from the cloud database...
                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-14 text-center text-slate-500"
                      >
                        <p className="text-lg font-semibold text-slate-700">
                          No audit records found
                        </p>

                        <p className="mt-2">
                          Deleted or updated records will appear here
                          automatically.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-slate-100 align-top transition hover:bg-slate-50"
                      >
                        <td className="px-6 py-5 text-sm text-slate-700">
                          {formatDateTime(row.created_at)}
                        </td>

                        <td className="px-6 py-5">
                          <p className="font-bold text-slate-900">
                            {row.title}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {row.subtitle}
                          </p>
                        </td>

                        <td className="px-6 py-5 text-slate-700">
                          {getEntityLabel(row.entity_type)}
                        </td>

                        <td className="px-6 py-5 font-bold text-slate-900">
                          {row.amount === null
                            ? "—"
                            : formatCurrency(row.amount)}
                        </td>

                        <td className="px-6 py-5 text-sm font-semibold text-emerald-700">
                          {row.stockStatus || "—"}
                        </td>

                        <td className="px-6 py-5">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${getActionClassName(
                              row.action
                            )}`}
                          >
                            {getActionDescription(row.action)}
                          </span>
                        </td>

                        <td className="px-6 py-5 text-right">
                          <details className="inline-block text-left">
                            <summary className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                              View
                            </summary>

                            <pre className="absolute right-8 z-20 mt-2 max-h-80 w-[440px] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100 shadow-2xl">
                              {JSON.stringify(
                            {
                              before: row.old_data,
                              after: row.new_data,
                              metadata: row.metadata,
                            },
                            null,
                            2
                          )}
                            </pre>
                          </details>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}