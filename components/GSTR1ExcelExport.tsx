"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";

type ProfileRow = {
  active_company_id: string | null;
};

type CompanyRow = {
  id: string;
  name: string;
  legal_name: string | null;
  gst_number: string | null;
  state: string | null;
  state_code: string | null;
};

type LedgerRow = {
  id: string;
  name: string;
  gst_number: string | null;
  state: string | null;
  state_code: string | null;
};

type ProductRow = {
  id: string;
  unit: string | null;
};

type SaleItemRow = {
  id: string;
  product_id: string | null;
  product_name: string | null;
  hsn_sac_code: string | null;
  quantity: number | string | null;
  gst_rate: number | string | null;
  taxable_amount: number | string | null;
  cgst_amount: number | string | null;
  sgst_amount: number | string | null;
  igst_amount: number | string | null;
  cess_amount: number | string | null;
  amount: number | string | null;
};

type SaleRow = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  place_of_supply: string | null;
  place_of_supply_code: string | null;
  tax_type: string | null;
  grand_total: number | string | null;
  customer: LedgerRow | LedgerRow[] | null;
  sale_items: SaleItemRow[] | null;
};

type CreditNoteItemRow = {
  id: string;
  product_id: string | null;
  product_name: string | null;
  quantity: number | string | null;
  hsn_sac_code: string | null;
  taxable_amount: number | string | null;
  cgst_amount: number | string | null;
  sgst_amount: number | string | null;
  igst_amount: number | string | null;
  cess_amount: number | string | null;
  amount: number | string | null;
};

type CreditNoteRow = {
  id: string;
  source_sale_id: string;
  credit_note_number: string;
  credit_note_date: string;
  place_of_supply: string | null;
  place_of_supply_code: string | null;
  tax_type: string | null;
  grand_total: number | string | null;
  status: "POSTED" | "VOID";
  credit_note_items: CreditNoteItemRow[] | null;
};

type RateBucket = {
  rate: number;
  taxable: number;
  cess: number;
  cgst: number;
  sgst: number;
  igst: number;
  quantity: number;
  totalValue: number;
};

type HsnBucket = RateBucket & {
  hsn: string;
  description: string;
  uqc: string;
};

type WorkbookData = {
  b2b: unknown[][];
  b2cl: unknown[][];
  b2cs: unknown[][];
  cdnr: unknown[][];
  cdnur: unknown[][];
  exemp: unknown[][];
  hsnB2b: unknown[][];
  hsnB2c: unknown[][];
  docs: unknown[][];
  counts: {
    b2bInvoices: number;
    b2clInvoices: number;
    b2csBuckets: number;
    registeredNotes: number;
    unregisteredLargeNotes: number;
    hsnRows: number;
  };
  warnings: string[];
};

type GSTR1ExcelExportProps = {
  fromDate: string;
  toDate: string;
};

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const INVOICE_PATTERN = /^[A-Za-z0-9/-]{1,16}$/;

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

function getJoinedLedger(value: LedgerRow | LedgerRow[] | null) {
  return Array.isArray(value) ? value[0] || null : value;
}

function normalizeGstin(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

function isValidGstin(value: unknown) {
  return GSTIN_PATTERN.test(normalizeGstin(value));
}

function formatOfflineDate(value: string) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${String(date.getDate()).padStart(2, "0")}-${months[date.getMonth()]}-${date.getFullYear()}`;
}

function formatPlaceOfSupply(code: string | null, state: string | null) {
  const normalizedCode = String(code || "").trim();
  const normalizedState = String(state || "").trim();
  if (normalizedCode && normalizedState) return `${normalizedCode}-${normalizedState}`;
  return normalizedCode || normalizedState;
}

function getB2clThreshold(invoiceDate: string) {
  return invoiceDate >= "2024-08-01" ? 100000 : 250000;
}

function isB2clSale(sale: SaleRow) {
  const party = getJoinedLedger(sale.customer);
  return (
    !isValidGstin(party?.gst_number) &&
    String(sale.tax_type || "") === "INTER_STATE" &&
    toNumber(sale.grand_total) > getB2clThreshold(sale.invoice_date)
  );
}

function isB2bSale(sale: SaleRow) {
  return isValidGstin(getJoinedLedger(sale.customer)?.gst_number);
}

function normalizeUqc(unit: string | null | undefined) {
  const normalized = String(unit || "").trim().toUpperCase();
  const map: Record<string, string> = {
    PCS: "PCS-PIECES",
    PIECE: "PCS-PIECES",
    PIECES: "PCS-PIECES",
    NOS: "NOS-NUMBERS",
    NO: "NOS-NUMBERS",
    NUMBER: "NOS-NUMBERS",
    NUMBERS: "NOS-NUMBERS",
    KG: "KGS-KILOGRAMS",
    KGS: "KGS-KILOGRAMS",
    KILOGRAM: "KGS-KILOGRAMS",
    KILOGRAMS: "KGS-KILOGRAMS",
    GM: "GMS-GRAMMES",
    GMS: "GMS-GRAMMES",
    GRAM: "GMS-GRAMMES",
    LTR: "LTR-LITRES",
    LITRE: "LTR-LITRES",
    LITRES: "LTR-LITRES",
    MTR: "MTR-METERS",
    METER: "MTR-METERS",
    METERS: "MTR-METERS",
    BOX: "BOX-BOX",
    SET: "SET-SETS",
    DOZ: "DOZ-DOZENS",
    TON: "TON-TONNES",
  };
  return map[normalized] || "OTH-OTHERS";
}

function groupByRate(items: Array<SaleItemRow | CreditNoteItemRow>) {
  const buckets = new Map<number, RateBucket>();
  items.forEach((item) => {
    const rate = roundMoney(
      "gst_rate" in item ? toNumber(item.gst_rate) : 0,
    );
    const current = buckets.get(rate) || {
      rate,
      taxable: 0,
      cess: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      quantity: 0,
      totalValue: 0,
    };
    current.taxable += toNumber(item.taxable_amount);
    current.cess += toNumber(item.cess_amount);
    current.cgst += toNumber(item.cgst_amount);
    current.sgst += toNumber(item.sgst_amount);
    current.igst += toNumber(item.igst_amount);
    current.quantity += toNumber(item.quantity);
    current.totalValue += toNumber(item.amount);
    buckets.set(rate, current);
  });
  return Array.from(buckets.values()).map((bucket) => ({
    ...bucket,
    taxable: roundMoney(bucket.taxable),
    cess: roundMoney(bucket.cess),
    cgst: roundMoney(bucket.cgst),
    sgst: roundMoney(bucket.sgst),
    igst: roundMoney(bucket.igst),
    quantity: roundMoney(bucket.quantity),
    totalValue: roundMoney(bucket.totalValue),
  }));
}

function getRateForCreditItem(
  item: CreditNoteItemRow,
  sourceSale: SaleRow | undefined,
) {
  const sourceItem = (sourceSale?.sale_items || []).find(
    (saleItem) => saleItem.product_id && saleItem.product_id === item.product_id,
  );
  if (sourceItem) return toNumber(sourceItem.gst_rate);
  const tax =
    toNumber(item.cgst_amount) +
    toNumber(item.sgst_amount) +
    toNumber(item.igst_amount);
  const taxable = toNumber(item.taxable_amount);
  return taxable > 0 ? roundMoney((tax * 100) / taxable) : 0;
}

function addHsnItems(
  target: Map<string, HsnBucket>,
  items: Array<SaleItemRow | CreditNoteItemRow>,
  productUnits: Map<string, string>,
  sign: 1 | -1,
  sourceSale?: SaleRow,
) {
  items.forEach((item) => {
    const rate =
      "gst_rate" in item
        ? toNumber(item.gst_rate)
        : getRateForCreditItem(item, sourceSale);
    const hsn = String(item.hsn_sac_code || "").trim() || "UNCLASSIFIED";
    const uqc = normalizeUqc(
      item.product_id ? productUnits.get(item.product_id) : null,
    );
    const key = `${hsn}|${roundMoney(rate)}|${uqc}`;
    const current = target.get(key) || {
      hsn,
      description: String(item.product_name || "Product / Service"),
      uqc,
      rate: roundMoney(rate),
      taxable: 0,
      cess: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      quantity: 0,
      totalValue: 0,
    };
    current.taxable += sign * toNumber(item.taxable_amount);
    current.cess += sign * toNumber(item.cess_amount);
    current.cgst += sign * toNumber(item.cgst_amount);
    current.sgst += sign * toNumber(item.sgst_amount);
    current.igst += sign * toNumber(item.igst_amount);
    current.quantity += sign * toNumber(item.quantity);
    current.totalValue += sign * toNumber(item.amount);
    target.set(key, current);
  });
}

function sumUniqueDocumentValues(
  rows: unknown[][],
  keyIndexes: number[],
  valueIndex: number,
) {
  const values = new Map<string, number>();
  rows.forEach((row) => {
    const key = keyIndexes.map((index) => String(row[index] ?? "")).join("|");
    if (!values.has(key)) values.set(key, toNumber(row[valueIndex]));
  });
  return roundMoney(Array.from(values.values()).reduce((sum, value) => sum + value, 0));
}

function createSheet(
  title: string,
  summaryLabels: unknown[],
  summaryValues: unknown[],
  headers: string[],
  rows: unknown[][],
) {
  const sheet = XLSX.utils.aoa_to_sheet([
    [title],
    summaryLabels,
    summaryValues,
    headers,
    ...rows,
  ]);
  const endColumn = XLSX.utils.encode_col(Math.max(headers.length - 1, 0));
  sheet["!autofilter"] = { ref: `A4:${endColumn}4` };
  sheet["!freeze"] = { xSplit: 0, ySplit: 4 } as never;
  sheet["!cols"] = headers.map((header) => ({
    wch: Math.min(Math.max(header.length + 3, 14), 32),
  }));
  return sheet;
}

function buildWorkbookData(
  company: CompanyRow,
  sales: SaleRow[],
  notes: CreditNoteRow[],
  sourceSales: Map<string, SaleRow>,
  productUnits: Map<string, string>,
): WorkbookData {
  const warnings = new Set<string>();
  const b2b: unknown[][] = [];
  const b2cl: unknown[][] = [];
  const cdnr: unknown[][] = [];
  const cdnur: unknown[][] = [];
  const b2csBuckets = new Map<string, RateBucket & { pos: string; type: string }>();
  const hsnB2bMap = new Map<string, HsnBucket>();
  const hsnB2cMap = new Map<string, HsnBucket>();
  const exemptMap = new Map<string, number>();

  if (!isValidGstin(company.gst_number)) {
    warnings.add("Active company GSTIN is missing or invalid. Validate it before using the workbook in the GST Returns Offline Tool.");
  }
  if (!String(company.state_code || "").trim()) {
    warnings.add("Active company State Code is missing. Inter-State/Intra-State exempt-supply classification needs review.");
  }

  function validateSale(sale: SaleRow) {
    if (!INVOICE_PATTERN.test(String(sale.invoice_number || ""))) {
      warnings.add(`Invoice ${sale.invoice_number || "(missing)"} does not follow the GST invoice-number rule of maximum 16 characters using letters, numbers, dash or slash.`);
    }
    if (!sale.place_of_supply_code) {
      warnings.add(`Invoice ${sale.invoice_number} is missing Place of Supply code.`);
    }
    if (String(sale.tax_type || "") === "UNCLASSIFIED" || !sale.tax_type) {
      warnings.add(`Invoice ${sale.invoice_number} is unclassified and is excluded from taxable GSTR-1 sheets.`);
    }
    if (String(sale.tax_type || "") === "ZERO_RATED") {
      warnings.add(`Invoice ${sale.invoice_number} is zero-rated. Export/SEZ fields are not available in the current sales schema, so it is excluded from the offline workbook.`);
    }
    const partyGstin = normalizeGstin(getJoinedLedger(sale.customer)?.gst_number);
    if (partyGstin && !isValidGstin(partyGstin)) {
      warnings.add(`Invoice ${sale.invoice_number} has an invalid customer GSTIN and is treated as B2C for this export.`);
    }
    if ((sale.sale_items || []).some((item) => !String(item.hsn_sac_code || "").trim())) {
      warnings.add(`Invoice ${sale.invoice_number} contains item(s) without HSN/SAC.`);
    }
  }

  sales.forEach((sale) => {
    validateSale(sale);
    const taxType = String(sale.tax_type || "UNCLASSIFIED");
    if (taxType === "UNCLASSIFIED" || taxType === "ZERO_RATED") return;

    const party = getJoinedLedger(sale.customer);
    const registered = isB2bSale(sale);
    const b2clSale = isB2clSale(sale);
    const pos = formatPlaceOfSupply(
      sale.place_of_supply_code,
      sale.place_of_supply || party?.state || null,
    );
    const rateBuckets = groupByRate(sale.sale_items || []);

    if (taxType === "EXEMPT") {
      const inter = Boolean(
        company.state_code &&
          sale.place_of_supply_code &&
          company.state_code !== sale.place_of_supply_code,
      );
      const description = `${inter ? "Inter" : "Intra"}-State supplies to ${registered ? "registered" : "unregistered"} persons`;
      const value = (sale.sale_items || []).reduce(
        (total, item) => total + (toNumber(item.taxable_amount) || toNumber(item.amount)),
        0,
      );
      exemptMap.set(description, (exemptMap.get(description) || 0) + value);
      return;
    }

    if (registered) {
      rateBuckets.forEach((bucket) => {
        b2b.push([
          normalizeGstin(party?.gst_number),
          party?.name || "Recipient",
          sale.invoice_number,
          formatOfflineDate(sale.invoice_date),
          roundMoney(toNumber(sale.grand_total)),
          pos,
          "N",
          "",
          "Regular B2B",
          "",
          bucket.rate,
          bucket.taxable,
          bucket.cess,
        ]);
      });
      addHsnItems(hsnB2bMap, sale.sale_items || [], productUnits, 1);
      return;
    }

    if (b2clSale) {
      rateBuckets.forEach((bucket) => {
        b2cl.push([
          sale.invoice_number,
          formatOfflineDate(sale.invoice_date),
          roundMoney(toNumber(sale.grand_total)),
          pos,
          "",
          bucket.rate,
          bucket.taxable,
          bucket.cess,
          "",
        ]);
      });
    } else {
      rateBuckets.forEach((bucket) => {
        const key = `${pos}|${bucket.rate}`;
        const current = b2csBuckets.get(key) || {
          ...bucket,
          taxable: 0,
          cess: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          quantity: 0,
          totalValue: 0,
          pos,
          type: "OE",
        };
        current.taxable += bucket.taxable;
        current.cess += bucket.cess;
        current.cgst += bucket.cgst;
        current.sgst += bucket.sgst;
        current.igst += bucket.igst;
        current.quantity += bucket.quantity;
        current.totalValue += bucket.totalValue;
        b2csBuckets.set(key, current);
      });
    }
    addHsnItems(hsnB2cMap, sale.sale_items || [], productUnits, 1);
  });

  notes.forEach((note) => {
    if (note.status !== "POSTED") return;
    const sourceSale = sourceSales.get(note.source_sale_id);
    if (!sourceSale) {
      warnings.add(`Credit Note ${note.credit_note_number} cannot resolve its source sales invoice and is excluded.`);
      return;
    }
    const party = getJoinedLedger(sourceSale.customer);
    const registered = isValidGstin(party?.gst_number);
    if (!INVOICE_PATTERN.test(String(note.credit_note_number || ""))) {
      warnings.add(`Credit Note ${note.credit_note_number || "(missing)"} does not follow the maximum 16-character document-number rule.`);
    }
    if (!(note.place_of_supply_code || sourceSale.place_of_supply_code)) {
      warnings.add(`Credit Note ${note.credit_note_number} is missing Place of Supply code.`);
    }
    if ((note.credit_note_items || []).some((item) => !String(item.hsn_sac_code || "").trim())) {
      warnings.add(`Credit Note ${note.credit_note_number} contains item(s) without HSN/SAC.`);
    }
    const sourceWasB2cl = isB2clSale(sourceSale);
    const pos = formatPlaceOfSupply(
      note.place_of_supply_code || sourceSale.place_of_supply_code,
      note.place_of_supply || sourceSale.place_of_supply || party?.state || null,
    );

    const noteItemsWithRates = (note.credit_note_items || []).map((item) => ({
      ...item,
      gst_rate: getRateForCreditItem(item, sourceSale),
    }));
    const rateBuckets = groupByRate(noteItemsWithRates as SaleItemRow[]);

    if (String(note.tax_type || sourceSale.tax_type || "") === "EXEMPT") {
      const notePosCode = note.place_of_supply_code || sourceSale.place_of_supply_code;
      const inter = Boolean(
        company.state_code &&
          notePosCode &&
          company.state_code !== notePosCode,
      );
      const description = `${inter ? "Inter" : "Intra"}-State supplies to ${registered ? "registered" : "unregistered"} persons`;
      const value = (note.credit_note_items || []).reduce(
        (total, item) => total + (toNumber(item.taxable_amount) || toNumber(item.amount)),
        0,
      );
      exemptMap.set(description, (exemptMap.get(description) || 0) - value);
      return;
    }

    if (registered) {
      rateBuckets.forEach((bucket) => {
        cdnr.push([
          normalizeGstin(party?.gst_number),
          party?.name || "Recipient",
          note.credit_note_number,
          formatOfflineDate(note.credit_note_date),
          "C",
          pos,
          "N",
          "Regular B2B",
          roundMoney(toNumber(note.grand_total)),
          "",
          bucket.rate,
          bucket.taxable,
          bucket.cess,
        ]);
      });
      addHsnItems(
        hsnB2bMap,
        note.credit_note_items || [],
        productUnits,
        -1,
        sourceSale,
      );
      return;
    }

    if (sourceWasB2cl) {
      rateBuckets.forEach((bucket) => {
        cdnur.push([
          "B2CL",
          note.credit_note_number,
          formatOfflineDate(note.credit_note_date),
          "C",
          pos,
          roundMoney(toNumber(note.grand_total)),
          "",
          bucket.rate,
          bucket.taxable,
          bucket.cess,
        ]);
      });
    } else {
      rateBuckets.forEach((bucket) => {
        const key = `${pos}|${bucket.rate}`;
        const current = b2csBuckets.get(key) || {
          ...bucket,
          taxable: 0,
          cess: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          quantity: 0,
          totalValue: 0,
          pos,
          type: "OE",
        };
        current.taxable -= bucket.taxable;
        current.cess -= bucket.cess;
        current.cgst -= bucket.cgst;
        current.sgst -= bucket.sgst;
        current.igst -= bucket.igst;
        current.quantity -= bucket.quantity;
        current.totalValue -= bucket.totalValue;
        b2csBuckets.set(key, current);
      });
    }
    addHsnItems(
      hsnB2cMap,
      note.credit_note_items || [],
      productUnits,
      -1,
      sourceSale,
    );
  });

  const b2cs = Array.from(b2csBuckets.values())
    .filter((bucket) => Math.abs(bucket.taxable) > 0.01 || Math.abs(bucket.cess) > 0.01)
    .sort((a, b) => a.pos.localeCompare(b.pos) || a.rate - b.rate)
    .map((bucket) => [
      bucket.type,
      bucket.pos,
      "",
      bucket.rate,
      roundMoney(bucket.taxable),
      roundMoney(bucket.cess),
      "",
    ]);

  const exemptDescriptions = [
    "Inter-State supplies to registered persons",
    "Intra-State supplies to registered persons",
    "Inter-State supplies to unregistered persons",
    "Intra-State supplies to unregistered persons",
  ];
  const exemp = exemptDescriptions.map((description) => [
    description,
    0,
    roundMoney(exemptMap.get(description) || 0),
    0,
  ]);

  function hsnRows(map: Map<string, HsnBucket>) {
    return Array.from(map.values())
      .filter((bucket) => Math.abs(bucket.taxable) > 0.01 || Math.abs(bucket.totalValue) > 0.01)
      .sort((a, b) => a.hsn.localeCompare(b.hsn) || a.rate - b.rate)
      .map((bucket) => [
        bucket.hsn,
        bucket.description,
        bucket.uqc,
        roundMoney(bucket.quantity),
        roundMoney(bucket.totalValue),
        bucket.rate,
        roundMoney(bucket.taxable),
        roundMoney(bucket.igst),
        roundMoney(bucket.cgst),
        roundMoney(bucket.sgst),
        roundMoney(bucket.cess),
      ]);
  }

  const hsnB2b = hsnRows(hsnB2bMap);
  const hsnB2c = hsnRows(hsnB2cMap);

  const sortedSales = [...sales].sort(
    (a, b) => a.invoice_date.localeCompare(b.invoice_date) || a.invoice_number.localeCompare(b.invoice_number),
  );
  const sortedNotes = [...notes]
    .filter((note) => note.status === "POSTED")
    .sort(
      (a, b) => a.credit_note_date.localeCompare(b.credit_note_date) || a.credit_note_number.localeCompare(b.credit_note_number),
    );
  const docs: unknown[][] = [];
  if (sortedSales.length > 0) {
    docs.push([
      "Invoices for outward supply",
      sortedSales[0].invoice_number,
      sortedSales[sortedSales.length - 1].invoice_number,
      sortedSales.length,
      0,
    ]);
  }
  if (sortedNotes.length > 0) {
    docs.push([
      "Credit Note",
      sortedNotes[0].credit_note_number,
      sortedNotes[sortedNotes.length - 1].credit_note_number,
      sortedNotes.length,
      0,
    ]);
  }

  if (sales.some((sale) => String(sale.tax_type || "") === "EXEMPT")) {
    warnings.add("VertexERP currently stores EXEMPT as one combined classification. The workbook places it in the Exempted column; review Nil-rated and Non-GST splits manually.");
  }
  warnings.add("Export, SEZ, deemed export, advances, amendments and e-commerce sections require dedicated source fields and are intentionally not guessed in this workbook.");
  warnings.add("Cancelled-document counts are not available in the current schema, so the DOCS sheet uses zero cancelled documents. Verify this before filing.");

  return {
    b2b,
    b2cl,
    b2cs,
    cdnr,
    cdnur,
    exemp,
    hsnB2b,
    hsnB2c,
    docs,
    counts: {
      b2bInvoices: new Set(b2b.map((row) => String(row[2]))).size,
      b2clInvoices: new Set(b2cl.map((row) => String(row[0]))).size,
      b2csBuckets: b2cs.length,
      registeredNotes: new Set(cdnr.map((row) => String(row[2]))).size,
      unregisteredLargeNotes: new Set(cdnur.map((row) => String(row[1]))).size,
      hsnRows: hsnB2b.length + hsnB2c.length,
    },
    warnings: Array.from(warnings),
  };
}

export default function GSTR1ExcelExport({
  fromDate,
  toDate,
}: GSTR1ExcelExportProps) {
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [notes, setNotes] = useState<CreditNoteRow[]>([]);
  const [sourceSales, setSourceSales] = useState<Map<string, SaleRow>>(new Map());
  const [productUnits, setProductUnits] = useState<Map<string, string>>(new Map());
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  async function loadData() {
    setIsLoading(true);
    setMessage("");

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Please sign in to prepare the GSTR-1 workbook.");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("active_company_id")
        .eq("id", user.id)
        .maybeSingle();
      if (profileError) throw profileError;
      const companyId = (profile as ProfileRow | null)?.active_company_id || null;
      if (!companyId) throw new Error("Select an active company first.");

      let salesQuery = supabase
        .from("sales")
        .select(
          `
            id,
            invoice_number,
            invoice_date,
            place_of_supply,
            place_of_supply_code,
            tax_type,
            grand_total,
            customer:ledgers!sales_customer_id_fkey(
              id, name, gst_number, state, state_code
            ),
            sale_items(
              id, product_id, product_name, hsn_sac_code, quantity, gst_rate,
              taxable_amount, cgst_amount, sgst_amount, igst_amount,
              cess_amount, amount
            )
          `,
        )
        .eq("company_id", companyId);

      let notesQuery = supabase
        .from("credit_notes")
        .select(
          `
            id,
            source_sale_id,
            credit_note_number,
            credit_note_date,
            place_of_supply,
            place_of_supply_code,
            tax_type,
            grand_total,
            status,
            credit_note_items(
              id, product_id, product_name, quantity, hsn_sac_code,
              taxable_amount, cgst_amount, sgst_amount, igst_amount,
              cess_amount, amount
            )
          `,
        )
        .eq("company_id", companyId)
        .eq("status", "POSTED");

      if (fromDate) {
        salesQuery = salesQuery.gte("invoice_date", fromDate);
        notesQuery = notesQuery.gte("credit_note_date", fromDate);
      }
      if (toDate) {
        salesQuery = salesQuery.lte("invoice_date", toDate);
        notesQuery = notesQuery.lte("credit_note_date", toDate);
      }

      const [companyResponse, salesResponse, notesResponse, productsResponse] = await Promise.all([
        supabase
          .from("companies")
          .select("id, name, legal_name, gst_number, state, state_code")
          .eq("id", companyId)
          .maybeSingle(),
        salesQuery.order("invoice_date", { ascending: true }),
        notesQuery.order("credit_note_date", { ascending: true }),
        supabase.from("products").select("id, unit").eq("company_id", companyId),
      ]);

      if (companyResponse.error) throw companyResponse.error;
      if (salesResponse.error) throw salesResponse.error;
      if (notesResponse.error) throw notesResponse.error;
      if (productsResponse.error) throw productsResponse.error;
      if (!companyResponse.data) throw new Error("Active company could not be loaded.");

      const nextSales = (salesResponse.data || []) as unknown as SaleRow[];
      const nextNotes = (notesResponse.data || []) as unknown as CreditNoteRow[];
      const sourceMap = new Map(nextSales.map((sale) => [sale.id, sale] as const));
      const missingSourceIds = Array.from(
        new Set(
          nextNotes
            .map((note) => note.source_sale_id)
            .filter((id) => id && !sourceMap.has(id)),
        ),
      );

      if (missingSourceIds.length > 0) {
        const { data, error } = await supabase
          .from("sales")
          .select(
            `
              id,
              invoice_number,
              invoice_date,
              place_of_supply,
              place_of_supply_code,
              tax_type,
              grand_total,
              customer:ledgers!sales_customer_id_fkey(
                id, name, gst_number, state, state_code
              ),
              sale_items(
                id, product_id, product_name, hsn_sac_code, quantity, gst_rate,
                taxable_amount, cgst_amount, sgst_amount, igst_amount,
                cess_amount, amount
              )
            `,
          )
          .eq("company_id", companyId)
          .in("id", missingSourceIds);
        if (error) throw error;
        ((data || []) as unknown as SaleRow[]).forEach((sale) => sourceMap.set(sale.id, sale));
      }

      setCompany(companyResponse.data as CompanyRow);
      setSales(nextSales);
      setNotes(nextNotes);
      setSourceSales(sourceMap);
      setProductUnits(
        new Map(
          ((productsResponse.data || []) as ProductRow[]).map((product) => [
            product.id,
            product.unit || "",
          ]),
        ),
      );
    } catch (error) {
      setCompany(null);
      setSales([]);
      setNotes([]);
      setSourceSales(new Map());
      setProductUnits(new Map());
      setMessage(error instanceof Error ? error.message : "GSTR-1 workbook data could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const events = [
      "vertexerp-sales-updated",
      "vertexerp-gst-data-updated",
      "vertexerp-products-updated",
      "vertexerp-active-company-updated",
    ];
    events.forEach((eventName) => window.addEventListener(eventName, loadData));
    return () => events.forEach((eventName) => window.removeEventListener(eventName, loadData));
  }, [fromDate, toDate]);

  const workbookData = useMemo(
    () =>
      company
        ? buildWorkbookData(company, sales, notes, sourceSales, productUnits)
        : null,
    [company, sales, notes, sourceSales, productUnits],
  );

  function exportWorkbook() {
    if (!company || !workbookData) return;
    setIsExporting(true);

    try {
      const workbook = XLSX.utils.book_new();

      const b2bHeaders = [
        "GSTIN/UIN of Recipient",
        "Receiver Name",
        "Invoice Number",
        "Invoice date",
        "Invoice Value",
        "Place Of Supply",
        "Reverse Charge",
        "Applicable % of Tax Rate",
        "Invoice Type",
        "E-Commerce GSTIN",
        "Rate",
        "Taxable Value",
        "Cess Amount",
      ];
      const b2clHeaders = [
        "Invoice Number",
        "Invoice date",
        "Invoice Value",
        "Place Of Supply",
        "Applicable % of Tax Rate",
        "Rate",
        "Taxable Value",
        "Cess Amount",
        "E-Commerce GSTIN",
      ];
      const b2csHeaders = [
        "Type",
        "Place Of Supply",
        "Applicable % of Tax Rate",
        "Rate",
        "Taxable Value",
        "Cess Amount",
        "E-Commerce GSTIN",
      ];
      const cdnrHeaders = [
        "GSTIN/UIN of Recipient",
        "Receiver Name",
        "Note Number",
        "Note Date",
        "Note Type",
        "Place Of Supply",
        "Reverse Charge",
        "Note Supply Type",
        "Note Value",
        "Applicable % of Tax Rate",
        "Rate",
        "Taxable Value",
        "Cess Amount",
      ];
      const cdnurHeaders = [
        "UR Type",
        "Note Number",
        "Note Date",
        "Note Type",
        "Place Of Supply",
        "Note Value",
        "Applicable % of Tax Rate",
        "Rate",
        "Taxable Value",
        "Cess Amount",
      ];
      const exempHeaders = [
        "Description",
        "Nil Rated Supplies",
        "Exempted (other than nil rated/non GST supply)",
        "Non-GST Supplies",
      ];
      const hsnHeaders = [
        "HSN",
        "Description",
        "UQC",
        "Total Quantity",
        "Total Value",
        "Rate",
        "Taxable Value",
        "Integrated Tax Amount",
        "Central Tax Amount",
        "State/UT Tax Amount",
        "Cess Amount",
      ];
      const docsHeaders = [
        "Nature of Document",
        "Sr. No. From",
        "Sr. No. To",
        "Total Number",
        "Cancelled",
      ];

      XLSX.utils.book_append_sheet(
        workbook,
        createSheet(
          "Summary For B2B, SEZ, DE (4A, 4B, 6B, 6C)",
          ["No. of Recipients", "No. of Invoices", "Total Invoice Value", "Total Taxable Value", "Total Cess"],
          [
            new Set(workbookData.b2b.map((row) => String(row[0]))).size,
            workbookData.counts.b2bInvoices,
            sumUniqueDocumentValues(workbookData.b2b, [0, 2], 4),
            roundMoney(workbookData.b2b.reduce((sum, row) => sum + toNumber(row[11]), 0)),
            roundMoney(workbookData.b2b.reduce((sum, row) => sum + toNumber(row[12]), 0)),
          ],
          b2bHeaders,
          workbookData.b2b,
        ),
        "b2b,sez,de",
      );
      XLSX.utils.book_append_sheet(
        workbook,
        createSheet(
          "Summary For B2CL (5)",
          ["No. of Invoices", "Total Invoice Value", "Total Taxable Value", "Total Cess"],
          [
            workbookData.counts.b2clInvoices,
            sumUniqueDocumentValues(workbookData.b2cl, [0], 2),
            roundMoney(workbookData.b2cl.reduce((sum, row) => sum + toNumber(row[6]), 0)),
            roundMoney(workbookData.b2cl.reduce((sum, row) => sum + toNumber(row[7]), 0)),
          ],
          b2clHeaders,
          workbookData.b2cl,
        ),
        "b2cl",
      );
      XLSX.utils.book_append_sheet(
        workbook,
        createSheet(
          "Summary For B2CS (7)",
          ["No. of Rate/POS Buckets", "Total Taxable Value", "Total Cess"],
          [
            workbookData.counts.b2csBuckets,
            roundMoney(workbookData.b2cs.reduce((sum, row) => sum + toNumber(row[4]), 0)),
            roundMoney(workbookData.b2cs.reduce((sum, row) => sum + toNumber(row[5]), 0)),
          ],
          b2csHeaders,
          workbookData.b2cs,
        ),
        "b2cs",
      );
      XLSX.utils.book_append_sheet(
        workbook,
        createSheet(
          "Summary For CDNR (9B)",
          ["No. of Recipients", "No. of Notes", "Total Note Value", "Total Taxable Value", "Total Cess"],
          [
            new Set(workbookData.cdnr.map((row) => String(row[0]))).size,
            workbookData.counts.registeredNotes,
            sumUniqueDocumentValues(workbookData.cdnr, [0, 2], 8),
            roundMoney(workbookData.cdnr.reduce((sum, row) => sum + toNumber(row[11]), 0)),
            roundMoney(workbookData.cdnr.reduce((sum, row) => sum + toNumber(row[12]), 0)),
          ],
          cdnrHeaders,
          workbookData.cdnr,
        ),
        "cdnr",
      );
      XLSX.utils.book_append_sheet(
        workbook,
        createSheet(
          "Summary For CDNUR (9B)",
          ["No. of Notes/Vouchers", "Total Note Value", "Total Taxable Value", "Total Cess"],
          [
            workbookData.counts.unregisteredLargeNotes,
            sumUniqueDocumentValues(workbookData.cdnur, [1], 5),
            roundMoney(workbookData.cdnur.reduce((sum, row) => sum + toNumber(row[8]), 0)),
            roundMoney(workbookData.cdnur.reduce((sum, row) => sum + toNumber(row[9]), 0)),
          ],
          cdnurHeaders,
          workbookData.cdnur,
        ),
        "cdnur",
      );
      XLSX.utils.book_append_sheet(
        workbook,
        createSheet(
          "Summary For Nil rated, exempted and non GST outward supplies (8)",
          ["Total Nil Rated Supplies", "Total Exempted Supplies", "Total Non-GST Supplies"],
          [
            roundMoney(workbookData.exemp.reduce((sum, row) => sum + toNumber(row[1]), 0)),
            roundMoney(workbookData.exemp.reduce((sum, row) => sum + toNumber(row[2]), 0)),
            roundMoney(workbookData.exemp.reduce((sum, row) => sum + toNumber(row[3]), 0)),
          ],
          exempHeaders,
          workbookData.exemp,
        ),
        "exemp",
      );
      XLSX.utils.book_append_sheet(
        workbook,
        createSheet(
          "Summary for HSN B2B (12)",
          ["No. of HSN", "Total Value", "Total Taxable Value", "Total Cess"],
          [
            workbookData.hsnB2b.length,
            roundMoney(workbookData.hsnB2b.reduce((sum, row) => sum + toNumber(row[4]), 0)),
            roundMoney(workbookData.hsnB2b.reduce((sum, row) => sum + toNumber(row[6]), 0)),
            roundMoney(workbookData.hsnB2b.reduce((sum, row) => sum + toNumber(row[10]), 0)),
          ],
          hsnHeaders,
          workbookData.hsnB2b,
        ),
        "hsn(b2b)",
      );
      XLSX.utils.book_append_sheet(
        workbook,
        createSheet(
          "Summary for HSN B2C (12)",
          ["No. of HSN", "Total Value", "Total Taxable Value", "Total Cess"],
          [
            workbookData.hsnB2c.length,
            roundMoney(workbookData.hsnB2c.reduce((sum, row) => sum + toNumber(row[4]), 0)),
            roundMoney(workbookData.hsnB2c.reduce((sum, row) => sum + toNumber(row[6]), 0)),
            roundMoney(workbookData.hsnB2c.reduce((sum, row) => sum + toNumber(row[10]), 0)),
          ],
          hsnHeaders,
          workbookData.hsnB2c,
        ),
        "hsn(b2c)",
      );
      XLSX.utils.book_append_sheet(
        workbook,
        createSheet(
          "Summary of documents issued during the tax period (13)",
          ["Total Number", "Total Cancelled"],
          [
            workbookData.docs.reduce((sum, row) => sum + toNumber(row[3]), 0),
            workbookData.docs.reduce((sum, row) => sum + toNumber(row[4]), 0),
          ],
          docsHeaders,
          workbookData.docs,
        ),
        "docs",
      );

      const safeGstin = normalizeGstin(company.gst_number) || "unregistered";
      XLSX.writeFile(
        workbook,
        `vertexerp-gstr1-offline-${safeGstin}-${fromDate || "all"}-${toDate || "all"}.xlsx`,
        { compression: true },
      );
      setMessage("GSTR-1 Excel workbook exported. Validate it in the official GST Returns Offline Tool before generating portal JSON.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "GSTR-1 workbook could not be exported.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-xl shadow-violet-100/40">
      <div className="bg-gradient-to-r from-violet-950 via-violet-800 to-violet-700 p-5 text-white sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-violet-100">
              <FileSpreadsheet className="h-5 w-5" />
              <p className="text-sm font-black uppercase tracking-[0.18em]">
                GSTR-1 Offline Workbook
              </p>
            </div>
            <h2 className="mt-3 text-2xl font-black sm:text-3xl">
              Portal-Style Multi-Sheet Excel Export
            </h2>
            <p className="mt-2 max-w-3xl leading-7 text-violet-100">
              Prepare B2B, B2CL, B2CS, credit-note, exempt, HSN and document-series sheets using the active report period.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-3 font-black text-white transition hover:bg-white/20 disabled:opacity-60"
            >
              <RefreshCw className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={exportWorkbook}
              disabled={isLoading || isExporting || !company || !workbookData}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-black text-violet-700 transition hover:bg-violet-50 disabled:opacity-60"
            >
              {isExporting ? (
                <LoaderCircle className="h-5 w-5 animate-spin" />
              ) : (
                <Download className="h-5 w-5" />
              )}
              {isExporting ? "Exporting..." : "Export GSTR-1 Excel"}
            </button>
          </div>
        </div>
      </div>

      {message && (
        <div className="border-b border-blue-200 bg-blue-50 px-5 py-4 font-semibold text-blue-700 sm:px-6">
          {message}
        </div>
      )}

      <div className="p-5 sm:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-violet-100 bg-violet-50 p-10 font-semibold text-violet-700">
            <LoaderCircle className="h-6 w-6 animate-spin" />
            Preparing GSTR-1 classification...
          </div>
        ) : workbookData ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              <Metric label="B2B Invoices" value={workbookData.counts.b2bInvoices} />
              <Metric label="B2CL Invoices" value={workbookData.counts.b2clInvoices} />
              <Metric label="B2CS Buckets" value={workbookData.counts.b2csBuckets} />
              <Metric label="Registered Notes" value={workbookData.counts.registeredNotes} />
              <Metric label="CDNUR Notes" value={workbookData.counts.unregisteredLargeNotes} />
              <Metric label="HSN Rows" value={workbookData.counts.hsnRows} />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <h3 className="font-black">Workbook sections ready</h3>
                    <p className="mt-1 text-sm leading-6">
                      b2b,sez,de · b2cl · b2cs · cdnr · cdnur · exemp · hsn(b2b) · hsn(b2c) · docs
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <h3 className="font-black">Review before portal JSON</h3>
                    <p className="mt-1 text-sm leading-6">
                      Excel is prepared for the GST Returns Offline Tool. The GST Portal accepts the JSON generated and validated by that tool, not this Excel file directly.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {workbookData.warnings.length > 0 && (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                <p className="font-black">Classification warnings ({workbookData.warnings.length})</p>
                <div className="mt-3 space-y-2 text-sm leading-6">
                  {workbookData.warnings.slice(0, 8).map((warning) => (
                    <p key={warning}>• {warning}</p>
                  ))}
                  {workbookData.warnings.length > 8 && (
                    <p className="font-semibold">• {workbookData.warnings.length - 8} more warning(s) are included in this review count.</p>
                  )}
                </div>
              </div>
            )}

            <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              Active period: <strong>{fromDate || "All dates"}</strong> to <strong>{toDate || "All dates"}</strong> · Company: <strong>{company?.legal_name || company?.name || "Company"}</strong> · GSTIN: <strong>{company?.gst_number || "Unregistered"}</strong>
            </p>
          </>
        ) : (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 font-semibold text-red-700">
            GSTR-1 workbook data is unavailable.
          </div>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-violet-600">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900">{value.toLocaleString("en-IN")}</p>
    </article>
  );
}