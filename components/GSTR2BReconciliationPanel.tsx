"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileDown,
  FileSpreadsheet,
  History,
  LoaderCircle,
  RefreshCw,
  Search,
  UploadCloud,
  XCircle,
} from "lucide-react";
import {
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";

type MatchStatus =
  | "UNMATCHED"
  | "MATCHED"
  | "MISMATCHED"
  | "MISSING_IN_BOOKS"
  | "DUPLICATE";

type ProfileRow = {
  active_company_id: string | null;
};

type SupplierRow = {
  id: string;
  name: string;
  gst_number: string | null;
};

type PurchaseItemRow = {
  taxable_amount: number | string | null;
};

type PurchaseRow = {
  id: string;
  bill_number: string;
  purchase_date: string;
  gst_total: number | string | null;
  cgst_total: number | string | null;
  sgst_total: number | string | null;
  igst_total: number | string | null;
  cess_total: number | string | null;
  grand_total: number | string | null;
  supplier: SupplierRow | SupplierRow[] | null;
  purchase_items: PurchaseItemRow[] | null;
};

type BookPurchase = {
  id: string;
  billNumber: string;
  normalizedBillNumber: string;
  purchaseDate: string;
  supplierName: string;
  supplierGstin: string;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  totalTax: number;
  invoiceValue: number;
};

type ParsedPortalRecord = {
  clientKey: string;
  supplierGstin: string;
  supplierName: string;
  invoiceNumber: string;
  normalizedInvoiceNumber: string;
  invoiceDate: string;
  invoiceType: string;
  placeOfSupply: string;
  reverseCharge: boolean;
  invoiceValue: number;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  itcAvailability: string;
  reasonForItcUnavailability: string;
  sourceSheet: string;
  sourceRowNumber: number;
  rawData: Record<string, unknown>;
  matchStatus: MatchStatus;
  matchedPurchaseId: string;
  matchedPurchaseNumber: string;
  mismatchReason: string;
};

type ImportRow = {
  id: string;
  file_name: string;
  return_period: string | null;
  period_from: string | null;
  period_to: string | null;
  status: string;
  total_rows: number | string | null;
  matched_rows: number | string | null;
  mismatched_rows: number | string | null;
  missing_in_books_rows: number | string | null;
  error_message: string | null;
  created_at: string;
};

type SavedRecordRow = {
  id: string;
  supplier_gstin: string | null;
  supplier_name: string | null;
  invoice_number: string;
  normalized_invoice_number: string;
  invoice_date: string | null;
  invoice_type: string | null;
  place_of_supply: string | null;
  reverse_charge: boolean | null;
  invoice_value: number | string | null;
  taxable_value: number | string | null;
  igst: number | string | null;
  cgst: number | string | null;
  sgst: number | string | null;
  cess: number | string | null;
  itc_availability: string | null;
  reason_for_itc_unavailability: string | null;
  match_status: MatchStatus;
  matched_purchase_id: string | null;
  mismatch_reason: string | null;
  source_sheet: string | null;
  source_row_number: number | null;
};

type ParseResult = {
  records: ParsedPortalRecord[];
  skippedRows: number;
  detectedSheets: string[];
  ignoredSheets: string[];
};

type GSTR2BReconciliationPanelProps = {
  fromDate: string;
  toDate: string;
};

const MATCH_TOLERANCE = 1;

const HEADER_ALIASES = {
  supplierGstin: [
    "gstin of supplier",
    "supplier gstin",
    "gstin/uin of supplier",
    "gstin of the supplier",
    "gstin",
  ],
  supplierName: [
    "trade/legal name",
    "trade name",
    "legal name",
    "supplier name",
    "name of supplier",
  ],
  invoiceNumber: [
    "invoice number",
    "invoice no",
    "invoice no.",
    "document number",
    "document no",
    "bill of entry number",
    "bill of entry no",
    "note number",
    "credit/debit note number",
  ],
  invoiceDate: [
    "invoice date",
    "document date",
    "bill of entry date",
    "note date",
    "credit/debit note date",
  ],
  invoiceType: [
    "invoice type",
    "document type",
    "type",
  ],
  placeOfSupply: [
    "place of supply",
    "place of supply (state/ut)",
    "pos",
  ],
  reverseCharge: [
    "supply attract reverse charge",
    "reverse charge",
    "rcm",
  ],
  invoiceValue: [
    "invoice value",
    "invoice value (₹)",
    "document value",
    "total invoice value",
    "note value",
  ],
  taxableValue: [
    "taxable value",
    "taxable value (₹)",
    "taxable amount",
  ],
  igst: [
    "integrated tax",
    "integrated tax(₹)",
    "igst",
    "igst amount",
  ],
  cgst: [
    "central tax",
    "central tax(₹)",
    "cgst",
    "cgst amount",
  ],
  sgst: [
    "state/ut tax",
    "state/ut tax(₹)",
    "state tax",
    "ut tax",
    "sgst",
    "sgst/utgst",
    "sgst amount",
  ],
  cess: [
    "cess",
    "cess(₹)",
    "cess amount",
  ],
  itcAvailability: [
    "itc availability",
    "itc available",
    "itc status",
    "itc eligibility",
  ],
  itcReason: [
    "reason for itc un-availability",
    "reason for itc unavailability",
    "reason for itc not available",
    "reason",
  ],
} as const;

type PortalField = keyof typeof HEADER_ALIASES;

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const text = String(value ?? "")
    .trim()
    .replace(/[₹,\s]/g, "");

  if (!text) {
    return 0;
  }

  const isNegative =
    text.startsWith("(") && text.endsWith(")");

  const normalized = text.replace(/[()]/g, "");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return isNegative ? -parsed : parsed;
}

function roundMoney(value: number) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

function formatCurrency(value: number) {
  return `₹${roundMoney(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string) {
  if (!value) {
    return "—";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string) {
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

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/₹/g, "")
    .replace(/[\n\r\t]+/g, " ")
    .replace(/[()./\\_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeGstin(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function normalizeInvoiceNumber(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function normalizeName(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function getJoinedSupplier(
  supplier: SupplierRow | SupplierRow[] | null
) {
  return Array.isArray(supplier)
    ? supplier[0] || null
    : supplier;
}

function excelDateToIso(value: unknown) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return "";
    }

    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, "0"),
      String(value.getDate()).padStart(2, "0"),
    ].join("-");
  }

  if (typeof value === "number" && value > 0) {
    const parsed = XLSX.SSF.parse_date_code(value);

    if (parsed) {
      return [
        parsed.y,
        String(parsed.m).padStart(2, "0"),
        String(parsed.d).padStart(2, "0"),
      ].join("-");
    }
  }

  const text = String(value ?? "").trim();

  if (!text) {
    return "";
  }

  const isoMatch = text.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/
  );

  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(
      2,
      "0"
    )}-${isoMatch[3].padStart(2, "0")}`;
  }

  const indianMatch = text.match(
    /^(\d{1,2})[-/](\d{1,2})[-/](\d{2}|\d{4})$/
  );

  if (indianMatch) {
    const rawYear = Number(indianMatch[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;

    return `${year}-${indianMatch[2].padStart(
      2,
      "0"
    )}-${indianMatch[1].padStart(2, "0")}`;
  }

  const parsedDate = new Date(text);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return [
    parsedDate.getFullYear(),
    String(parsedDate.getMonth() + 1).padStart(2, "0"),
    String(parsedDate.getDate()).padStart(2, "0"),
  ].join("-");
}

function isYes(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  return (
    normalized === "y" ||
    normalized === "yes" ||
    normalized === "true" ||
    normalized === "1"
  );
}

function findHeaderIndex(
  normalizedHeaders: string[],
  field: PortalField
) {
  const aliases = HEADER_ALIASES[field].map(normalizeHeader);

  return normalizedHeaders.findIndex((header) =>
    aliases.some(
      (alias) =>
        header === alias ||
        header.startsWith(`${alias} `) ||
        header.includes(alias)
    )
  );
}

function getHeaderScore(row: unknown[]) {
  const headers = row.map(normalizeHeader);

  const importantFields: PortalField[] = [
    "supplierGstin",
    "invoiceNumber",
    "invoiceDate",
    "taxableValue",
    "invoiceValue",
  ];

  return importantFields.reduce(
    (score, field) =>
      score +
      Number(findHeaderIndex(headers, field) >= 0),
    0
  );
}

function findHeaderRow(rows: unknown[][]) {
  let bestIndex = -1;
  let bestScore = 0;

  rows.slice(0, 35).forEach((row, index) => {
    const score = getHeaderScore(row);

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestScore >= 3 ? bestIndex : -1;
}

function buildRawData(
  headers: unknown[],
  row: unknown[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  headers.forEach((header, index) => {
    const key =
      String(header ?? "").trim() || `Column ${index + 1}`;

    result[key] = row[index] ?? null;
  });

  return result;
}

function getCell(
  row: unknown[],
  indexes: Partial<Record<PortalField, number>>,
  field: PortalField
) {
  const index = indexes[field];

  return index === undefined || index < 0
    ? undefined
    : row[index];
}

function parseWorkbook(workbook: XLSX.WorkBook): ParseResult {
  const parsed: ParsedPortalRecord[] = [];
  const detectedSheets: string[] = [];
  const ignoredSheets: string[] = [];
  let skippedRows = 0;

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      ignoredSheets.push(sheetName);
      return;
    }

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      raw: true,
    });

    const headerRowIndex = findHeaderRow(rows);

    if (headerRowIndex < 0) {
      ignoredSheets.push(sheetName);
      return;
    }

    detectedSheets.push(sheetName);

    const headers = rows[headerRowIndex] || [];
    const normalizedHeaders = headers.map(normalizeHeader);

    const indexes = Object.keys(
      HEADER_ALIASES
    ).reduce<Partial<Record<PortalField, number>>>(
      (result, field) => {
        result[field as PortalField] = findHeaderIndex(
          normalizedHeaders,
          field as PortalField
        );
        return result;
      },
      {}
    );

    rows
      .slice(headerRowIndex + 1)
      .forEach((row, relativeIndex) => {
        const sourceRowNumber =
          headerRowIndex + relativeIndex + 2;

        const supplierGstin = normalizeGstin(
          getCell(row, indexes, "supplierGstin")
        );
        const supplierName = String(
          getCell(row, indexes, "supplierName") ?? ""
        ).trim();
        const invoiceNumber = String(
          getCell(row, indexes, "invoiceNumber") ?? ""
        ).trim();
        const normalizedInvoiceNumber =
          normalizeInvoiceNumber(invoiceNumber);

        const hasAnyValue = row.some(
          (cell) => String(cell ?? "").trim() !== ""
        );

        if (!hasAnyValue) {
          return;
        }

        if (!invoiceNumber || !normalizedInvoiceNumber) {
          skippedRows += 1;
          return;
        }

        const invoiceDate = excelDateToIso(
          getCell(row, indexes, "invoiceDate")
        );

        parsed.push({
          clientKey: `${sheetName}-${sourceRowNumber}-${supplierGstin}-${normalizedInvoiceNumber}`,
          supplierGstin,
          supplierName,
          invoiceNumber,
          normalizedInvoiceNumber,
          invoiceDate,
          invoiceType:
            String(
              getCell(row, indexes, "invoiceType") ?? ""
            ).trim() || sheetName,
          placeOfSupply: String(
            getCell(row, indexes, "placeOfSupply") ?? ""
          ).trim(),
          reverseCharge: isYes(
            getCell(row, indexes, "reverseCharge")
          ),
          invoiceValue: roundMoney(
            toNumber(
              getCell(row, indexes, "invoiceValue")
            )
          ),
          taxableValue: roundMoney(
            toNumber(
              getCell(row, indexes, "taxableValue")
            )
          ),
          igst: roundMoney(
            toNumber(getCell(row, indexes, "igst"))
          ),
          cgst: roundMoney(
            toNumber(getCell(row, indexes, "cgst"))
          ),
          sgst: roundMoney(
            toNumber(getCell(row, indexes, "sgst"))
          ),
          cess: roundMoney(
            toNumber(getCell(row, indexes, "cess"))
          ),
          itcAvailability: String(
            getCell(row, indexes, "itcAvailability") ??
              ""
          ).trim(),
          reasonForItcUnavailability: String(
            getCell(row, indexes, "itcReason") ?? ""
          ).trim(),
          sourceSheet: sheetName,
          sourceRowNumber,
          rawData: buildRawData(headers, row),
          matchStatus: "UNMATCHED",
          matchedPurchaseId: "",
          matchedPurchaseNumber: "",
          mismatchReason: "",
        });
      });
  });

  return {
    records: parsed,
    skippedRows,
    detectedSheets,
    ignoredSheets,
  };
}

function isAmountDifferent(left: number, right: number) {
  return (
    Math.abs(roundMoney(left) - roundMoney(right)) >
    MATCH_TOLERANCE
  );
}

function makeMatchKey(
  supplierGstin: string,
  normalizedInvoiceNumber: string
) {
  return `${normalizeGstin(
    supplierGstin
  )}|${normalizeInvoiceNumber(normalizedInvoiceNumber)}`;
}

function matchPortalRecords(
  records: ParsedPortalRecord[],
  purchases: BookPurchase[]
) {
  const bookByExactKey = new Map<string, BookPurchase[]>();
  const bookByNumberAndName = new Map<
    string,
    BookPurchase[]
  >();

  purchases.forEach((purchase) => {
    if (purchase.supplierGstin) {
      const exactKey = makeMatchKey(
        purchase.supplierGstin,
        purchase.normalizedBillNumber
      );
      const exactGroup = bookByExactKey.get(exactKey) || [];
      exactGroup.push(purchase);
      bookByExactKey.set(exactKey, exactGroup);
    }

    const fallbackKey = `${purchase.normalizedBillNumber}|${normalizeName(
      purchase.supplierName
    )}`;
    const fallbackGroup =
      bookByNumberAndName.get(fallbackKey) || [];
    fallbackGroup.push(purchase);
    bookByNumberAndName.set(fallbackKey, fallbackGroup);
  });

  const portalGroups = new Map<
    string,
    ParsedPortalRecord[]
  >();

  records.forEach((record) => {
    const key = makeMatchKey(
      record.supplierGstin,
      record.normalizedInvoiceNumber
    );
    const group = portalGroups.get(key) || [];
    group.push(record);
    portalGroups.set(key, group);
  });

  return records.map((record) => {
    const portalKey = makeMatchKey(
      record.supplierGstin,
      record.normalizedInvoiceNumber
    );
    const portalDuplicates =
      portalGroups.get(portalKey) || [];

    if (portalDuplicates.length > 1) {
      return {
        ...record,
        matchStatus: "DUPLICATE" as const,
        mismatchReason: `${portalDuplicates.length} portal rows use the same supplier GSTIN and invoice number.`,
      };
    }

    let candidates: BookPurchase[] = [];

    if (record.supplierGstin) {
      candidates = bookByExactKey.get(portalKey) || [];
    }

    if (
      candidates.length === 0 &&
      !record.supplierGstin &&
      record.supplierName
    ) {
      const fallbackKey = `${record.normalizedInvoiceNumber}|${normalizeName(
        record.supplierName
      )}`;
      candidates =
        bookByNumberAndName.get(fallbackKey) || [];
    }

    if (candidates.length === 0) {
      return {
        ...record,
        matchStatus: "MISSING_IN_BOOKS" as const,
        mismatchReason:
          "No purchase bill with the same supplier GSTIN and invoice number was found in VertexERP.",
      };
    }

    if (candidates.length > 1) {
      return {
        ...record,
        matchStatus: "DUPLICATE" as const,
        mismatchReason:
          "Multiple purchase bills in VertexERP match this supplier GSTIN and invoice number.",
      };
    }

    const purchase = candidates[0];
    const mismatchReasons: string[] = [];

    if (
      record.invoiceDate &&
      purchase.purchaseDate &&
      record.invoiceDate !== purchase.purchaseDate
    ) {
      mismatchReasons.push(
        `Date: 2B ${formatDate(
          record.invoiceDate
        )}, Books ${formatDate(purchase.purchaseDate)}`
      );
    }

    const comparisons: Array<
      [string, number, number]
    > = [
      [
        "Invoice Value",
        record.invoiceValue,
        purchase.invoiceValue,
      ],
      [
        "Taxable Value",
        record.taxableValue,
        purchase.taxableValue,
      ],
      ["IGST", record.igst, purchase.igst],
      ["CGST", record.cgst, purchase.cgst],
      ["SGST", record.sgst, purchase.sgst],
      ["Cess", record.cess, purchase.cess],
    ];

    comparisons.forEach(
      ([label, portalValue, bookValue]) => {
        if (isAmountDifferent(portalValue, bookValue)) {
          mismatchReasons.push(
            `${label}: 2B ${formatCurrency(
              portalValue
            )}, Books ${formatCurrency(bookValue)}`
          );
        }
      }
    );

    return {
      ...record,
      matchStatus:
        mismatchReasons.length > 0
          ? ("MISMATCHED" as const)
          : ("MATCHED" as const),
      matchedPurchaseId: purchase.id,
      matchedPurchaseNumber: purchase.billNumber,
      mismatchReason: mismatchReasons.join(" · "),
    };
  });
}

function isPotentialItcAvailable(record: ParsedPortalRecord) {
  const text = `${record.itcAvailability} ${record.reasonForItcUnavailability}`
    .trim()
    .toLowerCase();

  if (!text) {
    return true;
  }

  return !(
    text.includes("not available") ||
    text.includes("unavailable") ||
    text.includes("ineligible") ||
    text === "no" ||
    text.startsWith("no ")
  );
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n")
  ) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = rows
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getPeriodDates(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})$/);

  if (!match) {
    return {
      returnPeriod: null,
      periodFrom: null,
      periodTo: null,
    };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const lastDay = new Date(year, month, 0).getDate();

  return {
    returnPeriod: `${match[2]}${match[1]}`,
    periodFrom: `${match[1]}-${match[2]}-01`,
    periodTo: `${match[1]}-${match[2]}-${String(
      lastDay
    ).padStart(2, "0")}`,
  };
}

function getCurrentMonth() {
  const today = new Date();

  return `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}`;
}

function statusClass(status: MatchStatus) {
  if (status === "MATCHED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "MISMATCHED") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "MISSING_IN_BOOKS") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (status === "DUPLICATE") {
    return "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function statusLabel(status: MatchStatus) {
  if (status === "MISSING_IN_BOOKS") {
    return "Missing in Books";
  }

  return status
    .split("_")
    .map(
      (part) =>
        part.charAt(0) + part.slice(1).toLowerCase()
    )
    .join(" ");
}

export default function GSTR2BReconciliationPanel({
  fromDate,
  toDate,
}: GSTR2BReconciliationPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [activeCompanyId, setActiveCompanyId] =
    useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [purchases, setPurchases] = useState<
    BookPurchase[]
  >([]);
  const [imports, setImports] = useState<ImportRow[]>([]);
  const [selectedImportId, setSelectedImportId] =
    useState("");
  const [savedRecords, setSavedRecords] = useState<
    ParsedPortalRecord[]
  >([]);

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);
  const [returnMonth, setReturnMonth] = useState(
    getCurrentMonth()
  );
  const [preview, setPreview] = useState<
    ParsedPortalRecord[]
  >([]);
  const [parseInfo, setParseInfo] =
    useState<ParseResult | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<"ALL" | MatchStatus>("ALL");

  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);

    window.setTimeout(() => {
      setMessage("");
    }, 5500);
  }

  async function resolveCompanyAndPurchases() {
    const supabase = createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error(
        "Please sign in before importing GSTR-2B."
      );
    }

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("active_company_id")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    const companyId =
      (profile as ProfileRow | null)?.active_company_id ||
      null;

    if (!companyId) {
      throw new Error(
        "Select an active company before importing GSTR-2B."
      );
    }

    let purchaseQuery = supabase
      .from("purchases")
      .select(
        `
          id,
          bill_number,
          purchase_date,
          gst_total,
          cgst_total,
          sgst_total,
          igst_total,
          cess_total,
          grand_total,
          supplier:ledgers!purchases_supplier_id_fkey(
            id,
            name,
            gst_number
          ),
          purchase_items(
            taxable_amount
          )
        `
      )
      .eq("company_id", companyId);

    if (fromDate) {
      purchaseQuery = purchaseQuery.gte(
        "purchase_date",
        fromDate
      );
    }

    if (toDate) {
      purchaseQuery = purchaseQuery.lte(
        "purchase_date",
        toDate
      );
    }

    const { data, error } = await purchaseQuery.order(
      "purchase_date",
      { ascending: false }
    );

    if (error) {
      throw error;
    }

    const nextPurchases = (
      (data || []) as unknown as PurchaseRow[]
    ).map<BookPurchase>((row) => {
      const supplier = getJoinedSupplier(row.supplier);
      const taxableValue = (row.purchase_items || []).reduce(
        (total, item) =>
          total + toNumber(item.taxable_amount),
        0
      );

      const cgst = toNumber(row.cgst_total);
      const sgst = toNumber(row.sgst_total);
      const igst = toNumber(row.igst_total);
      const cess = toNumber(row.cess_total);

      return {
        id: row.id,
        billNumber: row.bill_number || "",
        normalizedBillNumber: normalizeInvoiceNumber(
          row.bill_number
        ),
        purchaseDate: row.purchase_date || "",
        supplierName: supplier?.name || "Supplier",
        supplierGstin: normalizeGstin(
          supplier?.gst_number
        ),
        taxableValue: roundMoney(taxableValue),
        igst: roundMoney(igst),
        cgst: roundMoney(cgst),
        sgst: roundMoney(sgst),
        cess: roundMoney(cess),
        totalTax: roundMoney(cgst + sgst + igst + cess),
        invoiceValue: roundMoney(
          toNumber(row.grand_total)
        ),
      };
    });

    setUserId(user.id);
    setActiveCompanyId(companyId);
    setPurchases(nextPurchases);

    return {
      companyId,
      userId: user.id,
      purchases: nextPurchases,
    };
  }

  async function loadImports(companyId: string) {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("gstr2b_imports")
      .select(
        "id, file_name, return_period, period_from, period_to, status, total_rows, matched_rows, mismatched_rows, missing_in_books_rows, error_message, created_at"
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(12);

    if (error) {
      throw error;
    }

    const nextImports = (data || []) as ImportRow[];
    setImports(nextImports);

    return nextImports;
  }

  async function loadSavedRecords(
    importId: string,
    currentPurchases = purchases
  ) {
    if (!importId) {
      setSavedRecords([]);
      return;
    }

    const supabase = createClient();

    const { data, error } = await supabase
      .from("gstr2b_records")
      .select(
        "id, supplier_gstin, supplier_name, invoice_number, normalized_invoice_number, invoice_date, invoice_type, place_of_supply, reverse_charge, invoice_value, taxable_value, igst, cgst, sgst, cess, itc_availability, reason_for_itc_unavailability, match_status, matched_purchase_id, mismatch_reason, source_sheet, source_row_number"
      )
      .eq("import_id", importId)
      .order("source_sheet")
      .order("source_row_number");

    if (error) {
      throw error;
    }

    const purchaseById = new Map(
      currentPurchases.map((purchase) => [
        purchase.id,
        purchase,
      ])
    );

    const mapped = (
      (data || []) as SavedRecordRow[]
    ).map<ParsedPortalRecord>((row) => {
      const purchase = row.matched_purchase_id
        ? purchaseById.get(row.matched_purchase_id)
        : undefined;

      return {
        clientKey: row.id,
        supplierGstin: row.supplier_gstin || "",
        supplierName: row.supplier_name || "",
        invoiceNumber: row.invoice_number || "",
        normalizedInvoiceNumber:
          row.normalized_invoice_number || "",
        invoiceDate: row.invoice_date || "",
        invoiceType: row.invoice_type || "",
        placeOfSupply: row.place_of_supply || "",
        reverseCharge: Boolean(row.reverse_charge),
        invoiceValue: toNumber(row.invoice_value),
        taxableValue: toNumber(row.taxable_value),
        igst: toNumber(row.igst),
        cgst: toNumber(row.cgst),
        sgst: toNumber(row.sgst),
        cess: toNumber(row.cess),
        itcAvailability: row.itc_availability || "",
        reasonForItcUnavailability:
          row.reason_for_itc_unavailability || "",
        sourceSheet: row.source_sheet || "",
        sourceRowNumber: row.source_row_number || 0,
        rawData: {},
        matchStatus: row.match_status,
        matchedPurchaseId:
          row.matched_purchase_id || "",
        matchedPurchaseNumber:
          purchase?.billNumber || "",
        mismatchReason: row.mismatch_reason || "",
      };
    });

    setSavedRecords(mapped);
  }

  async function loadPanelData() {
    setIsLoading(true);
    setMessage("");

    try {
      const resolved =
        await resolveCompanyAndPurchases();
      const nextImports = await loadImports(
        resolved.companyId
      );

      if (nextImports[0]) {
        setSelectedImportId(nextImports[0].id);
        await loadSavedRecords(
          nextImports[0].id,
          resolved.purchases
        );
      } else {
        setSelectedImportId("");
        setSavedRecords([]);
      }
    } catch (error) {
      setActiveCompanyId(null);
      setUserId("");
      setPurchases([]);
      setImports([]);
      setSavedRecords([]);

      showMessage(
        error instanceof Error
          ? error.message
          : "GSTR-2B reconciliation data could not be loaded."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadPanelData();

    function handleCompanyChange() {
      setPreview([]);
      setParseInfo(null);
      setSelectedFile(null);
      loadPanelData();
    }

    function handlePurchasesChange() {
      loadPanelData();
    }

    window.addEventListener(
      "vertexerp-active-company-updated",
      handleCompanyChange
    );
    window.addEventListener(
      "vertexerp-purchases-updated",
      handlePurchasesChange
    );

    return () => {
      window.removeEventListener(
        "vertexerp-active-company-updated",
        handleCompanyChange
      );
      window.removeEventListener(
        "vertexerp-purchases-updated",
        handlePurchasesChange
      );
    };
  }, [fromDate, toDate]);

  async function parseSelectedFile(file: File) {
    const extension = file.name
      .split(".")
      .pop()
      ?.toLowerCase();

    if (
      !extension ||
      !["xlsx", "xls", "csv"].includes(extension)
    ) {
      showMessage(
        "Upload a valid GSTR-2B Excel or CSV file."
      );
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      showMessage(
        "The selected file is larger than 25 MB."
      );
      return;
    }

    setIsParsing(true);
    setMessage("");
    setPreview([]);
    setParseInfo(null);

    try {
      let currentPurchases = purchases;

      if (!activeCompanyId) {
        const resolved =
          await resolveCompanyAndPurchases();
        currentPurchases = resolved.purchases;
      }

      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, {
        type: "array",
        cellDates: true,
      });

      const result = parseWorkbook(workbook);

      if (result.records.length === 0) {
        throw new Error(
          "No invoice-level GSTR-2B rows were detected. Use the GST portal Excel/CSV containing fields such as Supplier GSTIN, Invoice Number, Invoice Date and Taxable Value."
        );
      }

      const matched = matchPortalRecords(
        result.records,
        currentPurchases
      );

      setSelectedFile(file);
      setPreview(matched);
      setParseInfo({
        ...result,
        records: matched,
      });
      setSavedRecords([]);
      setSelectedImportId("");

      showMessage(
        `${matched.length} GSTR-2B row(s) parsed and matched against VertexERP purchases.`
      );
    } catch (error) {
      setSelectedFile(null);
      setPreview([]);
      setParseInfo(null);

      showMessage(
        error instanceof Error
          ? error.message
          : "The GSTR-2B file could not be read."
      );
    } finally {
      setIsParsing(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  function handleFileInput(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (file) {
      parseSelectedFile(file);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];

    if (file) {
      parseSelectedFile(file);
    }
  }

  async function saveImport() {
    if (
      !activeCompanyId ||
      !userId ||
      !selectedFile ||
      preview.length === 0
    ) {
      showMessage(
        "Select and preview a GSTR-2B file before saving."
      );
      return;
    }

    setIsSaving(true);
    setMessage("");

    const supabase = createClient();
    let importId = "";

    try {
      const period = getPeriodDates(returnMonth);

      const counts = preview.reduce(
        (result, record) => {
          if (record.matchStatus === "MATCHED") {
            result.matched += 1;
          }

          if (
            record.matchStatus === "MISMATCHED" ||
            record.matchStatus === "DUPLICATE"
          ) {
            result.mismatched += 1;
          }

          if (
            record.matchStatus ===
            "MISSING_IN_BOOKS"
          ) {
            result.missing += 1;
          }

          return result;
        },
        {
          matched: 0,
          mismatched: 0,
          missing: 0,
        }
      );

      const { data: importData, error: importError } =
        await supabase
          .from("gstr2b_imports")
          .insert({
            company_id: activeCompanyId,
            uploaded_by: userId,
            file_name: selectedFile.name,
            return_period: period.returnPeriod,
            period_from: period.periodFrom,
            period_to: period.periodTo,
            status: "PROCESSING",
            total_rows: preview.length,
            matched_rows: counts.matched,
            mismatched_rows: counts.mismatched,
            missing_in_books_rows: counts.missing,
          })
          .select("id")
          .single();

      if (importError) {
        throw importError;
      }

      importId = String(importData.id);

      const payload = preview.map((record) => ({
        import_id: importId,
        company_id: activeCompanyId,
        supplier_gstin:
          record.supplierGstin || null,
        supplier_name: record.supplierName || null,
        invoice_number: record.invoiceNumber,
        normalized_invoice_number:
          record.normalizedInvoiceNumber,
        invoice_date: record.invoiceDate || null,
        invoice_type: record.invoiceType || null,
        place_of_supply:
          record.placeOfSupply || null,
        reverse_charge: record.reverseCharge,
        invoice_value: record.invoiceValue,
        taxable_value: record.taxableValue,
        igst: record.igst,
        cgst: record.cgst,
        sgst: record.sgst,
        cess: record.cess,
        itc_availability:
          record.itcAvailability || null,
        reason_for_itc_unavailability:
          record.reasonForItcUnavailability ||
          null,
        match_status: record.matchStatus,
        matched_purchase_id:
          record.matchedPurchaseId || null,
        mismatch_reason:
          record.mismatchReason || null,
        source_sheet: record.sourceSheet,
        source_row_number: record.sourceRowNumber,
        raw_data: record.rawData,
      }));

      const chunkSize = 250;

      for (
        let start = 0;
        start < payload.length;
        start += chunkSize
      ) {
        const chunk = payload.slice(
          start,
          start + chunkSize
        );

        const { error } = await supabase
          .from("gstr2b_records")
          .insert(chunk);

        if (error) {
          throw error;
        }
      }

      const { error: completionError } = await supabase
        .from("gstr2b_imports")
        .update({
          status: "COMPLETED",
          error_message: null,
        })
        .eq("id", importId)
        .eq("company_id", activeCompanyId);

      if (completionError) {
        throw completionError;
      }

      const nextImports = await loadImports(
        activeCompanyId
      );

      setSelectedImportId(importId);
      setPreview([]);
      setParseInfo(null);
      setSelectedFile(null);

      await loadSavedRecords(importId, purchases);

      showMessage(
        `GSTR-2B import saved successfully. ${nextImports.length} recent import(s) are available.`
      );
    } catch (error) {
      if (importId) {
        await supabase
          .from("gstr2b_imports")
          .update({
            status: "FAILED",
            error_message:
              error instanceof Error
                ? error.message
                : "Import failed.",
          })
          .eq("id", importId)
          .eq("company_id", activeCompanyId);
      }

      showMessage(
        error instanceof Error
          ? error.message
          : "GSTR-2B import could not be saved."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function selectImport(importId: string) {
    setSelectedImportId(importId);
    setPreview([]);
    setParseInfo(null);
    setSelectedFile(null);
    setIsLoading(true);

    try {
      await loadSavedRecords(importId);
    } catch (error) {
      setSavedRecords([]);
      showMessage(
        error instanceof Error
          ? error.message
          : "Imported records could not be loaded."
      );
    } finally {
      setIsLoading(false);
    }
  }

  const currentRecords =
    preview.length > 0 ? preview : savedRecords;

  const counts = useMemo(() => {
    return currentRecords.reduce(
      (result, record) => {
        result.total += 1;
        result[record.matchStatus] += 1;

        const tax =
          record.igst +
          record.cgst +
          record.sgst +
          record.cess;

        if (
          record.matchStatus === "MATCHED" &&
          isPotentialItcAvailable(record)
        ) {
          result.potentialItc += tax;
        }

        return result;
      },
      {
        total: 0,
        MATCHED: 0,
        MISMATCHED: 0,
        MISSING_IN_BOOKS: 0,
        DUPLICATE: 0,
        UNMATCHED: 0,
        potentialItc: 0,
      }
    );
  }, [currentRecords]);

  const matchedPurchaseIds = useMemo(
    () =>
      new Set(
        currentRecords
          .map((record) => record.matchedPurchaseId)
          .filter(Boolean)
      ),
    [currentRecords]
  );

  const booksMissingIn2B = useMemo(() => {
    if (currentRecords.length === 0) {
      return [];
    }

    return purchases.filter(
      (purchase) =>
        !matchedPurchaseIds.has(purchase.id) &&
        purchase.supplierGstin &&
        purchase.totalTax > 0
    );
  }, [
    currentRecords,
    purchases,
    matchedPurchaseIds,
  ]);

  const filteredRecords = useMemo(() => {
    const normalizedSearch = searchTerm
      .trim()
      .toLowerCase();

    return currentRecords.filter((record) => {
      const matchesStatus =
        statusFilter === "ALL" ||
        record.matchStatus === statusFilter;

      const searchable = [
        record.supplierGstin,
        record.supplierName,
        record.invoiceNumber,
        record.matchedPurchaseNumber,
        record.mismatchReason,
      ]
        .join(" ")
        .toLowerCase();

      return (
        matchesStatus &&
        (!normalizedSearch ||
          searchable.includes(normalizedSearch))
      );
    });
  }, [currentRecords, searchTerm, statusFilter]);

  function exportReconciliation() {
    const rows: unknown[][] = [
      [
        "Status",
        "Supplier GSTIN",
        "Supplier Name",
        "2B Invoice Number",
        "2B Invoice Date",
        "Matched Book Bill",
        "Invoice Value",
        "Taxable Value",
        "IGST",
        "CGST",
        "SGST",
        "Cess",
        "ITC Availability",
        "Mismatch Reason",
        "Source Sheet",
        "Source Row",
      ],
      ...filteredRecords.map((record) => [
        statusLabel(record.matchStatus),
        record.supplierGstin,
        record.supplierName,
        record.invoiceNumber,
        record.invoiceDate,
        record.matchedPurchaseNumber,
        record.invoiceValue,
        record.taxableValue,
        record.igst,
        record.cgst,
        record.sgst,
        record.cess,
        record.itcAvailability,
        record.mismatchReason,
        record.sourceSheet,
        record.sourceRowNumber,
      ]),
    ];

    downloadCsv(
      `vertexerp-gstr2b-reconciliation-${
        returnMonth || "import"
      }.csv`,
      rows
    );
  }

  function exportBooksMissingIn2B() {
    const rows: unknown[][] = [
      [
        "Supplier GSTIN",
        "Supplier Name",
        "Book Bill Number",
        "Purchase Date",
        "Taxable Value",
        "IGST",
        "CGST",
        "SGST",
        "Cess",
        "Invoice Value",
      ],
      ...booksMissingIn2B.map((purchase) => [
        purchase.supplierGstin,
        purchase.supplierName,
        purchase.billNumber,
        purchase.purchaseDate,
        purchase.taxableValue,
        purchase.igst,
        purchase.cgst,
        purchase.sgst,
        purchase.cess,
        purchase.invoiceValue,
      ]),
    ];

    downloadCsv(
      "vertexerp-purchases-missing-in-gstr2b.csv",
      rows
    );
  }

  function downloadExpectedTemplate() {
    const rows: unknown[][] = [
      [
        "GSTIN of supplier",
        "Trade/Legal name",
        "Invoice number",
        "Invoice Date",
        "Invoice Value",
        "Place of supply",
        "Supply Attract Reverse Charge",
        "Taxable Value",
        "Integrated Tax",
        "Central Tax",
        "State/UT Tax",
        "Cess",
        "ITC Availability",
        "Reason for ITC Un-availability",
      ],
      [
        "09ABCDE1234F1Z5",
        "Sample Supplier",
        "INV-001",
        "01/07/2026",
        1180,
        "Uttar Pradesh",
        "No",
        1000,
        0,
        90,
        90,
        0,
        "Yes",
        "",
      ],
    ];

    downloadCsv(
      "vertexerp-gstr2b-import-template.csv",
      rows
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-xl shadow-violet-100/40">
      <div className="bg-gradient-to-r from-[#2f1c6a] via-[#5931c8] to-[#673de6] p-5 text-white sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-violet-100">
              <FileSpreadsheet className="h-5 w-5" />
              <p className="text-sm font-black uppercase tracking-[0.18em]">
                Portal Reconciliation
              </p>
            </div>

            <h2 className="mt-3 text-2xl font-black sm:text-3xl">
              GSTR-2B Import &amp; Purchase Matching
            </h2>

            <p className="mt-2 max-w-3xl leading-7 text-violet-100">
              Import invoice-level GSTR-2B Excel/CSV data and
              compare supplier GSTIN, invoice number, date,
              taxable value and tax heads with VertexERP purchase
              bills.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={downloadExpectedTemplate}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/20"
            >
              <FileDown className="h-5 w-5" />
              Sample Template
            </button>

            <button
              type="button"
              onClick={loadPanelData}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-[#5025d1] transition hover:bg-violet-50 disabled:opacity-60"
            >
              <RefreshCw
                className={`h-5 w-5 ${
                  isLoading ? "animate-spin" : ""
                }`}
              />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {message && (
        <div className="m-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 font-semibold text-blue-700 sm:m-6">
          {message}
        </div>
      )}

      <div className="grid gap-5 p-4 sm:p-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`flex min-h-[240px] flex-col items-center justify-center rounded-3xl border-2 border-dashed p-6 text-center transition ${
              isDragging
                ? "border-violet-500 bg-violet-100"
                : "border-violet-200 bg-violet-50/60"
            }`}
          >
            {isParsing ? (
              <>
                <LoaderCircle className="h-12 w-12 animate-spin text-violet-700" />
                <h3 className="mt-4 text-xl font-black text-slate-900">
                  Reading GSTR-2B file...
                </h3>
              </>
            ) : (
              <>
                <UploadCloud className="h-12 w-12 text-violet-700" />
                <h3 className="mt-4 text-xl font-black text-slate-900">
                  Drop GSTR-2B Excel/CSV here
                </h3>
                <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600">
                  Supports .xlsx, .xls and .csv files up to
                  25 MB. The file is previewed before saving to
                  Supabase.
                </p>

                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="mt-5 rounded-xl bg-violet-600 px-6 py-3 font-black text-white transition hover:bg-violet-700"
                >
                  Select GSTR-2B File
                </button>
              </>
            )}

            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>

          <div className="mt-4">
            <label className="mb-2 block font-bold text-slate-800">
              GSTR-2B Return Month
            </label>
            <input
              type="month"
              value={returnMonth}
              onChange={(event) =>
                setReturnMonth(event.target.value)
              }
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100 sm:max-w-xs"
            />
          </div>

          {selectedFile && parseInfo && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
              <p className="font-black">
                {selectedFile.name}
              </p>
              <p className="mt-1 text-sm leading-6">
                {preview.length} row(s) detected ·{" "}
                {parseInfo.skippedRows} row(s) skipped
              </p>
              <p className="mt-1 text-xs">
                Read sheets:{" "}
                {parseInfo.detectedSheets.join(", ") ||
                  "None"}
              </p>
              {parseInfo.ignoredSheets.length > 0 && (
                <p className="mt-1 text-xs">
                  Ignored non-invoice sheets:{" "}
                  {parseInfo.ignoredSheets.join(", ")}
                </p>
              )}

              <button
                type="button"
                onClick={saveImport}
                disabled={isSaving}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-black text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
              >
                {isSaving ? (
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                ) : (
                  <UploadCloud className="h-5 w-5" />
                )}
                {isSaving
                  ? "Saving Import..."
                  : "Save GSTR-2B Import"}
              </button>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-violet-700" />
            <h3 className="text-lg font-black text-slate-900">
              Recent Imports
            </h3>
          </div>

          <div className="mt-4 space-y-3">
            {isLoading ? (
              <p className="py-8 text-center text-sm text-slate-500">
                Loading import history...
              </p>
            ) : imports.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                No GSTR-2B import has been saved yet.
              </p>
            ) : (
              imports.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectImport(item.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    selectedImportId === item.id
                      ? "border-violet-400 bg-violet-100"
                      : "border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-black text-slate-900">
                        {item.file_name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDateTime(item.created_at)}
                        {item.return_period
                          ? ` · Period ${item.return_period}`
                          : ""}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                        item.status === "COMPLETED"
                          ? "bg-emerald-100 text-emerald-700"
                          : item.status === "FAILED"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
                      <strong>
                        {toNumber(item.matched_rows)}
                      </strong>
                      <span className="block">Matched</span>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-2 text-amber-700">
                      <strong>
                        {toNumber(item.mismatched_rows)}
                      </strong>
                      <span className="block">Mismatch</span>
                    </div>
                    <div className="rounded-lg bg-red-50 p-2 text-red-700">
                      <strong>
                        {toNumber(
                          item.missing_in_books_rows
                        )}
                      </strong>
                      <span className="block">Missing</span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            title="Portal Records"
            value={counts.total}
            detail="Rows in current preview/import"
            icon={<FileSpreadsheet className="h-5 w-5" />}
            className="border-violet-200 bg-violet-50 text-violet-700"
          />
          <SummaryCard
            title="Matched"
            value={counts.MATCHED}
            detail="GSTIN, invoice and amounts agree"
            icon={<CheckCircle2 className="h-5 w-5" />}
            className="border-emerald-200 bg-emerald-50 text-emerald-700"
          />
          <SummaryCard
            title="Mismatched"
            value={counts.MISMATCHED + counts.DUPLICATE}
            detail={`${counts.DUPLICATE} duplicate row(s)`}
            icon={<AlertTriangle className="h-5 w-5" />}
            className="border-amber-200 bg-amber-50 text-amber-700"
          />
          <SummaryCard
            title="Missing in Books"
            value={counts.MISSING_IN_BOOKS}
            detail="Present in 2B, absent in purchases"
            icon={<XCircle className="h-5 w-5" />}
            className="border-red-200 bg-red-50 text-red-700"
          />
          <SummaryCard
            title="Potential Matched ITC"
            value={counts.potentialItc}
            detail="Review eligibility before claiming"
            icon={<CheckCircle2 className="h-5 w-5" />}
            className="border-blue-200 bg-blue-50 text-blue-700"
            isCurrency
          />
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="relative flex-1">
            <label className="mb-2 block font-bold text-slate-800">
              Search Reconciliation
            </label>
            <Search className="absolute bottom-3.5 left-4 h-5 w-5 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(event.target.value)
              }
              placeholder="GSTIN, supplier, portal invoice or book bill"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-12 pr-4 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
            />
          </div>

          <div>
            <label className="mb-2 block font-bold text-slate-800">
              Match Status
            </label>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as
                    | "ALL"
                    | MatchStatus
                )
              }
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100 lg:min-w-52"
            >
              <option value="ALL">All Statuses</option>
              <option value="MATCHED">Matched</option>
              <option value="MISMATCHED">
                Mismatched
              </option>
              <option value="MISSING_IN_BOOKS">
                Missing in Books
              </option>
              <option value="DUPLICATE">
                Duplicate
              </option>
            </select>
          </div>

          <button
            type="button"
            onClick={exportReconciliation}
            disabled={filteredRecords.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 font-black text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-5 w-5" />
            Export Results
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border-t border-slate-200">
        <table className="w-full min-w-[1450px]">
          <thead className="bg-slate-50">
            <tr>
              {[
                "Status",
                "Supplier",
                "2B Invoice",
                "Book Match",
                "Invoice Value",
                "Taxable",
                "IGST",
                "CGST",
                "SGST",
                "ITC",
                "Finding",
                "Action",
              ].map((heading) => (
                <th
                  key={heading}
                  className="border-b border-slate-200 px-5 py-4 text-left text-sm font-bold text-slate-700"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={12}
                  className="px-5 py-14 text-center text-slate-500"
                >
                  Loading GSTR-2B reconciliation...
                </td>
              </tr>
            ) : filteredRecords.length === 0 ? (
              <tr>
                <td
                  colSpan={12}
                  className="px-5 py-14 text-center text-slate-500"
                >
                  Upload a GSTR-2B file or select a saved
                  import to view matching results.
                </td>
              </tr>
            ) : (
              filteredRecords.map((record) => (
                <tr
                  key={record.clientKey}
                  className="border-b border-slate-100 align-top transition hover:bg-violet-50/40"
                >
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClass(
                        record.matchStatus
                      )}`}
                    >
                      {statusLabel(record.matchStatus)}
                    </span>
                    <p className="mt-2 text-xs text-slate-500">
                      {record.sourceSheet} · Row{" "}
                      {record.sourceRowNumber}
                    </p>
                  </td>

                  <td className="px-5 py-4">
                    <p className="font-black text-slate-900">
                      {record.supplierName ||
                        "Supplier name unavailable"}
                    </p>
                    <p className="mt-1 font-mono text-xs text-slate-500">
                      {record.supplierGstin ||
                        "GSTIN unavailable"}
                    </p>
                  </td>

                  <td className="px-5 py-4">
                    <p className="font-black text-slate-900">
                      {record.invoiceNumber}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDate(record.invoiceDate)}
                    </p>
                  </td>

                  <td className="px-5 py-4">
                    {record.matchedPurchaseId ? (
                      <>
                        <p className="font-bold text-slate-900">
                          {record.matchedPurchaseNumber ||
                            "Matched purchase"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          VertexERP purchase bill
                        </p>
                      </>
                    ) : (
                      <span className="text-sm text-slate-500">
                        No book match
                      </span>
                    )}
                  </td>

                  <td className="whitespace-nowrap px-5 py-4 font-bold text-slate-900">
                    {formatCurrency(record.invoiceValue)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                    {formatCurrency(record.taxableValue)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                    {formatCurrency(record.igst)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                    {formatCurrency(record.cgst)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                    {formatCurrency(record.sgst)}
                  </td>

                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-900">
                      {record.itcAvailability ||
                        "Not specified"}
                    </p>
                    {record.reasonForItcUnavailability && (
                      <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">
                        {
                          record.reasonForItcUnavailability
                        }
                      </p>
                    )}
                  </td>

                  <td className="max-w-md px-5 py-4 text-sm leading-6 text-slate-700">
                    {record.mismatchReason ||
                      "Portal and book values are within ₹1 tolerance."}
                  </td>

                  <td className="px-5 py-4">
                    {record.matchedPurchaseId ? (
                      <Link
                        href={`/purchase/bill/${record.matchedPurchaseId}`}
                        className="inline-flex rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-bold text-violet-700 transition hover:bg-violet-100"
                      >
                        View Purchase
                      </Link>
                    ) : (
                      <Link
                        href="/purchase"
                        className="inline-flex rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
                      >
                        Open Purchases
                      </Link>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {currentRecords.length > 0 && (
        <div className="border-t border-slate-200 p-4 sm:p-6">
          <div className="flex flex-col gap-4 rounded-3xl border border-orange-200 bg-orange-50 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-black text-orange-900">
                Purchases missing in the selected GSTR-2B
              </h3>
              <p className="mt-1 text-sm leading-6 text-orange-800">
                {booksMissingIn2B.length} registered-supplier
                purchase bill(s) with GST are not linked to the
                current portal records.
              </p>
            </div>

            <button
              type="button"
              onClick={exportBooksMissingIn2B}
              disabled={booksMissingIn2B.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3 font-black text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-5 w-5" />
              Export Missing in 2B
            </button>
          </div>
        </div>
      )}

      <div className="border-t border-amber-200 bg-amber-50 p-5 text-amber-900 sm:p-6">
        <p className="font-black">Compliance note</p>
        <p className="mt-1 text-sm leading-6">
          “Potential Matched ITC” is a reconciliation aid, not a
          final legal eligibility decision. Reverse charge,
          blocked credits, time limits, supplier compliance,
          amendments and accountant review must still be
          considered before claiming ITC.
        </p>
      </div>
    </section>
  );
}

function SummaryCard({
  title,
  value,
  detail,
  icon,
  className,
  isCurrency = false,
}: {
  title: string;
  value: number;
  detail: string;
  icon: ReactNode;
  className: string;
  isCurrency?: boolean;
}) {
  return (
    <article className={`rounded-3xl border p-5 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-bold">{title}</p>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70">
          {icon}
        </span>
      </div>
      <p className="mt-4 break-words text-3xl font-black">
        {isCurrency ? formatCurrency(value) : value}
      </p>
      <p className="mt-2 text-sm leading-6 opacity-80">
        {detail}
      </p>
    </article>
  );
}