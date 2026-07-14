"use client";

import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  ExternalLink,
  FileSpreadsheet,
  RefreshCw,
  Scale,
  Search,
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

type ItemSnapshot = {
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
  customer: LedgerRow | LedgerRow[] | null;
  sale_items: ItemSnapshot[] | null;
};

type PurchaseRow = {
  id: string;
  bill_number: string;
  purchase_date: string;
  place_of_supply: string | null;
  place_of_supply_code: string | null;
  tax_type: string | null;
  supplier: LedgerRow | LedgerRow[] | null;
  purchase_items: ItemSnapshot[] | null;
};

type CreditNoteRow = {
  id: string;
  source_sale_id: string;
  credit_note_number: string;
  credit_note_date: string;
  place_of_supply: string | null;
  place_of_supply_code: string | null;
  tax_type: string | null;
  status: "POSTED" | "VOID";
  credit_note_items: ItemSnapshot[] | null;
};

type DebitNoteRow = {
  id: string;
  source_purchase_id: string;
  debit_note_number: string;
  debit_note_date: string;
  place_of_supply: string | null;
  place_of_supply_code: string | null;
  tax_type: string | null;
  status: "POSTED" | "VOID";
  debit_note_items: ItemSnapshot[] | null;
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
type GstDirection = "OUTPUT" | "INPUT";

type RegisterRow = {
  key: string;
  id: string;
  documentType: DocumentType;
  documentLabel: string;
  documentNumber: string;
  documentDate: string;
  partyName: string;
  partyGstin: string;
  partyState: string;
  placeOfSupply: string;
  placeOfSupplyCode: string;
  taxType: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalTax: number;
  documentTotal: number;
  status: DocumentStatus;
  direction: GstDirection;
  sign: 1 | -1;
  href: string;
};

type ItemTotals = {
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalTax: number;
  documentTotal: number;
};

type SummaryTotals = {
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalTax: number;
  documentTotal: number;
  documentCount: number;
};

const emptySummary: SummaryTotals = {
  taxableValue: 0,
  cgst: 0,
  sgst: 0,
  igst: 0,
  cess: 0,
  totalTax: 0,
  documentTotal: 0,
  documentCount: 0,
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

function formatCurrency(value: number) {
  const rounded = roundMoney(value);
  const sign = rounded < 0 ? "−" : "";

  return `${sign}₹${Math.abs(rounded).toLocaleString("en-IN", {
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
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const startYear =
    currentMonth >= 4 ? currentYear : currentYear - 1;

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

function calculateItemTotals(items: ItemSnapshot[]): ItemTotals {
  return items.reduce<ItemTotals>(
    (total, item) => {
      const taxableValue = toNumber(item.taxable_amount);
      const cgst = toNumber(item.cgst_amount);
      const sgst = toNumber(item.sgst_amount);
      const igst = toNumber(item.igst_amount);
      const cess = toNumber(item.cess_amount);
      const totalTax = cgst + sgst + igst + cess;

      const savedAmount = toNumber(item.amount);
      const calculatedAmount = taxableValue + totalTax;

      return {
        taxableValue: total.taxableValue + taxableValue,
        cgst: total.cgst + cgst,
        sgst: total.sgst + sgst,
        igst: total.igst + igst,
        cess: total.cess + cess,
        totalTax: total.totalTax + totalTax,
        documentTotal:
          total.documentTotal +
          (savedAmount || calculatedAmount),
      };
    },
    {
      taxableValue: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      cess: 0,
      totalTax: 0,
      documentTotal: 0,
    }
  );
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
  const content = rows
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF", content], {
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

export default function GSTTransactionRegister() {
  const financialYear = useMemo(
    () => getCurrentFinancialYearDates(),
    []
  );

  const [rows, setRows] = useState<RegisterRow[]>([]);

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
  const [documentTypeFilter, setDocumentTypeFilter] =
    useState<"ALL" | DocumentType>("ALL");
  const [taxTypeFilter, setTaxTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] =
    useState<"ALL" | DocumentStatus>("ALL");

  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);

    window.setTimeout(() => {
      setMessage("");
    }, 4500);
  }

  async function loadRegister(
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
          "Please sign in to view the GST Transaction Register."
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
            customer:ledgers!sales_customer_id_fkey(
              id,
              name,
              gst_number,
              state,
              state_code
            ),
            sale_items(
              taxable_amount,
              cgst_amount,
              sgst_amount,
              igst_amount,
              cess_amount,
              amount
            )
          `
        )
        .eq("company_id", companyId);

      let purchaseQuery = supabase
        .from("purchases")
        .select(
          `
            id,
            bill_number,
            purchase_date,
            place_of_supply,
            place_of_supply_code,
            tax_type,
            supplier:ledgers!purchases_supplier_id_fkey(
              id,
              name,
              gst_number,
              state,
              state_code
            ),
            purchase_items(
              taxable_amount,
              cgst_amount,
              sgst_amount,
              igst_amount,
              cess_amount,
              amount
            )
          `
        )
        .eq("company_id", companyId);

      let creditNoteQuery = supabase
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
            status,
            credit_note_items(
              taxable_amount,
              cgst_amount,
              sgst_amount,
              igst_amount,
              cess_amount,
              amount
            )
          `
        )
        .eq("company_id", companyId);

      let debitNoteQuery = supabase
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
            status,
            debit_note_items(
              taxable_amount,
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
        salesQuery = salesQuery.gte(
          "invoice_date",
          reportFromDate
        );
        purchaseQuery = purchaseQuery.gte(
          "purchase_date",
          reportFromDate
        );
        creditNoteQuery = creditNoteQuery.gte(
          "credit_note_date",
          reportFromDate
        );
        debitNoteQuery = debitNoteQuery.gte(
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
        creditNoteQuery = creditNoteQuery.lte(
          "credit_note_date",
          reportToDate
        );
        debitNoteQuery = debitNoteQuery.lte(
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
        purchaseQuery,
        creditNoteQuery,
        debitNoteQuery,
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
        (creditNotesResponse.data ||
          []) as unknown as CreditNoteRow[];
      const debitNotes =
        (debitNotesResponse.data ||
          []) as unknown as DebitNoteRow[];

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

      const nextRows: RegisterRow[] = [];

      sales.forEach((sale) => {
        const party = getJoinedLedger(sale.customer);
        const totals = calculateItemTotals(sale.sale_items || []);

        nextRows.push({
          key: `SALE-${sale.id}`,
          id: sale.id,
          documentType: "SALE",
          documentLabel: "Sales Invoice",
          documentNumber: sale.invoice_number,
          documentDate: sale.invoice_date,
          partyName: party?.name || "Customer",
          partyGstin: party?.gst_number || "",
          partyState: party?.state || "",
          placeOfSupply: sale.place_of_supply || "",
          placeOfSupplyCode: sale.place_of_supply_code || "",
          taxType: sale.tax_type || "UNCLASSIFIED",
          taxableValue: totals.taxableValue,
          cgst: totals.cgst,
          sgst: totals.sgst,
          igst: totals.igst,
          cess: totals.cess,
          totalTax: totals.totalTax,
          documentTotal: totals.documentTotal,
          status: "POSTED",
          direction: "OUTPUT",
          sign: 1,
          href: `/sales/invoice/${sale.id}`,
        });
      });

      purchases.forEach((purchase) => {
        const party = getJoinedLedger(purchase.supplier);
        const totals = calculateItemTotals(
          purchase.purchase_items || []
        );

        nextRows.push({
          key: `PURCHASE-${purchase.id}`,
          id: purchase.id,
          documentType: "PURCHASE",
          documentLabel: "Purchase Bill",
          documentNumber: purchase.bill_number,
          documentDate: purchase.purchase_date,
          partyName: party?.name || "Supplier",
          partyGstin: party?.gst_number || "",
          partyState: party?.state || "",
          placeOfSupply: purchase.place_of_supply || "",
          placeOfSupplyCode:
            purchase.place_of_supply_code || "",
          taxType: purchase.tax_type || "UNCLASSIFIED",
          taxableValue: totals.taxableValue,
          cgst: totals.cgst,
          sgst: totals.sgst,
          igst: totals.igst,
          cess: totals.cess,
          totalTax: totals.totalTax,
          documentTotal: totals.documentTotal,
          status: "POSTED",
          direction: "INPUT",
          sign: 1,
          href: `/purchase/bill/${purchase.id}`,
        });
      });

      creditNotes.forEach((note) => {
        const sourceSale = sourceSaleById.get(
          note.source_sale_id
        );
        const party = getJoinedLedger(
          sourceSale?.customer || null
        );
        const totals = calculateItemTotals(
          note.credit_note_items || []
        );

        nextRows.push({
          key: `CREDIT_NOTE-${note.id}`,
          id: note.id,
          documentType: "CREDIT_NOTE",
          documentLabel: "Credit Note",
          documentNumber: note.credit_note_number,
          documentDate: note.credit_note_date,
          partyName: party?.name || "Customer",
          partyGstin: party?.gst_number || "",
          partyState: party?.state || "",
          placeOfSupply: note.place_of_supply || "",
          placeOfSupplyCode:
            note.place_of_supply_code || "",
          taxType: note.tax_type || "UNCLASSIFIED",
          taxableValue: totals.taxableValue,
          cgst: totals.cgst,
          sgst: totals.sgst,
          igst: totals.igst,
          cess: totals.cess,
          totalTax: totals.totalTax,
          documentTotal: totals.documentTotal,
          status: note.status,
          direction: "OUTPUT",
          sign: -1,
          href: `/credit-notes/${note.id}`,
        });
      });

      debitNotes.forEach((note) => {
        const sourcePurchase = sourcePurchaseById.get(
          note.source_purchase_id
        );
        const party = getJoinedLedger(
          sourcePurchase?.supplier || null
        );
        const totals = calculateItemTotals(
          note.debit_note_items || []
        );

        nextRows.push({
          key: `DEBIT_NOTE-${note.id}`,
          id: note.id,
          documentType: "DEBIT_NOTE",
          documentLabel: "Debit Note",
          documentNumber: note.debit_note_number,
          documentDate: note.debit_note_date,
          partyName: party?.name || "Supplier",
          partyGstin: party?.gst_number || "",
          partyState: party?.state || "",
          placeOfSupply: note.place_of_supply || "",
          placeOfSupplyCode:
            note.place_of_supply_code || "",
          taxType: note.tax_type || "UNCLASSIFIED",
          taxableValue: totals.taxableValue,
          cgst: totals.cgst,
          sgst: totals.sgst,
          igst: totals.igst,
          cess: totals.cess,
          totalTax: totals.totalTax,
          documentTotal: totals.documentTotal,
          status: note.status,
          direction: "INPUT",
          sign: -1,
          href: `/debit-notes/${note.id}`,
        });
      });

      nextRows.sort((left, right) => {
        const dateComparison = right.documentDate.localeCompare(
          left.documentDate
        );

        if (dateComparison !== 0) {
          return dateComparison;
        }

        return right.documentNumber.localeCompare(
          left.documentNumber
        );
      });

      setRows(nextRows);
    } catch (error) {
      setRows([]);

      showMessage(
        error instanceof Error
          ? error.message
          : "GST Transaction Register could not be loaded."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadRegister(financialYear.from, financialYear.to);

    const refreshEvents = [
      "vertexerp-sales-updated",
      "vertexerp-purchases-updated",
      "vertexerp-gst-data-updated",
      "vertexerp-active-company-updated",
    ];

    function handleRefresh() {
      loadRegister();
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

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesDocumentType =
        documentTypeFilter === "ALL" ||
        row.documentType === documentTypeFilter;

      const matchesTaxType =
        taxTypeFilter === "ALL" ||
        row.taxType === taxTypeFilter;

      const matchesStatus =
        statusFilter === "ALL" || row.status === statusFilter;

      const matchesSearch =
        !normalizedSearch ||
        row.documentNumber
          .toLowerCase()
          .includes(normalizedSearch) ||
        row.partyName.toLowerCase().includes(normalizedSearch) ||
        row.partyGstin.toLowerCase().includes(normalizedSearch) ||
        row.placeOfSupply
          .toLowerCase()
          .includes(normalizedSearch);

      return (
        matchesDocumentType &&
        matchesTaxType &&
        matchesStatus &&
        matchesSearch
      );
    });
  }, [
    rows,
    searchTerm,
    documentTypeFilter,
    taxTypeFilter,
    statusFilter,
  ]);

  const outputSummary = useMemo(() => {
    return filteredRows
      .filter(
        (row) =>
          row.direction === "OUTPUT" && row.status === "POSTED"
      )
      .reduce<SummaryTotals>(
        (total, row) => ({
          taxableValue:
            total.taxableValue +
            row.taxableValue * row.sign,
          cgst: total.cgst + row.cgst * row.sign,
          sgst: total.sgst + row.sgst * row.sign,
          igst: total.igst + row.igst * row.sign,
          cess: total.cess + row.cess * row.sign,
          totalTax:
            total.totalTax + row.totalTax * row.sign,
          documentTotal:
            total.documentTotal +
            row.documentTotal * row.sign,
          documentCount: total.documentCount + 1,
        }),
        { ...emptySummary }
      );
  }, [filteredRows]);

  const inputSummary = useMemo(() => {
    return filteredRows
      .filter(
        (row) =>
          row.direction === "INPUT" && row.status === "POSTED"
      )
      .reduce<SummaryTotals>(
        (total, row) => ({
          taxableValue:
            total.taxableValue +
            row.taxableValue * row.sign,
          cgst: total.cgst + row.cgst * row.sign,
          sgst: total.sgst + row.sgst * row.sign,
          igst: total.igst + row.igst * row.sign,
          cess: total.cess + row.cess * row.sign,
          totalTax:
            total.totalTax + row.totalTax * row.sign,
          documentTotal:
            total.documentTotal +
            row.documentTotal * row.sign,
          documentCount: total.documentCount + 1,
        }),
        { ...emptySummary }
      );
  }, [filteredRows]);

  const netPosition = useMemo(
    () => ({
      cgst: roundMoney(outputSummary.cgst - inputSummary.cgst),
      sgst: roundMoney(outputSummary.sgst - inputSummary.sgst),
      igst: roundMoney(outputSummary.igst - inputSummary.igst),
      cess: roundMoney(outputSummary.cess - inputSummary.cess),
      totalTax: roundMoney(
        outputSummary.totalTax - inputSummary.totalTax
      ),
    }),
    [outputSummary, inputSummary]
  );

  function applyDateFilter() {
    if (fromDate && toDate && fromDate > toDate) {
      showMessage("From Date cannot be later than To Date.");
      return;
    }

    appliedFromDateRef.current = fromDate;
    appliedToDateRef.current = toDate;

    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);

    loadRegister(fromDate, toDate);
  }

  function resetDateFilter() {
    const nextFinancialYear = getCurrentFinancialYearDates();

    setFromDate(nextFinancialYear.from);
    setToDate(nextFinancialYear.to);
    setAppliedFromDate(nextFinancialYear.from);
    setAppliedToDate(nextFinancialYear.to);

    appliedFromDateRef.current = nextFinancialYear.from;
    appliedToDateRef.current = nextFinancialYear.to;

    loadRegister(
      nextFinancialYear.from,
      nextFinancialYear.to
    );
  }

  function clearRegisterFilters() {
    setSearchTerm("");
    setDocumentTypeFilter("ALL");
    setTaxTypeFilter("ALL");
    setStatusFilter("ALL");
  }

  function exportRegisterCsv() {
    const exportRows: unknown[][] = [
      [
        "Date",
        "Document Type",
        "Document Number",
        "Direction",
        "Party Name",
        "Party GSTIN",
        "Party State",
        "Place of Supply",
        "Tax Type",
        "Taxable Value",
        "CGST",
        "SGST",
        "IGST",
        "Cess",
        "Total GST",
        "Document Total",
        "Status",
        "Included in Summary",
      ],
      ...filteredRows.map((row) => [
        row.documentDate,
        row.documentLabel,
        row.documentNumber,
        row.direction,
        row.partyName,
        row.partyGstin,
        row.partyState,
        row.placeOfSupply,
        getTaxTypeLabel(row.taxType),
        roundMoney(row.taxableValue * row.sign),
        roundMoney(row.cgst * row.sign),
        roundMoney(row.sgst * row.sign),
        roundMoney(row.igst * row.sign),
        roundMoney(row.cess * row.sign),
        roundMoney(row.totalTax * row.sign),
        roundMoney(row.documentTotal * row.sign),
        row.status,
        row.status === "POSTED" ? "Yes" : "No",
      ]),
    ];

    downloadCsv(
      `vertexerp-gst-transaction-register-${
        appliedFromDate || "all"
      }-${appliedToDate || "all"}.csv`,
      exportRows
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-violet-100 bg-gradient-to-br from-[#2f1c6a] to-[#673de6] p-5 text-white shadow-xl sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-violet-100">
              GST Document Register
            </p>

            <h1 className="mt-3 text-3xl font-black sm:text-4xl">
              Invoice-wise GST Transaction Register
            </h1>

            <p className="mt-3 max-w-3xl leading-7 text-violet-100">
              Review Sales Invoices, Purchase Bills, Credit Notes
              and Debit Notes in one searchable GST register.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => loadRegister()}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-black text-violet-700 shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={`h-5 w-5 ${
                  isLoading ? "animate-spin" : ""
                }`}
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={exportRegisterCsv}
              disabled={isLoading || filteredRows.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 py-3 font-black text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-5 w-5" />
              Export CSV
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
              onChange={(event) =>
                setFromDate(event.target.value)
              }
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
              onChange={(event) =>
                setToDate(event.target.value)
              }
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
            />
          </div>

          <button
            type="button"
            onClick={applyDateFilter}
            disabled={isLoading}
            className="self-end rounded-xl bg-violet-600 px-5 py-3 font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Generate Register
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
          Showing {formatDate(appliedFromDate)} to{" "}
          {formatDate(appliedToDate)}
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Net Output GST"
          value={outputSummary.totalTax}
          detail={`${outputSummary.documentCount} outward documents after Credit Note reversal`}
          icon={<ArrowUpRight className="h-5 w-5" />}
          className="border-blue-100 bg-blue-50 text-blue-700"
        />

        <SummaryCard
          title="Net Input GST"
          value={inputSummary.totalTax}
          detail={`${inputSummary.documentCount} inward documents after Debit Note reversal`}
          icon={<ArrowDownRight className="h-5 w-5" />}
          className="border-emerald-100 bg-emerald-50 text-emerald-700"
        />

        <SummaryCard
          title={
            netPosition.totalTax >= 0
              ? "Net GST Position"
              : "Input Credit Surplus"
          }
          value={Math.abs(netPosition.totalTax)}
          detail={
            netPosition.totalTax >= 0
              ? "Output GST exceeds Input GST"
              : "Input GST exceeds Output GST"
          }
          icon={<Scale className="h-5 w-5" />}
          className={
            netPosition.totalTax >= 0
              ? "border-orange-100 bg-orange-50 text-orange-700"
              : "border-violet-100 bg-violet-50 text-violet-700"
          }
        />

        <SummaryCard
          title="Filtered Documents"
          value={filteredRows.length}
          detail={`${filteredRows.filter((row) => row.status === "VOID").length} void documents excluded from summary`}
          icon={<FileSpreadsheet className="h-5 w-5" />}
          className="border-slate-100 bg-slate-50 text-slate-700"
          isCurrency={false}
        />
      </section>

      <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:p-6">
        <div className="mb-5">
          <h2 className="text-xl font-black text-slate-900 sm:text-2xl">
            Tax Head Position
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Net output and input GST position for each tax head.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <TaxPositionCard
            label="CGST Position"
            output={outputSummary.cgst}
            input={inputSummary.cgst}
          />

          <TaxPositionCard
            label="SGST Position"
            output={outputSummary.sgst}
            input={inputSummary.sgst}
          />

          <TaxPositionCard
            label="IGST Position"
            output={outputSummary.igst}
            input={inputSummary.igst}
          />

          <TaxPositionCard
            label="Cess Position"
            output={outputSummary.cess}
            input={inputSummary.cess}
          />
        </div>
      </section>

      <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative md:col-span-2">
            <label className="mb-2 block font-bold text-slate-800">
              Search Register
            </label>

            <Search className="absolute bottom-3.5 left-4 h-5 w-5 text-slate-400" />

            <input
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(event.target.value)
              }
              placeholder="Document number, party or GSTIN"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-12 pr-4 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
            />
          </div>

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
            label="Tax Type"
            value={taxTypeFilter}
            onChange={setTaxTypeFilter}
            options={[
              ["ALL", "All Tax Types"],
              ["INTRA_STATE", "Intra-State"],
              ["INTER_STATE", "Inter-State"],
              ["EXEMPT", "Exempt / Nil Rated"],
              ["ZERO_RATED", "Zero-Rated"],
              ["UNCLASSIFIED", "Unclassified"],
            ]}
          />

          <FilterSelect
            label="Status"
            value={statusFilter}
            onChange={(value) =>
              setStatusFilter(
                value as "ALL" | DocumentStatus
              )
            }
            options={[
              ["ALL", "All Statuses"],
              ["POSTED", "Posted"],
              ["VOID", "Void"],
            ]}
          />
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={clearRegisterFilters}
            className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Clear Filters
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl">
        <div className="border-b border-slate-200 p-5 sm:p-6">
          <h2 className="text-xl font-black text-slate-900 sm:text-2xl">
            GST Transactions
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Credit Notes and Debit Notes appear as negative GST
            adjustments. VOID records remain visible but are excluded
            from summary calculations.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1500px]">
            <thead className="bg-slate-50">
              <tr>
                {[
                  "Date",
                  "Document",
                  "Party",
                  "Supply",
                  "Taxable",
                  "CGST",
                  "SGST",
                  "IGST",
                  "Cess",
                  "Total GST",
                  "Document Total",
                  "Status",
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
                    colSpan={13}
                    className="px-5 py-14 text-center text-slate-500"
                  >
                    Loading GST Transaction Register...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={13}
                    className="px-5 py-14 text-center text-slate-500"
                  >
                    No GST transactions match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const signedTaxable =
                    row.taxableValue * row.sign;
                  const signedCgst = row.cgst * row.sign;
                  const signedSgst = row.sgst * row.sign;
                  const signedIgst = row.igst * row.sign;
                  const signedCess = row.cess * row.sign;
                  const signedTotalTax =
                    row.totalTax * row.sign;
                  const signedDocumentTotal =
                    row.documentTotal * row.sign;

                  return (
                    <tr
                      key={row.key}
                      className={`border-b border-slate-100 transition hover:bg-violet-50/40 ${
                        row.status === "VOID"
                          ? "bg-red-50/50 opacity-70"
                          : ""
                      }`}
                    >
                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                        {formatDate(row.documentDate)}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getDocumentBadgeClass(
                            row.documentType
                          )}`}
                        >
                          {row.documentLabel}
                        </span>

                        <p className="mt-2 font-bold text-slate-900">
                          {row.documentNumber}
                        </p>

                        <p
                          className={`mt-1 text-xs font-semibold ${
                            row.direction === "OUTPUT"
                              ? "text-blue-700"
                              : "text-emerald-700"
                          }`}
                        >
                          {row.direction} GST
                          {row.sign === -1
                            ? " REVERSAL"
                            : ""}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">
                          {row.partyName}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {row.partyGstin ||
                            "Unregistered Party"}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-800">
                          {getTaxTypeLabel(row.taxType)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {row.placeOfSupply
                            ? `${row.placeOfSupply}${
                                row.placeOfSupplyCode
                                  ? ` (${row.placeOfSupplyCode})`
                                  : ""
                              }`
                            : "Place of Supply pending"}
                        </p>
                      </td>

                      <MoneyCell value={signedTaxable} />
                      <MoneyCell value={signedCgst} />
                      <MoneyCell value={signedSgst} />
                      <MoneyCell value={signedIgst} />
                      <MoneyCell value={signedCess} />

                      <td className="px-5 py-4 font-bold text-violet-700">
                        {formatCurrency(signedTotalTax)}
                      </td>

                      <td className="px-5 py-4 font-black text-slate-900">
                        {formatCurrency(signedDocumentTotal)}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            row.status === "POSTED"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <Link
                          href={row.href}
                          className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                        >
                          View
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
        <h2 className="font-black">Important register scope</h2>
        <p className="mt-2 leading-7">
          This is an operational GST transaction register. Actual
          return filing, Input Tax Credit eligibility, reverse charge,
          statutory set-off, interest, late fees and GST portal
          adjustments must be verified before filing.
        </p>
      </section>
    </div>
  );
}

function SummaryCard({
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

function MoneyCell({ value }: { value: number }) {
  return (
    <td
      className={`px-5 py-4 font-semibold ${
        value < 0 ? "text-red-700" : "text-slate-700"
      }`}
    >
      {formatCurrency(value)}
    </td>
  );
}

function TaxPositionCard({
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
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
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