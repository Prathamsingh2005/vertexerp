"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Download,
  FileSpreadsheet,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ProfileRow = {
  active_company_id: string | null;
};

type SummaryRow = {
  tax_type: string | null;
  taxable_value: number | string | null;
  cgst: number | string | null;
  sgst: number | string | null;
  igst: number | string | null;
  cess: number | string | null;
  total_tax: number | string | null;
};

type SalesSummaryRow = SummaryRow & {
  invoice_count: number | string | null;
  invoice_value: number | string | null;
};

type PurchaseSummaryRow = SummaryRow & {
  bill_count: number | string | null;
  bill_value: number | string | null;
};

type ReturnSummaryRow = SummaryRow & {
  document_type: "CREDIT_NOTE" | "DEBIT_NOTE";
  document_count: number | string | null;
  document_value: number | string | null;
};

type ItemSnapshot = {
  hsn_sac_code: string | null;
  product_name: string | null;
  taxable_amount: number | string | null;
  cgst_amount: number | string | null;
  sgst_amount: number | string | null;
  igst_amount: number | string | null;
  cess_amount: number | string | null;
};

type SalesDocumentRow = {
  invoice_date: string;
  tax_type: string | null;
  sale_items: ItemSnapshot[] | null;
};

type PurchaseDocumentRow = {
  purchase_date: string;
  tax_type: string | null;
  purchase_items: ItemSnapshot[] | null;
};

type CreditNoteDocumentRow = {
  credit_note_date: string;
  tax_type: string | null;
  status: "POSTED" | "VOID";
  credit_note_items: ItemSnapshot[] | null;
};

type DebitNoteDocumentRow = {
  debit_note_date: string;
  tax_type: string | null;
  status: "POSTED" | "VOID";
  debit_note_items: ItemSnapshot[] | null;
};

type TaxBucket = {
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalTax: number;
  documentValue: number;
  documentCount: number;
};

type HsnSummary = {
  key: string;
  hsnSacCode: string;
  description: string;
  outwardTaxable: number;
  outwardCgst: number;
  outwardSgst: number;
  outwardIgst: number;
  outwardCess: number;
  creditTaxable: number;
  creditCgst: number;
  creditSgst: number;
  creditIgst: number;
  creditCess: number;
  inwardTaxable: number;
  inwardCgst: number;
  inwardSgst: number;
  inwardIgst: number;
  inwardCess: number;
  debitTaxable: number;
  debitCgst: number;
  debitSgst: number;
  debitIgst: number;
  debitCess: number;
};

const emptyBucket: TaxBucket = {
  taxable: 0,
  cgst: 0,
  sgst: 0,
  igst: 0,
  cess: 0,
  totalTax: 0,
  documentValue: 0,
  documentCount: 0,
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatCurrency(value: number) {
  return `₹${roundMoney(value).toLocaleString("en-IN", {
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

function bucketFromRows(rows: SummaryRow[]) {
  return rows.reduce<TaxBucket>(
    (total, row) => ({
      taxable: total.taxable + toNumber(row.taxable_value),
      cgst: total.cgst + toNumber(row.cgst),
      sgst: total.sgst + toNumber(row.sgst),
      igst: total.igst + toNumber(row.igst),
      cess: total.cess + toNumber(row.cess),
      totalTax: total.totalTax + toNumber(row.total_tax),
      documentValue: total.documentValue,
      documentCount: total.documentCount,
    }),
    { ...emptyBucket }
  );
}

function salesBucket(rows: SalesSummaryRow[]) {
  return rows.reduce<TaxBucket>(
    (total, row) => ({
      taxable: total.taxable + toNumber(row.taxable_value),
      cgst: total.cgst + toNumber(row.cgst),
      sgst: total.sgst + toNumber(row.sgst),
      igst: total.igst + toNumber(row.igst),
      cess: total.cess + toNumber(row.cess),
      totalTax: total.totalTax + toNumber(row.total_tax),
      documentValue:
        total.documentValue + toNumber(row.invoice_value),
      documentCount:
        total.documentCount + toNumber(row.invoice_count),
    }),
    { ...emptyBucket }
  );
}

function purchaseBucket(rows: PurchaseSummaryRow[]) {
  return rows.reduce<TaxBucket>(
    (total, row) => ({
      taxable: total.taxable + toNumber(row.taxable_value),
      cgst: total.cgst + toNumber(row.cgst),
      sgst: total.sgst + toNumber(row.sgst),
      igst: total.igst + toNumber(row.igst),
      cess: total.cess + toNumber(row.cess),
      totalTax: total.totalTax + toNumber(row.total_tax),
      documentValue:
        total.documentValue + toNumber(row.bill_value),
      documentCount:
        total.documentCount + toNumber(row.bill_count),
    }),
    { ...emptyBucket }
  );
}

function returnBucket(
  rows: ReturnSummaryRow[],
  documentType: ReturnSummaryRow["document_type"]
) {
  return rows
    .filter((row) => row.document_type === documentType)
    .reduce<TaxBucket>(
      (total, row) => ({
        taxable: total.taxable + toNumber(row.taxable_value),
        cgst: total.cgst + toNumber(row.cgst),
        sgst: total.sgst + toNumber(row.sgst),
        igst: total.igst + toNumber(row.igst),
        cess: total.cess + toNumber(row.cess),
        totalTax: total.totalTax + toNumber(row.total_tax),
        documentValue:
          total.documentValue + toNumber(row.document_value),
        documentCount:
          total.documentCount + toNumber(row.document_count),
      }),
      { ...emptyBucket }
    );
}

function subtractBucket(left: TaxBucket, right: TaxBucket): TaxBucket {
  return {
    taxable: roundMoney(left.taxable - right.taxable),
    cgst: roundMoney(left.cgst - right.cgst),
    sgst: roundMoney(left.sgst - right.sgst),
    igst: roundMoney(left.igst - right.igst),
    cess: roundMoney(left.cess - right.cess),
    totalTax: roundMoney(left.totalTax - right.totalTax),
    documentValue: roundMoney(
      left.documentValue - right.documentValue
    ),
    documentCount: left.documentCount - right.documentCount,
  };
}

function getTaxTypeRows<T extends SummaryRow>(
  rows: T[],
  taxType: string
) {
  return rows.filter(
    (row) => String(row.tax_type || "UNCLASSIFIED") === taxType
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

export default function GSTReportsManager() {
  const financialYear = getCurrentFinancialYearDates();

  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(
    null
  );
  const [salesSummary, setSalesSummary] = useState<SalesSummaryRow[]>(
    []
  );
  const [purchaseSummary, setPurchaseSummary] = useState<
    PurchaseSummaryRow[]
  >([]);
  const [returnSummary, setReturnSummary] = useState<
    ReturnSummaryRow[]
  >([]);

  const [salesDocuments, setSalesDocuments] = useState<
    SalesDocumentRow[]
  >([]);
  const [purchaseDocuments, setPurchaseDocuments] = useState<
    PurchaseDocumentRow[]
  >([]);
  const [creditDocuments, setCreditDocuments] = useState<
    CreditNoteDocumentRow[]
  >([]);
  const [debitDocuments, setDebitDocuments] = useState<
    DebitNoteDocumentRow[]
  >([]);

  const [fromDate, setFromDate] = useState(financialYear.from);
  const [toDate, setToDate] = useState(financialYear.to);
  const [appliedFromDate, setAppliedFromDate] = useState(
    financialYear.from
  );
  const [appliedToDate, setAppliedToDate] = useState(
    financialYear.to
  );

  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);

    window.setTimeout(() => {
      setMessage("");
    }, 4500);
  }

  async function loadGstReports(
    reportFromDate = appliedFromDate,
    reportToDate = appliedToDate
  ) {
    setIsLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setActiveCompanyId(null);
        throw new Error("Please sign in to view GST reports.");
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

      setActiveCompanyId(companyId);

      if (!companyId) {
        throw new Error(
          "Select an active company from the Companies page first."
        );
      }

      const rpcFilters = {
        p_company_id: companyId,
        p_from_date: reportFromDate || null,
        p_to_date: reportToDate || null,
      };

      let salesQuery = supabase
        .from("sales")
        .select(
          `
            invoice_date,
            tax_type,
            sale_items(
              hsn_sac_code,
              product_name,
              taxable_amount,
              cgst_amount,
              sgst_amount,
              igst_amount,
              cess_amount
            )
          `
        )
        .eq("company_id", companyId);

      let purchaseQuery = supabase
        .from("purchases")
        .select(
          `
            purchase_date,
            tax_type,
            purchase_items(
              hsn_sac_code,
              product_name,
              taxable_amount,
              cgst_amount,
              sgst_amount,
              igst_amount,
              cess_amount
            )
          `
        )
        .eq("company_id", companyId);

      let creditQuery = supabase
        .from("credit_notes")
        .select(
          `
            credit_note_date,
            tax_type,
            status,
            credit_note_items(
              hsn_sac_code,
              product_name,
              taxable_amount,
              cgst_amount,
              sgst_amount,
              igst_amount,
              cess_amount
            )
          `
        )
        .eq("company_id", companyId)
        .eq("status", "POSTED");

      let debitQuery = supabase
        .from("debit_notes")
        .select(
          `
            debit_note_date,
            tax_type,
            status,
            debit_note_items(
              hsn_sac_code,
              product_name,
              taxable_amount,
              cgst_amount,
              sgst_amount,
              igst_amount,
              cess_amount
            )
          `
        )
        .eq("company_id", companyId)
        .eq("status", "POSTED");

      if (reportFromDate) {
        salesQuery = salesQuery.gte("invoice_date", reportFromDate);
        purchaseQuery = purchaseQuery.gte(
          "purchase_date",
          reportFromDate
        );
        creditQuery = creditQuery.gte(
          "credit_note_date",
          reportFromDate
        );
        debitQuery = debitQuery.gte(
          "debit_note_date",
          reportFromDate
        );
      }

      if (reportToDate) {
        salesQuery = salesQuery.lte("invoice_date", reportToDate);
        purchaseQuery = purchaseQuery.lte(
          "purchase_date",
          reportToDate
        );
        creditQuery = creditQuery.lte(
          "credit_note_date",
          reportToDate
        );
        debitQuery = debitQuery.lte(
          "debit_note_date",
          reportToDate
        );
      }

      const [
        salesRpc,
        purchaseRpc,
        returnRpc,
        salesItemsResponse,
        purchaseItemsResponse,
        creditItemsResponse,
        debitItemsResponse,
      ] = await Promise.all([
        supabase.rpc("get_sales_gst_summary", rpcFilters),
        supabase.rpc("get_purchase_gst_summary", rpcFilters),
        supabase.rpc("get_return_gst_summary", rpcFilters),
        salesQuery,
        purchaseQuery,
        creditQuery,
        debitQuery,
      ]);

      if (salesRpc.error) {
        throw salesRpc.error;
      }

      if (purchaseRpc.error) {
        throw purchaseRpc.error;
      }

      if (returnRpc.error) {
        throw returnRpc.error;
      }

      if (salesItemsResponse.error) {
        throw salesItemsResponse.error;
      }

      if (purchaseItemsResponse.error) {
        throw purchaseItemsResponse.error;
      }

      if (creditItemsResponse.error) {
        throw creditItemsResponse.error;
      }

      if (debitItemsResponse.error) {
        throw debitItemsResponse.error;
      }

      setSalesSummary(
        (salesRpc.data || []) as SalesSummaryRow[]
      );
      setPurchaseSummary(
        (purchaseRpc.data || []) as PurchaseSummaryRow[]
      );
      setReturnSummary(
        (returnRpc.data || []) as ReturnSummaryRow[]
      );

      setSalesDocuments(
        (salesItemsResponse.data || []) as unknown as SalesDocumentRow[]
      );
      setPurchaseDocuments(
        (purchaseItemsResponse.data ||
          []) as unknown as PurchaseDocumentRow[]
      );
      setCreditDocuments(
        (creditItemsResponse.data ||
          []) as unknown as CreditNoteDocumentRow[]
      );
      setDebitDocuments(
        (debitItemsResponse.data ||
          []) as unknown as DebitNoteDocumentRow[]
      );
    } catch (error) {
      setSalesSummary([]);
      setPurchaseSummary([]);
      setReturnSummary([]);
      setSalesDocuments([]);
      setPurchaseDocuments([]);
      setCreditDocuments([]);
      setDebitDocuments([]);

      showMessage(
        error instanceof Error
          ? error.message
          : "GST reports could not be loaded."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadGstReports();

    const refreshEvents = [
      "vertexerp-sales-updated",
      "vertexerp-purchases-updated",
      "vertexerp-gst-data-updated",
      "vertexerp-products-updated",
      "vertexerp-active-company-updated",
    ];

    function handleRefresh() {
      loadGstReports();
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

  const grossOutput = useMemo(
    () => salesBucket(salesSummary),
    [salesSummary]
  );

  const grossInput = useMemo(
    () => purchaseBucket(purchaseSummary),
    [purchaseSummary]
  );

  const creditReversal = useMemo(
    () => returnBucket(returnSummary, "CREDIT_NOTE"),
    [returnSummary]
  );

  const debitReversal = useMemo(
    () => returnBucket(returnSummary, "DEBIT_NOTE"),
    [returnSummary]
  );

  const netOutput = useMemo(
    () => subtractBucket(grossOutput, creditReversal),
    [grossOutput, creditReversal]
  );

  const netInput = useMemo(
    () => subtractBucket(grossInput, debitReversal),
    [grossInput, debitReversal]
  );

  const netPosition = useMemo(
    () => subtractBucket(netOutput, netInput),
    [netOutput, netInput]
  );

  const unclassified = useMemo(() => {
    const salesRows = getTaxTypeRows(
      salesSummary,
      "UNCLASSIFIED"
    );
    const purchaseRows = getTaxTypeRows(
      purchaseSummary,
      "UNCLASSIFIED"
    );
    const returnRows = returnSummary.filter(
      (row) =>
        String(row.tax_type || "UNCLASSIFIED") ===
        "UNCLASSIFIED"
    );

    return {
      sales: salesRows.reduce(
        (count, row) => count + toNumber(row.invoice_count),
        0
      ),
      purchases: purchaseRows.reduce(
        (count, row) => count + toNumber(row.bill_count),
        0
      ),
      returns: returnRows.reduce(
        (count, row) =>
          count + toNumber(row.document_count),
        0
      ),
      taxable:
        bucketFromRows(salesRows).taxable +
        bucketFromRows(purchaseRows).taxable +
        bucketFromRows(returnRows).taxable,
    };
  }, [salesSummary, purchaseSummary, returnSummary]);

  const hsnSummary = useMemo(() => {
    const map = new Map<string, HsnSummary>();

    function addItems(
      items: ItemSnapshot[],
      side:
        | "outward"
        | "credit"
        | "inward"
        | "debit"
    ) {
      items.forEach((item) => {
        const code = item.hsn_sac_code || "UNCLASSIFIED";
        const description =
          item.product_name || "Product / Service";
        const current = map.get(code) || {
          key: code,
          hsnSacCode: code,
          description,
          outwardTaxable: 0,
          outwardCgst: 0,
          outwardSgst: 0,
          outwardIgst: 0,
          outwardCess: 0,
          creditTaxable: 0,
          creditCgst: 0,
          creditSgst: 0,
          creditIgst: 0,
          creditCess: 0,
          inwardTaxable: 0,
          inwardCgst: 0,
          inwardSgst: 0,
          inwardIgst: 0,
          inwardCess: 0,
          debitTaxable: 0,
          debitCgst: 0,
          debitSgst: 0,
          debitIgst: 0,
          debitCess: 0,
        };

        const taxable = toNumber(item.taxable_amount);
        const cgst = toNumber(item.cgst_amount);
        const sgst = toNumber(item.sgst_amount);
        const igst = toNumber(item.igst_amount);
        const cess = toNumber(item.cess_amount);

        if (side === "outward") {
          current.outwardTaxable += taxable;
          current.outwardCgst += cgst;
          current.outwardSgst += sgst;
          current.outwardIgst += igst;
          current.outwardCess += cess;
        }

        if (side === "credit") {
          current.creditTaxable += taxable;
          current.creditCgst += cgst;
          current.creditSgst += sgst;
          current.creditIgst += igst;
          current.creditCess += cess;
        }

        if (side === "inward") {
          current.inwardTaxable += taxable;
          current.inwardCgst += cgst;
          current.inwardSgst += sgst;
          current.inwardIgst += igst;
          current.inwardCess += cess;
        }

        if (side === "debit") {
          current.debitTaxable += taxable;
          current.debitCgst += cgst;
          current.debitSgst += sgst;
          current.debitIgst += igst;
          current.debitCess += cess;
        }

        map.set(code, current);
      });
    }

    salesDocuments.forEach((document) => {
      addItems(document.sale_items || [], "outward");
    });

    purchaseDocuments.forEach((document) => {
      addItems(document.purchase_items || [], "inward");
    });

    creditDocuments.forEach((document) => {
      addItems(document.credit_note_items || [], "credit");
    });

    debitDocuments.forEach((document) => {
      addItems(document.debit_note_items || [], "debit");
    });

    return Array.from(map.values()).sort((a, b) =>
      a.hsnSacCode.localeCompare(b.hsnSacCode)
    );
  }, [
    salesDocuments,
    purchaseDocuments,
    creditDocuments,
    debitDocuments,
  ]);

  const gstr1Rows = useMemo(() => {
    const taxTypes = [
      "INTRA_STATE",
      "INTER_STATE",
      "ZERO_RATED",
      "EXEMPT",
      "UNCLASSIFIED",
    ];

    return taxTypes.map((taxType) => {
      const sales = salesBucket(
        getTaxTypeRows(salesSummary, taxType)
      );
      const credits = returnBucket(
        returnSummary.filter(
          (row) =>
            String(row.tax_type || "UNCLASSIFIED") === taxType
        ),
        "CREDIT_NOTE"
      );
      const net = subtractBucket(sales, credits);

      return {
        taxType,
        sales,
        credits,
        net,
      };
    });
  }, [salesSummary, returnSummary]);

  function applyDateFilter() {
    if (fromDate && toDate && fromDate > toDate) {
      showMessage("From Date cannot be later than To Date.");
      return;
    }

    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);
    loadGstReports(fromDate, toDate);
  }

  function resetDateFilter() {
    const nextFinancialYear = getCurrentFinancialYearDates();

    setFromDate(nextFinancialYear.from);
    setToDate(nextFinancialYear.to);
    setAppliedFromDate(nextFinancialYear.from);
    setAppliedToDate(nextFinancialYear.to);
    loadGstReports(
      nextFinancialYear.from,
      nextFinancialYear.to
    );
  }

  function exportGstr1Csv() {
    const rows: unknown[][] = [
      [
        "Tax Type",
        "Sales Documents",
        "Gross Taxable",
        "Credit Notes",
        "Credit Taxable",
        "Net Taxable",
        "Net CGST",
        "Net SGST",
        "Net IGST",
        "Net Cess",
        "Net GST",
        "Net Document Value",
      ],
      ...gstr1Rows.map((row) => [
        getTaxTypeLabel(row.taxType),
        row.sales.documentCount,
        row.sales.taxable,
        row.credits.documentCount,
        row.credits.taxable,
        row.net.taxable,
        row.net.cgst,
        row.net.sgst,
        row.net.igst,
        row.net.cess,
        row.net.totalTax,
        row.net.documentValue,
      ]),
    ];

    downloadCsv(
      `vertexerp-gstr1-summary-${appliedFromDate || "all"}-${
        appliedToDate || "all"
      }.csv`,
      rows
    );
  }

  function exportGstr3bCsv() {
    const rows: unknown[][] = [
      [
        "Section",
        "Taxable Value",
        "CGST",
        "SGST",
        "IGST",
        "Cess",
        "Total GST",
      ],
      [
        "Gross Outward Supplies",
        grossOutput.taxable,
        grossOutput.cgst,
        grossOutput.sgst,
        grossOutput.igst,
        grossOutput.cess,
        grossOutput.totalTax,
      ],
      [
        "Less: Credit Notes",
        creditReversal.taxable,
        creditReversal.cgst,
        creditReversal.sgst,
        creditReversal.igst,
        creditReversal.cess,
        creditReversal.totalTax,
      ],
      [
        "Net Outward Supplies",
        netOutput.taxable,
        netOutput.cgst,
        netOutput.sgst,
        netOutput.igst,
        netOutput.cess,
        netOutput.totalTax,
      ],
      [
        "Gross Inward Supplies",
        grossInput.taxable,
        grossInput.cgst,
        grossInput.sgst,
        grossInput.igst,
        grossInput.cess,
        grossInput.totalTax,
      ],
      [
        "Less: Debit Notes",
        debitReversal.taxable,
        debitReversal.cgst,
        debitReversal.sgst,
        debitReversal.igst,
        debitReversal.cess,
        debitReversal.totalTax,
      ],
      [
        "Net Input GST",
        netInput.taxable,
        netInput.cgst,
        netInput.sgst,
        netInput.igst,
        netInput.cess,
        netInput.totalTax,
      ],
      [
        "Net GST Position",
        "",
        netPosition.cgst,
        netPosition.sgst,
        netPosition.igst,
        netPosition.cess,
        netPosition.totalTax,
      ],
    ];

    downloadCsv(
      `vertexerp-gstr3b-review-${appliedFromDate || "all"}-${
        appliedToDate || "all"
      }.csv`,
      rows
    );
  }

  function exportHsnCsv() {
    const rows: unknown[][] = [
      [
        "HSN/SAC",
        "Description",
        "Net Outward Taxable",
        "Net Outward CGST",
        "Net Outward SGST",
        "Net Outward IGST",
        "Net Inward Taxable",
        "Net Input CGST",
        "Net Input SGST",
        "Net Input IGST",
      ],
      ...hsnSummary.map((row) => [
        row.hsnSacCode,
        row.description,
        roundMoney(row.outwardTaxable - row.creditTaxable),
        roundMoney(row.outwardCgst - row.creditCgst),
        roundMoney(row.outwardSgst - row.creditSgst),
        roundMoney(row.outwardIgst - row.creditIgst),
        roundMoney(row.inwardTaxable - row.debitTaxable),
        roundMoney(row.inwardCgst - row.debitCgst),
        roundMoney(row.inwardSgst - row.debitSgst),
        roundMoney(row.inwardIgst - row.debitIgst),
      ]),
    ];

    downloadCsv(
      `vertexerp-hsn-summary-${appliedFromDate || "all"}-${
        appliedToDate || "all"
      }.csv`,
      rows
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <section className="rounded-3xl border border-violet-100 bg-gradient-to-br from-[#2f1c6a] to-[#673de6] p-5 text-white shadow-xl sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-violet-100">
              <ShieldCheck className="h-5 w-5" />
              <p className="text-sm font-black uppercase tracking-[0.18em]">
                GST Review Center
              </p>
            </div>

            <h1 className="mt-3 text-3xl font-black sm:text-4xl">
              GST Reports &amp; Tax Position
            </h1>

            <p className="mt-3 max-w-3xl leading-7 text-violet-100">
              Review outward GST, input GST, return reversals,
              HSN/SAC summaries and unclassified records before
              preparing statutory returns.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadGstReports()}
            disabled={isLoading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-black text-[#5025d1] shadow-xl shadow-violet-100/40 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
          >
            <RefreshCw
              className={`h-5 w-5 ${
                isLoading ? "animate-spin" : ""
              }`}
            />
            Refresh GST Data
          </button>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="overflow-hidden rounded-3xl border border-violet-200 bg-white shadow-xl">
          <div className="flex h-full flex-col p-5 sm:p-7">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                <FileSpreadsheet className="h-7 w-7" />
              </div>

              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em] text-violet-600">
                  Detailed GST Register
                </p>

                <h2 className="mt-2 text-2xl font-black text-slate-900">
                  Invoice-wise GST Transaction Register
                </h2>

                <p className="mt-2 leading-7 text-slate-600">
                  Review Sales Invoices, Purchase Bills, Credit Notes and
                  Debit Notes with party GSTIN, Place of Supply, taxable
                  value, CGST, SGST, IGST, Cess and document totals.
                </p>
              </div>
            </div>

            <Link
              href="/reports/gst/transactions"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 font-black text-white shadow-xl shadow-violet-100/40 transition hover:-translate-y-0.5 hover:bg-violet-700 sm:w-fit"
            >
              Open Transaction Register
              <ArrowUpRight className="h-5 w-5" />
            </Link>
          </div>
        </article>

        <article className="overflow-hidden rounded-3xl border border-rose-200 bg-white shadow-xl">
          <div className="flex h-full flex-col p-5 sm:p-7">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
                <AlertTriangle className="h-7 w-7" />
              </div>

              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em] text-rose-600">
                  GST Data Quality
                </p>

                <h2 className="mt-2 text-2xl font-black text-slate-900">
                  GST Reconciliation &amp; Error Checker
                </h2>

                <p className="mt-2 leading-7 text-slate-600">
                  Detect missing HSN/SAC, unclassified tax types,
                  incorrect CGST/SGST/IGST splits, calculation mismatches,
                  duplicate numbers and missing party master data.
                </p>
              </div>
            </div>

            <Link
              href="/reports/gst/reconciliation"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-6 py-3 font-black text-white shadow-xl shadow-violet-100/40 transition hover:-translate-y-0.5 hover:bg-rose-700 sm:w-fit"
            >
              Run GST Error Checker
              <ArrowUpRight className="h-5 w-5" />
            </Link>
          </div>
        </article>
      </section>

      {message && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 font-medium text-blue-700">
          {message}
        </div>
      )}

      <section className="rounded-3xl border border-violet-100 bg-white p-5 shadow-xl shadow-violet-100/40 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label className="mb-2 block font-bold text-slate-800">
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(event) =>
                setFromDate(event.target.value)
              }
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
            />
          </div>

          <div className="flex-1">
            <label className="mb-2 block font-bold text-slate-800">
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(event) =>
                setToDate(event.target.value)
              }
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
            />
          </div>

          <button
            type="button"
            onClick={applyDateFilter}
            disabled={isLoading}
            className="rounded-xl bg-violet-600 px-6 py-3 font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Generate GST Report
          </button>

          <button
            type="button"
            onClick={resetDateFilter}
            disabled={isLoading}
            className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Current FY
          </button>
        </div>

        <p className="mt-4 text-sm text-slate-500">
          Showing {formatDate(appliedFromDate)} to{" "}
          {formatDate(appliedToDate)}
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Net Output GST"
          value={netOutput.totalTax}
          detail={`Sales ${formatCurrency(
            grossOutput.totalTax
          )} − Credit Notes ${formatCurrency(
            creditReversal.totalTax
          )}`}
          icon={<ArrowUpRight className="h-5 w-5" />}
          className="border-blue-100 bg-blue-50 text-blue-700"
        />

        <MetricCard
          title="Net Input GST"
          value={netInput.totalTax}
          detail={`Purchases ${formatCurrency(
            grossInput.totalTax
          )} − Debit Notes ${formatCurrency(
            debitReversal.totalTax
          )}`}
          icon={<ArrowDownRight className="h-5 w-5" />}
          className="border-emerald-100 bg-emerald-50 text-emerald-700"
        />

        <MetricCard
          title={
            netPosition.totalTax >= 0
              ? "Net GST Position"
              : "Input Credit Surplus"
          }
          value={Math.abs(netPosition.totalTax)}
          detail="Before statutory set-off ordering, RCM, interest and adjustments"
          icon={<FileSpreadsheet className="h-5 w-5" />}
          className={
            netPosition.totalTax >= 0
              ? "border-orange-100 bg-orange-50 text-orange-700"
              : "border-violet-100 bg-violet-50 text-violet-700"
          }
        />

        <MetricCard
          title="Unclassified Records"
          value={
            unclassified.sales +
            unclassified.purchases +
            unclassified.returns
          }
          isCurrency={false}
          detail={`${unclassified.sales} sales · ${unclassified.purchases} purchases · ${unclassified.returns} returns`}
          icon={<AlertTriangle className="h-5 w-5" />}
          className={
            unclassified.sales +
              unclassified.purchases +
              unclassified.returns >
            0
              ? "border-red-100 bg-red-50 text-red-700"
              : "border-slate-100 bg-slate-50 text-slate-700"
          }
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <TaxHeadCard
          label="CGST Position"
          output={netOutput.cgst}
          input={netInput.cgst}
        />
        <TaxHeadCard
          label="SGST Position"
          output={netOutput.sgst}
          input={netInput.sgst}
        />
        <TaxHeadCard
          label="IGST Position"
          output={netOutput.igst}
          input={netInput.igst}
        />
        <TaxHeadCard
          label="Cess Position"
          output={netOutput.cess}
          input={netInput.cess}
        />
      </section>

      {unclassified.sales +
        unclassified.purchases +
        unclassified.returns >
        0 && (
        <section className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-800 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0" />
            <div>
              <h2 className="text-lg font-black">
                GST data needs review
              </h2>
              <p className="mt-1 leading-7">
                Unclassified transactions are excluded from
                Intra-State and Inter-State buckets. Complete State
                Codes and HSN/SAC data, then safely edit and save the
                affected transaction.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-xl">
        <ReportHeader
          title="GSTR-1 Review Summary"
          description="Net outward supplies after posted Credit Note reversals."
          onExport={exportGstr1Csv}
        />

        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead className="bg-slate-50">
              <tr>
                {[
                  "Supply Type",
                  "Sales Docs",
                  "Gross Taxable",
                  "Credit Notes",
                  "Credit Taxable",
                  "Net Taxable",
                  "CGST",
                  "SGST",
                  "IGST",
                  "Net GST",
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
              {gstr1Rows.map((row) => (
                <tr
                  key={row.taxType}
                  className="border-b border-slate-100"
                >
                  <td className="px-5 py-4 font-bold text-slate-900">
                    {getTaxTypeLabel(row.taxType)}
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    {row.sales.documentCount}
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    {formatCurrency(row.sales.taxable)}
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    {row.credits.documentCount}
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    {formatCurrency(row.credits.taxable)}
                  </td>
                  <td className="px-5 py-4 font-bold text-slate-900">
                    {formatCurrency(row.net.taxable)}
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    {formatCurrency(row.net.cgst)}
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    {formatCurrency(row.net.sgst)}
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    {formatCurrency(row.net.igst)}
                  </td>
                  <td className="px-5 py-4 font-bold text-blue-700">
                    {formatCurrency(row.net.totalTax)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-xl">
        <ReportHeader
          title="GSTR-3B Review Summary"
          description="Operational GST summary before statutory eligibility and set-off adjustments."
          onExport={exportGstr3bCsv}
        />

        <div className="grid gap-4 p-4 sm:p-6 xl:grid-cols-2">
          <GstSection
            title="Outward Supplies"
            rows={[
              ["Gross Sales Taxable", grossOutput.taxable],
              ["Less: Credit Note Taxable", -creditReversal.taxable],
              ["Net Outward Taxable", netOutput.taxable],
              ["Net Output CGST", netOutput.cgst],
              ["Net Output SGST", netOutput.sgst],
              ["Net Output IGST", netOutput.igst],
              ["Net Output GST", netOutput.totalTax],
            ]}
          />

          <GstSection
            title="Inward Supplies & Input GST"
            rows={[
              ["Gross Purchase Taxable", grossInput.taxable],
              ["Less: Debit Note Taxable", -debitReversal.taxable],
              ["Net Inward Taxable", netInput.taxable],
              ["Net Input CGST", netInput.cgst],
              ["Net Input SGST", netInput.sgst],
              ["Net Input IGST", netInput.igst],
              ["Net Input GST", netInput.totalTax],
            ]}
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-xl">
        <ReportHeader
          title="HSN/SAC Summary"
          description="Net outward and inward tax snapshots grouped by HSN/SAC."
          onExport={exportHsnCsv}
        />

        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[1250px]">
            <thead className="bg-slate-50">
              <tr>
                {[
                  "HSN/SAC",
                  "Description",
                  "Net Outward Taxable",
                  "Output CGST",
                  "Output SGST",
                  "Output IGST",
                  "Net Inward Taxable",
                  "Input CGST",
                  "Input SGST",
                  "Input IGST",
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
                    colSpan={10}
                    className="px-5 py-12 text-center text-slate-500"
                  >
                    Loading HSN/SAC summary...
                  </td>
                </tr>
              ) : hsnSummary.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-5 py-12 text-center text-slate-500"
                  >
                    No GST item snapshots are available for this
                    period.
                  </td>
                </tr>
              ) : (
                hsnSummary.map((row) => (
                  <tr
                    key={row.key}
                    className="border-b border-slate-100"
                  >
                    <td className="px-5 py-4 font-bold text-slate-900">
                      {row.hsnSacCode}
                    </td>
                    <td className="px-5 py-4 text-slate-700">
                      {row.description}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      {formatCurrency(
                        row.outwardTaxable -
                          row.creditTaxable
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-700">
                      {formatCurrency(
                        row.outwardCgst - row.creditCgst
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-700">
                      {formatCurrency(
                        row.outwardSgst - row.creditSgst
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-700">
                      {formatCurrency(
                        row.outwardIgst - row.creditIgst
                      )}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      {formatCurrency(
                        row.inwardTaxable - row.debitTaxable
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-700">
                      {formatCurrency(
                        row.inwardCgst - row.debitCgst
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-700">
                      {formatCurrency(
                        row.inwardSgst - row.debitSgst
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-700">
                      {formatCurrency(
                        row.inwardIgst - row.debitIgst
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
        <h2 className="font-black">Important report scope</h2>
        <p className="mt-2 leading-7">
          These reports are review-ready operational summaries. They
          do not automatically determine Input Tax Credit eligibility,
          reverse-charge liability, statutory set-off order, interest,
          late fees or portal filing values. Review with an accountant
          before filing.
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
  isCurrency = true,
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

function TaxHeadCard({
  label,
  output,
  input,
}: {
  label: string;
  output: number;
  input: number;
}) {
  const position = roundMoney(output - input);

  return (
    <article className="rounded-3xl border border-violet-100 bg-white p-5 shadow-xl shadow-violet-100/40">
      <p className="font-bold text-slate-900">{label}</p>

      <div className="mt-4 space-y-3 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-slate-500">Output</span>
          <strong className="text-blue-700">
            {formatCurrency(output)}
          </strong>
        </div>

        <div className="flex justify-between gap-3">
          <span className="text-slate-500">Input</span>
          <strong className="text-emerald-700">
            {formatCurrency(input)}
          </strong>
        </div>

        <div className="flex justify-between gap-3 border-t border-slate-200 pt-3">
          <span className="font-bold text-slate-700">
            Position
          </span>
          <strong
            className={
              position >= 0
                ? "text-orange-700"
                : "text-violet-700"
            }
          >
            {position >= 0 ? "Payable " : "Credit "}
            {formatCurrency(Math.abs(position))}
          </strong>
        </div>
      </div>
    </article>
  );
}

function ReportHeader({
  title,
  description,
  onExport,
}: {
  title: string;
  description: string;
  onExport: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div>
        <h2 className="text-xl font-black text-slate-900 sm:text-2xl">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {description}
        </p>
      </div>

      <button
        type="button"
        onClick={onExport}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 font-bold text-emerald-700 transition hover:bg-emerald-100 sm:w-auto"
      >
        <Download className="h-5 w-5" />
        Export CSV
      </button>
    </div>
  );
}

function GstSection({
  title,
  rows,
}: {
  title: string;
  rows: [string, number][];
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200">
      <div className="bg-slate-50 px-4 py-3">
        <h3 className="font-black text-slate-900">{title}</h3>
      </div>

      <div className="divide-y divide-slate-100">
        {rows.map(([label, value], index) => (
          <div
            key={label}
            className={`flex items-center justify-between gap-4 px-4 py-3 ${
              index === rows.length - 1
                ? "bg-blue-50 font-black text-blue-800"
                : ""
            }`}
          >
            <span>{label}</span>
            <span>{formatCurrency(value)}</span>
          </div>
        ))}
      </div>
    </article>
  );
}