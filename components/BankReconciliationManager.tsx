"use client";

import {
  type ChangeEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";

type ProfileRow = { active_company_id: string | null };
type CompanyRow = { name: string };

type BankAccount = {
  account_id: string;
  account_code: string;
  account_name: string;
  book_balance: number | string | null;
  balance_side: "Dr" | "Cr";
};

type StatementImport = {
  import_id: string;
  file_name: string;
  statement_opening_balance: number | string | null;
  statement_closing_balance: number | string | null;
  transaction_count: number | string;
  period_start: string | null;
  period_end: string | null;
  imported_at: string;
};

type ReconciliationStatus = "MATCHED" | "PARTIAL" | "UNMATCHED";
type Direction = "INFLOW" | "OUTFLOW";

type StatementLine = {
  statement_line_id: string;
  import_id: string;
  transaction_date: string;
  description: string;
  reference_number: string;
  direction: Direction;
  amount: number | string;
  matched_amount: number | string;
  remaining_amount: number | string;
  reconciliation_status: ReconciliationStatus;
  line_number: number;
};

type BookEntry = {
  accounting_entry_id: string;
  voucher_id: string;
  voucher_date: string;
  voucher_number: string;
  voucher_type: string;
  source_type: string;
  source_id: string | null;
  narration: string;
  description: string;
  reference_number: string;
  counterpart_accounts: string;
  direction: Direction;
  amount: number | string;
  matched_amount: number | string;
  remaining_amount: number | string;
  reconciliation_status: ReconciliationStatus;
};

type ReconciliationMatch = {
  match_id: string;
  match_type: "AUTO" | "MANUAL";
  matched_amount: number | string;
  matched_at: string;
  statement_line_id: string;
  statement_date: string;
  statement_description: string;
  statement_reference: string;
  accounting_entry_id: string;
  voucher_date: string;
  voucher_number: string;
  voucher_type: string;
  book_reference: string;
};

type ParsedStatementRow = {
  line_number: number;
  transaction_date: string;
  description: string;
  reference_number: string;
  deposit: number;
  withdrawal: number;
  raw_data: Record<string, string>;
};

type CsvPreview = {
  fileName: string;
  rows: ParsedStatementRow[];
  errors: string[];
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function getIndianFinancialYearStart(asOnDate: string) {
  const [yearText, monthText] = asOnDate.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return `${new Date().getFullYear()}-04-01`;
  }

  return `${month >= 4 ? year : year - 1}-04-01`;
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(amount: number) {
  return `₹${Math.abs(toNumber(amount)).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return fallback;
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (insideQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (character === "," && !insideQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }

  values.push(current.trim());
  return values;
}

function parseAmount(value: string) {
  const cleaned = String(value || "")
    .replace(/[₹,\s]/g, "")
    .replace(/^\((.*)\)$/, "-$1")
    .trim();

  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseStatementDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const iso = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }

  const indian = trimmed.match(
    /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/,
  );

  if (indian) {
    const shortYear = indian[3];
    const year =
      shortYear.length === 2
        ? Number(shortYear) >= 70
          ? `19${shortYear}`
          : `20${shortYear}`
        : shortYear;

    return `${year}-${indian[2].padStart(2, "0")}-${indian[1].padStart(2, "0")}`;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toISOString().slice(0, 10);
}

function findHeaderIndex(headers: string[], candidates: string[]) {
  const normalizedCandidates = candidates.map(normalizeHeader);

  return headers.findIndex((header) =>
    normalizedCandidates.includes(normalizeHeader(header)),
  );
}

function parseBankStatementCsv(fileName: string, content: string): CsvPreview {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return {
      fileName,
      rows: [],
      errors: ["CSV must have a header and at least one transaction."],
    };
  }

  const headers = parseCsvLine(lines[0]);
  const dateIndex = findHeaderIndex(headers, [
    "date",
    "transaction date",
    "txn date",
    "value date",
    "posting date",
  ]);
  const descriptionIndex = findHeaderIndex(headers, [
    "description",
    "narration",
    "particulars",
    "remarks",
    "details",
  ]);
  const referenceIndex = findHeaderIndex(headers, [
    "reference",
    "reference number",
    "ref no",
    "transaction id",
    "utr",
    "cheque number",
    "cheque no",
  ]);
  const depositIndex = findHeaderIndex(headers, [
    "deposit",
    "credit",
    "credit amount",
    "cr",
    "inflow",
  ]);
  const withdrawalIndex = findHeaderIndex(headers, [
    "withdrawal",
    "debit",
    "debit amount",
    "dr",
    "outflow",
  ]);
  const amountIndex = findHeaderIndex(headers, [
    "amount",
    "transaction amount",
  ]);
  const typeIndex = findHeaderIndex(headers, [
    "type",
    "dr cr",
    "debit credit",
    "transaction type",
  ]);

  const errors: string[] = [];

  if (dateIndex < 0) {
    errors.push('Date column not found. Use "Date" or "Transaction Date".');
  }

  if (
    depositIndex < 0 &&
    withdrawalIndex < 0 &&
    amountIndex < 0
  ) {
    errors.push(
      'Amount columns not found. Use "Deposit/Credit" and "Withdrawal/Debit", or signed "Amount".',
    );
  }

  if (errors.length > 0) {
    return { fileName, rows: [], errors };
  }

  const rows: ParsedStatementRow[] = [];

  lines.slice(1).forEach((line, rowIndex) => {
    const cells = parseCsvLine(line);
    const rawData = Object.fromEntries(
      headers.map((header, index) => [header, cells[index] || ""]),
    );

    const transactionDate = parseStatementDate(cells[dateIndex] || "");

    if (!transactionDate) {
      errors.push(`Row ${rowIndex + 2}: invalid date.`);
      return;
    }

    let deposit =
      depositIndex >= 0
        ? Math.abs(parseAmount(cells[depositIndex] || ""))
        : 0;
    let withdrawal =
      withdrawalIndex >= 0
        ? Math.abs(parseAmount(cells[withdrawalIndex] || ""))
        : 0;

    if (deposit <= 0 && withdrawal <= 0 && amountIndex >= 0) {
      const amount = parseAmount(cells[amountIndex] || "");
      const type =
        typeIndex >= 0
          ? normalizeHeader(cells[typeIndex] || "")
          : "";

      if (
        type.includes("debit") ||
        type === "dr" ||
        type.includes("withdraw")
      ) {
        withdrawal = Math.abs(amount);
      } else if (
        type.includes("credit") ||
        type === "cr" ||
        type.includes("deposit")
      ) {
        deposit = Math.abs(amount);
      } else if (amount < 0) {
        withdrawal = Math.abs(amount);
      } else {
        deposit = Math.abs(amount);
      }
    }

    if (deposit > 0 && withdrawal > 0) {
      errors.push(
        `Row ${rowIndex + 2}: both deposit and withdrawal are filled.`,
      );
      return;
    }

    if (deposit <= 0 && withdrawal <= 0) {
      errors.push(`Row ${rowIndex + 2}: amount is missing or zero.`);
      return;
    }

    rows.push({
      line_number: rowIndex + 1,
      transaction_date: transactionDate,
      description:
        descriptionIndex >= 0 ? cells[descriptionIndex] || "" : "",
      reference_number:
        referenceIndex >= 0 ? cells[referenceIndex] || "" : "",
      deposit,
      withdrawal,
      raw_data: rawData,
    });
  });

  return { fileName, rows, errors };
}

function statusClasses(status: ReconciliationStatus) {
  if (status === "MATCHED") return "bg-emerald-100 text-emerald-700";
  if (status === "PARTIAL") return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function escapeCsvValue(value: string | number) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export default function BankReconciliationManager() {
  const initialToDate = todayIsoDate();
  const initialFromDate = getIndianFinancialYearStart(initialToDate);

  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [activeCompanyName, setActiveCompanyName] = useState("");
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");

  const [fromDate, setFromDate] = useState(initialFromDate);
  const [toDate, setToDate] = useState(initialToDate);
  const [appliedFromDate, setAppliedFromDate] = useState(initialFromDate);
  const [appliedToDate, setAppliedToDate] = useState(initialToDate);

  const [imports, setImports] = useState<StatementImport[]>([]);
  const [selectedImportId, setSelectedImportId] = useState("");
  const [statementRows, setStatementRows] = useState<StatementLine[]>([]);
  const [bookRows, setBookRows] = useState<BookEntry[]>([]);
  const [matches, setMatches] = useState<ReconciliationMatch[]>([]);

  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null);
  const [openingBalance, setOpeningBalance] = useState("");
  const [closingBalance, setClosingBalance] = useState("");

  const [selectedStatementId, setSelectedStatementId] = useState("");
  const [selectedBookId, setSelectedBookId] = useState("");
  const [matchAmount, setMatchAmount] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | ReconciliationStatus
  >("ALL");

  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(""), 4500);
  }

  async function resolveActiveCompany() {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("Please sign in to use Bank Reconciliation.");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("active_company_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    const companyId =
      (profile as ProfileRow | null)?.active_company_id || null;

    if (!companyId) {
      throw new Error("Select an active company first.");
    }

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .maybeSingle();

    if (companyError) throw companyError;

    setActiveCompanyId(companyId);
    setActiveCompanyName(
      (company as CompanyRow | null)?.name || "Company",
    );

    return companyId;
  }

  async function loadAccounts(companyId: string, reportDate: string) {
    const supabase = createClient();
    const { data, error } = await supabase.rpc(
      "get_bank_reconciliation_accounts",
      {
        p_company_id: companyId,
        p_as_on_date: reportDate,
      },
    );

    if (error) throw error;

    const nextAccounts = (data || []) as BankAccount[];
    setAccounts(nextAccounts);

    const nextAccountId =
      nextAccounts.find(
        (account) => account.account_id === selectedAccountId,
      )?.account_id ||
      nextAccounts[0]?.account_id ||
      "";

    setSelectedAccountId(nextAccountId);
    return nextAccountId;
  }

  async function loadData(
    companyId: string,
    accountId: string,
    reportFromDate: string,
    reportToDate: string,
    importId: string,
  ) {
    if (!accountId) {
      setImports([]);
      setStatementRows([]);
      setBookRows([]);
      setMatches([]);
      return;
    }

    const supabase = createClient();
    const [importsResult, statementResult, bookResult, matchesResult] =
      await Promise.all([
        supabase.rpc("get_bank_statement_imports", {
          p_company_id: companyId,
          p_bank_account_id: accountId,
        }),
        supabase.rpc("get_bank_statement_lines", {
          p_company_id: companyId,
          p_bank_account_id: accountId,
          p_from_date: reportFromDate,
          p_to_date: reportToDate,
          p_import_id: importId || null,
        }),
        supabase.rpc("get_bank_book_reconciliation_entries", {
          p_company_id: companyId,
          p_bank_account_id: accountId,
          p_from_date: reportFromDate,
          p_to_date: reportToDate,
        }),
        supabase.rpc("get_bank_reconciliation_matches", {
          p_company_id: companyId,
          p_bank_account_id: accountId,
          p_from_date: reportFromDate,
          p_to_date: reportToDate,
        }),
      ]);

    if (importsResult.error) throw importsResult.error;
    if (statementResult.error) throw statementResult.error;
    if (bookResult.error) throw bookResult.error;
    if (matchesResult.error) throw matchesResult.error;

    setImports((importsResult.data || []) as StatementImport[]);
    setStatementRows((statementResult.data || []) as StatementLine[]);
    setBookRows((bookResult.data || []) as BookEntry[]);
    setMatches((matchesResult.data || []) as ReconciliationMatch[]);
  }

  async function refresh(importId = selectedImportId) {
    if (!activeCompanyId || !selectedAccountId) return;

    await loadAccounts(activeCompanyId, appliedToDate);
    await loadData(
      activeCompanyId,
      selectedAccountId,
      appliedFromDate,
      appliedToDate,
      importId,
    );
  }

  useEffect(() => {
    async function start() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const companyId = await resolveActiveCompany();
        const accountId = await loadAccounts(companyId, appliedToDate);
        await loadData(
          companyId,
          accountId,
          appliedFromDate,
          appliedToDate,
          "",
        );
      } catch (error) {
        setErrorMessage(
          getErrorMessage(
            error,
            "Bank Reconciliation data could not be loaded.",
          ),
        );
      } finally {
        setIsLoading(false);
      }
    }

    void start();
  }, []);

  useEffect(() => {
    if (!activeCompanyId || !selectedAccountId) return;

    setIsLoading(true);
    setErrorMessage("");

    void loadData(
      activeCompanyId,
      selectedAccountId,
      appliedFromDate,
      appliedToDate,
      selectedImportId,
    )
      .catch((error: unknown) => {
        setErrorMessage(
          getErrorMessage(error, "Reconciliation data could not be refreshed."),
        );
      })
      .finally(() => setIsLoading(false));
  }, [
    activeCompanyId,
    selectedAccountId,
    appliedFromDate,
    appliedToDate,
    selectedImportId,
  ]);

  const selectedAccount = useMemo(
    () =>
      accounts.find(
        (account) => account.account_id === selectedAccountId,
      ) || null,
    [accounts, selectedAccountId],
  );

  const selectedImport = useMemo(
    () =>
      imports.find(
        (statementImport) =>
          statementImport.import_id === selectedImportId,
      ) || null,
    [imports, selectedImportId],
  );

  const selectedStatement = useMemo(
    () =>
      statementRows.find(
        (row) => row.statement_line_id === selectedStatementId,
      ) || null,
    [statementRows, selectedStatementId],
  );

  const selectedBook = useMemo(
    () =>
      bookRows.find(
        (row) => row.accounting_entry_id === selectedBookId,
      ) || null,
    [bookRows, selectedBookId],
  );

  useEffect(() => {
    if (
      !selectedStatement ||
      !selectedBook ||
      selectedStatement.direction !== selectedBook.direction
    ) {
      setMatchAmount("");
      return;
    }

    setMatchAmount(
      String(
        Math.min(
          toNumber(selectedStatement.remaining_amount),
          toNumber(selectedBook.remaining_amount),
        ),
      ),
    );
  }, [selectedStatement, selectedBook]);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredStatements = statementRows.filter((row) => {
    const statusMatch =
      statusFilter === "ALL" ||
      row.reconciliation_status === statusFilter;
    const searchMatch =
      !normalizedSearch ||
      [
        row.transaction_date,
        row.description,
        row.reference_number,
        row.direction,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);

    return statusMatch && searchMatch;
  });

  const filteredBooks = bookRows.filter((row) => {
    const statusMatch =
      statusFilter === "ALL" ||
      row.reconciliation_status === statusFilter;
    const searchMatch =
      !normalizedSearch ||
      [
        row.voucher_number,
        row.voucher_type,
        row.reference_number,
        row.narration,
        row.description,
        row.counterpart_accounts,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);

    return statusMatch && searchMatch;
  });

  const summary = useMemo(
    () => ({
      matched: matches.reduce(
        (total, row) => total + toNumber(row.matched_amount),
        0,
      ),
      statementRemaining: statementRows.reduce(
        (total, row) => total + toNumber(row.remaining_amount),
        0,
      ),
      bookRemaining: bookRows.reduce(
        (total, row) => total + toNumber(row.remaining_amount),
        0,
      ),
    }),
    [matches, statementRows, bookRows],
  );

  const signedBookBalance = selectedAccount
    ? selectedAccount.balance_side === "Cr"
      ? -toNumber(selectedAccount.book_balance)
      : toNumber(selectedAccount.book_balance)
    : 0;

  const balanceDifference =
    selectedImport &&
    selectedImport.statement_closing_balance !== null
      ? signedBookBalance -
        toNumber(selectedImport.statement_closing_balance)
      : null;

  async function handleCsvFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return setCsvPreview(null);

    try {
      setCsvPreview(parseBankStatementCsv(file.name, await file.text()));
    } catch {
      setCsvPreview({
        fileName: file.name,
        rows: [],
        errors: ["The selected CSV file could not be read."],
      });
    }
  }

  async function importStatement() {
    if (!activeCompanyId || !selectedAccountId || !csvPreview) {
      return showMessage("Select a Bank Account and CSV file first.");
    }

    if (csvPreview.errors.length > 0 || csvPreview.rows.length === 0) {
      return showMessage("Resolve the CSV errors before importing.");
    }

    setIsImporting(true);
    setErrorMessage("");

    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("import_bank_statement", {
        p_company_id: activeCompanyId,
        p_bank_account_id: selectedAccountId,
        p_file_name: csvPreview.fileName,
        p_statement_opening_balance:
          openingBalance.trim() === "" ? null : toNumber(openingBalance),
        p_statement_closing_balance:
          closingBalance.trim() === "" ? null : toNumber(closingBalance),
        p_rows: csvPreview.rows,
      });

      if (error) throw error;

      const importId = String(data || "");
      setSelectedImportId(importId);
      setCsvPreview(null);
      setOpeningBalance("");
      setClosingBalance("");
      await loadData(
        activeCompanyId,
        selectedAccountId,
        appliedFromDate,
        appliedToDate,
        importId,
      );
      showMessage(
        `${csvPreview.rows.length} bank statement rows imported.`,
      );
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, "Bank statement could not be imported."),
      );
    } finally {
      setIsImporting(false);
    }
  }

  async function autoMatch() {
    if (!activeCompanyId || !selectedAccountId) return;

    setIsMatching(true);
    setErrorMessage("");

    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc(
        "auto_match_bank_reconciliation",
        {
          p_company_id: activeCompanyId,
          p_bank_account_id: selectedAccountId,
          p_from_date: appliedFromDate,
          p_to_date: appliedToDate,
          p_date_tolerance: 3,
        },
      );

      if (error) throw error;

      await refresh();
      showMessage(`${toNumber(data)} exact transaction matches created.`);
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, "Automatic matching could not be completed."),
      );
    } finally {
      setIsMatching(false);
    }
  }

  async function manualMatch() {
    if (!activeCompanyId || !selectedStatement || !selectedBook) {
      return showMessage("Select one Statement row and one Bank Book row.");
    }

    if (selectedStatement.direction !== selectedBook.direction) {
      return showMessage(
        "Inflow can only match inflow, and outflow can only match outflow.",
      );
    }

    const amount = toNumber(matchAmount);
    if (amount <= 0) return showMessage("Enter a valid match amount.");

    setIsMatching(true);
    setErrorMessage("");

    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("match_bank_reconciliation", {
        p_company_id: activeCompanyId,
        p_statement_line_id: selectedStatement.statement_line_id,
        p_accounting_entry_id: selectedBook.accounting_entry_id,
        p_amount: amount,
      });

      if (error) throw error;

      setSelectedStatementId("");
      setSelectedBookId("");
      setMatchAmount("");
      await refresh();
      showMessage("Transactions matched successfully.");
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, "Transactions could not be matched."),
      );
    } finally {
      setIsMatching(false);
    }
  }

  async function unmatch(matchId: string) {
    if (!activeCompanyId) return;

    setIsMatching(true);
    setErrorMessage("");

    try {
      const supabase = createClient();
      const { error } = await supabase.rpc(
        "unmatch_bank_reconciliation",
        {
          p_company_id: activeCompanyId,
          p_match_id: matchId,
        },
      );

      if (error) throw error;

      await refresh();
      showMessage("Reconciliation match removed.");
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, "Match could not be removed."),
      );
    } finally {
      setIsMatching(false);
    }
  }

  async function deleteImport(importId: string) {
    if (!activeCompanyId) return;

    const confirmed = window.confirm(
      "Delete this imported statement and its matches?",
    );

    if (!confirmed) return;

    setIsImporting(true);
    setErrorMessage("");

    try {
      const supabase = createClient();
      const { error } = await supabase.rpc(
        "delete_bank_statement_import",
        {
          p_company_id: activeCompanyId,
          p_import_id: importId,
        },
      );

      if (error) throw error;

      setSelectedImportId("");
      await loadData(
        activeCompanyId,
        selectedAccountId,
        appliedFromDate,
        appliedToDate,
        "",
      );
      showMessage("Imported statement deleted.");
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, "Imported statement could not be deleted."),
      );
    } finally {
      setIsImporting(false);
    }
  }

  function downloadCsv() {
    const csvRows: (string | number)[][] = [
      ["Company", activeCompanyName],
      [
        "Bank Account",
        selectedAccount
          ? `${selectedAccount.account_code} - ${selectedAccount.account_name}`
          : "",
      ],
      ["Period", `${appliedFromDate} to ${appliedToDate}`],
      [],
      [
        "Source",
        "Date",
        "Reference",
        "Description",
        "Direction",
        "Amount",
        "Matched",
        "Remaining",
        "Status",
      ],
      ...statementRows.map((row) => [
        "BANK STATEMENT",
        row.transaction_date,
        row.reference_number,
        row.description,
        row.direction,
        toNumber(row.amount).toFixed(2),
        toNumber(row.matched_amount).toFixed(2),
        toNumber(row.remaining_amount).toFixed(2),
        row.reconciliation_status,
      ]),
      ...bookRows.map((row) => [
        "ERP BANK BOOK",
        row.voucher_date,
        row.reference_number,
        `${row.voucher_number} - ${row.counterpart_accounts}`,
        row.direction,
        toNumber(row.amount).toFixed(2),
        toNumber(row.matched_amount).toFixed(2),
        toNumber(row.remaining_amount).toFixed(2),
        row.reconciliation_status,
      ]),
    ];

    const blob = new Blob(
      [
        "\uFEFF",
        csvRows
          .map((row) => row.map(escapeCsvValue).join(","))
          .join("\n"),
      ],
      { type: "text/csv;charset=utf-8;" },
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `bank-reconciliation-${appliedFromDate}-to-${appliedToDate}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-w-0 space-y-6">
      <section className="overflow-hidden rounded-[30px] bg-gradient-to-br from-violet-950 via-violet-800 to-violet-600 p-6 text-white shadow-2xl shadow-violet-900/20 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-200">
              Accounting Control
            </p>
            <h1 className="mt-3 text-3xl font-black sm:text-4xl">
              Bank Reconciliation
            </h1>
            <p className="mt-3 max-w-2xl leading-7 text-violet-100">
              Import statements, auto-match exact transactions and manually
              reconcile remaining Bank Book entries.
            </p>
            <p className="mt-3 font-black">
              {activeCompanyName || "No active company selected"}
            </p>
          </div>

          <div className="rounded-2xl border border-white/15 bg-slate-950/25 px-5 py-4 backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-200">
              Bank Book Balance
            </p>
            <p className="mt-1 text-2xl font-black">
              {selectedAccount
                ? `${formatCurrency(
                    toNumber(selectedAccount.book_balance),
                  )} ${selectedAccount.balance_side}`
                : "—"}
            </p>
            <p className="mt-1 text-sm text-violet-100">
              As on {formatDate(appliedToDate)}
            </p>
          </div>
        </div>
      </section>

      {errorMessage && (
        <Alert className="border-red-200 bg-red-50 text-red-700">
          {errorMessage}
        </Alert>
      )}

      {message && (
        <Alert className="border-violet-200 bg-violet-50 text-violet-800">
          {message}
        </Alert>
      )}

      <Panel>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <Field label="Bank Account">
            <select
              value={selectedAccountId}
              onChange={(event) => {
                setSelectedAccountId(event.target.value);
                setSelectedImportId("");
              }}
              className="input"
            >
              {accounts.length === 0 ? (
                <option value="">No Bank Account available</option>
              ) : (
                accounts.map((account) => (
                  <option key={account.account_id} value={account.account_id}>
                    {account.account_code} — {account.account_name}
                  </option>
                ))
              )}
            </select>
          </Field>

          <Field label="From Date">
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="input"
            />
          </Field>

          <Field label="To Date">
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="input"
            />
          </Field>

          <div className="flex items-end">
            <button
              type="button"
              disabled={isLoading || !selectedAccountId}
              onClick={() => {
                if (!fromDate || !toDate || fromDate > toDate) {
                  showMessage("Select a valid date range.");
                  return;
                }

                setAppliedFromDate(fromDate);
                setAppliedToDate(toDate);
              }}
              className="primary-button w-full"
            >
              Generate Reconciliation
            </button>
          </div>
        </div>
      </Panel>

      <Panel>
        <h2 className="text-xl font-black text-slate-900">
          Import Bank Statement CSV
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Use Date, Description, Reference, Deposit/Credit and
          Withdrawal/Debit columns. Signed Amount is also supported.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Field label="CSV File">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => void handleCsvFile(event)}
              className="w-full rounded-xl border border-dashed border-violet-300 bg-violet-50 px-4 py-3 text-sm"
            />
          </Field>

          <Field label="Statement Opening Balance">
            <input
              type="number"
              step="0.01"
              value={openingBalance}
              onChange={(event) => setOpeningBalance(event.target.value)}
              placeholder="Optional"
              className="input"
            />
          </Field>

          <Field label="Statement Closing Balance">
            <input
              type="number"
              step="0.01"
              value={closingBalance}
              onChange={(event) => setClosingBalance(event.target.value)}
              placeholder="Optional but recommended"
              className="input"
            />
          </Field>
        </div>

        {csvPreview && (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="font-black">{csvPreview.fileName}</p>
            <p className="mt-1 text-sm text-slate-600">
              Valid rows: {csvPreview.rows.length}
            </p>

            {csvPreview.errors.length > 0 && (
              <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">
                {csvPreview.errors.slice(0, 10).map((error) => (
                  <p key={error}>{error}</p>
                ))}
              </div>
            )}

            {csvPreview.rows.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left">
                      <th className="p-2">Date</th>
                      <th className="p-2">Description</th>
                      <th className="p-2">Reference</th>
                      <th className="p-2 text-right">Deposit</th>
                      <th className="p-2 text-right">Withdrawal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.rows.slice(0, 5).map((row) => (
                      <tr
                        key={row.line_number}
                        className="border-b border-slate-100"
                      >
                        <td className="p-2">
                          {formatDate(row.transaction_date)}
                        </td>
                        <td className="p-2">{row.description || "—"}</td>
                        <td className="p-2">
                          {row.reference_number || "—"}
                        </td>
                        <td className="p-2 text-right text-emerald-700">
                          {row.deposit
                            ? formatCurrency(row.deposit)
                            : "—"}
                        </td>
                        <td className="p-2 text-right text-red-700">
                          {row.withdrawal
                            ? formatCurrency(row.withdrawal)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <button
              type="button"
              onClick={() => void importStatement()}
              disabled={
                isImporting ||
                csvPreview.errors.length > 0 ||
                csvPreview.rows.length === 0
              }
              className="primary-button mt-4"
            >
              {isImporting ? "Importing..." : "Import Statement"}
            </button>
          </div>
        )}
      </Panel>

      <Panel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <Field label="Imported Statement" className="min-w-0 flex-1">
            <select
              value={selectedImportId}
              onChange={(event) => setSelectedImportId(event.target.value)}
              className="input"
            >
              <option value="">All imported statements</option>
              {imports.map((statementImport) => (
                <option
                  key={statementImport.import_id}
                  value={statementImport.import_id}
                >
                  {statementImport.file_name} ·{" "}
                  {formatDate(statementImport.period_start)} to{" "}
                  {formatDate(statementImport.period_end)}
                </option>
              ))}
            </select>
          </Field>

          <div className="flex flex-col gap-3 sm:flex-row">
            {selectedImport && (
              <button
                type="button"
                onClick={() => void deleteImport(selectedImport.import_id)}
                disabled={isImporting}
                className="danger-button"
              >
                Delete Import
              </button>
            )}

            <button
              type="button"
              onClick={() => void autoMatch()}
              disabled={
                isMatching ||
                statementRows.length === 0 ||
                bookRows.length === 0
              }
              className="success-button"
            >
              {isMatching ? "Matching..." : "Auto-Match Exact"}
            </button>

            <button
              type="button"
              onClick={downloadCsv}
              disabled={
                statementRows.length === 0 && bookRows.length === 0
              }
              className="secondary-button"
            >
              Download CSV
            </button>
          </div>
        </div>
      </Panel>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Matched Amount"
          value={formatCurrency(summary.matched)}
          className="border-emerald-100 bg-emerald-50 text-emerald-700"
        />
        <SummaryCard
          label="Unmatched Statement"
          value={formatCurrency(summary.statementRemaining)}
          className="border-red-100 bg-red-50 text-red-700"
        />
        <SummaryCard
          label="Unmatched Bank Book"
          value={formatCurrency(summary.bookRemaining)}
          className="border-amber-100 bg-amber-50 text-amber-700"
        />
        <SummaryCard
          label="Book vs Statement"
          value={
            balanceDifference === null
              ? "Enter closing balance"
              : formatCurrency(balanceDifference)
          }
          className={
            balanceDifference !== null &&
            Math.abs(balanceDifference) <= 0.005
              ? "border-emerald-100 bg-emerald-50 text-emerald-700"
              : "border-violet-100 bg-violet-50 text-violet-700"
          }
        />
      </section>

      <Panel>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search reference, voucher or description..."
            className="input"
          />

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as "ALL" | ReconciliationStatus,
              )
            }
            className="input"
          >
            <option value="ALL">All Statuses</option>
            <option value="UNMATCHED">Unmatched</option>
            <option value="PARTIAL">Partially Matched</option>
            <option value="MATCHED">Matched</option>
          </select>
        </div>
      </Panel>

      <Panel>
        <h2 className="text-xl font-black text-slate-900">
          Manual Match
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Select one compatible row from each table.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SelectionBox
            label="Statement Selection"
            value={
              selectedStatement
                ? `${formatDate(
                    selectedStatement.transaction_date,
                  )} · ${formatCurrency(
                    toNumber(selectedStatement.remaining_amount),
                  )} · ${selectedStatement.direction}`
                : "Not selected"
            }
          />

          <SelectionBox
            label="Bank Book Selection"
            value={
              selectedBook
                ? `${selectedBook.voucher_number} · ${formatCurrency(
                    toNumber(selectedBook.remaining_amount),
                  )} · ${selectedBook.direction}`
                : "Not selected"
            }
          />

          <Field label="Match Amount">
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                value={matchAmount}
                onChange={(event) => setMatchAmount(event.target.value)}
                className="input min-w-0 flex-1"
              />
              <button
                type="button"
                onClick={() => void manualMatch()}
                disabled={
                  isMatching || !selectedStatement || !selectedBook
                }
                className="primary-button"
              >
                Match
              </button>
            </div>
          </Field>
        </div>
      </Panel>

      <TransactionTable
        title="Imported Bank Statement"
        rows={filteredStatements}
        type="statement"
        selectedId={selectedStatementId}
        onSelect={setSelectedStatementId}
      />

      <TransactionTable
        title="ERP Bank Book"
        rows={filteredBooks}
        type="book"
        selectedId={selectedBookId}
        onSelect={setSelectedBookId}
      />

      <section className="overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-xl shadow-violet-100/40">
        <div className="border-b border-slate-200 px-5 py-5">
          <h2 className="text-xl font-black text-slate-900">
            Matched Transactions
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead className="bg-violet-50">
              <tr>
                <TableHeader>Statement</TableHeader>
                <TableHeader>Bank Book</TableHeader>
                <TableHeader>Type</TableHeader>
                <TableHeader alignRight>Amount</TableHeader>
                <TableHeader alignRight>Action</TableHeader>
              </tr>
            </thead>
            <tbody>
              {matches.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    No matches created yet.
                  </td>
                </tr>
              ) : (
                matches.map((match) => (
                  <tr
                    key={match.match_id}
                    className="border-b border-slate-100"
                  >
                    <td className="px-5 py-5">
                      <p className="font-black">
                        {formatDate(match.statement_date)}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {match.statement_reference ||
                          match.statement_description}
                      </p>
                    </td>
                    <td className="px-5 py-5">
                      <p className="font-black">{match.voucher_number}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {formatDate(match.voucher_date)} ·{" "}
                        {match.book_reference}
                      </p>
                    </td>
                    <td className="px-5 py-5">
                      <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700">
                        {match.match_type}
                      </span>
                    </td>
                    <td className="px-5 py-5 text-right font-black text-emerald-700">
                      {formatCurrency(toNumber(match.matched_amount))}
                    </td>
                    <td className="px-5 py-5 text-right">
                      <button
                        type="button"
                        onClick={() => void unmatch(match.match_id)}
                        disabled={isMatching}
                        className="danger-button"
                      >
                        Unmatch
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgb(203 213 225);
          background: rgb(248 250 252);
          padding: 0.75rem 1rem;
          color: rgb(15 23 42);
          outline: none;
        }
        .input:focus {
          border-color: rgb(139 92 246);
          box-shadow: 0 0 0 4px rgb(237 233 254);
        }
        .primary-button,
        .secondary-button,
        .success-button,
        .danger-button {
          border-radius: 0.75rem;
          padding: 0.75rem 1.25rem;
          font-weight: 900;
          transition: 150ms;
        }
        .primary-button {
          background: rgb(124 58 237);
          color: white;
        }
        .secondary-button {
          border: 1px solid rgb(221 214 254);
          background: rgb(245 243 255);
          color: rgb(109 40 217);
        }
        .success-button {
          background: rgb(5 150 105);
          color: white;
        }
        .danger-button {
          border: 1px solid rgb(254 202 202);
          background: rgb(254 242 242);
          color: rgb(185 28 28);
        }
        button:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }
      `}</style>
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-violet-100 bg-white p-4 shadow-xl shadow-violet-100/40 sm:p-6">
      {children}
    </section>
  );
}

function Alert({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <div className={`rounded-2xl border px-5 py-4 font-semibold ${className}`}>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-2 block font-bold text-slate-800">
        {label}
      </label>
      {children}
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
      <p className="mt-3 break-words text-2xl font-black">{value}</p>
    </article>
  );
}

function SelectionBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 font-bold text-slate-900">{value}</p>
    </div>
  );
}

function TableHeader({
  children,
  alignRight = false,
}: {
  children: ReactNode;
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

function TransactionTable({
  title,
  rows,
  type,
  selectedId,
  onSelect,
}: {
  title: string;
  rows: StatementLine[] | BookEntry[];
  type: "statement" | "book";
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-xl shadow-violet-100/40">
      <div className="border-b border-slate-200 px-5 py-5">
        <h2 className="text-xl font-black text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">
          {type === "statement"
            ? "Credit/Deposit is inflow; Debit/Withdrawal is outflow."
            : "Bank Account debit is inflow; Bank Account credit is outflow."}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1150px]">
          <thead className="bg-violet-50">
            <tr>
              <TableHeader>Date</TableHeader>
              <TableHeader>Reference</TableHeader>
              <TableHeader>Description</TableHeader>
              <TableHeader>Direction</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader alignRight>Amount</TableHeader>
              <TableHeader alignRight>Remaining</TableHeader>
              <TableHeader alignRight>Select</TableHeader>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-6 py-12 text-center text-slate-500"
                >
                  No rows match the selected filters.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const statement =
                  type === "statement" ? (row as StatementLine) : null;
                const book =
                  type === "book" ? (row as BookEntry) : null;

                const id = statement
                  ? statement.statement_line_id
                  : (book as BookEntry).accounting_entry_id;
                const date = statement
                  ? statement.transaction_date
                  : (book as BookEntry).voucher_date;
                const reference = statement
                  ? statement.reference_number
                  : (book as BookEntry).reference_number;
                const description = statement
                  ? statement.description
                  : `${(book as BookEntry).voucher_number} · ${
                      (book as BookEntry).counterpart_accounts
                    }`;
                const direction = statement
                  ? statement.direction
                  : (book as BookEntry).direction;
                const status = statement
                  ? statement.reconciliation_status
                  : (book as BookEntry).reconciliation_status;
                const amount = statement
                  ? statement.amount
                  : (book as BookEntry).amount;
                const remaining = statement
                  ? statement.remaining_amount
                  : (book as BookEntry).remaining_amount;
                const selected = selectedId === id;

                return (
                  <tr
                    key={id}
                    className={`border-b border-slate-100 ${
                      selected ? "bg-violet-100" : "hover:bg-violet-50/60"
                    }`}
                  >
                    <td className="px-5 py-5">{formatDate(date)}</td>
                    <td className="px-5 py-5 font-bold">
                      {reference || "—"}
                    </td>
                    <td className="px-5 py-5">{description}</td>
                    <td className="px-5 py-5">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${
                          direction === "INFLOW"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {direction}
                      </span>
                    </td>
                    <td className="px-5 py-5">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${statusClasses(
                          status,
                        )}`}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="px-5 py-5 text-right font-black">
                      {formatCurrency(toNumber(amount))}
                    </td>
                    <td className="px-5 py-5 text-right font-black text-violet-700">
                      {formatCurrency(toNumber(remaining))}
                    </td>
                    <td className="px-5 py-5 text-right">
                      <button
                        type="button"
                        disabled={toNumber(remaining) <= 0.005}
                        onClick={() => onSelect(selected ? "" : id)}
                        className={`rounded-lg px-4 py-2 text-sm font-black ${
                          selected
                            ? "bg-violet-700 text-white"
                            : "border border-violet-200 bg-violet-50 text-violet-700"
                        } disabled:opacity-40`}
                      >
                        {selected ? "Selected" : "Select"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}