"use client";

import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileSearch,
  Info,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react";
import {
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";

type ProfileRow = {
  active_company_id: string | null;
};

type LedgerRow = {
  id: string;
  name: string;
  gst_number: string | null;
  state: string | null;
  state_code: string | null;
};

type SourceItemRow = {
  id: string;
  product_name: string | null;
  hsn_sac_code: string | null;
  gst_rate: number | string | null;
  taxable_amount: number | string | null;
  gst_amount: number | string | null;
  cgst_amount: number | string | null;
  sgst_amount: number | string | null;
  igst_amount: number | string | null;
  cess_amount: number | string | null;
  amount: number | string | null;
};

type ReturnItemRow = {
  id: string;
  product_name: string | null;
  hsn_sac_code: string | null;
  taxable_amount: number | string | null;
  gst_amount: number | string | null;
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
  gst_total: number | string | null;
  cgst_total: number | string | null;
  sgst_total: number | string | null;
  igst_total: number | string | null;
  cess_total: number | string | null;
  grand_total: number | string | null;
  customer: LedgerRow | LedgerRow[] | null;
  sale_items: SourceItemRow[] | null;
};

type PurchaseRow = {
  id: string;
  bill_number: string;
  purchase_date: string;
  place_of_supply: string | null;
  place_of_supply_code: string | null;
  tax_type: string | null;
  gst_total: number | string | null;
  cgst_total: number | string | null;
  sgst_total: number | string | null;
  igst_total: number | string | null;
  cess_total: number | string | null;
  grand_total: number | string | null;
  supplier: LedgerRow | LedgerRow[] | null;
  purchase_items: SourceItemRow[] | null;
};

type CreditNoteRow = {
  id: string;
  source_sale_id: string;
  credit_note_number: string;
  credit_note_date: string;
  place_of_supply: string | null;
  place_of_supply_code: string | null;
  tax_type: string | null;
  gst_total: number | string | null;
  cgst_total: number | string | null;
  sgst_total: number | string | null;
  igst_total: number | string | null;
  cess_total: number | string | null;
  grand_total: number | string | null;
  status: "POSTED" | "VOID";
  credit_note_items: ReturnItemRow[] | null;
};

type DebitNoteRow = {
  id: string;
  source_purchase_id: string;
  debit_note_number: string;
  debit_note_date: string;
  place_of_supply: string | null;
  place_of_supply_code: string | null;
  tax_type: string | null;
  gst_total: number | string | null;
  cgst_total: number | string | null;
  sgst_total: number | string | null;
  igst_total: number | string | null;
  cess_total: number | string | null;
  grand_total: number | string | null;
  status: "POSTED" | "VOID";
  debit_note_items: ReturnItemRow[] | null;
};

type SourceSaleRow = {
  id: string;
  customer: LedgerRow | LedgerRow[] | null;
};

type SourcePurchaseRow = {
  id: string;
  supplier: LedgerRow | LedgerRow[] | null;
};

type DocumentType =
  | "SALE"
  | "PURCHASE"
  | "CREDIT_NOTE"
  | "DEBIT_NOTE";

type DocumentStatus = "POSTED" | "VOID";
type Severity = "ERROR" | "WARNING" | "INFO";
type IssueCategory =
  | "DOCUMENT"
  | "DUPLICATE"
  | "MASTER_DATA"
  | "CLASSIFICATION"
  | "HSN_SAC"
  | "TAX_SPLIT"
  | "TAX_CALCULATION"
  | "SOURCE_LINK"
  | "STATUS";

type AuditItem = {
  id: string;
  productName: string;
  hsnSacCode: string;
  gstRate: number | null;
  taxableAmount: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  amount: number;
};

type AuditDocument = {
  key: string;
  id: string;
  documentType: DocumentType;
  documentLabel: string;
  documentNumber: string;
  documentDate: string;
  partyName: string;
  partyGstin: string;
  partyState: string;
  partyStateCode: string;
  placeOfSupply: string;
  placeOfSupplyCode: string;
  taxType: string;
  status: DocumentStatus;
  sourceDocumentId: string;
  sourceAvailable: boolean;
  href: string;
  headerGstTotal: number;
  headerCgstTotal: number;
  headerSgstTotal: number;
  headerIgstTotal: number;
  headerCessTotal: number;
  headerGrandTotal: number;
  items: AuditItem[];
};

type GstIssue = {
  key: string;
  severity: Severity;
  category: IssueCategory;
  categoryLabel: string;
  documentKey: string;
  documentType: DocumentType;
  documentLabel: string;
  documentNumber: string;
  documentDate: string;
  partyName: string;
  taxType: string;
  title: string;
  detail: string;
  suggestion: string;
  affectedAmount: number;
  href: string;
};

type ItemTotals = {
  taxable: number;
  gst: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  grand: number;
};

const TOLERANCE = 0.1;

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

function isDifferent(left: number, right: number, tolerance = TOLERANCE) {
  return Math.abs(roundMoney(left) - roundMoney(right)) > tolerance;
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

function getCurrentFinancialYearDates() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const startYear = month >= 4 ? year : year - 1;

  return {
    from: `${startYear}-04-01`,
    to: `${startYear + 1}-03-31`,
  };
}

function getJoinedLedger(
  ledger: LedgerRow | LedgerRow[] | null
): LedgerRow | null {
  return Array.isArray(ledger) ? ledger[0] || null : ledger;
}

function getTaxTypeLabel(taxType: string) {
  if (taxType === "INTRA_STATE") {
    return "Intra-State";
  }

  if (taxType === "INTER_STATE") {
    return "Inter-State";
  }

  if (taxType === "EXEMPT") {
    return "Exempt / Nil Rated";
  }

  if (taxType === "ZERO_RATED") {
    return "Zero-Rated";
  }

  return "Unclassified";
}

function getCategoryLabel(category: IssueCategory) {
  const labels: Record<IssueCategory, string> = {
    DOCUMENT: "Document Data",
    DUPLICATE: "Duplicate Number",
    MASTER_DATA: "Party Master",
    CLASSIFICATION: "GST Classification",
    HSN_SAC: "HSN/SAC",
    TAX_SPLIT: "GST Tax Split",
    TAX_CALCULATION: "Tax Calculation",
    SOURCE_LINK: "Source Link",
    STATUS: "Document Status",
  };

  return labels[category];
}

function getDocumentLabel(documentType: DocumentType) {
  if (documentType === "SALE") {
    return "Sales Invoice";
  }

  if (documentType === "PURCHASE") {
    return "Purchase Bill";
  }

  if (documentType === "CREDIT_NOTE") {
    return "Credit Note";
  }

  return "Debit Note";
}

function getDocumentBadgeClass(documentType: DocumentType) {
  if (documentType === "SALE") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (documentType === "PURCHASE") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (documentType === "CREDIT_NOTE") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-violet-200 bg-violet-50 text-violet-700";
}

function getSeverityClass(severity: Severity) {
  if (severity === "ERROR") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (severity === "WARNING") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-blue-200 bg-blue-50 text-blue-700";
}

function mapSourceItems(items: SourceItemRow[]): AuditItem[] {
  return items.map((item) => ({
    id: item.id,
    productName: item.product_name || "Product / Service",
    hsnSacCode: item.hsn_sac_code || "",
    gstRate:
      item.gst_rate === null || item.gst_rate === undefined
        ? null
        : toNumber(item.gst_rate),
    taxableAmount: toNumber(item.taxable_amount),
    gstAmount: toNumber(item.gst_amount),
    cgstAmount: toNumber(item.cgst_amount),
    sgstAmount: toNumber(item.sgst_amount),
    igstAmount: toNumber(item.igst_amount),
    cessAmount: toNumber(item.cess_amount),
    amount: toNumber(item.amount),
  }));
}

function mapReturnItems(items: ReturnItemRow[]): AuditItem[] {
  return items.map((item) => ({
    id: item.id,
    productName: item.product_name || "Product / Service",
    hsnSacCode: item.hsn_sac_code || "",
    gstRate: null,
    taxableAmount: toNumber(item.taxable_amount),
    gstAmount: toNumber(item.gst_amount),
    cgstAmount: toNumber(item.cgst_amount),
    sgstAmount: toNumber(item.sgst_amount),
    igstAmount: toNumber(item.igst_amount),
    cessAmount: toNumber(item.cess_amount),
    amount: toNumber(item.amount),
  }));
}

function calculateItemTotals(items: AuditItem[]): ItemTotals {
  return items.reduce<ItemTotals>(
    (total, item) => ({
      taxable: total.taxable + item.taxableAmount,
      gst: total.gst + item.gstAmount,
      cgst: total.cgst + item.cgstAmount,
      sgst: total.sgst + item.sgstAmount,
      igst: total.igst + item.igstAmount,
      cess: total.cess + item.cessAmount,
      grand: total.grand + item.amount,
    }),
    {
      taxable: 0,
      gst: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      cess: 0,
      grand: 0,
    }
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

function createIssue(
  document: AuditDocument,
  severity: Severity,
  category: IssueCategory,
  title: string,
  detail: string,
  suggestion: string,
  affectedAmount = 0,
  suffix = ""
): GstIssue {
  return {
    key: `${document.key}-${category}-${title}-${suffix}`,
    severity,
    category,
    categoryLabel: getCategoryLabel(category),
    documentKey: document.key,
    documentType: document.documentType,
    documentLabel: document.documentLabel,
    documentNumber: document.documentNumber || "Missing number",
    documentDate: document.documentDate,
    partyName: document.partyName,
    taxType: document.taxType,
    title,
    detail,
    suggestion,
    affectedAmount,
    href: document.href,
  };
}

function buildIssues(documents: AuditDocument[]) {
  const issues: GstIssue[] = [];
  const numberGroups = new Map<string, AuditDocument[]>();

  documents.forEach((document) => {
    const normalizedNumber = document.documentNumber
      .trim()
      .toLowerCase();

    if (normalizedNumber && document.status === "POSTED") {
      const duplicateKey = `${document.documentType}:${normalizedNumber}`;
      const current = numberGroups.get(duplicateKey) || [];
      current.push(document);
      numberGroups.set(duplicateKey, current);
    }

    if (document.status === "VOID") {
      issues.push(
        createIssue(
          document,
          "INFO",
          "STATUS",
          "VOID document excluded",
          "This document remains visible for audit history but is excluded from filing-focused reconciliation checks.",
          "No action is required unless the document was voided by mistake.",
          document.headerGrandTotal
        )
      );
      return;
    }

    const itemTotals = calculateItemTotals(document.items);
    const documentTax =
      itemTotals.cgst +
      itemTotals.sgst +
      itemTotals.igst +
      itemTotals.cess;

    if (!document.documentNumber.trim()) {
      issues.push(
        createIssue(
          document,
          "ERROR",
          "DOCUMENT",
          "Document number is missing",
          `${document.documentLabel} does not have a document number.`,
          "Enter a unique document number before using this transaction for GST reporting."
        )
      );
    }

    if (!document.documentDate) {
      issues.push(
        createIssue(
          document,
          "ERROR",
          "DOCUMENT",
          "Document date is missing",
          `${document.documentLabel} does not have a valid date.`,
          "Add the correct transaction date and save the document again."
        )
      );
    }

    if (document.items.length === 0) {
      issues.push(
        createIssue(
          document,
          "ERROR",
          "DOCUMENT",
          "No item snapshots found",
          "This document has no GST item snapshot rows.",
          "Review the document and recreate or repair its item records before filing."
        )
      );
    }

    if (
      (document.documentType === "CREDIT_NOTE" ||
        document.documentType === "DEBIT_NOTE") &&
      !document.sourceAvailable
    ) {
      issues.push(
        createIssue(
          document,
          "ERROR",
          "SOURCE_LINK",
          "Original document link is missing",
          `${document.documentLabel} cannot resolve its original ${
            document.documentType === "CREDIT_NOTE"
              ? "Sales Invoice"
              : "Purchase Bill"
          }.`,
          "Restore the original document reference before using this return adjustment in GST reports."
        )
      );
    }

    if (!document.partyStateCode.trim()) {
      issues.push(
        createIssue(
          document,
          "WARNING",
          "MASTER_DATA",
          "Party State Code is missing",
          `${document.partyName} does not have a State Code in the ledger master.`,
          "Open the Customer/Supplier ledger and add the correct two-digit GST State Code."
        )
      );
    }

    if (!document.partyGstin.trim() && documentTax > TOLERANCE) {
      issues.push(
        createIssue(
          document,
          "INFO",
          "MASTER_DATA",
          "Party GSTIN is not available",
          `${document.partyName} is currently treated as an unregistered party.`,
          "Confirm that the party is genuinely unregistered. Add GSTIN in the ledger if it is a registered business.",
          documentTax
        )
      );
    }

    if (!document.placeOfSupply.trim()) {
      issues.push(
        createIssue(
          document,
          "WARNING",
          "CLASSIFICATION",
          "Place of Supply is missing",
          "GST Place of Supply has not been recorded for this document.",
          "Complete the party State and State Code, then review and save the transaction."
        )
      );
    }

    if (!document.placeOfSupplyCode.trim()) {
      issues.push(
        createIssue(
          document,
          "WARNING",
          "CLASSIFICATION",
          "Place of Supply Code is missing",
          "The transaction does not have a GST Place of Supply State Code.",
          "Add a valid State Code to the party master and regenerate the GST classification."
        )
      );
    }

    if (document.taxType === "UNCLASSIFIED" || !document.taxType) {
      issues.push(
        createIssue(
          document,
          documentTax > TOLERANCE ? "ERROR" : "WARNING",
          "CLASSIFICATION",
          "GST tax type is unclassified",
          "The document is not classified as Intra-State, Inter-State, Exempt or Zero-Rated.",
          "Complete State Codes and re-save the transaction so CGST/SGST or IGST can be classified correctly.",
          documentTax
        )
      );
    }

    if (
      document.partyStateCode &&
      document.placeOfSupplyCode &&
      document.partyStateCode !== document.placeOfSupplyCode
    ) {
      issues.push(
        createIssue(
          document,
          "INFO",
          "MASTER_DATA",
          "Party State differs from Place of Supply",
          `Party State Code ${document.partyStateCode} differs from Place of Supply Code ${document.placeOfSupplyCode}.`,
          "Verify that the Place of Supply is intentional for this transaction."
        )
      );
    }

    if (
      document.taxType === "INTRA_STATE" &&
      itemTotals.igst > TOLERANCE
    ) {
      issues.push(
        createIssue(
          document,
          "ERROR",
          "TAX_SPLIT",
          "IGST found on an Intra-State document",
          `Intra-State documents should normally use CGST and SGST, but IGST of ${formatCurrency(
            itemTotals.igst
          )} is present.`,
          "Review State Codes and recalculate the GST split before filing.",
          itemTotals.igst
        )
      );
    }

    if (
      document.taxType === "INTER_STATE" &&
      itemTotals.cgst + itemTotals.sgst > TOLERANCE
    ) {
      issues.push(
        createIssue(
          document,
          "ERROR",
          "TAX_SPLIT",
          "CGST/SGST found on an Inter-State document",
          `Inter-State documents should normally use IGST, but CGST/SGST of ${formatCurrency(
            itemTotals.cgst + itemTotals.sgst
          )} is present.`,
          "Review State Codes and recalculate the GST split before filing.",
          itemTotals.cgst + itemTotals.sgst
        )
      );
    }

    if (document.taxType === "EXEMPT" && documentTax > TOLERANCE) {
      issues.push(
        createIssue(
          document,
          "ERROR",
          "TAX_SPLIT",
          "GST charged on an Exempt document",
          `An Exempt / Nil Rated document contains GST of ${formatCurrency(
            documentTax
          )}.`,
          "Remove the tax or correct the GST classification before filing.",
          documentTax
        )
      );
    }

    const missingHsnItems = document.items.filter(
      (item) =>
        item.taxableAmount > TOLERANCE &&
        !item.hsnSacCode.trim()
    );

    if (missingHsnItems.length > 0) {
      const sample = missingHsnItems
        .slice(0, 3)
        .map((item) => item.productName)
        .join(", ");

      issues.push(
        createIssue(
          document,
          "WARNING",
          "HSN_SAC",
          "HSN/SAC is missing on taxable items",
          `${missingHsnItems.length} taxable item(s) do not have HSN/SAC${
            sample ? `: ${sample}` : ""
          }.`,
          "Update HSN/SAC in the product or service master and re-save the transaction."
        )
      );
    }

    document.items.forEach((item, index) => {
      const splitGst =
        item.cgstAmount + item.sgstAmount + item.igstAmount;
      const calculatedAmount =
        item.taxableAmount + splitGst + item.cessAmount;

      if (
        item.taxableAmount <= TOLERANCE &&
        splitGst + item.cessAmount > TOLERANCE
      ) {
        issues.push(
          createIssue(
            document,
            "ERROR",
            "TAX_CALCULATION",
            "GST exists with zero taxable value",
            `${item.productName} has zero taxable value but tax of ${formatCurrency(
              splitGst + item.cessAmount
            )}.`,
            "Correct the taxable amount or remove the tax from this item.",
            splitGst + item.cessAmount,
            `${item.id}-${index}`
          )
        );
      }

      if (isDifferent(item.gstAmount, splitGst)) {
        issues.push(
          createIssue(
            document,
            "ERROR",
            "TAX_CALCULATION",
            "Item GST total does not match tax split",
            `${item.productName}: saved GST is ${formatCurrency(
              item.gstAmount
            )}, while CGST + SGST + IGST is ${formatCurrency(
              splitGst
            )}.`,
            "Recalculate the item GST snapshot and save the document again.",
            Math.abs(item.gstAmount - splitGst),
            `${item.id}-${index}-split`
          )
        );
      }

      if (isDifferent(item.amount, calculatedAmount)) {
        issues.push(
          createIssue(
            document,
            "ERROR",
            "TAX_CALCULATION",
            "Item amount does not match taxable value plus tax",
            `${item.productName}: saved amount is ${formatCurrency(
              item.amount
            )}, expected ${formatCurrency(calculatedAmount)}.`,
            "Recalculate the item total and save the transaction again.",
            Math.abs(item.amount - calculatedAmount),
            `${item.id}-${index}-amount`
          )
        );
      }

      if (
        item.gstRate !== null &&
        item.taxableAmount > TOLERANCE
      ) {
        const expectedGst = roundMoney(
          (item.taxableAmount * item.gstRate) / 100
        );
        const dynamicTolerance = Math.max(
          TOLERANCE,
          expectedGst * 0.002
        );

        if (
          isDifferent(item.gstAmount, expectedGst, dynamicTolerance)
        ) {
          issues.push(
            createIssue(
              document,
              "WARNING",
              "TAX_CALCULATION",
              "GST rate calculation needs review",
              `${item.productName}: ${item.gstRate}% of ${formatCurrency(
                item.taxableAmount
              )} is ${formatCurrency(
                expectedGst
              )}, but saved GST is ${formatCurrency(item.gstAmount)}.`,
              "Verify discount, taxable value, GST rate and rounding for this item.",
              Math.abs(item.gstAmount - expectedGst),
              `${item.id}-${index}-rate`
            )
          );
        }
      }
    });

    const headerSplitGst =
      document.headerCgstTotal +
      document.headerSgstTotal +
      document.headerIgstTotal;

    if (isDifferent(document.headerGstTotal, itemTotals.gst)) {
      issues.push(
        createIssue(
          document,
          "ERROR",
          "TAX_CALCULATION",
          "Document GST total does not match item GST",
          `Header GST is ${formatCurrency(
            document.headerGstTotal
          )}, while item GST totals ${formatCurrency(itemTotals.gst)}.`,
          "Recalculate the document totals from item snapshots.",
          Math.abs(document.headerGstTotal - itemTotals.gst)
        )
      );
    }

    if (isDifferent(headerSplitGst, itemTotals.cgst + itemTotals.sgst + itemTotals.igst)) {
      issues.push(
        createIssue(
          document,
          "ERROR",
          "TAX_CALCULATION",
          "Header GST split does not match item tax split",
          `Header CGST + SGST + IGST is ${formatCurrency(
            headerSplitGst
          )}, while item split totals ${formatCurrency(
            itemTotals.cgst + itemTotals.sgst + itemTotals.igst
          )}.`,
          "Rebuild the document GST header totals from its items.",
          Math.abs(
            headerSplitGst -
              (itemTotals.cgst + itemTotals.sgst + itemTotals.igst)
          )
        )
      );
    }

    if (isDifferent(document.headerCessTotal, itemTotals.cess)) {
      issues.push(
        createIssue(
          document,
          "ERROR",
          "TAX_CALCULATION",
          "Document Cess total does not match items",
          `Header Cess is ${formatCurrency(
            document.headerCessTotal
          )}, while item Cess totals ${formatCurrency(itemTotals.cess)}.`,
          "Recalculate the Cess total from item snapshots.",
          Math.abs(document.headerCessTotal - itemTotals.cess)
        )
      );
    }

    if (isDifferent(document.headerGrandTotal, itemTotals.grand)) {
      issues.push(
        createIssue(
          document,
          "ERROR",
          "TAX_CALCULATION",
          "Document total does not match item totals",
          `Header total is ${formatCurrency(
            document.headerGrandTotal
          )}, while item amounts total ${formatCurrency(itemTotals.grand)}.`,
          "Recalculate the document total before using it for GST reporting.",
          Math.abs(document.headerGrandTotal - itemTotals.grand)
        )
      );
    }
  });

  numberGroups.forEach((group) => {
    if (group.length <= 1) {
      return;
    }

    group.forEach((document) => {
      issues.push(
        createIssue(
          document,
          "ERROR",
          "DUPLICATE",
          "Duplicate document number",
          `${group.length} ${document.documentLabel} records use number ${document.documentNumber}.`,
          "Keep one valid record and correct or void the duplicate document number.",
          document.headerGrandTotal,
          String(group.length)
        )
      );
    });
  });

  return issues.sort((left, right) => {
    const severityOrder: Record<Severity, number> = {
      ERROR: 0,
      WARNING: 1,
      INFO: 2,
    };

    const severityDifference =
      severityOrder[left.severity] - severityOrder[right.severity];

    if (severityDifference !== 0) {
      return severityDifference;
    }

    return right.documentDate.localeCompare(left.documentDate);
  });
}

export default function GSTReconciliationManager() {
  const financialYear = useMemo(
    () => getCurrentFinancialYearDates(),
    []
  );

  const [documents, setDocuments] = useState<AuditDocument[]>([]);
  const [issues, setIssues] = useState<GstIssue[]>([]);

  const [fromDate, setFromDate] = useState(financialYear.from);
  const [toDate, setToDate] = useState(financialYear.to);
  const [appliedFromDate, setAppliedFromDate] = useState(
    financialYear.from
  );
  const [appliedToDate, setAppliedToDate] = useState(
    financialYear.to
  );

  const appliedFromDateRef = useRef(financialYear.from);
  const appliedToDateRef = useRef(financialYear.to);

  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] =
    useState<"ALL" | Severity>("ALL");
  const [documentTypeFilter, setDocumentTypeFilter] =
    useState<"ALL" | DocumentType>("ALL");
  const [categoryFilter, setCategoryFilter] =
    useState<"ALL" | IssueCategory>("ALL");

  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);

    window.setTimeout(() => {
      setMessage("");
    }, 5000);
  }

  async function loadReconciliation(
    reportFromDate = appliedFromDateRef.current,
    reportToDate = appliedToDateRef.current
  ) {
    setIsLoading(true);
    setMessage("");

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "Please sign in to run GST reconciliation."
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
        (profile as ProfileRow | null)?.active_company_id || null;

      if (!companyId) {
        throw new Error(
          "Select an active company from the Companies page first."
        );
      }

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
            gst_total,
            cgst_total,
            sgst_total,
            igst_total,
            cess_total,
            grand_total,
            customer:ledgers!sales_customer_id_fkey(
              id,
              name,
              gst_number,
              state,
              state_code
            ),
            sale_items(
              id,
              product_name,
              hsn_sac_code,
              gst_rate,
              taxable_amount,
              gst_amount,
              cgst_amount,
              sgst_amount,
              igst_amount,
              cess_amount,
              amount
            )
          `
        )
        .eq("company_id", companyId);

      let purchasesQuery = supabase
        .from("purchases")
        .select(
          `
            id,
            bill_number,
            purchase_date,
            place_of_supply,
            place_of_supply_code,
            tax_type,
            gst_total,
            cgst_total,
            sgst_total,
            igst_total,
            cess_total,
            grand_total,
            supplier:ledgers!purchases_supplier_id_fkey(
              id,
              name,
              gst_number,
              state,
              state_code
            ),
            purchase_items(
              id,
              product_name,
              hsn_sac_code,
              gst_rate,
              taxable_amount,
              gst_amount,
              cgst_amount,
              sgst_amount,
              igst_amount,
              cess_amount,
              amount
            )
          `
        )
        .eq("company_id", companyId);

      let creditNotesQuery = supabase
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
            gst_total,
            cgst_total,
            sgst_total,
            igst_total,
            cess_total,
            grand_total,
            status,
            credit_note_items(
              id,
              product_name,
              hsn_sac_code,
              taxable_amount,
              gst_amount,
              cgst_amount,
              sgst_amount,
              igst_amount,
              cess_amount,
              amount
            )
          `
        )
        .eq("company_id", companyId);

      let debitNotesQuery = supabase
        .from("debit_notes")
        .select(
          `
            id,
            source_purchase_id,
            debit_note_number,
            debit_note_date,
            place_of_supply,
            place_of_supply_code,
            tax_type,
            gst_total,
            cgst_total,
            sgst_total,
            igst_total,
            cess_total,
            grand_total,
            status,
            debit_note_items(
              id,
              product_name,
              hsn_sac_code,
              taxable_amount,
              gst_amount,
              cgst_amount,
              sgst_amount,
              igst_amount,
              cess_amount,
              amount
            )
          `
        )
        .eq("company_id", companyId);

      if (reportFromDate) {
        salesQuery = salesQuery.gte("invoice_date", reportFromDate);
        purchasesQuery = purchasesQuery.gte(
          "purchase_date",
          reportFromDate
        );
        creditNotesQuery = creditNotesQuery.gte(
          "credit_note_date",
          reportFromDate
        );
        debitNotesQuery = debitNotesQuery.gte(
          "debit_note_date",
          reportFromDate
        );
      }

      if (reportToDate) {
        salesQuery = salesQuery.lte("invoice_date", reportToDate);
        purchasesQuery = purchasesQuery.lte(
          "purchase_date",
          reportToDate
        );
        creditNotesQuery = creditNotesQuery.lte(
          "credit_note_date",
          reportToDate
        );
        debitNotesQuery = debitNotesQuery.lte(
          "debit_note_date",
          reportToDate
        );
      }

      const [
        salesResponse,
        purchasesResponse,
        creditNotesResponse,
        debitNotesResponse,
      ] = await Promise.all([
        salesQuery,
        purchasesQuery,
        creditNotesQuery,
        debitNotesQuery,
      ]);

      if (salesResponse.error) {
        throw salesResponse.error;
      }

      if (purchasesResponse.error) {
        throw purchasesResponse.error;
      }

      if (creditNotesResponse.error) {
        throw creditNotesResponse.error;
      }

      if (debitNotesResponse.error) {
        throw debitNotesResponse.error;
      }

      const sales =
        (salesResponse.data || []) as unknown as SaleRow[];
      const purchases =
        (purchasesResponse.data || []) as unknown as PurchaseRow[];
      const creditNotes =
        (creditNotesResponse.data || []) as unknown as CreditNoteRow[];
      const debitNotes =
        (debitNotesResponse.data || []) as unknown as DebitNoteRow[];

      const sourceSaleIds = Array.from(
        new Set(
          creditNotes
            .map((note) => note.source_sale_id)
            .filter(Boolean)
        )
      );

      const sourcePurchaseIds = Array.from(
        new Set(
          debitNotes
            .map((note) => note.source_purchase_id)
            .filter(Boolean)
        )
      );

      let sourceSales: SourceSaleRow[] = [];
      let sourcePurchases: SourcePurchaseRow[] = [];

      if (sourceSaleIds.length > 0) {
        const { data, error } = await supabase
          .from("sales")
          .select(
            `
              id,
              customer:ledgers!sales_customer_id_fkey(
                id,
                name,
                gst_number,
                state,
                state_code
              )
            `
          )
          .eq("company_id", companyId)
          .in("id", sourceSaleIds);

        if (error) {
          throw error;
        }

        sourceSales = (data || []) as unknown as SourceSaleRow[];
      }

      if (sourcePurchaseIds.length > 0) {
        const { data, error } = await supabase
          .from("purchases")
          .select(
            `
              id,
              supplier:ledgers!purchases_supplier_id_fkey(
                id,
                name,
                gst_number,
                state,
                state_code
              )
            `
          )
          .eq("company_id", companyId)
          .in("id", sourcePurchaseIds);

        if (error) {
          throw error;
        }

        sourcePurchases =
          (data || []) as unknown as SourcePurchaseRow[];
      }

      const sourceSaleById = new Map<string, SourceSaleRow>();
      const sourcePurchaseById = new Map<
        string,
        SourcePurchaseRow
      >();

      sourceSales.forEach((sale) => {
        sourceSaleById.set(sale.id, sale);
      });

      sourcePurchases.forEach((purchase) => {
        sourcePurchaseById.set(purchase.id, purchase);
      });

      const nextDocuments: AuditDocument[] = [];

      sales.forEach((sale) => {
        const party = getJoinedLedger(sale.customer);

        nextDocuments.push({
          key: `SALE-${sale.id}`,
          id: sale.id,
          documentType: "SALE",
          documentLabel: "Sales Invoice",
          documentNumber: sale.invoice_number || "",
          documentDate: sale.invoice_date || "",
          partyName: party?.name || "Customer",
          partyGstin: party?.gst_number || "",
          partyState: party?.state || "",
          partyStateCode: party?.state_code || "",
          placeOfSupply: sale.place_of_supply || "",
          placeOfSupplyCode: sale.place_of_supply_code || "",
          taxType: sale.tax_type || "UNCLASSIFIED",
          status: "POSTED",
          sourceDocumentId: "",
          sourceAvailable: true,
          href: `/sales/invoice/${sale.id}`,
          headerGstTotal: toNumber(sale.gst_total),
          headerCgstTotal: toNumber(sale.cgst_total),
          headerSgstTotal: toNumber(sale.sgst_total),
          headerIgstTotal: toNumber(sale.igst_total),
          headerCessTotal: toNumber(sale.cess_total),
          headerGrandTotal: toNumber(sale.grand_total),
          items: mapSourceItems(sale.sale_items || []),
        });
      });

      purchases.forEach((purchase) => {
        const party = getJoinedLedger(purchase.supplier);

        nextDocuments.push({
          key: `PURCHASE-${purchase.id}`,
          id: purchase.id,
          documentType: "PURCHASE",
          documentLabel: "Purchase Bill",
          documentNumber: purchase.bill_number || "",
          documentDate: purchase.purchase_date || "",
          partyName: party?.name || "Supplier",
          partyGstin: party?.gst_number || "",
          partyState: party?.state || "",
          partyStateCode: party?.state_code || "",
          placeOfSupply: purchase.place_of_supply || "",
          placeOfSupplyCode:
            purchase.place_of_supply_code || "",
          taxType: purchase.tax_type || "UNCLASSIFIED",
          status: "POSTED",
          sourceDocumentId: "",
          sourceAvailable: true,
          href: `/purchase/bill/${purchase.id}`,
          headerGstTotal: toNumber(purchase.gst_total),
          headerCgstTotal: toNumber(purchase.cgst_total),
          headerSgstTotal: toNumber(purchase.sgst_total),
          headerIgstTotal: toNumber(purchase.igst_total),
          headerCessTotal: toNumber(purchase.cess_total),
          headerGrandTotal: toNumber(purchase.grand_total),
          items: mapSourceItems(purchase.purchase_items || []),
        });
      });

      creditNotes.forEach((note) => {
        const sourceSale = sourceSaleById.get(note.source_sale_id);
        const party = getJoinedLedger(sourceSale?.customer || null);

        nextDocuments.push({
          key: `CREDIT_NOTE-${note.id}`,
          id: note.id,
          documentType: "CREDIT_NOTE",
          documentLabel: "Credit Note",
          documentNumber: note.credit_note_number || "",
          documentDate: note.credit_note_date || "",
          partyName: party?.name || "Customer",
          partyGstin: party?.gst_number || "",
          partyState: party?.state || "",
          partyStateCode: party?.state_code || "",
          placeOfSupply: note.place_of_supply || "",
          placeOfSupplyCode: note.place_of_supply_code || "",
          taxType: note.tax_type || "UNCLASSIFIED",
          status: note.status,
          sourceDocumentId: note.source_sale_id || "",
          sourceAvailable: Boolean(sourceSale),
          href: `/credit-notes/${note.id}`,
          headerGstTotal: toNumber(note.gst_total),
          headerCgstTotal: toNumber(note.cgst_total),
          headerSgstTotal: toNumber(note.sgst_total),
          headerIgstTotal: toNumber(note.igst_total),
          headerCessTotal: toNumber(note.cess_total),
          headerGrandTotal: toNumber(note.grand_total),
          items: mapReturnItems(note.credit_note_items || []),
        });
      });

      debitNotes.forEach((note) => {
        const sourcePurchase = sourcePurchaseById.get(
          note.source_purchase_id
        );
        const party = getJoinedLedger(
          sourcePurchase?.supplier || null
        );

        nextDocuments.push({
          key: `DEBIT_NOTE-${note.id}`,
          id: note.id,
          documentType: "DEBIT_NOTE",
          documentLabel: "Debit Note",
          documentNumber: note.debit_note_number || "",
          documentDate: note.debit_note_date || "",
          partyName: party?.name || "Supplier",
          partyGstin: party?.gst_number || "",
          partyState: party?.state || "",
          partyStateCode: party?.state_code || "",
          placeOfSupply: note.place_of_supply || "",
          placeOfSupplyCode: note.place_of_supply_code || "",
          taxType: note.tax_type || "UNCLASSIFIED",
          status: note.status,
          sourceDocumentId: note.source_purchase_id || "",
          sourceAvailable: Boolean(sourcePurchase),
          href: `/debit-notes/${note.id}`,
          headerGstTotal: toNumber(note.gst_total),
          headerCgstTotal: toNumber(note.cgst_total),
          headerSgstTotal: toNumber(note.sgst_total),
          headerIgstTotal: toNumber(note.igst_total),
          headerCessTotal: toNumber(note.cess_total),
          headerGrandTotal: toNumber(note.grand_total),
          items: mapReturnItems(note.debit_note_items || []),
        });
      });

      nextDocuments.sort((left, right) =>
        right.documentDate.localeCompare(left.documentDate)
      );

      setDocuments(nextDocuments);
      setIssues(buildIssues(nextDocuments));
    } catch (error) {
      setDocuments([]);
      setIssues([]);

      showMessage(
        error instanceof Error
          ? error.message
          : "GST reconciliation could not be completed."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadReconciliation(financialYear.from, financialYear.to);

    const refreshEvents = [
      "vertexerp-sales-updated",
      "vertexerp-purchases-updated",
      "vertexerp-gst-data-updated",
      "vertexerp-active-company-updated",
    ];

    function handleRefresh() {
      loadReconciliation();
    }

    refreshEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleRefresh);
    });

    return () => {
      refreshEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleRefresh);
      });
    };
  }, []);

  const errorCount = useMemo(
    () => issues.filter((issue) => issue.severity === "ERROR").length,
    [issues]
  );

  const warningCount = useMemo(
    () =>
      issues.filter((issue) => issue.severity === "WARNING").length,
    [issues]
  );

  const infoCount = useMemo(
    () => issues.filter((issue) => issue.severity === "INFO").length,
    [issues]
  );

  const blockingDocumentKeys = useMemo(() => {
    return new Set(
      issues
        .filter(
          (issue) =>
            issue.severity === "ERROR" ||
            issue.severity === "WARNING"
        )
        .map((issue) => issue.documentKey)
    );
  }, [issues]);

  const postedDocumentCount = useMemo(
    () =>
      documents.filter((document) => document.status === "POSTED")
        .length,
    [documents]
  );

  const voidDocumentCount = documents.length - postedDocumentCount;

  const cleanDocumentCount = Math.max(
    postedDocumentCount - blockingDocumentKeys.size,
    0
  );

  const filteredIssues = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return issues.filter((issue) => {
      const matchesSeverity =
        severityFilter === "ALL" ||
        issue.severity === severityFilter;
      const matchesDocumentType =
        documentTypeFilter === "ALL" ||
        issue.documentType === documentTypeFilter;
      const matchesCategory =
        categoryFilter === "ALL" ||
        issue.category === categoryFilter;
      const matchesSearch =
        !normalizedSearch ||
        issue.documentNumber
          .toLowerCase()
          .includes(normalizedSearch) ||
        issue.partyName.toLowerCase().includes(normalizedSearch) ||
        issue.title.toLowerCase().includes(normalizedSearch) ||
        issue.detail.toLowerCase().includes(normalizedSearch);

      return (
        matchesSeverity &&
        matchesDocumentType &&
        matchesCategory &&
        matchesSearch
      );
    });
  }, [
    issues,
    searchTerm,
    severityFilter,
    documentTypeFilter,
    categoryFilter,
  ]);

  const readinessLabel =
    errorCount > 0
      ? "Critical GST issues found"
      : warningCount > 0
        ? "Review required before filing"
        : "Operational checks passed";

  function applyDateFilter() {
    if (fromDate && toDate && fromDate > toDate) {
      showMessage("From Date cannot be later than To Date.");
      return;
    }

    appliedFromDateRef.current = fromDate;
    appliedToDateRef.current = toDate;

    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);

    loadReconciliation(fromDate, toDate);
  }

  function resetDateFilter() {
    const nextFinancialYear = getCurrentFinancialYearDates();

    setFromDate(nextFinancialYear.from);
    setToDate(nextFinancialYear.to);
    setAppliedFromDate(nextFinancialYear.from);
    setAppliedToDate(nextFinancialYear.to);

    appliedFromDateRef.current = nextFinancialYear.from;
    appliedToDateRef.current = nextFinancialYear.to;

    loadReconciliation(
      nextFinancialYear.from,
      nextFinancialYear.to
    );
  }

  function clearFilters() {
    setSearchTerm("");
    setSeverityFilter("ALL");
    setDocumentTypeFilter("ALL");
    setCategoryFilter("ALL");
  }

  function exportIssuesCsv() {
    const rows: unknown[][] = [
      [
        "Severity",
        "Category",
        "Date",
        "Document Type",
        "Document Number",
        "Party",
        "Tax Type",
        "Issue",
        "Details",
        "Suggested Resolution",
        "Affected Amount",
      ],
      ...filteredIssues.map((issue) => [
        issue.severity,
        issue.categoryLabel,
        issue.documentDate,
        issue.documentLabel,
        issue.documentNumber,
        issue.partyName,
        getTaxTypeLabel(issue.taxType),
        issue.title,
        issue.detail,
        issue.suggestion,
        roundMoney(issue.affectedAmount),
      ]),
    ];

    downloadCsv(
      `vertexerp-gst-reconciliation-${
        appliedFromDate || "all"
      }-${appliedToDate || "all"}.csv`,
      rows
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-rose-100 bg-gradient-to-br from-[#2f1c6a] via-[#5931c8] to-[#b4235a] p-5 text-white shadow-xl sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-rose-100">
              <ShieldAlert className="h-5 w-5" />
              <p className="text-sm font-black uppercase tracking-[0.18em]">
                GST Data Quality
              </p>
            </div>

            <h1 className="mt-3 text-3xl font-black sm:text-4xl">
              GST Reconciliation &amp; Error Checker
            </h1>

            <p className="mt-3 max-w-3xl leading-7 text-rose-50">
              Detect GST classification, tax split, calculation,
              duplicate-number, HSN/SAC and party-master issues before
              preparing returns.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => loadReconciliation()}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-black text-[#6b248f] shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={`h-5 w-5 ${
                  isLoading ? "animate-spin" : ""
                }`}
              />
              Run Checks
            </button>

            <button
              type="button"
              onClick={exportIssuesCsv}
              disabled={isLoading || filteredIssues.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 py-3 font-black text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-5 w-5" />
              Export Issues
            </button>
          </div>
        </div>
      </section>

      {message && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 font-medium text-blue-700">
          {message}
        </div>
      )}

      <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:p-6">
        <div className="grid gap-4 lg:grid-cols-4">
          <div>
            <label className="mb-2 block font-bold text-slate-800">
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
            />
          </div>

          <div>
            <label className="mb-2 block font-bold text-slate-800">
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
            />
          </div>

          <button
            type="button"
            onClick={applyDateFilter}
            disabled={isLoading}
            className="self-end rounded-xl bg-violet-600 px-5 py-3 font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Run Reconciliation
          </button>

          <button
            type="button"
            onClick={resetDateFilter}
            disabled={isLoading}
            className="self-end rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Current FY
          </button>
        </div>

        <p className="mt-4 text-sm text-slate-500">
          Checking {formatDate(appliedFromDate)} to{" "}
          {formatDate(appliedToDate)}
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Errors"
          value={errorCount}
          detail="Critical issues that can distort GST reporting"
          icon={<AlertCircle className="h-5 w-5" />}
          className="border-red-200 bg-red-50 text-red-700"
        />

        <MetricCard
          title="Warnings"
          value={warningCount}
          detail="Master-data or classification review required"
          icon={<AlertTriangle className="h-5 w-5" />}
          className="border-amber-200 bg-amber-50 text-amber-700"
        />

        <MetricCard
          title="Information"
          value={infoCount}
          detail="Non-blocking observations and audit notes"
          icon={<Info className="h-5 w-5" />}
          className="border-blue-200 bg-blue-50 text-blue-700"
        />

        <MetricCard
          title="Clean Documents"
          value={cleanDocumentCount}
          detail={`${postedDocumentCount} posted checked · ${voidDocumentCount} void audit records`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          className="border-emerald-200 bg-emerald-50 text-emerald-700"
        />
      </section>

      <section
        className={`rounded-3xl border p-5 shadow-sm sm:p-6 ${
          errorCount > 0
            ? "border-red-200 bg-red-50 text-red-800"
            : warningCount > 0
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
        }`}
      >
        <div className="flex items-start gap-3">
          {errorCount > 0 ? (
            <AlertCircle className="mt-0.5 h-6 w-6 shrink-0" />
          ) : warningCount > 0 ? (
            <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" />
          )}

          <div>
            <h2 className="text-lg font-black">{readinessLabel}</h2>
            <p className="mt-1 leading-7">
              {errorCount > 0
                ? "Resolve critical errors before relying on GST return summaries."
                : warningCount > 0
                  ? "No critical mismatch was found, but warnings should be reviewed before filing."
                  : "No blocking operational GST issue was found for the selected period."}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative md:col-span-2">
            <label className="mb-2 block font-bold text-slate-800">
              Search Issues
            </label>
            <Search className="absolute bottom-3.5 left-4 h-5 w-5 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Document, party, issue or details"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-12 pr-4 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
            />
          </div>

          <FilterSelect
            label="Severity"
            value={severityFilter}
            onChange={(value) =>
              setSeverityFilter(value as "ALL" | Severity)
            }
            options={[
              ["ALL", "All Severities"],
              ["ERROR", "Errors"],
              ["WARNING", "Warnings"],
              ["INFO", "Information"],
            ]}
          />

          <FilterSelect
            label="Document Type"
            value={documentTypeFilter}
            onChange={(value) =>
              setDocumentTypeFilter(
                value as "ALL" | DocumentType
              )
            }
            options={[
              ["ALL", "All Documents"],
              ["SALE", "Sales Invoice"],
              ["PURCHASE", "Purchase Bill"],
              ["CREDIT_NOTE", "Credit Note"],
              ["DEBIT_NOTE", "Debit Note"],
            ]}
          />

          <FilterSelect
            label="Issue Category"
            value={categoryFilter}
            onChange={(value) =>
              setCategoryFilter(
                value as "ALL" | IssueCategory
              )
            }
            options={[
              ["ALL", "All Categories"],
              ["DOCUMENT", "Document Data"],
              ["DUPLICATE", "Duplicate Number"],
              ["MASTER_DATA", "Party Master"],
              ["CLASSIFICATION", "GST Classification"],
              ["HSN_SAC", "HSN/SAC"],
              ["TAX_SPLIT", "GST Tax Split"],
              ["TAX_CALCULATION", "Tax Calculation"],
              ["SOURCE_LINK", "Source Link"],
              ["STATUS", "Document Status"],
            ]}
          />
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Clear Filters
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <div className="flex items-center gap-2">
              <FileSearch className="h-6 w-6 text-violet-700" />
              <h2 className="text-xl font-black text-slate-900 sm:text-2xl">
                Reconciliation Issues
              </h2>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Showing {filteredIssues.length} of {issues.length} detected
              observations.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1450px]">
            <thead className="bg-slate-50">
              <tr>
                {[
                  "Severity",
                  "Document",
                  "Party",
                  "Category",
                  "Issue",
                  "Suggested Resolution",
                  "Amount",
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
                    colSpan={8}
                    className="px-5 py-14 text-center text-slate-500"
                  >
                    Running GST reconciliation checks...
                  </td>
                </tr>
              ) : filteredIssues.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-14 text-center text-slate-500"
                  >
                    {issues.length === 0
                      ? "No operational GST issues were detected for this period."
                      : "No issues match the selected filters."}
                  </td>
                </tr>
              ) : (
                filteredIssues.map((issue) => (
                  <tr
                    key={issue.key}
                    className="border-b border-slate-100 align-top transition hover:bg-violet-50/40"
                  >
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${getSeverityClass(
                          issue.severity
                        )}`}
                      >
                        {issue.severity}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getDocumentBadgeClass(
                          issue.documentType
                        )}`}
                      >
                        {getDocumentLabel(issue.documentType)}
                      </span>
                      <p className="mt-2 font-black text-slate-900">
                        {issue.documentNumber}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDate(issue.documentDate)} ·{" "}
                        {getTaxTypeLabel(issue.taxType)}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">
                        {issue.partyName}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                        {issue.categoryLabel}
                      </span>
                    </td>

                    <td className="max-w-md px-5 py-4">
                      <p className="font-black text-slate-900">
                        {issue.title}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {issue.detail}
                      </p>
                    </td>

                    <td className="max-w-md px-5 py-4 text-sm leading-6 text-slate-700">
                      {issue.suggestion}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 font-bold text-slate-900">
                      {issue.affectedAmount > TOLERANCE
                        ? formatCurrency(issue.affectedAmount)
                        : "—"}
                    </td>

                    <td className="px-5 py-4">
                      <Link
                        href={issue.href}
                        className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                      >
                        View
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
        <h2 className="font-black">Important reconciliation scope</h2>
        <p className="mt-2 leading-7">
          This checker validates operational snapshots stored inside
          VertexERP. It does not replace GST portal reconciliation,
          GSTR-2B matching, Input Tax Credit eligibility review,
          reverse-charge checks, statutory set-off, interest or an
          accountant&apos;s filing review.
        </p>
      </section>
    </div>
  );
}

function MetricCard({
  title,
  value,
  detail,
  icon,
  className,
}: {
  title: string;
  value: number;
  detail: string;
  icon: ReactNode;
  className: string;
}) {
  return (
    <article className={`rounded-3xl border p-5 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-bold">{title}</p>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70">
          {icon}
        </span>
      </div>
      <p className="mt-4 text-3xl font-black">{value}</p>
      <p className="mt-2 text-sm leading-6 opacity-80">{detail}</p>
    </article>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <div>
      <label className="mb-2 block font-bold text-slate-800">
        {label}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}