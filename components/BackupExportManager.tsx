"use client";

import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileArchive,
  FileSpreadsheet,
  HardDriveDownload,
  RefreshCw,
  ShieldCheck,
  Table2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type JsonRecord = Record<string, unknown>;

type DatasetKey =
  | "companies"
  | "ledgers"
  | "products"
  | "sales"
  | "sale_items"
  | "purchases"
  | "purchase_items"
  | "payments"
  | "expenses"
  | "credit_notes"
  | "credit_note_items"
  | "debit_notes"
  | "debit_note_items"
  | "chart_of_accounts"
  | "accounting_vouchers"
  | "accounting_entries"
  | "accounting_period_locks"
  | "audit_logs";

type BackupData = Record<DatasetKey, JsonRecord[]>;

type DatasetDefinition = {
  key: DatasetKey;
  label: string;
  description: string;
  filename: string;
  group: "Master Data" | "Transactions" | "Accounting" | "Security";
};

type ProfileRow = {
  active_company_id: string | null;
};

type QueryError = {
  message?: string;
};

type ManyQueryResult = {
  data: JsonRecord[] | null;
  error: QueryError | null;
};

type SingleQueryResult = {
  data: JsonRecord | null;
  error: QueryError | null;
};

type DynamicQuery = PromiseLike<ManyQueryResult> & {
  eq: (column: string, value: unknown) => DynamicQuery;
  in: (column: string, values: unknown[]) => DynamicQuery;
  range: (from: number, to: number) => DynamicQuery;
  maybeSingle: () => PromiseLike<SingleQueryResult>;
};

type DynamicTableClient = {
  from: (table: string) => {
    select: (columns: string) => DynamicQuery;
  };
};

const PAGE_SIZE = 1000;
const ID_CHUNK_SIZE = 200;
const BACKUP_SCHEMA_VERSION = "1.0.0";

const DATASET_DEFINITIONS: DatasetDefinition[] = [
  {
    key: "companies",
    label: "Company Profile",
    description: "Active company identity and business details.",
    filename: "company",
    group: "Master Data",
  },
  {
    key: "ledgers",
    label: "Ledgers",
    description: "Customer, supplier and other ledger masters.",
    filename: "ledgers",
    group: "Master Data",
  },
  {
    key: "products",
    label: "Products & Inventory",
    description: "Product masters, stock and pricing fields.",
    filename: "products",
    group: "Master Data",
  },
  {
    key: "sales",
    label: "Sales Invoices",
    description: "Sales invoice headers for the active company.",
    filename: "sales",
    group: "Transactions",
  },
  {
    key: "sale_items",
    label: "Sales Invoice Items",
    description: "Item-level sales, HSN and GST snapshots.",
    filename: "sale-items",
    group: "Transactions",
  },
  {
    key: "purchases",
    label: "Purchase Bills",
    description: "Purchase bill headers for the active company.",
    filename: "purchases",
    group: "Transactions",
  },
  {
    key: "purchase_items",
    label: "Purchase Bill Items",
    description: "Item-level purchase, HSN and GST snapshots.",
    filename: "purchase-items",
    group: "Transactions",
  },
  {
    key: "payments",
    label: "Payments",
    description: "Customer receipts and supplier payments.",
    filename: "payments",
    group: "Transactions",
  },
  {
    key: "expenses",
    label: "Expenses",
    description: "Business expense records.",
    filename: "expenses",
    group: "Transactions",
  },
  {
    key: "credit_notes",
    label: "Credit Notes",
    description: "Sales-return and credit-note headers.",
    filename: "credit-notes",
    group: "Transactions",
  },
  {
    key: "credit_note_items",
    label: "Credit Note Items",
    description: "Item-level sales-return records.",
    filename: "credit-note-items",
    group: "Transactions",
  },
  {
    key: "debit_notes",
    label: "Debit Notes",
    description: "Purchase-return and debit-note headers.",
    filename: "debit-notes",
    group: "Transactions",
  },
  {
    key: "debit_note_items",
    label: "Debit Note Items",
    description: "Item-level purchase-return records.",
    filename: "debit-note-items",
    group: "Transactions",
  },
  {
    key: "chart_of_accounts",
    label: "Chart of Accounts",
    description: "System and custom accounting accounts.",
    filename: "chart-of-accounts",
    group: "Accounting",
  },
  {
    key: "accounting_vouchers",
    label: "Accounting Vouchers",
    description: "Posted, draft and void voucher headers.",
    filename: "accounting-vouchers",
    group: "Accounting",
  },
  {
    key: "accounting_entries",
    label: "Accounting Entries",
    description: "Double-entry debit and credit lines.",
    filename: "accounting-entries",
    group: "Accounting",
  },
  {
    key: "accounting_period_locks",
    label: "Accounting Period Locks",
    description: "Financial-year and custom lock history.",
    filename: "accounting-period-locks",
    group: "Accounting",
  },
  {
    key: "audit_logs",
    label: "Audit Logs",
    description: "Protected create, update, delete and restore history.",
    filename: "audit-logs",
    group: "Security",
  },
];

const SENSITIVE_KEYS = new Set([
  "password",
  "password_hash",
  "access_token",
  "refresh_token",
  "service_role_key",
  "anon_key",
  "authorization",
  "cookie",
  "owner_id",
  "user_id",
  "auth_user_id",
]);

function createEmptyBackupData(): BackupData {
  return {
    companies: [],
    ledgers: [],
    products: [],
    sales: [],
    sale_items: [],
    purchases: [],
    purchase_items: [],
    payments: [],
    expenses: [],
    credit_notes: [],
    credit_note_items: [],
    debit_notes: [],
    debit_note_items: [],
    chart_of_accounts: [],
    accounting_vouchers: [],
    accounting_entries: [],
    accounting_period_locks: [],
    audit_logs: [],
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "The requested dataset could not be loaded.";
}

function toSafeFilename(value: string) {
  const normalized = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "Active-Company";
}

function getDateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not generated yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value && typeof value === "object") {
    const sanitized: JsonRecord = {};

    Object.entries(value as JsonRecord).forEach(([key, nestedValue]) => {
      const normalizedKey = key.toLowerCase();

      if (
        SENSITIVE_KEYS.has(normalizedKey) ||
        normalizedKey.includes("password") ||
        normalizedKey.includes("access_token") ||
        normalizedKey.includes("refresh_token") ||
        normalizedKey.includes("secret")
      ) {
        return;
      }

      sanitized[key] = sanitizeValue(nestedValue);
    });

    return sanitized;
  }

  return value;
}

function sanitizeRows(rows: JsonRecord[]) {
  return rows.map((row) => sanitizeValue(row) as JsonRecord);
}

function downloadBlob(content: BlobPart, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function csvCell(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  const text =
    typeof value === "object" ? JSON.stringify(value) : String(value);

  return `"${text.replace(/"/g, '""')}"`;
}

function rowsToCsv(rows: JsonRecord[]) {
  const columns = Array.from(
    new Set(rows.flatMap((row) => Object.keys(row)))
  ).sort();

  if (columns.length === 0) {
    return "\uFEFF";
  }

  const header = columns.map(csvCell).join(",");
  const body = rows.map((row) =>
    columns.map((column) => csvCell(row[column])).join(",")
  );

  return `\uFEFF${[header, ...body].join("\r\n")}`;
}

function chunkValues<T>(values: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

async function fetchAllByCompany(
  database: DynamicTableClient,
  table: string,
  companyId: string
) {
  const rows: JsonRecord[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await database
      .from(table)
      .select("*")
      .eq("company_id", companyId)
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(error.message || `${table} could not be loaded.`);
    }

    const page = data || [];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

async function fetchAllByParentIds(
  database: DynamicTableClient,
  table: string,
  parentColumn: string,
  parentIds: string[]
) {
  if (parentIds.length === 0) {
    return [];
  }

  const rows: JsonRecord[] = [];

  for (const idChunk of chunkValues(parentIds, ID_CHUNK_SIZE)) {
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await database
        .from(table)
        .select("*")
        .in(parentColumn, idChunk)
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        throw new Error(error.message || `${table} could not be loaded.`);
      }

      const page = data || [];
      rows.push(...page);

      if (page.length < PAGE_SIZE) {
        break;
      }
    }
  }

  return rows;
}

function getIds(rows: JsonRecord[]) {
  return rows
    .map((row) => row.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

export default function BackupExportManager() {
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [activeCompanyName, setActiveCompanyName] = useState("");
  const [backupData, setBackupData] = useState<BackupData>(
    createEmptyBackupData
  );
  const [datasetErrors, setDatasetErrors] = useState<
    Partial<Record<DatasetKey, string>>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [progressText, setProgressText] = useState(
    "Preparing backup center..."
  );
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(""), 4500);
  }

  async function loadBackupData() {
    setIsLoading(true);
    setProgressText("Checking signed-in user and active company...");
    setDatasetErrors({});
    setMessage("");

    try {
      const supabase = createClient();
      const database = supabase as unknown as DynamicTableClient;

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Please sign in before exporting company data.");
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
        throw new Error(
          "Select an active company from the Companies page first."
        );
      }

      setActiveCompanyId(companyId);
      setProgressText("Loading active company profile...");

      const companyResponse = await database
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .maybeSingle();

      if (companyResponse.error || !companyResponse.data) {
        throw new Error(
          companyResponse.error?.message ||
            "Active company could not be loaded."
        );
      }

      const companyName =
        typeof companyResponse.data.name === "string"
          ? companyResponse.data.name
          : "Active Company";

      const nextData = createEmptyBackupData();
      const nextErrors: Partial<Record<DatasetKey, string>> = {};

      nextData.companies = sanitizeRows([companyResponse.data]);
      setActiveCompanyName(companyName);

      async function capture(
        key: DatasetKey,
        loader: () => Promise<JsonRecord[]>
      ) {
        try {
          nextData[key] = sanitizeRows(await loader());
        } catch (error) {
          nextData[key] = [];
          nextErrors[key] = getErrorMessage(error);
        }
      }

      setProgressText("Loading master data and transaction headers...");

      await Promise.all([
        capture("ledgers", () =>
          fetchAllByCompany(database, "ledgers", companyId)
        ),
        capture("products", () =>
          fetchAllByCompany(database, "products", companyId)
        ),
        capture("sales", () =>
          fetchAllByCompany(database, "sales", companyId)
        ),
        capture("purchases", () =>
          fetchAllByCompany(database, "purchases", companyId)
        ),
        capture("payments", () =>
          fetchAllByCompany(database, "payments", companyId)
        ),
        capture("expenses", () =>
          fetchAllByCompany(database, "expenses", companyId)
        ),
        capture("credit_notes", () =>
          fetchAllByCompany(database, "credit_notes", companyId)
        ),
        capture("debit_notes", () =>
          fetchAllByCompany(database, "debit_notes", companyId)
        ),
        capture("chart_of_accounts", () =>
          fetchAllByCompany(database, "chart_of_accounts", companyId)
        ),
        capture("accounting_vouchers", () =>
          fetchAllByCompany(database, "accounting_vouchers", companyId)
        ),
        capture("accounting_period_locks", () =>
          fetchAllByCompany(database, "accounting_period_locks", companyId)
        ),
        capture("audit_logs", () =>
          fetchAllByCompany(database, "audit_logs", companyId)
        ),
      ]);

      setProgressText("Loading item rows and accounting entries...");

      await Promise.all([
        capture("sale_items", () =>
          fetchAllByParentIds(
            database,
            "sale_items",
            "sale_id",
            getIds(nextData.sales)
          )
        ),
        capture("purchase_items", () =>
          fetchAllByParentIds(
            database,
            "purchase_items",
            "purchase_id",
            getIds(nextData.purchases)
          )
        ),
        capture("credit_note_items", () =>
          fetchAllByParentIds(
            database,
            "credit_note_items",
            "credit_note_id",
            getIds(nextData.credit_notes)
          )
        ),
        capture("debit_note_items", () =>
          fetchAllByParentIds(
            database,
            "debit_note_items",
            "debit_note_id",
            getIds(nextData.debit_notes)
          )
        ),
        capture("accounting_entries", () =>
          fetchAllByParentIds(
            database,
            "accounting_entries",
            "voucher_id",
            getIds(nextData.accounting_vouchers)
          )
        ),
      ]);

      setProgressText("Preparing secure export manifest...");
      setBackupData(nextData);
      setDatasetErrors(nextErrors);
      setLastLoadedAt(new Date().toISOString());

      const failedCount = Object.keys(nextErrors).length;

      showMessage(
        failedCount === 0
          ? "Backup data loaded successfully."
          : `${failedCount} dataset${
              failedCount === 1 ? "" : "s"
            } could not be loaded. Review the warning section.`
      );
    } catch (error) {
      setActiveCompanyId(null);
      setActiveCompanyName("");
      setBackupData(createEmptyBackupData());
      setDatasetErrors({});
      setLastLoadedAt(null);
      showMessage(getErrorMessage(error));
    } finally {
      setProgressText("");
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadBackupData();

    window.addEventListener(
      "vertexerp-active-company-updated",
      loadBackupData
    );

    return () => {
      window.removeEventListener(
        "vertexerp-active-company-updated",
        loadBackupData
      );
    };
  }, []);

  const statistics = useMemo(() => {
    const counts = DATASET_DEFINITIONS.map((definition) => ({
      ...definition,
      count: backupData[definition.key].length,
      error: datasetErrors[definition.key] || "",
    }));

    const totalRecords = counts.reduce(
      (total, dataset) => total + dataset.count,
      0
    );

    const failedCount = counts.filter((dataset) => dataset.error).length;
    const loadedCount = counts.length - failedCount;
    const largestDataset = [...counts].sort(
      (first, second) => second.count - first.count
    )[0];

    return {
      counts,
      totalRecords,
      failedCount,
      loadedCount,
      largestDataset,
    };
  }, [backupData, datasetErrors]);

  const canDownloadFullBackup =
    Boolean(activeCompanyId) &&
    !isLoading &&
    statistics.failedCount === 0 &&
    statistics.totalRecords > 0;

  function downloadFullBackup() {
    if (!canDownloadFullBackup) {
      showMessage(
        statistics.failedCount > 0
          ? "Resolve dataset errors before downloading a complete backup."
          : "Load active company data before downloading a backup."
      );
      return;
    }

    const recordCounts = Object.fromEntries(
      DATASET_DEFINITIONS.map((definition) => [
        definition.key,
        backupData[definition.key].length,
      ])
    );

    const payload = {
      format: "VertexERP Company Backup",
      schema_version: BACKUP_SCHEMA_VERSION,
      generated_at: new Date().toISOString(),
      application: "VertexERP",
      scope: "ACTIVE_COMPANY_ONLY",
      security: {
        includes_auth_credentials: false,
        includes_passwords: false,
        auth_linked_user_ids_redacted: true,
      },
      company: {
        id: activeCompanyId,
        name: activeCompanyName,
      },
      manifest: {
        dataset_count: DATASET_DEFINITIONS.length,
        total_records: statistics.totalRecords,
        record_counts: recordCounts,
      },
      data: backupData,
    };

    const filename = `VertexERP_${toSafeFilename(
      activeCompanyName
    )}_${getDateStamp()}.json`;

    downloadBlob(
      JSON.stringify(payload, null, 2),
      filename,
      "application/json;charset=utf-8"
    );

    showMessage("Complete JSON backup downloaded successfully.");
  }

  function downloadManifestCsv() {
    const rows: JsonRecord[] = statistics.counts.map((dataset) => ({
      dataset: dataset.label,
      table: dataset.key,
      group: dataset.group,
      records: dataset.count,
      status: dataset.error ? "ERROR" : "READY",
      error: dataset.error,
    }));

    const filename = `VertexERP_${toSafeFilename(
      activeCompanyName
    )}_${getDateStamp()}_manifest.csv`;

    downloadBlob(rowsToCsv(rows), filename, "text/csv;charset=utf-8");
    showMessage("Backup manifest CSV downloaded.");
  }

  function downloadDatasetCsv(definition: DatasetDefinition) {
    const rows = backupData[definition.key];

    if (datasetErrors[definition.key]) {
      showMessage(
        `${definition.label} has a loading error and cannot be exported.`
      );
      return;
    }

    if (rows.length === 0) {
      showMessage(`${definition.label} does not contain any records.`);
      return;
    }

    const filename = `VertexERP_${toSafeFilename(
      activeCompanyName
    )}_${getDateStamp()}_${definition.filename}.csv`;

    downloadBlob(rowsToCsv(rows), filename, "text/csv;charset=utf-8");
    showMessage(`${definition.label} CSV downloaded.`);
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 text-white shadow-xl">
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.2fr_0.8fr] lg:p-8">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-950/50">
              <HardDriveDownload className="h-6 w-6" />
            </div>

            <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">
              Backup &amp; Data Export Center
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
              Create a secure, active-company-only backup of business,
              inventory, GST, payment, accounting and audit data.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={downloadFullBackup}
                disabled={!canDownloadFullBackup}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white shadow-lg transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                <FileArchive className="h-5 w-5" />
                Download Complete JSON
              </button>

              <button
                type="button"
                onClick={loadBackupData}
                disabled={isLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 font-bold text-slate-100 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                <RefreshCw
                  className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`}
                />
                {isLoading ? "Loading Data..." : "Refresh Data"}
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              Active Company
            </p>
            <p className="mt-2 break-words text-xl font-black text-white">
              {isLoading
                ? "Loading company..."
                : activeCompanyName || "No active company selected"}
            </p>

            <div className="mt-5 space-y-3 text-sm">
              <InfoRow label="Schema Version" value={BACKUP_SCHEMA_VERSION} />
              <InfoRow
                label="Last Prepared"
                value={formatDateTime(lastLoadedAt)}
              />
              <InfoRow label="Export Scope" value="Active Company Only" green />
            </div>
          </div>
        </div>
      </section>

      {message && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
          {message}
        </div>
      )}

      {isLoading && (
        <section className="rounded-3xl border border-blue-100 bg-blue-50 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
            <div>
              <p className="font-bold text-blue-900">
                Preparing export data
              </p>
              <p className="mt-1 text-sm text-blue-700">{progressText}</p>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<Database className="h-5 w-5" />}
          label="Total Records"
          value={
            isLoading
              ? "..."
              : statistics.totalRecords.toLocaleString("en-IN")
          }
          detail="Across all export datasets"
        />
        <MetricCard
          icon={<Table2 className="h-5 w-5" />}
          label="Datasets Ready"
          value={
            isLoading
              ? "..."
              : `${statistics.loadedCount}/${DATASET_DEFINITIONS.length}`
          }
          detail="Company-scoped tables loaded"
        />
        <MetricCard
          icon={<FileSpreadsheet className="h-5 w-5" />}
          label="Largest Dataset"
          value={
            isLoading
              ? "..."
              : statistics.largestDataset?.count.toLocaleString("en-IN") ||
                "0"
          }
          detail={statistics.largestDataset?.label || "No records"}
        />
        <MetricCard
          icon={
            statistics.failedCount > 0 ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <CheckCircle2 className="h-5 w-5" />
            )
          }
          label="Data Health"
          value={
            isLoading
              ? "..."
              : statistics.failedCount > 0
                ? `${statistics.failedCount} Error${
                    statistics.failedCount === 1 ? "" : "s"
                  }`
                : "Complete"
          }
          detail={
            statistics.failedCount > 0
              ? "Review failed datasets below"
              : "Full backup is ready"
          }
          warning={statistics.failedCount > 0}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-black text-emerald-950">
                Security Protection
              </h2>
              <p className="mt-2 text-sm leading-6 text-emerald-800">
                Passwords, authentication tokens, secrets and auth-linked user
                IDs are not included. Only data visible to the signed-in user
                for the active company is queried.
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-black text-amber-950">
                Restore Is Intentionally Disabled
              </h2>
              <p className="mt-2 text-sm leading-6 text-amber-800">
                Import and restore will be added separately with duplicate,
                stock, GST and accounting checks plus a dry-run preview.
              </p>
            </div>
          </div>
        </article>
      </section>

      {statistics.failedCount > 0 && (
        <section className="rounded-3xl border border-red-200 bg-red-50 p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-red-600" />
            <div className="min-w-0">
              <h2 className="text-lg font-black text-red-900">
                Dataset Errors
              </h2>
              <p className="mt-1 text-sm text-red-700">
                Complete JSON backup remains disabled until every dataset
                loads.
              </p>

              <div className="mt-4 space-y-3">
                {statistics.counts
                  .filter((dataset) => dataset.error)
                  .map((dataset) => (
                    <div
                      key={dataset.key}
                      className="rounded-xl border border-red-200 bg-white px-4 py-3"
                    >
                      <p className="font-bold text-red-900">
                        {dataset.label}
                      </p>
                      <p className="mt-1 break-words text-sm text-red-700">
                        {dataset.error}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="text-xl font-black text-slate-950 sm:text-2xl">
              Table-wise CSV Export
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Download any dataset separately for review, analysis or
              archival.
            </p>
          </div>

          <button
            type="button"
            onClick={downloadManifestCsv}
            disabled={isLoading || !activeCompanyId}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            <Download className="h-4 w-4" />
            Download Manifest CSV
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {DATASET_DEFINITIONS.map((definition) => {
            const count = backupData[definition.key].length;
            const error = datasetErrors[definition.key];

            return (
              <article
                key={definition.key}
                className="flex flex-col gap-4 px-5 py-5 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between sm:px-6"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-black text-slate-900">
                      {definition.label}
                    </h3>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                      {definition.group}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        error
                          ? "bg-red-100 text-red-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {error ? "Error" : "Ready"}
                    </span>
                  </div>

                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {definition.description}
                  </p>

                  {error && (
                    <p className="mt-2 break-words text-sm font-semibold text-red-600">
                      {error}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <div className="rounded-xl bg-slate-100 px-4 py-2 text-center">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Records
                    </p>
                    <p className="mt-0.5 font-black text-slate-900">
                      {isLoading ? "..." : count.toLocaleString("en-IN")}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => downloadDatasetCsv(definition)}
                    disabled={isLoading || Boolean(error) || count === 0}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Download className="h-4 w-4" />
                    CSV
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function InfoRow({
  label,
  value,
  green = false,
}: {
  label: string;
  value: string;
  green?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-white/[0.05] px-4 py-3">
      <span className="text-slate-400">{label}</span>
      <span
        className={`text-right font-bold ${
          green ? "text-emerald-300" : "text-white"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  warning = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  warning?: boolean;
}) {
  return (
    <article
      className={`rounded-3xl border p-5 shadow-sm ${
        warning
          ? "border-amber-200 bg-amber-50"
          : "border-slate-200 bg-white"
      }`}
    >
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
          warning
            ? "bg-amber-100 text-amber-700"
            : "bg-blue-50 text-blue-700"
        }`}
      >
        {icon}
      </span>
      <p className="mt-4 text-sm font-bold text-slate-600">{label}</p>
      <p className="mt-1 break-words text-2xl font-black text-slate-950">
        {value}
      </p>
      <p className="mt-1 text-sm text-slate-500">{detail}</p>
    </article>
  );
}