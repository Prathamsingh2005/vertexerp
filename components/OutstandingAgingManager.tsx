"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PartyType = "Customer" | "Supplier";

type AgingBucket =
  | "All"
  | "0-30 Days"
  | "31-60 Days"
  | "61-90 Days"
  | "90+ Days";

type ProfileRow = {
  active_company_id: string | null;
};

type CompanyRow = {
  name: string;
};

type AgingRow = {
  row_id: string;
  party_id: string;
  party_name: string;
  party_type: PartyType;
  document_id: string | null;
  document_type: string;
  document_number: string;
  document_date: string;
  original_amount: number | string | null;
  return_adjustment: number | string | null;
  net_document_amount: number | string | null;
  fifo_settled_amount: number | string | null;
  outstanding_amount: number | string | null;
  age_days: number | string;
  aging_bucket: Exclude<AgingBucket, "All">;
  sort_order: number | string;
};

type PartySummary = {
  partyId: string;
  partyName: string;
  documentCount: number;
  oldestAge: number;
  outstanding: number;
  current: number;
  days31To60: number;
  days61To90: number;
  days90Plus: number;
};

const AGING_BUCKETS: Exclude<AgingBucket, "All">[] = [
  "0-30 Days",
  "31-60 Days",
  "61-90 Days",
  "90+ Days",
];

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(amount: number) {
  return `₹${toNumber(amount).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
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

function getBucketStyle(bucket: Exclude<AgingBucket, "All">) {
  if (bucket === "0-30 Days") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (bucket === "31-60 Days") {
    return "bg-amber-100 text-amber-700";
  }

  if (bucket === "61-90 Days") {
    return "bg-orange-100 text-orange-700";
  }

  return "bg-red-100 text-red-700";
}

export default function OutstandingAgingManager() {
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(
    null,
  );
  const [activeCompanyName, setActiveCompanyName] = useState("");

  const [partyType, setPartyType] = useState<PartyType>("Customer");
  const [asOnDate, setAsOnDate] = useState(todayIsoDate());
  const [appliedAsOnDate, setAppliedAsOnDate] = useState(todayIsoDate());

  const [rows, setRows] = useState<AgingRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [bucketFilter, setBucketFilter] = useState<AgingBucket>("All");

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
      throw new Error("Please sign in to view Outstanding Aging.");
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

    setActiveCompanyId(companyId);
    setActiveCompanyName(
      (company as CompanyRow | null)?.name || "Company",
    );

    return companyId;
  }

  async function loadAging(
    companyId: string,
    nextPartyType: PartyType,
    nextAsOnDate: string,
  ) {
    const supabase = createClient();

    const { data, error } = await supabase.rpc("get_outstanding_aging", {
      p_company_id: companyId,
      p_party_type: nextPartyType,
      p_as_on_date: nextAsOnDate,
    });

    if (error) {
      throw error;
    }

    setRows((data || []) as AgingRow[]);
  }

  async function loadInitialData() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const companyId = await resolveActiveCompany();
      await loadAging(companyId, partyType, appliedAsOnDate);
    } catch (error) {
      setActiveCompanyId(null);
      setActiveCompanyName("");
      setRows([]);
      setErrorMessage(
        getErrorMessage(
          error,
          "Outstanding Aging data could not be loaded.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    if (!activeCompanyId) {
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    void loadAging(activeCompanyId, partyType, appliedAsOnDate)
      .catch((error: unknown) => {
        setRows([]);
        setErrorMessage(
          getErrorMessage(
            error,
            "Outstanding Aging data could not be loaded.",
          ),
        );
      })
      .finally(() => setIsLoading(false));
  }, [activeCompanyId, partyType, appliedAsOnDate]);

  useEffect(() => {
    async function handleRefresh() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const companyId = await resolveActiveCompany();
        await loadAging(companyId, partyType, appliedAsOnDate);
      } catch (error) {
        setRows([]);
        setErrorMessage(
          getErrorMessage(
            error,
            "Outstanding Aging data could not be refreshed.",
          ),
        );
      } finally {
        setIsLoading(false);
      }
    }

    const events = [
      "vertexerp-active-company-updated",
      "vertexerp-sales-updated",
      "vertexerp-purchases-updated",
      "vertexerp-payments-updated",
      "vertexerp-gst-data-updated",
      "vertexerp-ledgers-updated",
      "vertexerp-accounting-updated",
    ];

    events.forEach((eventName) => {
      window.addEventListener(eventName, handleRefresh);
    });

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, handleRefresh);
      });
    };
  }, [partyType, appliedAsOnDate]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesBucket =
        bucketFilter === "All" || row.aging_bucket === bucketFilter;

      const matchesSearch =
        !normalizedSearch ||
        [
          row.party_name,
          row.document_number,
          row.document_type,
          row.aging_bucket,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);

      return matchesBucket && matchesSearch;
    });
  }, [rows, searchQuery, bucketFilter]);

  const totals = useMemo(() => {
    const bucketTotals = {
      "0-30 Days": 0,
      "31-60 Days": 0,
      "61-90 Days": 0,
      "90+ Days": 0,
    };

    const partyIds = new Set<string>();

    rows.forEach((row) => {
      bucketTotals[row.aging_bucket] += toNumber(row.outstanding_amount);
      partyIds.add(row.party_id);
    });

    return {
      totalOutstanding: rows.reduce(
        (total, row) => total + toNumber(row.outstanding_amount),
        0,
      ),
      documentCount: rows.length,
      partyCount: partyIds.size,
      bucketTotals,
    };
  }, [rows]);

  const visibleOutstanding = useMemo(
    () =>
      filteredRows.reduce(
        (total, row) => total + toNumber(row.outstanding_amount),
        0,
      ),
    [filteredRows],
  );

  const partySummaries = useMemo<PartySummary[]>(() => {
    const summaryByParty = new Map<string, PartySummary>();

    rows.forEach((row) => {
      const current =
        summaryByParty.get(row.party_id) || {
          partyId: row.party_id,
          partyName: row.party_name,
          documentCount: 0,
          oldestAge: 0,
          outstanding: 0,
          current: 0,
          days31To60: 0,
          days61To90: 0,
          days90Plus: 0,
        };

      const amount = toNumber(row.outstanding_amount);

      current.documentCount += 1;
      current.oldestAge = Math.max(current.oldestAge, toNumber(row.age_days));
      current.outstanding += amount;

      if (row.aging_bucket === "0-30 Days") {
        current.current += amount;
      } else if (row.aging_bucket === "31-60 Days") {
        current.days31To60 += amount;
      } else if (row.aging_bucket === "61-90 Days") {
        current.days61To90 += amount;
      } else {
        current.days90Plus += amount;
      }

      summaryByParty.set(row.party_id, current);
    });

    return Array.from(summaryByParty.values()).sort(
      (first, second) => second.outstanding - first.outstanding,
    );
  }, [rows]);

  function generateReport() {
    if (!asOnDate) {
      showMessage("Please select the As On Date.");
      return;
    }

    setAppliedAsOnDate(asOnDate);
    setSearchQuery("");
    setBucketFilter("All");
    showMessage("Outstanding Aging report generated successfully.");
  }

  function downloadCsv() {
    if (filteredRows.length === 0) {
      showMessage("No aging rows are available to export.");
      return;
    }

    const csvRows: (string | number)[][] = [
      ["Company", activeCompanyName],
      ["Party Type", partyType],
      ["As On Date", appliedAsOnDate],
      ["Allocation Method", "FIFO"],
      ["Age Basis", "Document Date"],
      [],
      [
        "Party",
        "Document Type",
        "Document Number",
        "Document Date",
        "Age Days",
        "Aging Bucket",
        "Original Amount",
        "Return Adjustment",
        "Net Document Amount",
        "FIFO Settled",
        "Outstanding",
      ],
      ...filteredRows.map((row) => [
        row.party_name,
        row.document_type,
        row.document_number,
        row.document_date,
        toNumber(row.age_days),
        row.aging_bucket,
        toNumber(row.original_amount).toFixed(2),
        toNumber(row.return_adjustment).toFixed(2),
        toNumber(row.net_document_amount).toFixed(2),
        toNumber(row.fifo_settled_amount).toFixed(2),
        toNumber(row.outstanding_amount).toFixed(2),
      ]),
      [],
      ["Visible Outstanding", "", "", "", "", "", "", "", "", "", visibleOutstanding.toFixed(2)],
      ["Total Outstanding", "", "", "", "", "", "", "", "", "", totals.totalOutstanding.toFixed(2)],
    ];

    const content = csvRows
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF", content], {
      type: "text/csv;charset=utf-8;",
    });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = downloadUrl;
    anchor.download = `${createSafeFileName(
      activeCompanyName,
    )}-${partyType.toLowerCase()}-outstanding-aging-${appliedAsOnDate}.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(downloadUrl);

    showMessage("Outstanding Aging CSV downloaded successfully.");
  }

  function printReport() {
    if (filteredRows.length === 0) {
      showMessage("No aging rows are available to print.");
      return;
    }

    const printWindow = window.open("", "_blank", "width=1250,height=850");

    if (!printWindow) {
      showMessage("Please allow pop-ups to print the report.");
      return;
    }

    const bodyRows = filteredRows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.party_name)}</td>
            <td>
              <strong>${escapeHtml(row.document_number)}</strong>
              <div class="muted">${escapeHtml(row.document_type)}</div>
            </td>
            <td>${escapeHtml(formatDate(row.document_date))}</td>
            <td class="number">${escapeHtml(toNumber(row.age_days))}</td>
            <td>${escapeHtml(row.aging_bucket)}</td>
            <td class="number">${escapeHtml(
              formatCurrency(toNumber(row.original_amount)),
            )}</td>
            <td class="number">${escapeHtml(
              formatCurrency(toNumber(row.return_adjustment)),
            )}</td>
            <td class="number">${escapeHtml(
              formatCurrency(toNumber(row.fifo_settled_amount)),
            )}</td>
            <td class="number">${escapeHtml(
              formatCurrency(toNumber(row.outstanding_amount)),
            )}</td>
          </tr>
        `,
      )
      .join("");

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(partyType)} Outstanding Aging</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 24px; font-family: Arial, sans-serif; color: #111827; }
            h1 { margin: 0; font-size: 26px; }
            .company { margin-top: 6px; color: #5b21b6; font-size: 18px; font-weight: 700; }
            .meta { margin-top: 5px; color: #475569; }
            .summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-top: 18px; }
            .summary div { border: 1px solid #ddd6fe; border-radius: 9px; padding: 9px; background: #f5f3ff; }
            .summary span { display: block; font-size: 10px; color: #64748b; text-transform: uppercase; }
            .summary strong { display: block; margin-top: 4px; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 10px; }
            th, td { border: 1px solid #cbd5e1; padding: 7px; }
            th { background: #f5f3ff; text-align: left; }
            .number { text-align: right; white-space: nowrap; }
            .muted { margin-top: 3px; color: #64748b; font-size: 9px; }
            tfoot td { background: #f8fafc; font-weight: 800; }
            @page { size: landscape; margin: 9mm; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(partyType)} Outstanding Aging</h1>
          <div class="company">${escapeHtml(activeCompanyName)}</div>
          <div class="meta">
            As on ${escapeHtml(formatDate(appliedAsOnDate))}
            · FIFO allocation · Age from document date
          </div>

          <div class="summary">
            <div><span>Total</span><strong>${escapeHtml(
              formatCurrency(totals.totalOutstanding),
            )}</strong></div>
            ${AGING_BUCKETS.map(
              (bucket) => `
                <div>
                  <span>${escapeHtml(bucket)}</span>
                  <strong>${escapeHtml(
                    formatCurrency(totals.bucketTotals[bucket]),
                  )}</strong>
                </div>
              `,
            ).join("")}
          </div>

          <table>
            <thead>
              <tr>
                <th>Party</th>
                <th>Document</th>
                <th>Date</th>
                <th class="number">Age</th>
                <th>Bucket</th>
                <th class="number">Original</th>
                <th class="number">Returns</th>
                <th class="number">FIFO Settled</th>
                <th class="number">Outstanding</th>
              </tr>
            </thead>
            <tbody>${bodyRows}</tbody>
            <tfoot>
              <tr>
                <td colspan="8">Visible Outstanding</td>
                <td class="number">${escapeHtml(
                  formatCurrency(visibleOutstanding),
                )}</td>
              </tr>
            </tfoot>
          </table>

          <script>
            window.addEventListener("load", () => window.print());
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  }

  const dueLabel =
    partyType === "Customer" ? "Receivable" : "Payable";

  return (
    <div className="min-w-0 space-y-6">
      <section className="overflow-hidden rounded-[30px] bg-gradient-to-br from-violet-950 via-violet-800 to-violet-600 p-6 text-white shadow-2xl shadow-violet-900/20 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-200">
              Credit Control
            </p>
            <h1 className="mt-3 text-3xl font-black sm:text-4xl">
              Outstanding Aging
            </h1>
            <p className="mt-3 max-w-2xl leading-7 text-violet-100">
              Track invoice and bill-wise pending balances across 0–30,
              31–60, 61–90 and 90+ day aging buckets.
            </p>
            <p className="mt-3 font-black text-white">
              {activeCompanyName || "No active company selected"}
            </p>
          </div>

          <div className="rounded-2xl border border-white/15 bg-slate-950/25 px-5 py-4 backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-200">
              Report Basis
            </p>
            <p className="mt-1 text-lg font-black">
              FIFO Settlement
            </p>
            <p className="mt-1 text-sm text-violet-100">
              Age calculated from document date
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_auto]">
          <div>
            <label className="mb-2 block font-bold text-slate-800">
              Party Type
            </label>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1.5">
              {(["Customer", "Supplier"] as PartyType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setPartyType(type);
                    setSearchQuery("");
                    setBucketFilter("All");
                  }}
                  className={`rounded-lg px-4 py-2.5 text-sm font-black transition ${
                    partyType === type
                      ? "bg-violet-600 text-white shadow"
                      : "text-slate-600 hover:bg-white"
                  }`}
                >
                  {type} Aging
                </button>
              ))}
            </div>
          </div>

          <div>
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

          <div className="flex items-end">
            <button
              type="button"
              onClick={generateReport}
              disabled={isLoading || !activeCompanyId}
              className="w-full rounded-xl bg-violet-600 px-6 py-3 font-black text-white shadow-lg transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
            >
              Generate Aging
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href="/payments"
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-sm font-black text-white transition hover:bg-emerald-700"
          >
            Record Payment
          </Link>

          <button
            type="button"
            onClick={downloadCsv}
            disabled={isLoading || filteredRows.length === 0}
            className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-bold text-violet-700 transition hover:bg-violet-100 disabled:opacity-50"
          >
            Download CSV
          </button>

          <button
            type="button"
            onClick={printReport}
            disabled={isLoading || filteredRows.length === 0}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
          >
            Print Report
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label={`Total ${dueLabel}`}
          value={isLoading ? "..." : formatCurrency(totals.totalOutstanding)}
          detail={`${totals.documentCount} pending document${
            totals.documentCount !== 1 ? "s" : ""
          }`}
          className="border-violet-100 bg-violet-50 text-violet-700"
        />
        <SummaryCard
          label={`Pending ${partyType}s`}
          value={isLoading ? "..." : String(totals.partyCount)}
          detail="Parties with a pending balance"
          className="border-blue-100 bg-blue-50 text-blue-700"
        />
        <SummaryCard
          label="Oldest Bucket"
          value={
            isLoading
              ? "..."
              : formatCurrency(totals.bucketTotals["90+ Days"])
          }
          detail="Outstanding older than 90 days"
          className="border-red-100 bg-red-50 text-red-700"
        />
        <SummaryCard
          label="Report Date"
          value={formatDate(appliedAsOnDate)}
          detail="Point-in-time outstanding position"
          className="border-emerald-100 bg-emerald-50 text-emerald-700"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {AGING_BUCKETS.map((bucket) => (
          <button
            key={bucket}
            type="button"
            onClick={() =>
              setBucketFilter(
                bucketFilter === bucket ? "All" : bucket,
              )
            }
            className={`rounded-2xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 ${
              bucketFilter === bucket
                ? "border-violet-400 ring-4 ring-violet-100"
                : "border-slate-200"
            } bg-white`}
          >
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${getBucketStyle(
                bucket,
              )}`}
            >
              {bucket}
            </span>
            <p className="mt-3 text-2xl font-black text-slate-900">
              {formatCurrency(totals.bucketTotals[bucket])}
            </p>
          </button>
        ))}
      </section>

      <section className="rounded-3xl border border-violet-100 bg-white p-4 shadow-xl shadow-violet-100/40 sm:p-6">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_230px]">
          <div className="relative">
            <span className="absolute left-4 top-3.5 text-violet-400">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search party, invoice or bill number..."
              className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-11 pr-4 text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
            />
          </div>

          <select
            value={bucketFilter}
            onChange={(event) =>
              setBucketFilter(event.target.value as AgingBucket)
            }
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
          >
            <option value="All">All Aging Buckets</option>
            {AGING_BUCKETS.map((bucket) => (
              <option key={bucket} value={bucket}>
                {bucket}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="min-w-0 overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-xl shadow-violet-100/40">
        <div className="border-b border-slate-200 px-5 py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900 sm:text-2xl">
                Party Aging Summary
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Party-wise pending balance split across every aging bucket.
              </p>
            </div>
            <span className="w-fit rounded-full bg-violet-100 px-4 py-2 text-sm font-black text-violet-700">
              {partySummaries.length} parties
            </span>
          </div>
        </div>

        <div className="hidden max-w-full overflow-x-auto md:block">
          <table className="w-full min-w-[1120px]">
            <thead className="bg-violet-50/70">
              <tr className="border-b border-slate-200 text-left">
                <TableHeader>Party</TableHeader>
                <TableHeader>Documents</TableHeader>
                <TableHeader>Oldest Age</TableHeader>
                <TableHeader alignRight>0–30</TableHeader>
                <TableHeader alignRight>31–60</TableHeader>
                <TableHeader alignRight>61–90</TableHeader>
                <TableHeader alignRight>90+</TableHeader>
                <TableHeader alignRight>Outstanding</TableHeader>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <EmptyTable colSpan={8} message="Loading party aging..." />
              ) : partySummaries.length === 0 ? (
                <EmptyTable
                  colSpan={8}
                  message={`No ${partyType.toLowerCase()} outstanding balances found.`}
                />
              ) : (
                partySummaries.map((party) => (
                  <tr
                    key={party.partyId}
                    className="border-b border-slate-100 transition hover:bg-violet-50/60"
                  >
                    <td className="px-5 py-5">
                      <p className="font-black text-slate-900">
                        {party.partyName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {partyType} Ledger
                      </p>
                    </td>
                    <td className="px-5 py-5 text-slate-700">
                      {party.documentCount}
                    </td>
                    <td className="px-5 py-5 text-slate-700">
                      {party.oldestAge} days
                    </td>
                    <MoneyCell value={party.current} />
                    <MoneyCell value={party.days31To60} />
                    <MoneyCell value={party.days61To90} />
                    <MoneyCell value={party.days90Plus} danger />
                    <MoneyCell value={party.outstanding} emphasized />
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-4 p-4 md:hidden">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-slate-500">
              Loading party aging...
            </p>
          ) : partySummaries.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              No {partyType.toLowerCase()} outstanding balances found.
            </p>
          ) : (
            partySummaries.map((party) => (
              <article
                key={party.partyId}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-black text-slate-900">
                      {party.partyName}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {party.documentCount} documents · oldest{" "}
                      {party.oldestAge} days
                    </p>
                  </div>
                  <p className="shrink-0 font-black text-violet-700">
                    {formatCurrency(party.outstanding)}
                  </p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <BucketBox label="0–30" value={party.current} />
                  <BucketBox label="31–60" value={party.days31To60} />
                  <BucketBox label="61–90" value={party.days61To90} />
                  <BucketBox label="90+" value={party.days90Plus} danger />
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="min-w-0 overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-xl shadow-violet-100/40">
        <div className="border-b border-slate-200 px-5 py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900 sm:text-2xl">
                Pending Documents
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Source-linked returns are deducted first; party payments are
                then allocated to the oldest documents using FIFO.
              </p>
            </div>
            <span className="w-fit rounded-full bg-violet-100 px-4 py-2 text-sm font-black text-violet-700">
              Visible: {formatCurrency(visibleOutstanding)}
            </span>
          </div>
        </div>

        <div className="space-y-4 p-4 md:hidden">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-slate-500">
              Loading pending documents...
            </p>
          ) : filteredRows.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              No pending documents match the current filters.
            </p>
          ) : (
            filteredRows.map((row) => (
              <article
                key={row.row_id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-black text-slate-900">
                      {row.party_name}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {row.document_number} · {row.document_type}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${getBucketStyle(
                      row.aging_bucket,
                    )}`}
                  >
                    {row.aging_bucket}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <InfoBox
                    label="Document Date"
                    value={formatDate(row.document_date)}
                  />
                  <InfoBox
                    label="Age"
                    value={`${toNumber(row.age_days)} days`}
                  />
                  <InfoBox
                    label="FIFO Settled"
                    value={formatCurrency(
                      toNumber(row.fifo_settled_amount),
                    )}
                  />
                  <InfoBox
                    label="Outstanding"
                    value={formatCurrency(
                      toNumber(row.outstanding_amount),
                    )}
                    emphasized
                  />
                </div>
              </article>
            ))
          )}
        </div>

        <div className="hidden max-w-full overflow-x-auto md:block">
          <table className="w-full min-w-[1300px]">
            <thead className="bg-violet-50/70">
              <tr className="border-b border-slate-200 text-left">
                <TableHeader>Party</TableHeader>
                <TableHeader>Document</TableHeader>
                <TableHeader>Date</TableHeader>
                <TableHeader>Age</TableHeader>
                <TableHeader>Bucket</TableHeader>
                <TableHeader alignRight>Original</TableHeader>
                <TableHeader alignRight>Returns</TableHeader>
                <TableHeader alignRight>FIFO Settled</TableHeader>
                <TableHeader alignRight>Outstanding</TableHeader>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <EmptyTable colSpan={9} message="Loading pending documents..." />
              ) : filteredRows.length === 0 ? (
                <EmptyTable
                  colSpan={9}
                  message="No pending documents match the current filters."
                />
              ) : (
                filteredRows.map((row) => (
                  <tr
                    key={row.row_id}
                    className="border-b border-slate-100 transition hover:bg-violet-50/60"
                  >
                    <td className="px-5 py-5">
                      <p className="font-black text-slate-900">
                        {row.party_name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {row.party_type}
                      </p>
                    </td>
                    <td className="px-5 py-5">
                      <p className="font-bold text-slate-900">
                        {row.document_number}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {row.document_type}
                      </p>
                    </td>
                    <td className="px-5 py-5 text-slate-700">
                      {formatDate(row.document_date)}
                    </td>
                    <td className="px-5 py-5 text-slate-700">
                      {toNumber(row.age_days)} days
                    </td>
                    <td className="px-5 py-5">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${getBucketStyle(
                          row.aging_bucket,
                        )}`}
                      >
                        {row.aging_bucket}
                      </span>
                    </td>
                    <MoneyCell value={toNumber(row.original_amount)} />
                    <MoneyCell value={toNumber(row.return_adjustment)} />
                    <MoneyCell value={toNumber(row.fifo_settled_amount)} />
                    <MoneyCell
                      value={toNumber(row.outstanding_amount)}
                      emphasized
                    />
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-800">
        <strong>Age basis:</strong> your current sales and purchase tables do
        not contain a Due Date field. Therefore, aging is calculated from the
        invoice or bill date. Payments are party-level, so they are allocated
        to the oldest pending documents using FIFO.
      </div>
    </div>
  );
}

function SummaryCard({
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
    <article className={`rounded-3xl border p-5 shadow-lg ${className}`}>
      <p className="font-semibold">{label}</p>
      <p className="mt-3 break-words text-3xl font-black">{value}</p>
      <p className="mt-2 text-sm opacity-80">{detail}</p>
    </article>
  );
}

function TableHeader({
  children,
  alignRight = false,
}: {
  children: React.ReactNode;
  alignRight?: boolean;
}) {
  return (
    <th
      className={`px-5 py-4 text-sm font-black text-slate-700 ${
        alignRight ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function MoneyCell({
  value,
  emphasized = false,
  danger = false,
}: {
  value: number;
  emphasized?: boolean;
  danger?: boolean;
}) {
  return (
    <td
      className={`px-5 py-5 text-right font-bold ${
        emphasized
          ? "text-violet-700"
          : danger
            ? "text-red-600"
            : "text-slate-800"
      }`}
    >
      {value > 0 ? formatCurrency(value) : "—"}
    </td>
  );
}

function EmptyTable({
  colSpan,
  message,
}: {
  colSpan: number;
  message: string;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-6 py-12 text-center text-slate-500"
      >
        {message}
      </td>
    </tr>
  );
}

function BucketBox({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white p-3">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={`mt-1 font-black ${
          danger ? "text-red-600" : "text-slate-900"
        }`}
      >
        {formatCurrency(value)}
      </p>
    </div>
  );
}

function InfoBox({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-3 ${
        emphasized ? "bg-violet-100" : "bg-white"
      }`}
    >
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={`mt-1 font-black ${
          emphasized ? "text-violet-700" : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}