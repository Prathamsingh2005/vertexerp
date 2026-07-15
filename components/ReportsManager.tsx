"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PaymentType = "Customer Receipt" | "Supplier Payment";

type ProductRow = {
  id: string;
  quantity: number | string | null;
  purchase_price: number | string | null;
  low_stock_alert: number | string | null;
};

type SaleRow = {
  id: string;
  invoice_date: string;
  payment_mode: string;
  customer_id: string | null;
  grand_total: number | string | null;
};

type PurchaseRow = {
  id: string;
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
};

type LedgerRow = {
  id: string;
  ledger_type: string;
  opening_balance: number | string | null;
};

type CreditNoteRow = {
  id: string;
  source_sale_id: string;
  credit_note_date: string;
  grand_total: number | string | null;
  status: "POSTED" | "VOID";
};

type DebitNoteRow = {
  id: string;
  source_purchase_id: string;
  debit_note_date: string;
  grand_total: number | string | null;
  status: "POSTED" | "VOID";
};

type ProfileRow = {
  active_company_id: string | null;
};

type TrialBalanceRow = {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  normal_balance: "Debit" | "Credit";
  total_debit: number | string | null;
  total_credit: number | string | null;
  closing_debit: number | string | null;
  closing_credit: number | string | null;
};

type ProfitLossSummaryRow = {
  total_income: number | string | null;
  total_expense: number | string | null;
  net_profit: number | string | null;
};

type ProfitLossAccountRow = {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: "Income" | "Expense";
  amount: number | string | null;
};

type GeneralLedgerRow = {
  voucher_date: string;
  voucher_number: string;
  voucher_type: string;
  narration: string | null;
  line_description: string | null;
  debit: number | string | null;
  credit: number | string | null;
  running_balance: number | string | null;
  balance_side: string;
};

type ReportData = {
  totalSales: number;
  totalPurchase: number;
  customerReceivable: number;
  supplierPayable: number;
  stockValue: number;
  lowStockCount: number;
};

type ProfitLossSummary = {
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
};

const initialReportData: ReportData = {
  totalSales: 0,
  totalPurchase: 0,
  customerReceivable: 0,
  supplierPayable: 0,
  stockValue: 0,
  lowStockCount: 0,
};

const initialProfitLossSummary: ProfitLossSummary = {
  totalIncome: 0,
  totalExpense: 0,
  netProfit: 0,
};

function toNumber(value: unknown) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
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

function isDateInRange(dateValue: string, fromDate: string, toDate: string) {
  if (!dateValue) {
    return false;
  }

  if (fromDate && dateValue < fromDate) {
    return false;
  }

  if (toDate && dateValue > toDate) {
    return false;
  }

  return true;
}

function isCreditPayment(paymentMode: string) {
  return (
    String(paymentMode || "")
      .trim()
      .toLowerCase() === "credit"
  );
}

function calculateOutstanding(
  partyLedgers: LedgerRow[],
  entries: {
    partyId: string | null;
    amount: number;
  }[],
  returnAdjustments: {
    partyId: string | null;
    amount: number;
  }[],
  payments: PaymentRow[],
  paymentType: PaymentType,
) {
  const expectedLedgerType =
    paymentType === "Customer Receipt" ? "Customer" : "Supplier";
  const balanceByParty = new Map<string, number>();

  partyLedgers
    .filter((ledger) => ledger.ledger_type === expectedLedgerType)
    .forEach((ledger) => {
      balanceByParty.set(ledger.id, toNumber(ledger.opening_balance));
    });

  entries.forEach((entry) => {
    if (!entry.partyId || !balanceByParty.has(entry.partyId)) {
      return;
    }

    balanceByParty.set(
      entry.partyId,
      (balanceByParty.get(entry.partyId) || 0) + entry.amount,
    );
  });

  returnAdjustments.forEach((adjustment) => {
    if (!adjustment.partyId || !balanceByParty.has(adjustment.partyId)) {
      return;
    }

    balanceByParty.set(
      adjustment.partyId,
      (balanceByParty.get(adjustment.partyId) || 0) - adjustment.amount,
    );
  });

  payments
    .filter((payment) => payment.payment_type === paymentType)
    .forEach((payment) => {
      if (!balanceByParty.has(payment.party_id)) {
        return;
      }

      balanceByParty.set(
        payment.party_id,
        (balanceByParty.get(payment.party_id) || 0) - toNumber(payment.amount),
      );
    });

  return Array.from(balanceByParty.values()).reduce(
    (total, balance) => total + Math.max(0, balance),
    0,
  );
}

function getBalanceLabel(debit: number, credit: number) {
  if (debit > 0) {
    return `${formatCurrency(debit)} Dr`;
  }

  if (credit > 0) {
    return `${formatCurrency(credit)} Cr`;
  }

  return "—";
}

export default function ReportsManager() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [partyLedgers, setPartyLedgers] = useState<LedgerRow[]>([]);
  const [creditNotes, setCreditNotes] = useState<CreditNoteRow[]>([]);
  const [debitNotes, setDebitNotes] = useState<DebitNoteRow[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);

  const [trialBalance, setTrialBalance] = useState<TrialBalanceRow[]>([]);
  const [profitLossAccounts, setProfitLossAccounts] = useState<
    ProfitLossAccountRow[]
  >([]);
  const [profitLossSummary, setProfitLossSummary] = useState<ProfitLossSummary>(
    initialProfitLossSummary,
  );
  const [generalLedger, setGeneralLedger] = useState<GeneralLedgerRow[]>([]);
  const [selectedLedgerAccountId, setSelectedLedgerAccountId] = useState("");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedFromDate, setAppliedFromDate] = useState("");
  const [appliedToDate, setAppliedToDate] = useState("");

  const [message, setMessage] = useState("");
  const [accountingError, setAccountingError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAccountingLoading, setIsAccountingLoading] = useState(true);
  const [isLedgerLoading, setIsLedgerLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);

    window.setTimeout(() => {
      setMessage("");
    }, 3500);
  }

  async function loadCloudData() {
    setIsLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setProducts([]);
        setSales([]);
        setPurchases([]);
        setPayments([]);
        setPartyLedgers([]);
        setCreditNotes([]);
        setDebitNotes([]);
        setActiveCompanyId(null);
        showMessage("Please sign in to view report data.");
        return;
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
        setProducts([]);
        setSales([]);
        setPurchases([]);
        setPayments([]);
        setPartyLedgers([]);
        setCreditNotes([]);
        setDebitNotes([]);
        showMessage("Select an active company from the Companies page first.");
        return;
      }

      const [
        productsResponse,
        salesResponse,
        purchasesResponse,
        paymentsResponse,
        ledgersResponse,
        creditNotesResponse,
        debitNotesResponse,
      ] = await Promise.all([
        supabase
          .from("products")
          .select("id, quantity, purchase_price, low_stock_alert")
          .eq("company_id", companyId),
        supabase
          .from("sales")
          .select("id, invoice_date, payment_mode, customer_id, grand_total")
          .eq("company_id", companyId),
        supabase
          .from("purchases")
          .select("id, purchase_date, payment_mode, supplier_id, grand_total")
          .eq("company_id", companyId),
        supabase
          .from("payments")
          .select("id, payment_type, party_id, payment_date, amount")
          .eq("company_id", companyId),
        supabase
          .from("ledgers")
          .select("id, ledger_type, opening_balance")
          .eq("company_id", companyId)
          .in("ledger_type", ["Customer", "Supplier"]),
        supabase
          .from("credit_notes")
          .select("id, source_sale_id, credit_note_date, grand_total, status")
          .eq("company_id", companyId)
          .eq("status", "POSTED"),
        supabase
          .from("debit_notes")
          .select(
            "id, source_purchase_id, debit_note_date, grand_total, status",
          )
          .eq("company_id", companyId)
          .eq("status", "POSTED"),
      ]);

      if (productsResponse.error) {
        throw productsResponse.error;
      }

      if (salesResponse.error) {
        throw salesResponse.error;
      }

      if (purchasesResponse.error) {
        throw purchasesResponse.error;
      }

      if (paymentsResponse.error) {
        throw paymentsResponse.error;
      }

      if (ledgersResponse.error) {
        throw ledgersResponse.error;
      }

      if (creditNotesResponse.error) {
        throw creditNotesResponse.error;
      }

      if (debitNotesResponse.error) {
        throw debitNotesResponse.error;
      }

      setProducts((productsResponse.data || []) as ProductRow[]);
      setSales((salesResponse.data || []) as SaleRow[]);
      setPurchases((purchasesResponse.data || []) as PurchaseRow[]);
      setPayments((paymentsResponse.data || []) as PaymentRow[]);
      setPartyLedgers((ledgersResponse.data || []) as LedgerRow[]);
      setCreditNotes((creditNotesResponse.data || []) as CreditNoteRow[]);
      setDebitNotes((debitNotesResponse.data || []) as DebitNoteRow[]);
    } catch (error) {
      setProducts([]);
      setSales([]);
      setPurchases([]);
      setPayments([]);
      setPartyLedgers([]);
      setCreditNotes([]);
      setDebitNotes([]);
      setActiveCompanyId(null);

      showMessage(
        error instanceof Error
          ? error.message
          : "Report data could not be loaded from the cloud database.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function loadAccountingReports(
    companyId: string,
    reportFromDate: string,
    reportToDate: string,
  ) {
    setIsAccountingLoading(true);
    setAccountingError("");

    try {
      const supabase = createClient();
      const filters = {
        p_company_id: companyId,
        p_from_date: reportFromDate || null,
        p_to_date: reportToDate || null,
      };

      const [trialBalanceResponse, summaryResponse, accountsResponse] =
        await Promise.all([
          supabase.rpc("get_trial_balance", filters),
          supabase.rpc("get_profit_loss_summary", filters),
          supabase.rpc("get_profit_loss_accounts", filters),
        ]);

      if (trialBalanceResponse.error) {
        throw trialBalanceResponse.error;
      }

      if (summaryResponse.error) {
        throw summaryResponse.error;
      }

      if (accountsResponse.error) {
        throw accountsResponse.error;
      }

      const nextTrialBalance = (trialBalanceResponse.data ||
        []) as TrialBalanceRow[];
      const nextSummary = (summaryResponse.data ||
        []) as ProfitLossSummaryRow[];
      const nextProfitLossAccounts = (accountsResponse.data ||
        []) as ProfitLossAccountRow[];

      setTrialBalance(nextTrialBalance);
      setProfitLossAccounts(nextProfitLossAccounts);

      const summary = nextSummary[0];

      setProfitLossSummary({
        totalIncome: toNumber(summary?.total_income),
        totalExpense: toNumber(summary?.total_expense),
        netProfit: toNumber(summary?.net_profit),
      });

      setSelectedLedgerAccountId((currentAccountId) => {
        if (
          currentAccountId &&
          nextTrialBalance.some(
            (account) => account.account_id === currentAccountId,
          )
        ) {
          return currentAccountId;
        }

        return nextTrialBalance[0]?.account_id || "";
      });
    } catch (error) {
      setTrialBalance([]);
      setProfitLossAccounts([]);
      setProfitLossSummary(initialProfitLossSummary);
      setGeneralLedger([]);
      setSelectedLedgerAccountId("");

      setAccountingError(
        error instanceof Error
          ? error.message
          : "Accounting reports could not be loaded.",
      );
    } finally {
      setIsAccountingLoading(false);
    }
  }

  async function loadGeneralLedger(
    companyId: string,
    accountId: string,
    reportFromDate: string,
    reportToDate: string,
  ) {
    if (!accountId) {
      setGeneralLedger([]);
      return;
    }

    setIsLedgerLoading(true);

    try {
      const supabase = createClient();

      const { data, error } = await supabase.rpc("get_general_ledger", {
        p_company_id: companyId,
        p_account_id: accountId,
        p_from_date: reportFromDate || null,
        p_to_date: reportToDate || null,
      });

      if (error) {
        throw error;
      }

      setGeneralLedger((data || []) as GeneralLedgerRow[]);
    } catch (error) {
      setGeneralLedger([]);
      setAccountingError(
        error instanceof Error
          ? error.message
          : "General ledger could not be loaded.",
      );
    } finally {
      setIsLedgerLoading(false);
    }
  }

  useEffect(() => {
    loadCloudData();

    const refreshEvents = [
      "vertexerp-products-updated",
      "vertexerp-sales-updated",
      "vertexerp-purchases-updated",
      "vertexerp-payments-updated",
      "vertexerp-gst-data-updated",
      "vertexerp-expenses-updated",
      "vertexerp-active-company-updated",
    ];

    function handleRefresh() {
      loadCloudData();
      setRefreshKey((currentValue) => currentValue + 1);
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

  useEffect(() => {
    if (!activeCompanyId) {
      setTrialBalance([]);
      setProfitLossAccounts([]);
      setProfitLossSummary(initialProfitLossSummary);
      setGeneralLedger([]);
      setSelectedLedgerAccountId("");
      setIsAccountingLoading(false);
      return;
    }

    loadAccountingReports(activeCompanyId, appliedFromDate, appliedToDate);
  }, [activeCompanyId, appliedFromDate, appliedToDate, refreshKey]);

  useEffect(() => {
    if (!activeCompanyId || !selectedLedgerAccountId) {
      setGeneralLedger([]);
      return;
    }

    loadGeneralLedger(
      activeCompanyId,
      selectedLedgerAccountId,
      appliedFromDate,
      appliedToDate,
    );
  }, [
    activeCompanyId,
    selectedLedgerAccountId,
    appliedFromDate,
    appliedToDate,
    refreshKey,
  ]);

  const reportData = useMemo<ReportData>(() => {
    const filteredSales = sales.filter((sale) =>
      isDateInRange(sale.invoice_date, appliedFromDate, appliedToDate),
    );

    const filteredPurchases = purchases.filter((purchase) =>
      isDateInRange(purchase.purchase_date, appliedFromDate, appliedToDate),
    );

    const totalSales = filteredSales.reduce(
      (total, sale) => total + toNumber(sale.grand_total),
      0,
    );

    const totalPurchase = filteredPurchases.reduce(
      (total, purchase) => total + toNumber(purchase.grand_total),
      0,
    );

    // Receivable/payable cards are closing balances as of To Date.
    // From Date only controls period sales and purchase totals.
    const balanceSales = sales.filter(
      (sale) => !appliedToDate || sale.invoice_date <= appliedToDate,
    );
    const balancePurchases = purchases.filter(
      (purchase) => !appliedToDate || purchase.purchase_date <= appliedToDate,
    );
    const balancePayments = payments.filter(
      (payment) => !appliedToDate || payment.payment_date <= appliedToDate,
    );
    const balanceCreditNotes = creditNotes.filter(
      (note) =>
        note.status === "POSTED" &&
        (!appliedToDate || note.credit_note_date <= appliedToDate),
    );
    const balanceDebitNotes = debitNotes.filter(
      (note) =>
        note.status === "POSTED" &&
        (!appliedToDate || note.debit_note_date <= appliedToDate),
    );

    const customerCreditSales = balanceSales
      .filter((sale) => isCreditPayment(sale.payment_mode))
      .map((sale) => ({
        partyId: sale.customer_id,
        amount: toNumber(sale.grand_total),
      }));

    const supplierCreditPurchases = balancePurchases
      .filter((purchase) => isCreditPayment(purchase.payment_mode))
      .map((purchase) => ({
        partyId: purchase.supplier_id,
        amount: toNumber(purchase.grand_total),
      }));

    const saleById = new Map(
      balanceSales.map((sale) => [sale.id, sale] as const),
    );
    const purchaseById = new Map(
      balancePurchases.map((purchase) => [purchase.id, purchase] as const),
    );

    const customerReturnAdjustments = balanceCreditNotes.map((note) => ({
      partyId: saleById.get(note.source_sale_id)?.customer_id || null,
      amount: toNumber(note.grand_total),
    }));

    const supplierReturnAdjustments = balanceDebitNotes.map((note) => ({
      partyId: purchaseById.get(note.source_purchase_id)?.supplier_id || null,
      amount: toNumber(note.grand_total),
    }));

    const customerReceivable = calculateOutstanding(
      partyLedgers,
      customerCreditSales,
      customerReturnAdjustments,
      balancePayments,
      "Customer Receipt",
    );

    const supplierPayable = calculateOutstanding(
      partyLedgers,
      supplierCreditPurchases,
      supplierReturnAdjustments,
      balancePayments,
      "Supplier Payment",
    );

    const stockValue = products.reduce(
      (total, product) =>
        total + toNumber(product.quantity) * toNumber(product.purchase_price),
      0,
    );

    const lowStockCount = products.filter(
      (product) =>
        toNumber(product.quantity) <= toNumber(product.low_stock_alert),
    ).length;

    return {
      totalSales,
      totalPurchase,
      customerReceivable,
      supplierPayable,
      stockValue,
      lowStockCount,
    };
  }, [
    products,
    sales,
    purchases,
    payments,
    partyLedgers,
    creditNotes,
    debitNotes,
    appliedFromDate,
    appliedToDate,
  ]);

  const trialBalanceTotals = useMemo(() => {
    return trialBalance.reduce(
      (totals, account) => ({
        debit: totals.debit + toNumber(account.total_debit),
        credit: totals.credit + toNumber(account.total_credit),
      }),
      { debit: 0, credit: 0 },
    );
  }, [trialBalance]);

  const incomeAccounts = useMemo(
    () =>
      profitLossAccounts.filter((account) => account.account_type === "Income"),
    [profitLossAccounts],
  );

  const expenseAccounts = useMemo(
    () =>
      profitLossAccounts.filter(
        (account) => account.account_type === "Expense",
      ),
    [profitLossAccounts],
  );

  const selectedLedgerAccount = useMemo(
    () =>
      trialBalance.find(
        (account) => account.account_id === selectedLedgerAccountId,
      ) || null,
    [trialBalance, selectedLedgerAccountId],
  );

  function handleGenerateReport() {
    if (fromDate && toDate && fromDate > toDate) {
      showMessage("From Date cannot be later than To Date.");
      return;
    }

    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);
    showMessage("Reports generated using the selected date range.");
  }

  function resetFilter() {
    setFromDate("");
    setToDate("");
    setAppliedFromDate("");
    setAppliedToDate("");
    showMessage("Filters cleared. Showing all available report data.");
  }

  function getPeriodText() {
    if (appliedFromDate && appliedToDate) {
      return `${formatDate(appliedFromDate)} to ${formatDate(appliedToDate)}`;
    }

    if (appliedFromDate) {
      return `From ${formatDate(appliedFromDate)}`;
    }

    if (appliedToDate) {
      return `Until ${formatDate(appliedToDate)}`;
    }

    return "All available data";
  }

  const dataStatus =
    isLoading || isAccountingLoading ? "Loading..." : getPeriodText();

  return (
    <div className="min-w-0 space-y-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
        <article className="rounded-3xl border border-violet-100 bg-white p-5 shadow-xl shadow-violet-100/40 sm:p-6">
          <p className="font-medium text-slate-600">Sales Revenue</p>
          <h2 className="mt-3 break-words text-3xl font-bold text-violet-600 sm:text-4xl">
            {isLoading ? "..." : formatCurrency(reportData.totalSales)}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Sales within the selected date range
          </p>
        </article>

        <article className="rounded-3xl border border-violet-100 bg-white p-5 shadow-xl shadow-violet-100/40 sm:p-6">
          <p className="font-medium text-slate-600">Purchase Value</p>
          <h2 className="mt-3 break-words text-3xl font-bold text-purple-600 sm:text-4xl">
            {isLoading ? "..." : formatCurrency(reportData.totalPurchase)}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Purchases within the selected date range
          </p>
        </article>

        <article className="rounded-3xl border border-violet-100 bg-white p-5 shadow-xl shadow-violet-100/40 sm:p-6">
          <p className="font-medium text-slate-600">Customer Receivable</p>
          <h2 className="mt-3 break-words text-3xl font-bold text-orange-500 sm:text-4xl">
            {isLoading ? "..." : formatCurrency(reportData.customerReceivable)}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Opening + credit sales − posted Credit Notes − receipts, as of To
            Date
          </p>
        </article>

        <article className="rounded-3xl border border-violet-100 bg-white p-5 shadow-xl shadow-violet-100/40 sm:p-6">
          <p className="font-medium text-slate-600">Stock Value</p>
          <h2 className="mt-3 break-words text-3xl font-bold text-green-600 sm:text-4xl">
            {isLoading ? "..." : formatCurrency(reportData.stockValue)}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {isLoading
              ? "Loading inventory..."
              : `${reportData.lowStockCount} low-stock product${
                  reportData.lowStockCount !== 1 ? "s" : ""
                }`}
          </p>
        </article>
      </section>

      <section className="mt-5 grid grid-cols-1 gap-4 sm:mt-6 sm:grid-cols-2 sm:gap-6">
        <article className="rounded-3xl border border-orange-100 bg-orange-50 p-5 sm:p-6">
          <p className="font-semibold text-orange-800">Supplier Payable</p>
          <p className="mt-2 break-words text-3xl font-bold text-orange-600">
            {isLoading ? "..." : formatCurrency(reportData.supplierPayable)}
          </p>
          <p className="mt-2 text-sm text-orange-700">
            Opening + credit purchases − posted Debit Notes − payments, as of To
            Date
          </p>
        </article>

        <article className="rounded-3xl border border-violet-100 bg-violet-50 p-5 sm:p-6">
          <p className="font-semibold text-violet-800">Inventory Alert</p>
          <p className="mt-2 text-3xl font-bold text-violet-600">
            {isLoading ? "..." : reportData.lowStockCount}
          </p>
          <p className="mt-2 text-sm text-violet-700">
            Products currently at or below their low-stock alert level
          </p>
        </article>
      </section>

      <section className="mt-6 rounded-3xl border border-violet-100 bg-white p-4 shadow-xl shadow-violet-100/40 sm:mt-8 sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Report Date Filter
            </h2>
            <p className="mt-1 text-sm text-slate-600 sm:text-base">
              The same date range applies to business and accounting reports.
            </p>
          </div>

          <span className="w-fit max-w-full break-words rounded-full bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700">
            {dataStatus}
          </span>
        </div>

        {message && (
          <div className="mb-5 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-medium text-violet-700 sm:text-base">
            {message}
          </div>
        )}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label className="mb-2 block font-semibold text-slate-800">
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
            <label className="mb-2 block font-semibold text-slate-800">
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
            onClick={handleGenerateReport}
            disabled={isLoading || isAccountingLoading}
            className="w-full rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white shadow-lg transition hover:bg-violet-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto lg:px-7"
          >
            Generate Report
          </button>

          <button
            type="button"
            onClick={resetFilter}
            disabled={isLoading || isAccountingLoading}
            className="w-full rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto lg:px-7"
          >
            Reset Filter
          </button>
        </div>
      </section>

      <section className="mt-6 min-w-0 overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-xl shadow-violet-100/40 sm:mt-8">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Accounting Reports
            </h2>
            <p className="mt-1 text-sm text-slate-600 sm:text-base">
              Trial Balance, Profit &amp; Loss, and General Ledger from posted
              double-entry vouchers.
            </p>
          </div>

          <span className="w-fit rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
            Posted Vouchers Only
          </span>
        </div>

        <div className="border-b border-amber-100 bg-amber-50 px-4 py-4 text-sm text-amber-800 sm:px-6">
          Accounting reports exclude VOID vouchers. They reflect transactions
          posted after accounting was enabled; historic transactions have not
          been backfilled yet.
        </div>

        {accountingError && (
          <div className="mx-4 mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 sm:mx-6">
            {accountingError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3 sm:gap-6 sm:p-6">
          <article className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
            <p className="font-semibold text-emerald-800">Accounting Income</p>
            <p className="mt-2 break-words text-3xl font-bold text-emerald-600">
              {isAccountingLoading
                ? "..."
                : formatCurrency(profitLossSummary.totalIncome)}
            </p>
            <p className="mt-2 text-sm text-emerald-700">
              Income from posted accounting vouchers
            </p>
          </article>

          <article className="rounded-2xl border border-rose-100 bg-rose-50 p-5">
            <p className="font-semibold text-rose-800">Accounting Expenses</p>
            <p className="mt-2 break-words text-3xl font-bold text-rose-600">
              {isAccountingLoading
                ? "..."
                : formatCurrency(profitLossSummary.totalExpense)}
            </p>
            <p className="mt-2 text-sm text-rose-700">
              Expense accounts from posted vouchers
            </p>
          </article>

          <article
            className={`rounded-2xl border p-5 ${
              profitLossSummary.netProfit >= 0
                ? "border-violet-100 bg-violet-50"
                : "border-red-100 bg-red-50"
            }`}
          >
            <p
              className={`font-semibold ${
                profitLossSummary.netProfit >= 0
                  ? "text-violet-800"
                  : "text-red-800"
              }`}
            >
              {profitLossSummary.netProfit >= 0 ? "Net Profit" : "Net Loss"}
            </p>
            <p
              className={`mt-2 break-words text-3xl font-bold ${
                profitLossSummary.netProfit >= 0
                  ? "text-violet-600"
                  : "text-red-600"
              }`}
            >
              {isAccountingLoading
                ? "..."
                : formatCurrency(Math.abs(profitLossSummary.netProfit))}
            </p>
            <p
              className={`mt-2 text-sm ${
                profitLossSummary.netProfit >= 0
                  ? "text-violet-700"
                  : "text-red-700"
              }`}
            >
              Income less accounting expenses
            </p>
          </article>
        </div>

        <div className="grid grid-cols-1 gap-5 border-t border-slate-100 p-4 sm:gap-6 sm:p-6 lg:grid-cols-2">
          <article className="overflow-hidden rounded-2xl border border-emerald-100">
            <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-4">
              <h3 className="font-bold text-emerald-900">Income Breakdown</h3>
              <p className="mt-1 text-sm text-emerald-700">
                Income accounts used in the selected period
              </p>
            </div>

            {isAccountingLoading ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                Loading income accounts...
              </p>
            ) : incomeAccounts.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                No posted income entries are available for this period.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {incomeAccounts.map((account) => (
                  <div
                    key={account.account_id}
                    className="flex items-center justify-between gap-4 px-4 py-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">
                        {account.account_name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {account.account_code} · {account.account_type}
                      </p>
                    </div>
                    <p className="shrink-0 font-bold text-emerald-600">
                      {formatCurrency(toNumber(account.amount))}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="overflow-hidden rounded-2xl border border-rose-100">
            <div className="border-b border-rose-100 bg-rose-50 px-4 py-4">
              <h3 className="font-bold text-rose-900">Expense Breakdown</h3>
              <p className="mt-1 text-sm text-rose-700">
                Expense accounts used in the selected period
              </p>
            </div>

            {isAccountingLoading ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                Loading expense accounts...
              </p>
            ) : expenseAccounts.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                No posted expense entries are available for this period.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {expenseAccounts.map((account) => (
                  <div
                    key={account.account_id}
                    className="flex items-center justify-between gap-4 px-4 py-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">
                        {account.account_name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {account.account_code} · {account.account_type}
                      </p>
                    </div>
                    <p className="shrink-0 font-bold text-rose-600">
                      {formatCurrency(toNumber(account.amount))}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>
      </section>

      <section className="mt-6 min-w-0 overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-xl shadow-violet-100/40 sm:mt-8">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Trial Balance
            </h2>
            <p className="mt-1 text-sm text-slate-600 sm:text-base">
              Debit and credit totals across all active accounting accounts.
            </p>
          </div>

          <span
            className={`w-fit rounded-full px-4 py-2 text-sm font-semibold ${
              Math.abs(trialBalanceTotals.debit - trialBalanceTotals.credit) <
              0.01
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {isAccountingLoading
              ? "Checking..."
              : Math.abs(trialBalanceTotals.debit - trialBalanceTotals.credit) <
                  0.01
                ? "Balanced"
                : "Needs Review"}
          </span>
        </div>

        <div className="p-4 md:hidden">
          {isAccountingLoading ? (
            <p className="py-10 text-center text-sm text-slate-500">
              Loading trial balance...
            </p>
          ) : trialBalance.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              No posted accounting entries are available for this period.
            </p>
          ) : (
            <div className="space-y-4">
              {trialBalance.map((account) => {
                const closingDebit = toNumber(account.closing_debit);
                const closingCredit = toNumber(account.closing_credit);

                return (
                  <article
                    key={account.account_id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-slate-900">
                          {account.account_name}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {account.account_code} · {account.account_type}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">
                        {account.normal_balance}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-white p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Total Debit
                        </p>
                        <p className="mt-1 font-bold text-slate-900">
                          {formatCurrency(toNumber(account.total_debit))}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Total Credit
                        </p>
                        <p className="mt-1 font-bold text-slate-900">
                          {formatCurrency(toNumber(account.total_credit))}
                        </p>
                      </div>
                    </div>

                    <p className="mt-4 rounded-xl bg-white px-3 py-3 text-sm font-semibold text-slate-700">
                      Closing Balance:{" "}
                      {getBalanceLabel(closingDebit, closingCredit)}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="hidden max-w-full overflow-x-auto md:block">
          <table className="w-full min-w-[960px]">
            <thead className="bg-violet-50/70">
              <tr className="border-b border-slate-200 text-left">
                <th className="px-6 py-4 text-sm font-bold text-slate-700">
                  Account
                </th>
                <th className="px-6 py-4 text-sm font-bold text-slate-700">
                  Type
                </th>
                <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">
                  Total Debit
                </th>
                <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">
                  Total Credit
                </th>
                <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">
                  Closing Debit
                </th>
                <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">
                  Closing Credit
                </th>
              </tr>
            </thead>
            <tbody>
              {isAccountingLoading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    Loading trial balance...
                  </td>
                </tr>
              ) : trialBalance.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    No posted accounting entries are available for this period.
                  </td>
                </tr>
              ) : (
                <>
                  {trialBalance.map((account) => (
                    <tr
                      key={account.account_id}
                      className="border-b border-slate-100 transition hover:bg-violet-50"
                    >
                      <td className="px-6 py-5">
                        <p className="font-bold text-slate-900">
                          {account.account_name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {account.account_code} · Normal:{" "}
                          {account.normal_balance}
                        </p>
                      </td>
                      <td className="px-6 py-5 text-slate-700">
                        {account.account_type}
                      </td>
                      <td className="px-6 py-5 text-right font-semibold text-slate-900">
                        {formatCurrency(toNumber(account.total_debit))}
                      </td>
                      <td className="px-6 py-5 text-right font-semibold text-slate-900">
                        {formatCurrency(toNumber(account.total_credit))}
                      </td>
                      <td className="px-6 py-5 text-right font-semibold text-violet-700">
                        {toNumber(account.closing_debit) > 0
                          ? formatCurrency(toNumber(account.closing_debit))
                          : "—"}
                      </td>
                      <td className="px-6 py-5 text-right font-semibold text-purple-700">
                        {toNumber(account.closing_credit) > 0
                          ? formatCurrency(toNumber(account.closing_credit))
                          : "—"}
                      </td>
                    </tr>
                  ))}

                  <tr className="bg-slate-50">
                    <td
                      colSpan={2}
                      className="px-6 py-5 font-bold text-slate-900"
                    >
                      Total
                    </td>
                    <td className="px-6 py-5 text-right font-bold text-slate-900">
                      {formatCurrency(trialBalanceTotals.debit)}
                    </td>
                    <td className="px-6 py-5 text-right font-bold text-slate-900">
                      {formatCurrency(trialBalanceTotals.credit)}
                    </td>
                    <td colSpan={2} className="px-6 py-5" />
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 min-w-0 overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-xl shadow-violet-100/40 sm:mt-8">
        <div className="border-b border-slate-200 px-4 py-5 sm:px-6 sm:py-6">
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
            General Ledger
          </h2>
          <p className="mt-1 text-sm text-slate-600 sm:text-base">
            Review every posted debit and credit entry for one accounting
            account.
          </p>

          <div className="mt-5 max-w-xl">
            <label className="mb-2 block font-semibold text-slate-800">
              Select Account
            </label>
            <select
              value={selectedLedgerAccountId}
              onChange={(event) =>
                setSelectedLedgerAccountId(event.target.value)
              }
              disabled={isAccountingLoading || trialBalance.length === 0}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {trialBalance.length === 0 ? (
                <option value="">No posted accounts available</option>
              ) : (
                trialBalance.map((account) => (
                  <option key={account.account_id} value={account.account_id}>
                    {account.account_code} — {account.account_name}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {selectedLedgerAccount && (
          <div className="border-b border-violet-100 bg-violet-50 px-4 py-4 text-sm text-violet-800 sm:px-6">
            Showing ledger for{" "}
            <strong>
              {selectedLedgerAccount.account_code} —{" "}
              {selectedLedgerAccount.account_name}
            </strong>
            .
          </div>
        )}

        <div className="p-4 md:hidden">
          {isLedgerLoading ? (
            <p className="py-10 text-center text-sm text-slate-500">
              Loading general ledger...
            </p>
          ) : !selectedLedgerAccountId ? (
            <p className="py-10 text-center text-sm text-slate-500">
              Select an account to view ledger entries.
            </p>
          ) : generalLedger.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              No posted entries are available for this account and period.
            </p>
          ) : (
            <div className="space-y-4">
              {generalLedger.map((entry, index) => (
                <article
                  key={`${entry.voucher_number}-${index}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-900">
                        {entry.voucher_number}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {formatDate(entry.voucher_date)} · {entry.voucher_type}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">
                      {entry.balance_side}
                    </span>
                  </div>

                  <p className="mt-4 text-sm text-slate-700">
                    {entry.line_description || entry.narration || "—"}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Debit
                      </p>
                      <p className="mt-1 font-bold text-slate-900">
                        {formatCurrency(toNumber(entry.debit))}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Credit
                      </p>
                      <p className="mt-1 font-bold text-slate-900">
                        {formatCurrency(toNumber(entry.credit))}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 rounded-xl bg-white px-3 py-3 text-sm font-semibold text-slate-700">
                    Running Balance:{" "}
                    {formatCurrency(toNumber(entry.running_balance))}{" "}
                    {entry.balance_side}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="hidden max-w-full overflow-x-auto md:block">
          <table className="w-full min-w-[1080px]">
            <thead className="bg-violet-50/70">
              <tr className="border-b border-slate-200 text-left">
                <th className="px-6 py-4 text-sm font-bold text-slate-700">
                  Date
                </th>
                <th className="px-6 py-4 text-sm font-bold text-slate-700">
                  Voucher
                </th>
                <th className="px-6 py-4 text-sm font-bold text-slate-700">
                  Details
                </th>
                <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">
                  Debit
                </th>
                <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">
                  Credit
                </th>
                <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">
                  Running Balance
                </th>
              </tr>
            </thead>
            <tbody>
              {isLedgerLoading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    Loading general ledger...
                  </td>
                </tr>
              ) : !selectedLedgerAccountId ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    Select an account to view ledger entries.
                  </td>
                </tr>
              ) : generalLedger.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    No posted entries are available for this account and period.
                  </td>
                </tr>
              ) : (
                generalLedger.map((entry, index) => (
                  <tr
                    key={`${entry.voucher_number}-${index}`}
                    className="border-b border-slate-100 transition hover:bg-violet-50"
                  >
                    <td className="px-6 py-5 text-slate-700">
                      {formatDate(entry.voucher_date)}
                    </td>
                    <td className="px-6 py-5">
                      <p className="font-bold text-slate-900">
                        {entry.voucher_number}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {entry.voucher_type}
                      </p>
                    </td>
                    <td className="px-6 py-5">
                      <p className="font-semibold text-slate-900">
                        {entry.line_description || "Accounting entry"}
                      </p>
                      <p className="mt-1 max-w-md text-sm text-slate-500">
                        {entry.narration || "—"}
                      </p>
                    </td>
                    <td className="px-6 py-5 text-right font-semibold text-slate-900">
                      {toNumber(entry.debit) > 0
                        ? formatCurrency(toNumber(entry.debit))
                        : "—"}
                    </td>
                    <td className="px-6 py-5 text-right font-semibold text-slate-900">
                      {toNumber(entry.credit) > 0
                        ? formatCurrency(toNumber(entry.credit))
                        : "—"}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <p className="font-bold text-violet-700">
                        {formatCurrency(toNumber(entry.running_balance))}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {entry.balance_side}
                      </p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}