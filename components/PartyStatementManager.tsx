"use client";

import Link from "next/link";
import {
  BookOpenCheck,
  CalendarDays,
  Download,
  ExternalLink,
  FileText,
  Printer,
  RefreshCw,
  Search,
  Users,
  WalletCards,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { createClient } from "@/lib/supabase/client";

type PartyType = "Customer" | "Supplier";
type PaymentType = "Customer Receipt" | "Supplier Payment";
type DocumentFilter =
  | "ALL"
  | "OPENING"
  | "INVOICE"
  | "BILL"
  | "RECEIPT"
  | "PAYMENT"
  | "CREDIT_NOTE"
  | "DEBIT_NOTE"
  | "SETTLEMENT";

type ProfileRow = {
  active_company_id: string | null;
};

type CompanyRow = {
  id: string;
  name: string;
  gst_number: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  address: string | null;
};

type LedgerRow = {
  id: string;
  name: string;
  ledger_type: string;
  opening_balance: number | string | null;
  mobile: string | null;
  email: string | null;
  gst_number: string | null;
  state: string | null;
  state_code: string | null;
  pincode: string | null;
  address: string | null;
};

type SaleRow = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  payment_mode: string;
  customer_id: string | null;
  grand_total: number | string | null;
};

type PurchaseRow = {
  id: string;
  bill_number: string;
  purchase_date: string;
  payment_mode: string;
  supplier_id: string | null;
  grand_total: number | string | null;
};

type PaymentRow = {
  id: string;
  payment_type: PaymentType;
  party_id: string;
  payment_date: string;
  amount: number | string | null;
  payment_mode: string;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
};

type CreditNoteRow = {
  id: string;
  source_sale_id: string;
  credit_note_number: string;
  credit_note_date: string;
  grand_total: number | string | null;
  status: "POSTED" | "VOID";
};

type DebitNoteRow = {
  id: string;
  source_purchase_id: string;
  debit_note_number: string;
  debit_note_date: string;
  grand_total: number | string | null;
  status: "POSTED" | "VOID";
};

type StatementTransaction = {
  key: string;
  id: string;
  date: string;
  sortOrder: number;
  documentType: Exclude<DocumentFilter, "ALL" | "OPENING">;
  documentLabel: string;
  documentNumber: string;
  description: string;
  debit: number;
  credit: number;
  paymentMode: string;
  referenceNumber: string;
  href: string | null;
};

type StatementRow = StatementTransaction & {
  runningBalance: number;
};

type PartyOption = {
  id: string;
  name: string;
  type: PartyType;
  openingBalance: number;
  mobile: string;
  email: string;
  gstNumber: string;
  state: string;
  stateCode: string;
  pincode: string;
  address: string;
};

type MetricCardProps = {
  title: string;
  value: string;
  detail: string;
  icon: ReactNode;
  className: string;
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatCurrency(value: number) {
  return `₹${Math.abs(roundMoney(value)).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatBalance(value: number) {
  const rounded = roundMoney(value);

  if (Math.abs(rounded) < 0.01) {
    return `${formatCurrency(0)} —`;
  }

  return `${formatCurrency(rounded)} ${rounded > 0 ? "Dr" : "Cr"}`;
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
  const startYear = currentMonth >= 4 ? currentYear : currentYear - 1;

  return {
    from: `${startYear}-04-01`,
    to: `${startYear + 1}-03-31`,
  };
}

function isCreditMode(paymentMode: string) {
  return String(paymentMode || "").trim().toLowerCase() === "credit";
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");

  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function mapParty(row: LedgerRow): PartyOption | null {
  const normalizedType = String(row.ledger_type || "").trim().toLowerCase();

  if (normalizedType !== "customer" && normalizedType !== "supplier") {
    return null;
  }

  return {
    id: row.id,
    name: row.name || "Unnamed Party",
    type: normalizedType === "customer" ? "Customer" : "Supplier",
    openingBalance: toNumber(row.opening_balance),
    mobile: row.mobile || "",
    email: row.email || "",
    gstNumber: row.gst_number || "",
    state: row.state || "",
    stateCode: row.state_code || "",
    pincode: row.pincode || "",
    address: row.address || "",
  };
}

function getDocumentBadgeClass(documentType: StatementTransaction["documentType"]) {
  if (documentType === "INVOICE") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (documentType === "BILL") {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }

  if (documentType === "RECEIPT") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (documentType === "PAYMENT") {
    return "border-purple-200 bg-purple-50 text-purple-700";
  }

  if (documentType === "CREDIT_NOTE") {
    return "border-cyan-200 bg-cyan-50 text-cyan-700";
  }

  if (documentType === "DEBIT_NOTE") {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function PartyStatementManager() {
  const { can } = usePermissions();
  const canViewLedgers = can("ledgers.view");
  const canViewSales = can("sales.view");
  const canViewPurchases = can("purchase.view");
  const canViewPayments = can("payments.view");
  const canViewCreditNotes = can("credit_notes.view");
  const canViewDebitNotes = can("debit_notes.view");

  const financialYear = useMemo(() => getCurrentFinancialYearDates(), []);

  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [creditNotes, setCreditNotes] = useState<CreditNoteRow[]>([]);
  const [debitNotes, setDebitNotes] = useState<DebitNoteRow[]>([]);

  const [partyType, setPartyType] = useState<PartyType>("Customer");
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [fromDate, setFromDate] = useState(financialYear.from);
  const [toDate, setToDate] = useState(financialYear.to);
  const [appliedFromDate, setAppliedFromDate] = useState(financialYear.from);
  const [appliedToDate, setAppliedToDate] = useState(financialYear.to);
  const [searchTerm, setSearchTerm] = useState("");
  const [documentFilter, setDocumentFilter] = useState<DocumentFilter>("ALL");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(""), 4500);
  }

  async function loadStatementData() {
    setIsLoading(true);
    setMessage("");

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Please sign in to view party statements.");
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("active_company_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      const companyId = (profile as ProfileRow | null)?.active_company_id || null;

      if (!companyId) {
        throw new Error("Select an active company from the Companies page first.");
      }

      const [
        companyResponse,
        ledgersResponse,
        salesResponse,
        purchasesResponse,
        paymentsResponse,
        creditNotesResponse,
        debitNotesResponse,
      ] = await Promise.all([
        supabase
          .from("companies")
          .select("id, name, gst_number, email, phone, city, address")
          .eq("id", companyId)
          .maybeSingle(),
        supabase
          .from("ledgers")
          .select(
            "id, name, ledger_type, opening_balance, mobile, email, gst_number, state, state_code, pincode, address"
          )
          .eq("company_id", companyId)
          .in("ledger_type", ["Customer", "Supplier"])
          .order("name", { ascending: true }),
        supabase
          .from("sales")
          .select(
            "id, invoice_number, invoice_date, payment_mode, customer_id, grand_total"
          )
          .eq("company_id", companyId),
        supabase
          .from("purchases")
          .select(
            "id, bill_number, purchase_date, payment_mode, supplier_id, grand_total"
          )
          .eq("company_id", companyId),
        supabase
          .from("payments")
          .select(
            "id, payment_type, party_id, payment_date, amount, payment_mode, reference_number, notes, created_at"
          )
          .eq("company_id", companyId),
        supabase
          .from("credit_notes")
          .select(
            "id, source_sale_id, credit_note_number, credit_note_date, grand_total, status"
          )
          .eq("company_id", companyId)
          .eq("status", "POSTED"),
        supabase
          .from("debit_notes")
          .select(
            "id, source_purchase_id, debit_note_number, debit_note_date, grand_total, status"
          )
          .eq("company_id", companyId)
          .eq("status", "POSTED"),
      ]);

      const responses = [
        companyResponse,
        ledgersResponse,
        salesResponse,
        purchasesResponse,
        paymentsResponse,
        creditNotesResponse,
        debitNotesResponse,
      ];
      const firstError = responses.find((response) => response.error)?.error;

      if (firstError) {
        throw firstError;
      }

      const nextParties = ((ledgersResponse.data || []) as LedgerRow[])
        .map(mapParty)
        .filter((party): party is PartyOption => Boolean(party));

      setCompany((companyResponse.data || null) as CompanyRow | null);
      setParties(nextParties);
      setSales((salesResponse.data || []) as SaleRow[]);
      setPurchases((purchasesResponse.data || []) as PurchaseRow[]);
      setPayments((paymentsResponse.data || []) as PaymentRow[]);
      setCreditNotes((creditNotesResponse.data || []) as CreditNoteRow[]);
      setDebitNotes((debitNotesResponse.data || []) as DebitNoteRow[]);

      setSelectedPartyId((currentPartyId) => {
        const currentStillAvailable = nextParties.some(
          (party) => party.id === currentPartyId && party.type === partyType
        );

        if (currentStillAvailable) {
          return currentPartyId;
        }

        return nextParties.find((party) => party.type === partyType)?.id || "";
      });
    } catch (error) {
      setCompany(null);
      setParties([]);
      setSales([]);
      setPurchases([]);
      setPayments([]);
      setCreditNotes([]);
      setDebitNotes([]);
      setSelectedPartyId("");

      showMessage(
        error instanceof Error
          ? error.message
          : "Party statement data could not be loaded."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadStatementData();

    const refreshEvents = [
      "vertexerp-ledgers-updated",
      "vertexerp-sales-updated",
      "vertexerp-purchases-updated",
      "vertexerp-payments-updated",
      "vertexerp-gst-data-updated",
      "vertexerp-active-company-updated",
    ];

    refreshEvents.forEach((eventName) => {
      window.addEventListener(eventName, loadStatementData);
    });

    return () => {
      refreshEvents.forEach((eventName) => {
        window.removeEventListener(eventName, loadStatementData);
      });
    };
  }, []);

  const visibleParties = useMemo(
    () => parties.filter((party) => party.type === partyType),
    [parties, partyType]
  );

  const selectedParty = useMemo(
    () => parties.find((party) => party.id === selectedPartyId) || null,
    [parties, selectedPartyId]
  );

  function changePartyType(nextType: PartyType) {
    setPartyType(nextType);
    setSelectedPartyId(parties.find((party) => party.type === nextType)?.id || "");
    setSearchTerm("");
    setDocumentFilter("ALL");
  }

  const statementTransactions = useMemo<StatementTransaction[]>(() => {
    if (!selectedParty) {
      return [];
    }

    const rows: StatementTransaction[] = [];
    const saleById = new Map<string, SaleRow>(
      sales.map((sale) => [sale.id, sale] as const)
    );
    const purchaseById = new Map<string, PurchaseRow>(
      purchases.map((purchase) => [purchase.id, purchase] as const)
    );

    if (selectedParty.type === "Customer") {
      sales
        .filter((sale) => sale.customer_id === selectedParty.id)
        .forEach((sale) => {
          const amount = toNumber(sale.grand_total);
          const paymentMode = sale.payment_mode || "Cash";

          rows.push({
            key: `invoice-${sale.id}`,
            id: sale.id,
            date: sale.invoice_date,
            sortOrder: 10,
            documentType: "INVOICE",
            documentLabel: "Sales Invoice",
            documentNumber: sale.invoice_number || "—",
            description: isCreditMode(paymentMode)
              ? "Credit sales invoice"
              : `Sales invoice paid via ${paymentMode}`,
            debit: amount,
            credit: 0,
            paymentMode,
            referenceNumber: "",
            href: `/sales/invoice/${sale.id}`,
          });

          if (!isCreditMode(paymentMode)) {
            rows.push({
              key: `invoice-settlement-${sale.id}`,
              id: sale.id,
              date: sale.invoice_date,
              sortOrder: 11,
              documentType: "SETTLEMENT",
              documentLabel: "Immediate Settlement",
              documentNumber: sale.invoice_number || "—",
              description: `Invoice settled at creation through ${paymentMode}`,
              debit: 0,
              credit: amount,
              paymentMode,
              referenceNumber: "",
              href: `/sales/invoice/${sale.id}`,
            });
          }
        });

      payments
        .filter(
          (payment) =>
            payment.party_id === selectedParty.id &&
            payment.payment_type === "Customer Receipt"
        )
        .forEach((payment) => {
          rows.push({
            key: `receipt-${payment.id}`,
            id: payment.id,
            date: payment.payment_date,
            sortOrder: 30,
            documentType: "RECEIPT",
            documentLabel: "Customer Receipt",
            documentNumber: payment.reference_number || `RCPT-${payment.id.slice(0, 8)}`,
            description: payment.notes || "Amount received from customer",
            debit: 0,
            credit: toNumber(payment.amount),
            paymentMode: payment.payment_mode || "Cash",
            referenceNumber: payment.reference_number || "",
            href: "/payments",
          });
        });

      creditNotes.forEach((note) => {
        const sourceSale = saleById.get(note.source_sale_id);

        if (!sourceSale || sourceSale.customer_id !== selectedParty.id) {
          return;
        }

        rows.push({
          key: `credit-note-${note.id}`,
          id: note.id,
          date: note.credit_note_date,
          sortOrder: 20,
          documentType: "CREDIT_NOTE",
          documentLabel: "Credit Note",
          documentNumber: note.credit_note_number || "—",
          description: `Reversal against ${sourceSale.invoice_number || "sales invoice"}`,
          debit: 0,
          credit: toNumber(note.grand_total),
          paymentMode: "Adjustment",
          referenceNumber: sourceSale.invoice_number || "",
          href: `/credit-notes/${note.id}`,
        });
      });
    } else {
      purchases
        .filter((purchase) => purchase.supplier_id === selectedParty.id)
        .forEach((purchase) => {
          const amount = toNumber(purchase.grand_total);
          const paymentMode = purchase.payment_mode || "Cash";

          rows.push({
            key: `bill-${purchase.id}`,
            id: purchase.id,
            date: purchase.purchase_date,
            sortOrder: 10,
            documentType: "BILL",
            documentLabel: "Purchase Bill",
            documentNumber: purchase.bill_number || "—",
            description: isCreditMode(paymentMode)
              ? "Credit purchase bill"
              : `Purchase bill paid via ${paymentMode}`,
            debit: 0,
            credit: amount,
            paymentMode,
            referenceNumber: "",
            href: `/purchase/bill/${purchase.id}`,
          });

          if (!isCreditMode(paymentMode)) {
            rows.push({
              key: `bill-settlement-${purchase.id}`,
              id: purchase.id,
              date: purchase.purchase_date,
              sortOrder: 11,
              documentType: "SETTLEMENT",
              documentLabel: "Immediate Settlement",
              documentNumber: purchase.bill_number || "—",
              description: `Bill settled at creation through ${paymentMode}`,
              debit: amount,
              credit: 0,
              paymentMode,
              referenceNumber: "",
              href: `/purchase/bill/${purchase.id}`,
            });
          }
        });

      payments
        .filter(
          (payment) =>
            payment.party_id === selectedParty.id &&
            payment.payment_type === "Supplier Payment"
        )
        .forEach((payment) => {
          rows.push({
            key: `supplier-payment-${payment.id}`,
            id: payment.id,
            date: payment.payment_date,
            sortOrder: 30,
            documentType: "PAYMENT",
            documentLabel: "Supplier Payment",
            documentNumber: payment.reference_number || `PAY-${payment.id.slice(0, 8)}`,
            description: payment.notes || "Amount paid to supplier",
            debit: toNumber(payment.amount),
            credit: 0,
            paymentMode: payment.payment_mode || "Cash",
            referenceNumber: payment.reference_number || "",
            href: "/payments",
          });
        });

      debitNotes.forEach((note) => {
        const sourcePurchase = purchaseById.get(note.source_purchase_id);

        if (!sourcePurchase || sourcePurchase.supplier_id !== selectedParty.id) {
          return;
        }

        rows.push({
          key: `debit-note-${note.id}`,
          id: note.id,
          date: note.debit_note_date,
          sortOrder: 20,
          documentType: "DEBIT_NOTE",
          documentLabel: "Debit Note",
          documentNumber: note.debit_note_number || "—",
          description: `Reversal against ${sourcePurchase.bill_number || "purchase bill"}`,
          debit: toNumber(note.grand_total),
          credit: 0,
          paymentMode: "Adjustment",
          referenceNumber: sourcePurchase.bill_number || "",
          href: `/debit-notes/${note.id}`,
        });
      });
    }

    return rows.sort((left, right) => {
      const dateComparison = left.date.localeCompare(right.date);

      if (dateComparison !== 0) {
        return dateComparison;
      }

      const orderComparison = left.sortOrder - right.sortOrder;

      if (orderComparison !== 0) {
        return orderComparison;
      }

      return left.documentNumber.localeCompare(right.documentNumber);
    });
  }, [selectedParty, sales, purchases, payments, creditNotes, debitNotes]);

  const baseOpeningBalance = useMemo(() => {
    if (!selectedParty) {
      return 0;
    }

    return selectedParty.type === "Customer"
      ? selectedParty.openingBalance
      : -selectedParty.openingBalance;
  }, [selectedParty]);

  const openingBalance = useMemo(() => {
    return roundMoney(
      statementTransactions
        .filter(
          (transaction) => appliedFromDate && transaction.date < appliedFromDate
        )
        .reduce(
          (balance, transaction) =>
            balance + transaction.debit - transaction.credit,
          baseOpeningBalance
        )
    );
  }, [statementTransactions, appliedFromDate, baseOpeningBalance]);

  const periodRows = useMemo<StatementRow[]>(() => {
    let runningBalance = openingBalance;

    return statementTransactions
      .filter((transaction) => {
        if (appliedFromDate && transaction.date < appliedFromDate) {
          return false;
        }

        if (appliedToDate && transaction.date > appliedToDate) {
          return false;
        }

        return true;
      })
      .map((transaction) => {
        runningBalance = roundMoney(
          runningBalance + transaction.debit - transaction.credit
        );

        return {
          ...transaction,
          runningBalance,
        };
      });
  }, [statementTransactions, appliedFromDate, appliedToDate, openingBalance]);

  const periodTotals = useMemo(
    () =>
      periodRows.reduce(
        (totals, row) => ({
          debit: totals.debit + row.debit,
          credit: totals.credit + row.credit,
        }),
        { debit: 0, credit: 0 }
      ),
    [periodRows]
  );

  const closingBalance = roundMoney(
    openingBalance + periodTotals.debit - periodTotals.credit
  );

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return periodRows.filter((row) => {
      const matchesDocument =
        documentFilter === "ALL" || row.documentType === documentFilter;
      const searchableText = [
        row.documentLabel,
        row.documentNumber,
        row.description,
        row.paymentMode,
        row.referenceNumber,
      ]
        .join(" ")
        .toLowerCase();
      const matchesSearch =
        !normalizedSearch || searchableText.includes(normalizedSearch);

      return matchesDocument && matchesSearch;
    });
  }, [periodRows, documentFilter, searchTerm]);

  function applyDateFilter() {
    if (fromDate && toDate && fromDate > toDate) {
      showMessage("From Date cannot be later than To Date.");
      return;
    }

    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);
  }

  function resetToCurrentFinancialYear() {
    const nextFinancialYear = getCurrentFinancialYearDates();

    setFromDate(nextFinancialYear.from);
    setToDate(nextFinancialYear.to);
    setAppliedFromDate(nextFinancialYear.from);
    setAppliedToDate(nextFinancialYear.to);
  }

  function clearTableFilters() {
    setSearchTerm("");
    setDocumentFilter("ALL");
  }

  function exportStatement() {
    if (!selectedParty) {
      showMessage("Select a party before exporting the statement.");
      return;
    }

    const rows: unknown[][] = [
      ["Company", company?.name || "VertexERP Company"],
      ["Party", selectedParty.name],
      ["Party Type", selectedParty.type],
      ["Period", `${formatDate(appliedFromDate)} to ${formatDate(appliedToDate)}`],
      ["Opening Balance", formatBalance(openingBalance)],
      [],
      [
        "Date",
        "Document Type",
        "Document Number",
        "Description",
        "Payment Mode",
        "Reference",
        "Debit",
        "Credit",
        "Running Balance",
        "Balance Side",
      ],
      ...filteredRows.map((row) => [
        row.date,
        row.documentLabel,
        row.documentNumber,
        row.description,
        row.paymentMode,
        row.referenceNumber,
        roundMoney(row.debit),
        roundMoney(row.credit),
        Math.abs(roundMoney(row.runningBalance)),
        Math.abs(row.runningBalance) < 0.01
          ? "—"
          : row.runningBalance > 0
            ? "Dr"
            : "Cr",
      ]),
      [],
      ["Period Debit", roundMoney(periodTotals.debit)],
      ["Period Credit", roundMoney(periodTotals.credit)],
      ["Closing Balance", formatBalance(closingBalance)],
    ];

    const safePartyName = selectedParty.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "party";

    downloadCsv(
      `vertexerp-${safePartyName}-statement-${appliedFromDate || "all"}-${
        appliedToDate || "all"
      }.csv`,
      rows
    );
  }

  function printStatement() {
    if (!selectedParty) {
      showMessage("Select a party before printing the statement.");
      return;
    }

    window.print();
  }

  function canOpenTransaction(row: StatementRow) {
    if (!row.href) {
      return false;
    }

    if (row.documentType === "INVOICE") {
      return canViewSales;
    }

    if (row.documentType === "BILL") {
      return canViewPurchases;
    }

    if (row.documentType === "RECEIPT" || row.documentType === "PAYMENT") {
      return canViewPayments;
    }

    if (row.documentType === "CREDIT_NOTE") {
      return canViewCreditNotes;
    }

    if (row.documentType === "DEBIT_NOTE") {
      return canViewDebitNotes;
    }

    if (row.documentType === "SETTLEMENT") {
      return row.href.startsWith("/sales/")
        ? canViewSales
        : canViewPurchases;
    }

    return false;
  }

  const contactLine = selectedParty
    ? [selectedParty.mobile, selectedParty.email].filter(Boolean).join(" · ")
    : "";
  const addressLine = selectedParty
    ? [
        selectedParty.address,
        selectedParty.state,
        selectedParty.pincode,
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <div className="min-w-0 space-y-6">
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm;
          }

          body {
            background: white !important;
          }

          body * {
            visibility: hidden !important;
          }

          #party-statement-print,
          #party-statement-print * {
            visibility: visible !important;
          }

          #party-statement-print {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            background: white !important;
          }

          .party-statement-no-print {
            display: none !important;
          }

          .party-statement-print-shadow {
            box-shadow: none !important;
          }

          .party-statement-table {
            min-width: 0 !important;
            width: 100% !important;
            font-size: 10px !important;
          }
        }
      `}</style>

      <section className="party-statement-no-print rounded-3xl border border-violet-100 bg-gradient-to-br from-slate-950 via-violet-950 to-violet-700 p-5 text-white shadow-xl sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-violet-200">
              <BookOpenCheck className="h-5 w-5" />
              <p className="text-sm font-black uppercase tracking-[0.18em]">
                Party Accounts
              </p>
            </div>

            <h1 className="mt-3 text-3xl font-black sm:text-4xl">
              Customer &amp; Supplier Statements
            </h1>

            <p className="mt-3 max-w-3xl leading-7 text-violet-100">
              Review opening balance, invoices, bills, receipts, payments,
              return notes and running balances from one statement center.
            </p>
          </div>

          <button
            type="button"
            onClick={loadStatementData}
            disabled={isLoading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-black text-violet-700 shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
          >
            <RefreshCw
              className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh Statement Data
          </button>
        </div>
      </section>

      {message && (
        <div className="party-statement-no-print rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 font-medium text-blue-700">
          {message}
        </div>
      )}

      <section className="party-statement-no-print rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:p-6">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-2 block font-bold text-slate-800">
              Party Type
            </label>
            <select
              value={partyType}
              onChange={(event) => changePartyType(event.target.value as PartyType)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
            >
              <option value="Customer">Customer</option>
              <option value="Supplier">Supplier</option>
            </select>
          </div>

          <div className="md:col-span-1 xl:col-span-2">
            <label className="mb-2 block font-bold text-slate-800">
              Select {partyType}
            </label>
            <select
              value={selectedPartyId}
              onChange={(event) => setSelectedPartyId(event.target.value)}
              disabled={isLoading || visibleParties.length === 0}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {visibleParties.length === 0 ? (
                <option value="">No {partyType.toLowerCase()} ledger found</option>
              ) : (
                visibleParties.map((party) => (
                  <option key={party.id} value={party.id}>
                    {party.name}
                    {party.gstNumber ? ` · GSTIN ${party.gstNumber}` : ""}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex items-end">
            {canViewLedgers ? (
              <Link
                href="/ledger"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-5 py-3 font-bold text-violet-700 transition hover:bg-violet-100"
              >
                <Users className="h-5 w-5" />
                Manage Ledgers
              </Link>
            ) : (
              <div className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-5 py-3 font-bold text-slate-500">
                <Users className="h-5 w-5" />
                Ledger access restricted
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="party-statement-no-print rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label className="mb-2 block font-bold text-slate-800">
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
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
              onChange={(event) => setToDate(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
            />
          </div>

          <button
            type="button"
            onClick={applyDateFilter}
            className="rounded-xl bg-violet-600 px-6 py-3 font-bold text-white transition hover:bg-violet-700"
          >
            Generate Statement
          </button>

          <button
            type="button"
            onClick={resetToCurrentFinancialYear}
            className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-bold text-slate-700 transition hover:bg-slate-50"
          >
            Current FY
          </button>
        </div>

        <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <CalendarDays className="h-4 w-4" />
          Showing {formatDate(appliedFromDate)} to {formatDate(appliedToDate)}
        </p>
      </section>

      <section className="party-statement-no-print grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Opening Balance"
          value={formatBalance(openingBalance)}
          detail="Ledger opening plus all activity before the selected period"
          icon={<BookOpenCheck className="h-5 w-5" />}
          className="border-slate-200 bg-slate-50 text-slate-700"
        />
        <MetricCard
          title="Period Debit"
          value={formatCurrency(periodTotals.debit)}
          detail={`${periodRows.filter((row) => row.debit > 0).length} debit-side entries`}
          icon={<FileText className="h-5 w-5" />}
          className="border-blue-100 bg-blue-50 text-blue-700"
        />
        <MetricCard
          title="Period Credit"
          value={formatCurrency(periodTotals.credit)}
          detail={`${periodRows.filter((row) => row.credit > 0).length} credit-side entries`}
          icon={<WalletCards className="h-5 w-5" />}
          className="border-emerald-100 bg-emerald-50 text-emerald-700"
        />
        <MetricCard
          title="Closing Balance"
          value={formatBalance(closingBalance)}
          detail={
            Math.abs(closingBalance) < 0.01
              ? "Account is balanced for this statement"
              : closingBalance > 0
                ? "Debit balance / amount receivable"
                : "Credit balance / amount payable"
          }
          icon={<BookOpenCheck className="h-5 w-5" />}
          className={
            Math.abs(closingBalance) < 0.01
              ? "border-emerald-100 bg-emerald-50 text-emerald-700"
              : "border-orange-100 bg-orange-50 text-orange-700"
          }
        />
      </section>

      <section className="party-statement-no-print rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.5fr_1fr_auto]">
          <div>
            <label className="mb-2 block font-bold text-slate-800">
              Search Statement
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Document number, description, mode or reference"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-12 pr-4 text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block font-bold text-slate-800">
              Document Type
            </label>
            <select
              value={documentFilter}
              onChange={(event) =>
                setDocumentFilter(event.target.value as DocumentFilter)
              }
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
            >
              <option value="ALL">All Transactions</option>
              {partyType === "Customer" ? (
                <>
                  <option value="INVOICE">Sales Invoices</option>
                  <option value="RECEIPT">Customer Receipts</option>
                  <option value="CREDIT_NOTE">Credit Notes</option>
                </>
              ) : (
                <>
                  <option value="BILL">Purchase Bills</option>
                  <option value="PAYMENT">Supplier Payments</option>
                  <option value="DEBIT_NOTE">Debit Notes</option>
                </>
              )}
              <option value="SETTLEMENT">Immediate Settlements</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={clearTableFilters}
              className="w-full rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-50 xl:w-auto"
            >
              Clear Filters
            </button>
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-500">
          Search and document filters change the visible rows only. Statement
          totals and running balances continue to use every transaction in the
          selected period.
        </p>
      </section>

      <section
        id="party-statement-print"
        className="party-statement-print-shadow overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl"
      >
        <div className="border-b border-slate-200 p-5 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-violet-600">
                {company?.name || "VertexERP Company"}
              </p>
              <h2 className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">
                {selectedParty?.type || partyType} Account Statement
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Statement period: {formatDate(appliedFromDate)} to{" "}
                {formatDate(appliedToDate)}
              </p>
            </div>

            <div className="party-statement-no-print flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={exportStatement}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 font-bold text-emerald-700 transition hover:bg-emerald-100"
              >
                <Download className="h-5 w-5" />
                Export CSV
              </button>
              <button
                type="button"
                onClick={printStatement}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 font-bold text-white transition hover:bg-slate-800"
              >
                <Printer className="h-5 w-5" />
                Print Statement
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Statement From
              </p>
              <p className="mt-2 text-lg font-black text-slate-900">
                {company?.name || "VertexERP Company"}
              </p>
              {company?.gst_number && (
                <p className="mt-1 text-sm text-slate-600">
                  GSTIN: {company.gst_number}
                </p>
              )}
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {[company?.address, company?.city].filter(Boolean).join(", ") ||
                  "Company address not configured"}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {[company?.phone, company?.email].filter(Boolean).join(" · ")}
              </p>
            </div>

            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-600">
                Statement For
              </p>
              <p className="mt-2 text-lg font-black text-slate-900">
                {selectedParty?.name || `Select a ${partyType}`}
              </p>
              {selectedParty?.gstNumber && (
                <p className="mt-1 text-sm text-slate-600">
                  GSTIN: {selectedParty.gstNumber}
                </p>
              )}
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {addressLine || "Party address not configured"}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {contactLine || "Contact details not configured"}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <StatementSummaryBox
              label="Opening"
              value={formatBalance(openingBalance)}
            />
            <StatementSummaryBox
              label="Debit"
              value={formatCurrency(periodTotals.debit)}
            />
            <StatementSummaryBox
              label="Credit"
              value={formatCurrency(periodTotals.credit)}
            />
            <StatementSummaryBox
              label="Closing"
              value={formatBalance(closingBalance)}
              emphasized
            />
          </div>
        </div>

        <div className="max-w-full overflow-x-auto">
          <table className="party-statement-table w-full min-w-[1250px]">
            <thead className="bg-slate-50">
              <tr>
                {[
                  "Date",
                  "Document",
                  "Number / Reference",
                  "Particulars",
                  "Mode",
                  "Debit",
                  "Credit",
                  "Running Balance",
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
              <tr className="border-b border-slate-200 bg-amber-50/60">
                <td className="px-5 py-4 text-slate-700">
                  {appliedFromDate ? formatDate(appliedFromDate) : "Beginning"}
                </td>
                <td className="px-5 py-4">
                  <span className="inline-flex rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                    Opening
                  </span>
                </td>
                <td className="px-5 py-4 font-bold text-slate-900">—</td>
                <td className="px-5 py-4 text-slate-700">
                  Balance brought forward
                </td>
                <td className="px-5 py-4 text-slate-500">—</td>
                <td className="px-5 py-4 text-right font-semibold text-slate-700">
                  {openingBalance > 0 ? formatCurrency(openingBalance) : "—"}
                </td>
                <td className="px-5 py-4 text-right font-semibold text-slate-700">
                  {openingBalance < 0 ? formatCurrency(openingBalance) : "—"}
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-right font-black text-slate-900">
                  {formatBalance(openingBalance)}
                </td>
                <td className="party-statement-no-print px-5 py-4">—</td>
              </tr>

              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-14 text-center text-slate-500">
                    Loading party statement...
                  </td>
                </tr>
              ) : !selectedParty ? (
                <tr>
                  <td colSpan={9} className="px-5 py-14 text-center text-slate-500">
                    Select a customer or supplier ledger to view its statement.
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-14 text-center text-slate-500">
                    {periodRows.length === 0
                      ? "No transactions are available for this party and period."
                      : "No statement rows match the selected filters."}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr
                    key={row.key}
                    className="border-b border-slate-100 transition hover:bg-violet-50/50"
                  >
                    <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                      {formatDate(row.date)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-xs font-bold ${getDocumentBadgeClass(
                          row.documentType
                        )}`}
                      >
                        {row.documentLabel}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-black text-slate-900">
                        {row.documentNumber}
                      </p>
                      {row.referenceNumber &&
                        row.referenceNumber !== row.documentNumber && (
                          <p className="mt-1 text-xs text-slate-500">
                            Ref: {row.referenceNumber}
                          </p>
                        )}
                    </td>
                    <td className="max-w-sm px-5 py-4 text-sm leading-6 text-slate-700">
                      {row.description}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                      {row.paymentMode || "—"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right font-bold text-blue-700">
                      {row.debit > 0 ? formatCurrency(row.debit) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right font-bold text-emerald-700">
                      {row.credit > 0 ? formatCurrency(row.credit) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right font-black text-slate-900">
                      {formatBalance(row.runningBalance)}
                    </td>
                    <td className="party-statement-no-print px-5 py-4">
                      {row.href && canOpenTransaction(row) ? (
                        <Link
                          href={row.href}
                          className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
                        >
                          View
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            <tfoot className="bg-slate-50">
              <tr>
                <td colSpan={5} className="px-5 py-5 font-black text-slate-900">
                  Statement Total
                </td>
                <td className="px-5 py-5 text-right font-black text-blue-700">
                  {formatCurrency(periodTotals.debit)}
                </td>
                <td className="px-5 py-5 text-right font-black text-emerald-700">
                  {formatCurrency(periodTotals.credit)}
                </td>
                <td className="px-5 py-5 text-right font-black text-violet-700">
                  {formatBalance(closingBalance)}
                </td>
                <td className="party-statement-no-print px-5 py-5" />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="border-t border-slate-200 p-5 text-sm leading-6 text-slate-600 sm:p-6">
          <p>
            Positive running balances are shown as Debit (Dr); negative running
            balances are shown as Credit (Cr). Non-credit invoices and bills are
            paired with an immediate settlement row so they remain visible
            without changing the outstanding balance.
          </p>
        </div>
      </section>

      <section className="party-statement-no-print rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
        <h2 className="font-black">Important statement scope</h2>
        <p className="mt-2 leading-7">
          Posted Credit Notes and Debit Notes are included as balance
          adjustments. Ledger opening balances are interpreted as receivable for
          Customers and payable for Suppliers when entered as positive values.
          Review migrated opening balances and return-note treatment before
          sharing a final statutory statement.
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
}: MetricCardProps) {
  return (
    <article className={`rounded-3xl border p-5 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-bold">{title}</p>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70">
          {icon}
        </span>
      </div>
      <p className="mt-4 break-words text-2xl font-black sm:text-3xl">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 opacity-80">{detail}</p>
    </article>
  );
}

function StatementSummaryBox({
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
      className={`rounded-2xl border p-4 ${
        emphasized
          ? "border-violet-200 bg-violet-50"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p
        className={`mt-2 font-black ${
          emphasized ? "text-violet-700" : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}