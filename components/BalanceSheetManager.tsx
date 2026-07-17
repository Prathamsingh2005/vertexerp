"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ProfileRow = {
  active_company_id: string | null;
};

type CompanyRow = {
  name: string;
};

type BalanceSheetSection = "Asset" | "Liability" | "Equity";

type BalanceSheetRow = {
  row_id: string;
  account_id: string | null;
  account_code: string;
  account_name: string;
  account_type: BalanceSheetSection;
  account_group: string;
  system_key: string | null;
  section: BalanceSheetSection;
  amount: number | string | null;
  is_synthetic: boolean;
  sort_order: number;
};

type ProfitLossSummaryRow = {
  total_income: number | string | null;
  total_expense: number | string | null;
  net_profit: number | string | null;
};

type ProfitLossSummary = {
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
};

type GroupSummary = {
  groupName: string;
  amount: number;
};

const INITIAL_PROFIT_LOSS: ProfitLossSummary = {
  totalIncome: 0,
  totalExpense: 0,
  netProfit: 0,
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function getIndianFinancialYearStart(asOnDate: string) {
  const safeDate = asOnDate || todayIsoDate();
  const [yearText, monthText] = safeDate.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return `${new Date().getFullYear()}-04-01`;
  }

  return `${month >= 4 ? year : year - 1}-04-01`;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

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

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(amount: number) {
  const absoluteAmount = Math.abs(toNumber(amount));
  const formatted = absoluteAmount.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });

  return amount < 0 ? `(₹${formatted})` : `₹${formatted}`;
}

function formatDate(dateValue: string) {
  if (!dateValue) {
    return "—";
  }

  const parsedDate = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return dateValue;
  }

  return parsedDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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

function createSafeFileName(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "company"
  );
}

function getSectionStyle(section: BalanceSheetSection) {
  if (section === "Asset") {
    return {
      badge: "bg-emerald-100 text-emerald-700",
      border: "border-emerald-100",
      header: "bg-emerald-50 text-emerald-900",
      amount: "text-emerald-700",
    };
  }

  if (section === "Liability") {
    return {
      badge: "bg-orange-100 text-orange-700",
      border: "border-orange-100",
      header: "bg-orange-50 text-orange-900",
      amount: "text-orange-700",
    };
  }

  return {
    badge: "bg-violet-100 text-violet-700",
    border: "border-violet-100",
    header: "bg-violet-50 text-violet-900",
    amount: "text-violet-700",
  };
}

export default function BalanceSheetManager() {
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [activeCompanyName, setActiveCompanyName] = useState("");
  const [financialYearStart, setFinancialYearStart] = useState("");

  const [asOnDate, setAsOnDate] = useState(todayIsoDate());
  const [appliedAsOnDate, setAppliedAsOnDate] = useState(todayIsoDate());

  const [rows, setRows] = useState<BalanceSheetRow[]>([]);
  const [profitLoss, setProfitLoss] =
    useState<ProfitLossSummary>(INITIAL_PROFIT_LOSS);

  const [searchQuery, setSearchQuery] = useState("");
  const [sectionFilter, setSectionFilter] = useState<
    "All" | BalanceSheetSection
  >("All");

  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(""), 4000);
  }

  async function resolveActiveCompany() {
    const supabase = createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("Please sign in to view the Balance Sheet.");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("active_company_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    const companyId =
      (profile as ProfileRow | null)?.active_company_id || null;

    if (!companyId) {
      throw new Error("Select an active company from the Companies page first.");
    }

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .maybeSingle();

    if (companyError) {
      throw companyError;
    }

    const companyRow = company as CompanyRow | null;

    const derivedFinancialYearStart =
      getIndianFinancialYearStart(appliedAsOnDate);

    setActiveCompanyId(companyId);
    setActiveCompanyName(companyRow?.name || "Company");
    setFinancialYearStart(derivedFinancialYearStart);

    return {
      companyId,
      financialYearStart: derivedFinancialYearStart,
    };
  }

  async function loadBalanceSheet(
    companyId: string,
    reportAsOnDate: string,
    companyFinancialYearStart: string,
  ) {
    const supabase = createClient();

    const profitFromDate =
      companyFinancialYearStart &&
      companyFinancialYearStart <= reportAsOnDate
        ? companyFinancialYearStart
        : null;

    const [balanceSheetResponse, profitLossResponse] = await Promise.all([
      supabase.rpc("get_balance_sheet", {
        p_company_id: companyId,
        p_as_on_date: reportAsOnDate,
      }),
      supabase.rpc("get_profit_loss_summary", {
        p_company_id: companyId,
        p_from_date: profitFromDate,
        p_to_date: reportAsOnDate,
      }),
    ]);

    if (balanceSheetResponse.error) {
      throw balanceSheetResponse.error;
    }

    if (profitLossResponse.error) {
      throw profitLossResponse.error;
    }

    setRows((balanceSheetResponse.data || []) as BalanceSheetRow[]);

    const summary = ((profitLossResponse.data || []) as ProfitLossSummaryRow[])[0];

    setProfitLoss({
      totalIncome: toNumber(summary?.total_income),
      totalExpense: toNumber(summary?.total_expense),
      netProfit: toNumber(summary?.net_profit),
    });
  }

  async function loadInitialData() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const company = await resolveActiveCompany();
      await loadBalanceSheet(
        company.companyId,
        appliedAsOnDate,
        company.financialYearStart,
      );
    } catch (error) {
      setActiveCompanyId(null);
      setActiveCompanyName("");
      setFinancialYearStart("");
      setRows([]);
      setProfitLoss(INITIAL_PROFIT_LOSS);
      setErrorMessage(
        getErrorMessage(
          error,
          "Balance Sheet data could not be loaded.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadInitialData();

    async function handleRefresh() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const company = await resolveActiveCompany();
        await loadBalanceSheet(
          company.companyId,
          appliedAsOnDate,
          company.financialYearStart,
        );
      } catch (error) {
        setRows([]);
        setProfitLoss(INITIAL_PROFIT_LOSS);
        setErrorMessage(
          getErrorMessage(
            error,
            "Balance Sheet data could not be refreshed.",
          ),
        );
      } finally {
        setIsLoading(false);
      }
    }

    const refreshEvents = [
      "vertexerp-active-company-updated",
      "vertexerp-accounting-updated",
      "vertexerp-sales-updated",
      "vertexerp-purchases-updated",
      "vertexerp-payments-updated",
      "vertexerp-expenses-updated",
      "vertexerp-gst-data-updated",
      "vertexerp-ledgers-updated",
    ];

    refreshEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleRefresh);
    });

    return () => {
      refreshEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleRefresh);
      });
    };
  }, [appliedAsOnDate]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSection =
        sectionFilter === "All" || row.section === sectionFilter;

      const matchesSearch =
        !normalizedSearch ||
        [
          row.account_code,
          row.account_name,
          row.account_group,
          row.section,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);

      return matchesSection && matchesSearch;
    });
  }, [rows, searchQuery, sectionFilter]);

  const assetRows = useMemo(
    () => filteredRows.filter((row) => row.section === "Asset"),
    [filteredRows],
  );

  const liabilityRows = useMemo(
    () => filteredRows.filter((row) => row.section === "Liability"),
    [filteredRows],
  );

  const equityRows = useMemo(
    () => filteredRows.filter((row) => row.section === "Equity"),
    [filteredRows],
  );

  const fullTotals = useMemo(() => {
    const totalAssets = rows
      .filter((row) => row.section === "Asset")
      .reduce((total, row) => total + toNumber(row.amount), 0);

    const totalLiabilities = rows
      .filter((row) => row.section === "Liability")
      .reduce((total, row) => total + toNumber(row.amount), 0);

    const totalEquity = rows
      .filter((row) => row.section === "Equity")
      .reduce((total, row) => total + toNumber(row.amount), 0);

    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

    return {
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalLiabilitiesAndEquity,
      difference: totalAssets - totalLiabilitiesAndEquity,
    };
  }, [rows]);

  const groupSummaries = useMemo(() => {
    function summarize(section: BalanceSheetSection): GroupSummary[] {
      const totals = new Map<string, number>();

      rows
        .filter((row) => row.section === section)
        .forEach((row) => {
          const groupName = row.account_group || "Other";
          totals.set(
            groupName,
            (totals.get(groupName) || 0) + toNumber(row.amount),
          );
        });

      return Array.from(totals.entries())
        .map(([groupName, amount]) => ({ groupName, amount }))
        .sort((first, second) => first.groupName.localeCompare(second.groupName));
    }

    return {
      assets: summarize("Asset"),
      liabilities: summarize("Liability"),
      equity: summarize("Equity"),
    };
  }, [rows]);

  const accumulatedProfitLoss =
    rows.find((row) => row.system_key === "accumulated_profit_loss")?.amount ||
    0;

  const isBalanced = Math.abs(fullTotals.difference) < 0.01;

  async function applyAsOnDate() {
    if (!asOnDate) {
      showMessage("Please select the As On Date.");
      return;
    }

    if (!activeCompanyId) {
      showMessage("Select an active company first.");
      return;
    }

    const nextFinancialYearStart =
      getIndianFinancialYearStart(asOnDate);

    setAppliedAsOnDate(asOnDate);
    setFinancialYearStart(nextFinancialYearStart);
    setIsLoading(true);
    setErrorMessage("");

    try {
      await loadBalanceSheet(
        activeCompanyId,
        asOnDate,
        nextFinancialYearStart,
      );
      showMessage("Balance Sheet generated successfully.");
    } catch (error) {
      setRows([]);
      setProfitLoss(INITIAL_PROFIT_LOSS);
      setErrorMessage(
        getErrorMessage(
          error,
          "Balance Sheet could not be generated.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }

  function downloadCsv() {
    if (filteredRows.length === 0) {
      showMessage("No Balance Sheet rows are available to export.");
      return;
    }

    const csvRows: (string | number)[][] = [
      ["Company", activeCompanyName],
      ["As On Date", appliedAsOnDate],
      [],
      ["Section", "Account Code", "Account Name", "Account Group", "Amount"],
      ...filteredRows.map((row) => [
        row.section,
        row.account_code,
        row.account_name,
        row.account_group,
        toNumber(row.amount).toFixed(2),
      ]),
      [],
      ["Total Assets", "", "", "", fullTotals.totalAssets.toFixed(2)],
      [
        "Total Liabilities",
        "",
        "",
        "",
        fullTotals.totalLiabilities.toFixed(2),
      ],
      ["Total Equity", "", "", "", fullTotals.totalEquity.toFixed(2)],
      [
        "Liabilities + Equity",
        "",
        "",
        "",
        fullTotals.totalLiabilitiesAndEquity.toFixed(2),
      ],
      ["Difference", "", "", "", fullTotals.difference.toFixed(2)],
    ];

    const csvContent = csvRows
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF", csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = downloadUrl;
    anchor.download = `${createSafeFileName(
      activeCompanyName,
    )}-balance-sheet-${appliedAsOnDate}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(downloadUrl);
    showMessage("Balance Sheet CSV downloaded successfully.");
  }

  function printReport() {
    if (rows.length === 0) {
      showMessage("No Balance Sheet data is available to print.");
      return;
    }

    const printWindow = window.open("", "_blank", "width=1100,height=850");

    if (!printWindow) {
      showMessage("Please allow pop-ups to print the Balance Sheet.");
      return;
    }

    function createSectionRows(
      sectionName: string,
      sectionRows: BalanceSheetRow[],
      total: number,
    ) {
      return `
        <tr class="section-title">
          <td colspan="3">${escapeHtml(sectionName)}</td>
        </tr>
        ${sectionRows
          .map(
            (row) => `
              <tr>
                <td>${escapeHtml(row.account_code)}</td>
                <td>
                  <strong>${escapeHtml(row.account_name)}</strong>
                  <div class="muted">${escapeHtml(row.account_group)}</div>
                </td>
                <td class="amount ${toNumber(row.amount) < 0 ? "negative" : ""}">
                  ${escapeHtml(formatCurrency(toNumber(row.amount)))}
                </td>
              </tr>
            `,
          )
          .join("")}
        <tr class="subtotal">
          <td colspan="2">Total ${escapeHtml(sectionName)}</td>
          <td class="amount">${escapeHtml(formatCurrency(total))}</td>
        </tr>
      `;
    }

    const allAssets = rows.filter((row) => row.section === "Asset");
    const allLiabilities = rows.filter((row) => row.section === "Liability");
    const allEquity = rows.filter((row) => row.section === "Equity");

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Balance Sheet - ${escapeHtml(activeCompanyName)}</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 28px; font-family: Arial, sans-serif; color: #111827; }
            h1 { margin: 0; font-size: 28px; }
            .company { margin-top: 6px; color: #5b21b6; font-size: 18px; font-weight: 700; }
            .period { margin-top: 5px; color: #475569; }
            .status { display: inline-block; margin-top: 12px; padding: 7px 13px; border-radius: 999px; font-weight: 700; background: ${
              isBalanced ? "#dcfce7" : "#fee2e2"
            }; color: ${isBalanced ? "#166534" : "#991b1b"}; }
            table { width: 100%; border-collapse: collapse; margin-top: 22px; }
            th, td { border: 1px solid #cbd5e1; padding: 10px; }
            th { background: #f5f3ff; text-align: left; }
            .amount { text-align: right; white-space: nowrap; font-weight: 700; }
            .negative { color: #b91c1c; }
            .muted { margin-top: 3px; color: #64748b; font-size: 11px; }
            .section-title td { background: #ede9fe; color: #4c1d95; font-weight: 800; }
            .subtotal td { background: #f8fafc; font-weight: 800; }
            .grand-total td { background: #1e1b4b; color: white; font-weight: 800; }
            @page { size: A4 portrait; margin: 12mm; }
          </style>
        </head>
        <body>
          <h1>Balance Sheet</h1>
          <div class="company">${escapeHtml(activeCompanyName)}</div>
          <div class="period">As on ${escapeHtml(
            formatDate(appliedAsOnDate),
          )}</div>
          <div class="status">${isBalanced ? "Balanced" : "Needs Review"}</div>

          <table>
            <thead>
              <tr>
                <th style="width: 110px;">Code</th>
                <th>Particulars</th>
                <th style="width: 190px; text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${createSectionRows(
                "Assets",
                allAssets,
                fullTotals.totalAssets,
              )}
              ${createSectionRows(
                "Liabilities",
                allLiabilities,
                fullTotals.totalLiabilities,
              )}
              ${createSectionRows(
                "Equity",
                allEquity,
                fullTotals.totalEquity,
              )}
              <tr class="grand-total">
                <td colspan="2">Total Liabilities &amp; Equity</td>
                <td class="amount">${escapeHtml(
                  formatCurrency(fullTotals.totalLiabilitiesAndEquity),
                )}</td>
              </tr>
            </tbody>
          </table>

          <script>
            window.addEventListener("load", () => window.print());
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  }

  return (
    <div className="min-w-0 space-y-6">
      <section className="overflow-hidden rounded-[30px] bg-gradient-to-br from-violet-950 via-violet-800 to-violet-600 p-6 text-white shadow-2xl shadow-violet-900/20 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-200">
              Financial Position
            </p>
            <h1 className="mt-3 text-3xl font-black sm:text-4xl">
              Balance Sheet
            </h1>
            <p className="mt-3 max-w-2xl leading-7 text-violet-100">
              Review assets, liabilities, equity and accumulated profit or loss
              from posted double-entry vouchers.
            </p>
            <p className="mt-3 font-black text-white">
              {activeCompanyName || "No active company selected"}
            </p>
          </div>

          <div className="rounded-2xl border border-white/15 bg-slate-950/25 px-5 py-4 backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-200">
              Report Date
            </p>
            <p className="mt-1 text-lg font-black">
              {formatDate(appliedAsOnDate)}
            </p>
            <p className="mt-1 text-sm text-violet-100">
              {financialYearStart
                ? `Financial year starts ${formatDate(financialYearStart)}`
                : "Financial year start not configured"}
            </p>
          </div>
        </div>
      </section>

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-semibold text-red-700">
          {errorMessage}
        </div>
      )}

      {message && (
        <div className="rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 font-semibold text-violet-800">
          {message}
        </div>
      )}

      <section className="rounded-3xl border border-violet-100 bg-white p-4 shadow-xl shadow-violet-100/40 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label className="mb-2 block font-bold text-slate-800">
              As On Date
            </label>
            <input
              type="date"
              value={asOnDate}
              onChange={(event) => setAsOnDate(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
            />
          </div>

          <button
            type="button"
            onClick={() => void applyAsOnDate()}
            disabled={isLoading || !activeCompanyId}
            className="w-full rounded-xl bg-violet-600 px-6 py-3 font-black text-white shadow-lg transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
          >
            {isLoading ? "Generating..." : "Generate Balance Sheet"}
          </button>

          <button
            type="button"
            onClick={downloadCsv}
            disabled={isLoading || filteredRows.length === 0}
            className="w-full rounded-xl border border-violet-200 bg-violet-50 px-5 py-3 font-bold text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
          >
            Download CSV
          </button>

          <button
            type="button"
            onClick={printReport}
            disabled={isLoading || rows.length === 0}
            className="w-full rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
          >
            Print Report
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Assets"
          value={isLoading ? "..." : formatCurrency(fullTotals.totalAssets)}
          className="border-emerald-100 bg-emerald-50 text-emerald-700"
        />
        <SummaryCard
          label="Total Liabilities"
          value={
            isLoading ? "..." : formatCurrency(fullTotals.totalLiabilities)
          }
          className="border-orange-100 bg-orange-50 text-orange-700"
        />
        <SummaryCard
          label="Total Equity"
          value={isLoading ? "..." : formatCurrency(fullTotals.totalEquity)}
          className="border-violet-100 bg-violet-50 text-violet-700"
        />
        <SummaryCard
          label={isBalanced ? "Balance Status" : "Difference"}
          value={
            isLoading
              ? "..."
              : isBalanced
                ? "Balanced"
                : formatCurrency(fullTotals.difference)
          }
          className={
            isBalanced
              ? "border-blue-100 bg-blue-50 text-blue-700"
              : "border-red-100 bg-red-50 text-red-700"
          }
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <InfoCard
          label="Financial-Year Income"
          value={formatCurrency(profitLoss.totalIncome)}
          detail={
            financialYearStart
              ? `${formatDate(financialYearStart)} to ${formatDate(
                  appliedAsOnDate,
                )}`
              : `Until ${formatDate(appliedAsOnDate)}`
          }
          className="border-emerald-100 bg-emerald-50 text-emerald-700"
        />
        <InfoCard
          label="Financial-Year Expenses"
          value={formatCurrency(profitLoss.totalExpense)}
          detail="Posted Income and Expense accounts"
          className="border-rose-100 bg-rose-50 text-rose-700"
        />
        <InfoCard
          label={
            profitLoss.netProfit >= 0
              ? "Financial-Year Net Profit"
              : "Financial-Year Net Loss"
          }
          value={formatCurrency(Math.abs(profitLoss.netProfit))}
          detail={`Accumulated P&L in Equity: ${formatCurrency(
            toNumber(accumulatedProfitLoss),
          )}`}
          className={
            profitLoss.netProfit >= 0
              ? "border-violet-100 bg-violet-50 text-violet-700"
              : "border-red-100 bg-red-50 text-red-700"
          }
        />
      </section>

      <section className="rounded-3xl border border-violet-100 bg-white p-4 shadow-xl shadow-violet-100/40 sm:p-6">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="relative">
            <span className="absolute left-4 top-3.5 text-violet-400">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search account code, name or group..."
              className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-11 pr-4 text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
            />
          </div>

          <select
            value={sectionFilter}
            onChange={(event) =>
              setSectionFilter(
                event.target.value as "All" | BalanceSheetSection,
              )
            }
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
          >
            <option value="All">All Sections</option>
            <option value="Asset">Assets</option>
            <option value="Liability">Liabilities</option>
            <option value="Equity">Equity</option>
          </select>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <BalanceSection
          title="Assets"
          rows={assetRows}
          groups={groupSummaries.assets}
          total={fullTotals.totalAssets}
          section="Asset"
          isLoading={isLoading}
        />
        <BalanceSection
          title="Liabilities"
          rows={liabilityRows}
          groups={groupSummaries.liabilities}
          total={fullTotals.totalLiabilities}
          section="Liability"
          isLoading={isLoading}
        />
        <BalanceSection
          title="Equity"
          rows={equityRows}
          groups={groupSummaries.equity}
          total={fullTotals.totalEquity}
          section="Equity"
          isLoading={isLoading}
        />
      </section>

      <section
        className={`rounded-3xl border p-5 shadow-xl sm:p-6 ${
          isBalanced
            ? "border-emerald-200 bg-emerald-50 shadow-emerald-100/50"
            : "border-red-200 bg-red-50 shadow-red-100/50"
        }`}
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p
              className={`text-xs font-black uppercase tracking-[0.2em] ${
                isBalanced ? "text-emerald-600" : "text-red-600"
              }`}
            >
              Accounting Equation
            </p>
            <h2
              className={`mt-2 text-2xl font-black ${
                isBalanced ? "text-emerald-950" : "text-red-950"
              }`}
            >
              {isBalanced
                ? "Assets equal Liabilities plus Equity"
                : "Balance Sheet Needs Review"}
            </h2>
            <p
              className={`mt-2 ${
                isBalanced ? "text-emerald-700" : "text-red-700"
              }`}
            >
              Total Assets {formatCurrency(fullTotals.totalAssets)} ·
              Liabilities &amp; Equity{" "}
              {formatCurrency(fullTotals.totalLiabilitiesAndEquity)}
            </p>
          </div>

          <div
            className={`rounded-2xl bg-white px-6 py-4 text-center shadow-sm ${
              isBalanced ? "text-emerald-700" : "text-red-700"
            }`}
          >
            <p className="text-xs font-black uppercase tracking-[0.16em]">
              Difference
            </p>
            <p className="mt-1 text-2xl font-black">
              {formatCurrency(fullTotals.difference)}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className: string;
}) {
  return (
    <article className={`rounded-3xl border p-5 shadow-lg ${className}`}>
      <p className="font-semibold">{label}</p>
      <p className="mt-3 break-words text-3xl font-black">{value}</p>
    </article>
  );
}

function InfoCard({
  label,
  value,
  detail,
  className,
}: {
  label: string;
  value: string;
  detail: string;
  className: string;
}) {
  return (
    <article className={`rounded-2xl border p-5 ${className}`}>
      <p className="font-semibold">{label}</p>
      <p className="mt-2 break-words text-2xl font-black">{value}</p>
      <p className="mt-2 text-sm opacity-80">{detail}</p>
    </article>
  );
}

function BalanceSection({
  title,
  rows,
  groups,
  total,
  section,
  isLoading,
}: {
  title: string;
  rows: BalanceSheetRow[];
  groups: GroupSummary[];
  total: number;
  section: BalanceSheetSection;
  isLoading: boolean;
}) {
  const style = getSectionStyle(section);

  return (
    <article
      className={`min-w-0 overflow-hidden rounded-3xl border bg-white shadow-xl shadow-slate-200/50 ${style.border}`}
    >
      <div className={`border-b px-5 py-5 ${style.header} ${style.border}`}>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-black">{title}</h2>
          <span className={`rounded-full px-3 py-1 text-xs font-black ${style.badge}`}>
            {rows.length} rows
          </span>
        </div>
      </div>

      {isLoading ? (
        <p className="px-5 py-12 text-center text-sm text-slate-500">
          Loading {title.toLowerCase()}...
        </p>
      ) : rows.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-slate-500">
          No {title.toLowerCase()} match the current filters.
        </p>
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((row) => (
            <div
              key={row.row_id}
              className="flex items-start justify-between gap-4 px-5 py-4 transition hover:bg-violet-50/50"
            >
              <div className="min-w-0">
                <p className="truncate font-bold text-slate-900">
                  {row.account_name}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {row.account_code} · {row.account_group}
                </p>
                {toNumber(row.amount) < 0 && (
                  <span className="mt-2 inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
                    Opposite balance
                  </span>
                )}
              </div>

              <p
                className={`shrink-0 text-right font-black ${
                  toNumber(row.amount) < 0 ? "text-red-600" : style.amount
                }`}
              >
                {formatCurrency(toNumber(row.amount))}
              </p>
            </div>
          ))}
        </div>
      )}

      {groups.length > 0 && (
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Group Summary
          </p>
          <div className="mt-3 space-y-2">
            {groups.map((group) => (
              <div
                key={group.groupName}
                className="flex items-center justify-between gap-4 text-sm"
              >
                <span className="text-slate-600">{group.groupName}</span>
                <span className="font-bold text-slate-900">
                  {formatCurrency(group.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={`flex items-center justify-between gap-4 border-t px-5 py-5 ${style.header} ${style.border}`}>
        <span className="font-black">Total {title}</span>
        <span className="text-xl font-black">{formatCurrency(total)}</span>
      </div>
    </article>
  );
}