"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ProfileRow = { active_company_id: string | null };
type CompanyRow = { name: string };

type CashBankAccount = {
  account_id: string;
  account_code: string;
  account_name: string;
  system_key: "cash" | "bank";
  closing_debit: number | string | null;
  closing_credit: number | string | null;
};

type CashBankBookRow = {
  row_type: "OPENING" | "ENTRY";
  entry_id: string | null;
  voucher_date: string;
  voucher_number: string;
  voucher_type: string;
  source_type: string;
  narration: string | null;
  line_description: string | null;
  counterpart_accounts: string | null;
  debit: number | string | null;
  credit: number | string | null;
  running_balance: number | string | null;
  balance_side: "Dr" | "Cr";
  row_order: number | string;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function getIndianFinancialYearStart(asOnDate: string) {
  const [yearText, monthText] = (asOnDate || todayIsoDate()).split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  return `${month >= 4 ? year : year - 1}-04-01`;
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number) {
  return `₹${Math.abs(toNumber(value)).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value || "—";
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}

function escapeCsvValue(value: string | number) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function escapeHtml(value: string | number) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeFileName(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "company"
  );
}

export default function CashBankBookManager() {
  const initialToDate = todayIsoDate();
  const initialFromDate = getIndianFinancialYearStart(initialToDate);

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [accounts, setAccounts] = useState<CashBankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [rows, setRows] = useState<CashBankBookRow[]>([]);

  const [fromDate, setFromDate] = useState(initialFromDate);
  const [toDate, setToDate] = useState(initialToDate);
  const [appliedFromDate, setAppliedFromDate] = useState(initialFromDate);
  const [appliedToDate, setAppliedToDate] = useState(initialToDate);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"All" | "Receipts" | "Payments">("All");
  const [isLoading, setIsLoading] = useState(true);
  const [isBookLoading, setIsBookLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(""), 4000);
  }

  async function resolveCompany() {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("Please sign in to view Cash & Bank Book.");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("active_company_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    const activeCompanyId =
      (profile as ProfileRow | null)?.active_company_id || null;

    if (!activeCompanyId) {
      throw new Error("Select an active company from the Companies page first.");
    }

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("name")
      .eq("id", activeCompanyId)
      .maybeSingle();

    if (companyError) throw companyError;

    setCompanyId(activeCompanyId);
    setCompanyName((company as CompanyRow | null)?.name || "Company");
    return activeCompanyId;
  }

  async function fetchAccounts(activeCompanyId: string, asOnDate: string) {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("get_cash_bank_accounts", {
      p_company_id: activeCompanyId,
      p_as_on_date: asOnDate,
    });

    if (error) throw error;

    const nextAccounts = (data || []) as CashBankAccount[];
    setAccounts(nextAccounts);
    setSelectedAccountId((current) =>
      nextAccounts.some((item) => item.account_id === current)
        ? current
        : nextAccounts[0]?.account_id || "",
    );
    return nextAccounts;
  }

  async function fetchBook(
    activeCompanyId: string,
    accountId: string,
    reportFromDate: string,
    reportToDate: string,
  ) {
    if (!accountId) {
      setRows([]);
      return;
    }

    setIsBookLoading(true);
    setErrorMessage("");

    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_cash_bank_book", {
        p_company_id: activeCompanyId,
        p_account_id: accountId,
        p_from_date: reportFromDate,
        p_to_date: reportToDate,
      });

      if (error) throw error;
      setRows((data || []) as CashBankBookRow[]);
    } catch (error) {
      setRows([]);
      setErrorMessage(
        getErrorMessage(error, "Cash & Bank Book could not be loaded."),
      );
    } finally {
      setIsBookLoading(false);
    }
  }

  async function loadInitial() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const activeCompanyId = await resolveCompany();
      const nextAccounts = await fetchAccounts(activeCompanyId, appliedToDate);
      const firstAccountId = nextAccounts[0]?.account_id || "";
      if (firstAccountId) {
        await fetchBook(
          activeCompanyId,
          firstAccountId,
          appliedFromDate,
          appliedToDate,
        );
      }
    } catch (error) {
      setCompanyId(null);
      setCompanyName("");
      setAccounts([]);
      setSelectedAccountId("");
      setRows([]);
      setErrorMessage(
        getErrorMessage(error, "Cash & Bank Book data could not be loaded."),
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadInitial();
  }, []);

  useEffect(() => {
    if (!companyId || !selectedAccountId) {
      setRows([]);
      return;
    }

    void fetchBook(
      companyId,
      selectedAccountId,
      appliedFromDate,
      appliedToDate,
    );
  }, [companyId, selectedAccountId, appliedFromDate, appliedToDate]);

  const selectedAccount = useMemo(
    () =>
      accounts.find((account) => account.account_id === selectedAccountId) ||
      null,
    [accounts, selectedAccountId],
  );

  const openingRow = useMemo(
    () => rows.find((row) => row.row_type === "OPENING") || null,
    [rows],
  );

  const entryRows = useMemo(
    () => rows.filter((row) => row.row_type === "ENTRY"),
    [rows],
  );

  const summary = useMemo(() => {
    const receipts = entryRows.reduce(
      (total, row) => total + toNumber(row.debit),
      0,
    );
    const payments = entryRows.reduce(
      (total, row) => total + toNumber(row.credit),
      0,
    );
    const openingSigned = openingRow
      ? openingRow.balance_side === "Cr"
        ? -toNumber(openingRow.running_balance)
        : toNumber(openingRow.running_balance)
      : 0;
    const lastRow = rows[rows.length - 1];
    const closingSigned = lastRow
      ? lastRow.balance_side === "Cr"
        ? -toNumber(lastRow.running_balance)
        : toNumber(lastRow.running_balance)
      : openingSigned;

    return { receipts, payments, openingSigned, closingSigned };
  }, [entryRows, openingRow, rows]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (row.row_type === "OPENING") {
        return filter === "All" && !normalizedSearch;
      }

      const matchesFilter =
        filter === "All" ||
        (filter === "Receipts" && toNumber(row.debit) > 0) ||
        (filter === "Payments" && toNumber(row.credit) > 0);

      const matchesSearch =
        !normalizedSearch ||
        [
          row.voucher_number,
          row.voucher_type,
          row.narration,
          row.line_description,
          row.counterpart_accounts,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);

      return matchesFilter && matchesSearch;
    });
  }, [rows, search, filter]);

  const hasNegativeCash =
    selectedAccount?.system_key === "cash" && summary.closingSigned < -0.005;

  async function generateBook() {
    if (!fromDate || !toDate) {
      showMessage("Please select both From Date and To Date.");
      return;
    }

    if (fromDate > toDate) {
      showMessage("From Date cannot be later than To Date.");
      return;
    }

    if (!companyId || !selectedAccountId) {
      showMessage("Select an active company and Cash or Bank account first.");
      return;
    }

    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);
    await fetchAccounts(companyId, toDate);
    await fetchBook(companyId, selectedAccountId, fromDate, toDate);
    showMessage("Cash & Bank Book generated successfully.");
  }

  function resetFilters() {
    const nextToDate = todayIsoDate();
    const nextFromDate = getIndianFinancialYearStart(nextToDate);
    setFromDate(nextFromDate);
    setToDate(nextToDate);
    setAppliedFromDate(nextFromDate);
    setAppliedToDate(nextToDate);
    setSearch("");
    setFilter("All");
    showMessage("Filters reset to the current financial year.");
  }

  function downloadCsv() {
    if (!selectedAccount || filteredRows.length === 0) {
      showMessage("No Cash & Bank Book rows are available to export.");
      return;
    }

    const csvRows: (string | number)[][] = [
      ["Company", companyName],
      [
        "Account",
        `${selectedAccount.account_code} - ${selectedAccount.account_name}`,
      ],
      ["Period", `${appliedFromDate} to ${appliedToDate}`],
      [],
      [
        "Date",
        "Voucher",
        "Type",
        "Particulars",
        "Counterpart",
        "Receipt / Debit",
        "Payment / Credit",
        "Running Balance",
        "Side",
      ],
      ...filteredRows.map((row) => [
        row.voucher_date,
        row.voucher_number,
        row.voucher_type,
        row.line_description || row.narration || "",
        row.counterpart_accounts || "",
        toNumber(row.debit).toFixed(2),
        toNumber(row.credit).toFixed(2),
        toNumber(row.running_balance).toFixed(2),
        row.balance_side,
      ]),
    ];

    const content = csvRows
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF", content], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeFileName(companyName)}-${
      selectedAccount.system_key
    }-book-${appliedFromDate}-to-${appliedToDate}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showMessage("Cash & Bank Book CSV downloaded successfully.");
  }

  function printReport() {
    if (!selectedAccount || rows.length === 0) {
      showMessage("No Cash & Bank Book data is available to print.");
      return;
    }

    const printWindow = window.open("", "_blank", "width=1200,height=850");
    if (!printWindow) {
      showMessage("Please allow pop-ups to print the report.");
      return;
    }

    const bodyRows = filteredRows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(formatDate(row.voucher_date))}</td>
            <td><strong>${escapeHtml(row.voucher_number)}</strong><br/><small>${escapeHtml(row.voucher_type)}</small></td>
            <td><strong>${escapeHtml(row.line_description || row.narration || "—")}</strong><br/><small>Against: ${escapeHtml(row.counterpart_accounts || "—")}</small></td>
            <td class="num">${toNumber(row.debit) > 0 ? escapeHtml(formatCurrency(toNumber(row.debit))) : "—"}</td>
            <td class="num">${toNumber(row.credit) > 0 ? escapeHtml(formatCurrency(toNumber(row.credit))) : "—"}</td>
            <td class="num">${escapeHtml(formatCurrency(toNumber(row.running_balance)))} ${escapeHtml(row.balance_side)}</td>
          </tr>`,
      )
      .join("");

    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(selectedAccount.account_name)} Book</title><style>
      body{font-family:Arial,sans-serif;margin:24px;color:#111827}h1{margin:0}.company{margin-top:6px;color:#5b21b6;font-size:18px;font-weight:700}.period{margin-top:5px;color:#475569}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:18px}.summary div{border:1px solid #ddd6fe;border-radius:10px;padding:10px;background:#f5f3ff}.summary span{display:block;font-size:11px;color:#64748b;text-transform:uppercase}.summary strong{display:block;margin-top:4px}table{width:100%;border-collapse:collapse;margin-top:20px;font-size:11px}th,td{border:1px solid #cbd5e1;padding:8px}th{background:#f5f3ff;text-align:left}.num{text-align:right;white-space:nowrap}small{color:#64748b}@page{size:landscape;margin:10mm}
    </style></head><body>
      <h1>${escapeHtml(selectedAccount.account_name)} Book</h1>
      <div class="company">${escapeHtml(companyName)}</div>
      <div class="period">${escapeHtml(formatDate(appliedFromDate))} to ${escapeHtml(formatDate(appliedToDate))}</div>
      <div class="summary">
        <div><span>Opening</span><strong>${escapeHtml(formatCurrency(summary.openingSigned))} ${summary.openingSigned < 0 ? "Cr" : "Dr"}</strong></div>
        <div><span>Receipts</span><strong>${escapeHtml(formatCurrency(summary.receipts))}</strong></div>
        <div><span>Payments</span><strong>${escapeHtml(formatCurrency(summary.payments))}</strong></div>
        <div><span>Closing</span><strong>${escapeHtml(formatCurrency(summary.closingSigned))} ${summary.closingSigned < 0 ? "Cr" : "Dr"}</strong></div>
      </div>
      <table><thead><tr><th>Date</th><th>Voucher</th><th>Particulars</th><th class="num">Receipt / Debit</th><th class="num">Payment / Credit</th><th class="num">Running Balance</th></tr></thead><tbody>${bodyRows}</tbody></table>
      <script>window.addEventListener("load",()=>window.print());</script>
    </body></html>`);
    printWindow.document.close();
  }

  return (
    <div className="min-w-0 space-y-6">
      <section className="overflow-hidden rounded-[30px] bg-gradient-to-br from-violet-950 via-violet-800 to-violet-600 p-6 text-white shadow-2xl shadow-violet-900/20 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-200">Accounting Reports</p>
            <h1 className="mt-3 text-3xl font-black sm:text-4xl">Cash &amp; Bank Book</h1>
            <p className="mt-3 max-w-2xl leading-7 text-violet-100">Opening balance, receipts, payments and running balance from posted double-entry vouchers.</p>
            <p className="mt-3 font-black text-white">{companyName || "No active company selected"}</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-slate-950/25 px-5 py-4 backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-200">Selected Account</p>
            <p className="mt-1 text-lg font-black">{selectedAccount ? `${selectedAccount.account_code} — ${selectedAccount.account_name}` : "Loading..."}</p>
            <p className="mt-1 text-sm text-violet-100">{formatDate(appliedFromDate)} to {formatDate(appliedToDate)}</p>
          </div>
        </div>
      </section>

      {errorMessage && <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-semibold text-red-700">{errorMessage}</div>}
      {message && <div className="rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 font-semibold text-violet-800">{message}</div>}

      {hasNegativeCash && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-800">
          <p className="font-black">Negative Cash Warning</p>
          <p className="mt-1 text-sm">Cash in Hand is showing a credit balance of {formatCurrency(summary.closingSigned)}. Review opening cash, payment modes and cash transactions.</p>
        </div>
      )}

      <section className="rounded-3xl border border-violet-100 bg-white p-4 shadow-xl shadow-violet-100/40 sm:p-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-5">
          <div className="xl:col-span-2">
            <label className="mb-2 block font-bold text-slate-800">Cash / Bank Account</label>
            <select value={selectedAccountId} onChange={(event) => setSelectedAccountId(event.target.value)} disabled={isLoading || accounts.length === 0} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100 disabled:opacity-60">
              {accounts.length === 0 ? <option value="">No Cash or Bank account available</option> : accounts.map((account) => <option key={account.account_id} value={account.account_id}>{account.account_code} — {account.account_name}</option>)}
            </select>
          </div>
          <DateField label="From Date" value={fromDate} onChange={setFromDate} />
          <DateField label="To Date" value={toDate} onChange={setToDate} />
          <div className="flex items-end">
            <button type="button" onClick={() => void generateBook()} disabled={isLoading || isBookLoading || !selectedAccountId} className="w-full rounded-xl bg-violet-600 px-5 py-3 font-black text-white shadow-lg transition hover:bg-violet-700 disabled:opacity-50">Generate Book</button>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <ActionButton onClick={resetFilters}>Reset Filters</ActionButton>
          <ActionButton onClick={downloadCsv}>Download CSV</ActionButton>
          <ActionButton onClick={printReport}>Print Report</ActionButton>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Opening Balance" value={`${formatCurrency(summary.openingSigned)} ${summary.openingSigned < 0 ? "Cr" : "Dr"}`} className="border-blue-100 bg-blue-50 text-blue-700" />
        <SummaryCard label="Total Receipts" value={formatCurrency(summary.receipts)} className="border-emerald-100 bg-emerald-50 text-emerald-700" />
        <SummaryCard label="Total Payments" value={formatCurrency(summary.payments)} className="border-orange-100 bg-orange-50 text-orange-700" />
        <SummaryCard label="Closing Balance" value={`${formatCurrency(summary.closingSigned)} ${summary.closingSigned < 0 ? "Cr" : "Dr"}`} className={summary.closingSigned < 0 ? "border-red-100 bg-red-50 text-red-700" : "border-violet-100 bg-violet-50 text-violet-700"} />
      </section>

      <section className="rounded-3xl border border-violet-100 bg-white p-4 shadow-xl shadow-violet-100/40 sm:p-6">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search voucher, narration or counterpart..." className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100" />
          <select value={filter} onChange={(event) => setFilter(event.target.value as "All" | "Receipts" | "Payments")} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100">
            <option value="All">All Entries</option>
            <option value="Receipts">Receipts Only</option>
            <option value="Payments">Payments Only</option>
          </select>
        </div>
      </section>

      <section className="min-w-0 overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-xl shadow-violet-100/40">
        <div className="border-b border-slate-200 px-5 py-5">
          <h2 className="text-xl font-black text-slate-900 sm:text-2xl">{selectedAccount?.account_name || "Cash / Bank"} Transactions</h2>
          <p className="mt-1 text-sm text-slate-600">Debit entries are receipts and credit entries are payments.</p>
        </div>

        <div className="space-y-4 p-4 md:hidden">
          {isBookLoading ? <EmptyText text="Loading Cash & Bank Book..." /> : filteredRows.length === 0 ? <EmptyText text="No entries match the selected filters." /> : filteredRows.map((row) => (
            <article key={row.entry_id || `opening-${row.voucher_date}`} className={`rounded-2xl border p-4 ${row.row_type === "OPENING" ? "border-violet-200 bg-violet-50" : "border-slate-200 bg-slate-50"}`}>
              <div className="flex items-start justify-between gap-3">
                <div><p className="font-black text-slate-900">{row.voucher_number}</p><p className="mt-1 text-sm text-slate-500">{formatDate(row.voucher_date)} · {row.voucher_type}</p></div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-violet-700">{formatCurrency(toNumber(row.running_balance))} {row.balance_side}</span>
              </div>
              <p className="mt-4 font-semibold text-slate-800">{row.line_description || row.narration || "—"}</p>
              <p className="mt-1 text-sm text-slate-500">Against: {row.counterpart_accounts || "—"}</p>
              <div className="mt-4 grid grid-cols-2 gap-3"><AmountBox label="Receipt / Debit" value={toNumber(row.debit)} className="text-emerald-700" /><AmountBox label="Payment / Credit" value={toNumber(row.credit)} className="text-orange-700" /></div>
            </article>
          ))}
        </div>

        <div className="hidden max-w-full overflow-x-auto md:block">
          <table className="w-full min-w-[1180px]">
            <thead className="bg-violet-50/70"><tr className="border-b border-slate-200 text-left"><Header>Date</Header><Header>Voucher</Header><Header>Particulars</Header><Header>Counterpart</Header><Header right>Receipt / Debit</Header><Header right>Payment / Credit</Header><Header right>Running Balance</Header></tr></thead>
            <tbody>
              {isBookLoading ? <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500">Loading Cash &amp; Bank Book...</td></tr> : filteredRows.length === 0 ? <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500">No entries match the selected filters.</td></tr> : filteredRows.map((row) => (
                <tr key={row.entry_id || `opening-${row.voucher_date}`} className={`border-b border-slate-100 ${row.row_type === "OPENING" ? "bg-violet-50" : "transition hover:bg-violet-50/60"}`}>
                  <td className="px-5 py-5 text-slate-700">{formatDate(row.voucher_date)}</td>
                  <td className="px-5 py-5"><p className="font-black text-slate-900">{row.voucher_number}</p><p className="mt-1 text-xs text-slate-500">{row.voucher_type}</p></td>
                  <td className="px-5 py-5"><p className="font-semibold text-slate-900">{row.line_description || row.narration || "—"}</p><p className="mt-1 max-w-sm text-sm text-slate-500">{row.narration || "—"}</p></td>
                  <td className="px-5 py-5 text-slate-700">{row.counterpart_accounts || "—"}</td>
                  <td className="px-5 py-5 text-right font-bold text-emerald-700">{toNumber(row.debit) > 0 ? formatCurrency(toNumber(row.debit)) : "—"}</td>
                  <td className="px-5 py-5 text-right font-bold text-orange-700">{toNumber(row.credit) > 0 ? formatCurrency(toNumber(row.credit)) : "—"}</td>
                  <td className={`px-5 py-5 text-right font-black ${row.balance_side === "Cr" ? "text-red-600" : "text-violet-700"}`}>{formatCurrency(toNumber(row.running_balance))} {row.balance_side}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div><label className="mb-2 block font-bold text-slate-800">{label}</label><input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100" /></div>;
}

function ActionButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-bold text-violet-700 transition hover:bg-violet-100">{children}</button>;
}

function SummaryCard({ label, value, className }: { label: string; value: string; className: string }) {
  return <article className={`rounded-3xl border p-5 shadow-lg ${className}`}><p className="font-semibold">{label}</p><p className="mt-3 break-words text-3xl font-black">{value}</p></article>;
}

function AmountBox({ label, value, className }: { label: string; value: number; className: string }) {
  return <div className="rounded-xl bg-white p-3"><p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-1 font-black ${className}`}>{value > 0 ? formatCurrency(value) : "—"}</p></div>;
}

function Header({ children, right = false }: { children: ReactNode; right?: boolean }) {
  return <th className={`px-5 py-4 text-sm font-black text-slate-700 ${right ? "text-right" : ""}`}>{children}</th>;
}

function EmptyText({ text }: { text: string }) {
  return <p className="py-10 text-center text-sm text-slate-500">{text}</p>;
}