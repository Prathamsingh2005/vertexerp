"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";

type PaymentType = "Customer Receipt" | "Supplier Payment";

type Sale = {
  id: string;
  invoiceNumber: string;
  date: string;
  paymentMode: string;
  customerId: string;
  customerName: string;
  grandTotal: number;
};

type Purchase = {
  id: string;
  billNumber: string;
  date: string;
  paymentMode: string;
  supplierId: string;
  supplierName: string;
  grandTotal: number;
};

type Payment = {
  id: string;
  type: PaymentType;
  partyId: string;
  partyName: string;
  date: string;
  amount: number;
  paymentMode: string;
  referenceNumber: string;
  notes: string;
  createdAt: string;
};

type PartyOutstanding = {
  id: string;
  name: string;
  openingBalance: number;
  totalCredit: number;
  returnAdjustment: number;
  paidAmount: number;
  outstanding: number;
  billCount: number;
  latestDate: string;
};

type ProfileRow = {
  active_company_id: string | null;
};

type LedgerRow = {
  id: string;
  name: string;
  ledger_type: string;
  opening_balance: number | string | null;
};

type CreditNoteRow = {
  id: string;
  source_sale_id: string;
  grand_total: number | string | null;
  status: "POSTED" | "VOID";
};

type DebitNoteRow = {
  id: string;
  source_purchase_id: string;
  grand_total: number | string | null;
  status: "POSTED" | "VOID";
};

type SaleRow = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  payment_mode: string;
  customer_id: string | null;
  grand_total: number | string | null;
  customer: LedgerRow | LedgerRow[] | null;
};

type PurchaseRow = {
  id: string;
  bill_number: string;
  purchase_date: string;
  payment_mode: string;
  supplier_id: string | null;
  grand_total: number | string | null;
  supplier: LedgerRow | LedgerRow[] | null;
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

function toNumber(value: unknown) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function formatCurrency(amount: number) {
  return `₹${toNumber(amount).toLocaleString("en-IN")}`;
}

function isCreditPayment(paymentMode: string) {
  return String(paymentMode || "").trim().toLowerCase() === "credit";
}

function formatDate(dateValue: string) {
  if (!dateValue) {
    return "Not available";
  }

  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getJoinedLedger(
  ledger: LedgerRow | LedgerRow[] | null
): LedgerRow | null {
  return Array.isArray(ledger) ? ledger[0] || null : ledger;
}

function buildOutstanding(
  partyLedgers: LedgerRow[],
  entries: {
    partyId: string;
    partyName: string;
    date: string;
    amount: number;
  }[],
  returnAdjustments: {
    partyId: string;
    amount: number;
  }[],
  payments: Payment[],
  paymentType: PaymentType
) {
  const partyMap = new Map<string, PartyOutstanding>();

  partyLedgers.forEach((ledger) => {
    partyMap.set(ledger.id, {
      id: ledger.id,
      name: ledger.name || "Unnamed Party",
      openingBalance: toNumber(ledger.opening_balance),
      totalCredit: 0,
      returnAdjustment: 0,
      paidAmount: 0,
      outstanding: 0,
      billCount: 0,
      latestDate: "",
    });
  });

  entries.forEach((entry) => {
    const party = partyMap.get(entry.partyId);

    if (!party) {
      return;
    }

    party.totalCredit += entry.amount;
    party.billCount += 1;

    if (!party.latestDate || entry.date > party.latestDate) {
      party.latestDate = entry.date;
    }
  });

  returnAdjustments.forEach((adjustment) => {
    const party = partyMap.get(adjustment.partyId);

    if (party) {
      party.returnAdjustment += adjustment.amount;
    }
  });

  payments
    .filter((payment) => payment.type === paymentType)
    .forEach((payment) => {
      const party = partyMap.get(payment.partyId);

      if (party) {
        party.paidAmount += payment.amount;
      }
    });

  return Array.from(partyMap.values())
    .map((party) => {
      const grossDue = party.openingBalance + party.totalCredit;
      const adjustedDue = Math.max(0, grossDue - party.returnAdjustment);

      return {
        ...party,
        paidAmount: Math.min(party.paidAmount, adjustedDue),
        outstanding: Math.max(0, adjustedDue - party.paidAmount),
      };
    })
    .filter((party) => party.outstanding > 0)
    .sort((first, second) => second.outstanding - first.outstanding);
}

export default function OutstandingPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [ledgers, setLedgers] = useState<LedgerRow[]>([]);
  const [creditNotes, setCreditNotes] = useState<CreditNoteRow[]>([]);
  const [debitNotes, setDebitNotes] = useState<DebitNoteRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  const {
    access,
    can,
    error: permissionError,
    isLoading: isPermissionLoading,
  } = usePermissions();

  const canViewOutstanding = can("outstanding.view");
  const canRecordPayment = can("payments.create");
  const canViewSales = can("sales.view");
  const canViewPurchases = can("purchase.view");


  function showMessage(nextMessage: string) {
    setMessage(nextMessage);

    window.setTimeout(() => {
      setMessage("");
    }, 4000);
  }

  async function loadOutstandingData() {
    setIsLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setSales([]);
        setPurchases([]);
        setPayments([]);
        setLedgers([]);
        setCreditNotes([]);
        setDebitNotes([]);
        showMessage("Please sign in to view outstanding balances.");
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

      const activeCompanyId =
        (profile as ProfileRow | null)?.active_company_id || null;

      if (!activeCompanyId) {
        setSales([]);
        setPurchases([]);
        setPayments([]);
        setLedgers([]);
        setCreditNotes([]);
        setDebitNotes([]);
        showMessage("Select an active company from the Companies page first.");
        return;
      }

      const [
        salesResponse,
        purchasesResponse,
        paymentsResponse,
        ledgersResponse,
        creditNotesResponse,
        debitNotesResponse,
      ] = await Promise.all([
          supabase
            .from("sales")
            .select(
              `
                id,
                invoice_number,
                invoice_date,
                payment_mode,
                customer_id,
                grand_total,
                customer:ledgers!sales_customer_id_fkey(
                  id,
                  name
                )
              `
            )
            .eq("company_id", activeCompanyId)
            .order("invoice_date", { ascending: false }),
          supabase
            .from("purchases")
            .select(
              `
                id,
                bill_number,
                purchase_date,
                payment_mode,
                supplier_id,
                grand_total,
                supplier:ledgers!purchases_supplier_id_fkey(
                  id,
                  name
                )
              `
            )
            .eq("company_id", activeCompanyId)
            .order("purchase_date", { ascending: false }),
          supabase
            .from("payments")
            .select(
              "id, payment_type, party_id, payment_date, amount, payment_mode, reference_number, notes, created_at"
            )
            .eq("company_id", activeCompanyId)
            .order("created_at", { ascending: false }),
          supabase
            .from("ledgers")
            .select("id, name, ledger_type, opening_balance")
            .eq("company_id", activeCompanyId),
          supabase
            .from("credit_notes")
            .select("id, source_sale_id, grand_total, status")
            .eq("company_id", activeCompanyId)
            .eq("status", "POSTED"),
          supabase
            .from("debit_notes")
            .select("id, source_purchase_id, grand_total, status")
            .eq("company_id", activeCompanyId)
            .eq("status", "POSTED"),
        ]);

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

      const nextLedgers = (ledgersResponse.data || []) as LedgerRow[];
      const ledgerNameById = new Map(
        nextLedgers.map((ledger) => [
          ledger.id,
          ledger.name,
        ])
      );

      const nextSales = (
        (salesResponse.data || []) as unknown as SaleRow[]
      ).map((sale) => {
        const customer = getJoinedLedger(sale.customer);

        return {
          id: sale.id,
          invoiceNumber: sale.invoice_number || "",
          date: sale.invoice_date || "",
          paymentMode: sale.payment_mode || "Cash",
          customerId: sale.customer_id || customer?.id || "",
          customerName: customer?.name || "Unknown Customer",
          grandTotal: toNumber(sale.grand_total),
        };
      });

      const nextPurchases = (
        (purchasesResponse.data || []) as unknown as PurchaseRow[]
      ).map((purchase) => {
        const supplier = getJoinedLedger(purchase.supplier);

        return {
          id: purchase.id,
          billNumber: purchase.bill_number || "",
          date: purchase.purchase_date || "",
          paymentMode: purchase.payment_mode || "Cash",
          supplierId: purchase.supplier_id || supplier?.id || "",
          supplierName: supplier?.name || "Unknown Supplier",
          grandTotal: toNumber(purchase.grand_total),
        };
      });

      const nextPayments = (
        (paymentsResponse.data || []) as PaymentRow[]
      ).map((payment) => ({
        id: payment.id,
        type: payment.payment_type,
        partyId: payment.party_id,
        partyName:
          ledgerNameById.get(payment.party_id) || "Unknown Party",
        date: payment.payment_date,
        amount: toNumber(payment.amount),
        paymentMode: payment.payment_mode || "Cash",
        referenceNumber: payment.reference_number || "",
        notes: payment.notes || "",
        createdAt: payment.created_at,
      }));

      setSales(nextSales);
      setPurchases(nextPurchases);
      setPayments(nextPayments);
      setLedgers(nextLedgers);
      setCreditNotes((creditNotesResponse.data || []) as CreditNoteRow[]);
      setDebitNotes((debitNotesResponse.data || []) as DebitNoteRow[]);
    } catch (error) {
      setSales([]);
      setPurchases([]);
      setPayments([]);
      setLedgers([]);
      setCreditNotes([]);
      setDebitNotes([]);

      showMessage(
        error instanceof Error
          ? error.message
          : "Outstanding data could not be loaded from the cloud database."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (isPermissionLoading || !canViewOutstanding) {
      return;
    }

    loadOutstandingData();

    window.addEventListener(
      "vertexerp-sales-updated",
      loadOutstandingData
    );
    window.addEventListener(
      "vertexerp-purchases-updated",
      loadOutstandingData
    );
    window.addEventListener(
      "vertexerp-payments-updated",
      loadOutstandingData
    );
    window.addEventListener(
      "vertexerp-active-company-updated",
      loadOutstandingData
    );
    window.addEventListener(
      "vertexerp-gst-data-updated",
      loadOutstandingData
    );

    return () => {
      window.removeEventListener(
        "vertexerp-sales-updated",
        loadOutstandingData
      );
      window.removeEventListener(
        "vertexerp-purchases-updated",
        loadOutstandingData
      );
      window.removeEventListener(
        "vertexerp-payments-updated",
        loadOutstandingData
      );
      window.removeEventListener(
        "vertexerp-active-company-updated",
        loadOutstandingData
      );
      window.removeEventListener(
        "vertexerp-gst-data-updated",
        loadOutstandingData
      );
    };
  }, [isPermissionLoading, canViewOutstanding]);

  const creditSales = useMemo(
    () => sales.filter((sale) => isCreditPayment(sale.paymentMode)),
    [sales]
  );

  const creditPurchases = useMemo(
    () =>
      purchases.filter((purchase) => isCreditPayment(purchase.paymentMode)),
    [purchases]
  );

  const customerCreditEntries = useMemo(
    () =>
      creditSales
        .filter((sale) => Boolean(sale.customerId))
        .map((sale) => ({
          partyId: sale.customerId,
          partyName: sale.customerName,
          date: sale.date,
          amount: sale.grandTotal,
        })),
    [creditSales]
  );

  const supplierCreditEntries = useMemo(
    () =>
      creditPurchases
        .filter((purchase) => Boolean(purchase.supplierId))
        .map((purchase) => ({
          partyId: purchase.supplierId,
          partyName: purchase.supplierName,
          date: purchase.date,
          amount: purchase.grandTotal,
        })),
    [creditPurchases]
  );

  const saleById = useMemo(
    () => new Map(sales.map((sale) => [sale.id, sale] as const)),
    [sales]
  );

  const purchaseById = useMemo(
    () => new Map(purchases.map((purchase) => [purchase.id, purchase] as const)),
    [purchases]
  );

  const customerReturnAdjustments = useMemo(
    () =>
      creditNotes.flatMap((note) => {
        const sourceSale = saleById.get(note.source_sale_id);

        if (!sourceSale?.customerId) {
          return [];
        }

        return [
          {
            partyId: sourceSale.customerId,
            amount: toNumber(note.grand_total),
          },
        ];
      }),
    [creditNotes, saleById]
  );

  const supplierReturnAdjustments = useMemo(
    () =>
      debitNotes.flatMap((note) => {
        const sourcePurchase = purchaseById.get(note.source_purchase_id);

        if (!sourcePurchase?.supplierId) {
          return [];
        }

        return [
          {
            partyId: sourcePurchase.supplierId,
            amount: toNumber(note.grand_total),
          },
        ];
      }),
    [debitNotes, purchaseById]
  );

  const customerLedgers = useMemo(
    () => ledgers.filter((ledger) => ledger.ledger_type === "Customer"),
    [ledgers]
  );

  const supplierLedgers = useMemo(
    () => ledgers.filter((ledger) => ledger.ledger_type === "Supplier"),
    [ledgers]
  );

  const customerOutstanding = useMemo(
    () =>
      buildOutstanding(
        customerLedgers,
        customerCreditEntries,
        customerReturnAdjustments,
        payments,
        "Customer Receipt"
      ),
    [
      customerLedgers,
      customerCreditEntries,
      customerReturnAdjustments,
      payments,
    ]
  );

  const supplierOutstanding = useMemo(
    () =>
      buildOutstanding(
        supplierLedgers,
        supplierCreditEntries,
        supplierReturnAdjustments,
        payments,
        "Supplier Payment"
      ),
    [
      supplierLedgers,
      supplierCreditEntries,
      supplierReturnAdjustments,
      payments,
    ]
  );

  const totalReceivable = customerOutstanding.reduce(
    (total, customer) => total + customer.outstanding,
    0
  );

  const totalPayable = supplierOutstanding.reduce(
    (total, supplier) => total + supplier.outstanding,
    0
  );

  const netOutstanding = totalReceivable - totalPayable;

  if (isPermissionLoading) {
    return (
      <div className="flex min-h-screen bg-[#f3f6fb]">
        <Sidebar />
        <div className="min-w-0 flex-1 overflow-x-hidden">
          <Navbar />
          <main className="min-w-0 p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
            <div className="rounded-3xl border border-violet-100 bg-white p-10 text-center font-semibold text-slate-600 shadow-xl shadow-violet-100/50">
              Loading Outstanding permissions...
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!canViewOutstanding) {
    return (
      <div className="flex min-h-screen bg-[#f3f6fb]">
        <Sidebar />
        <div className="min-w-0 flex-1 overflow-x-hidden">
          <Navbar />
          <main className="p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
            <div className="rounded-3xl border border-red-200 bg-white p-10 text-center shadow-xl">
              <div className="text-4xl">🔒</div>
              <h1 className="mt-4 text-2xl font-black text-slate-900">
                Outstanding access is restricted
              </h1>
              <p className="mx-auto mt-2 max-w-xl text-slate-600">
                Your current role does not include the{" "}
                <strong>outstanding.view</strong> permission for the active
                company.
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f3f6fb]">
      <Sidebar />

      <div className="min-w-0 flex-1 overflow-x-hidden">
        <Navbar />

        <main className="p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
          <section className="overflow-hidden rounded-[30px] bg-gradient-to-br from-violet-950 via-violet-800 to-violet-600 p-6 text-white shadow-2xl shadow-violet-900/20 sm:p-8 lg:p-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-violet-100 backdrop-blur">
                  <span>💰</span>
                  Receivable &amp; Payable Center
                </div>

                <h1 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                  Outstanding Management
                </h1>

                <p className="mt-3 max-w-2xl text-base leading-7 text-violet-100 sm:text-lg">
                  Track pending customer receipts, supplier dues, return-note
                  adjustments and net outstanding from one place.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <div className="rounded-2xl border border-white/15 bg-slate-950/25 px-5 py-4 backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-200">
                    Active Access
                  </p>
                  <p className="mt-1 text-lg font-black">
                    {access?.roleName || "No active role"}
                  </p>
                  <p className="mt-1 text-sm text-violet-100">
                    Outstanding viewing enabled
                  </p>
                </div>

                {canRecordPayment && (
                  <Link
                    href="/payments"
                    className="inline-flex w-full items-center justify-center rounded-xl bg-white px-6 py-3 font-black text-violet-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-violet-50 sm:w-auto"
                  >
                    💳 Record Payment
                  </Link>
                )}
              </div>
            </div>
          </section>

          {permissionError && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-semibold text-red-700">
              {permissionError}
            </div>
          )}

          {message && (
            <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 text-sm font-semibold text-violet-700">
              {message}
            </div>
          )}

          <section
            className="mt-6 rounded-3xl border border-violet-200 bg-violet-50 p-5 shadow-sm sm:mt-8 sm:p-6"
          >
            <p className="font-black text-violet-900">
              Outstanding Summary
            </p>

<p className="mt-2 text-sm leading-6 text-violet-800">
              Opening balances and Credit transactions create the due amount.
              Posted Credit Notes, Debit Notes, customer receipts and supplier
              payments automatically reduce the pending balance.
            </p>
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
            <div className="rounded-3xl border border-violet-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">
                Customer Receivable
              </p>

              <h2
                className="mt-3 break-words text-3xl font-bold sm:text-4xl"
                style={{ color: "#2563eb" }}
              >
                {isLoading ? "..." : formatCurrency(totalReceivable)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Amount still to collect from customers
              </p>
            </div>

            <div className="rounded-3xl border border-violet-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">
                Supplier Payable
              </p>

              <h2
                className="mt-3 break-words text-3xl font-bold sm:text-4xl"
                style={{ color: "#7e22ce" }}
              >
                {isLoading ? "..." : formatCurrency(totalPayable)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Amount still payable to suppliers
              </p>
            </div>

            <div className="rounded-3xl border border-orange-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">
                Pending Customers
              </p>

              <h2
                className="mt-3 break-words text-3xl font-bold sm:text-4xl"
                style={{ color: "#ea580c" }}
              >
                {isLoading ? "..." : customerOutstanding.length}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Customers with pending balance
              </p>
            </div>

            <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-lg sm:p-6">
              <p className="font-medium text-slate-600">
                Net Outstanding
              </p>

              <h2
                className="mt-3 break-words text-3xl font-bold sm:text-4xl"
                style={{
                  color: netOutstanding >= 0 ? "#059669" : "#dc2626",
                }}
              >
                {isLoading
                  ? "..."
                  : formatCurrency(Math.abs(netOutstanding))}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                {netOutstanding >= 0
                  ? "More receivable than payable"
                  : "More payable than receivable"}
              </p>
            </div>
          </section>

          <section className="mt-6 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl sm:mt-8 lg:mt-10">
            <div className="flex flex-col gap-4 border-b border-violet-200 bg-gradient-to-r from-violet-950 via-violet-800 to-violet-600 px-4 py-5 text-white sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 lg:py-6">
              <div>
                <h2 className="text-2xl font-black text-white">
                  Customer Receivables
                </h2>

                <p className="mt-1 text-violet-100">
                  Opening balance + Credit sales − Credit Notes − customer receipts.
                </p>
              </div>

              <div className="rounded-full bg-violet-50 px-4 py-2 text-sm font-bold text-violet-700">
                Customers: {isLoading ? "..." : customerOutstanding.length}
              </div>
            </div>

            <div className="p-4 md:hidden">
              {isLoading ? (
                <p className="py-10 text-center text-sm text-slate-500">
                  Loading receivable data from the cloud database...
                </p>
              ) : customerOutstanding.length === 0 ? (
                <div className="py-10 text-center text-slate-500">
                  <p className="text-lg font-semibold text-slate-700">
                    No customer receivables found
                  </p>
                  <p className="mt-2 text-sm">
                    All customer credit balances are cleared, or there are no
                    Credit sales invoices yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {customerOutstanding.map((customer) => (
                    <article
                      key={customer.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-bold text-slate-900">
                            {customer.name}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            Customer Ledger
                          </p>
                        </div>

                        <span className="shrink-0 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">
                          {customer.billCount} Invoice
                          {customer.billCount !== 1 ? "s" : ""}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-white p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Latest Invoice
                          </p>
                          <p className="mt-1 font-semibold text-slate-800">
                            {formatDate(customer.latestDate)}
                          </p>
                        </div>

                        <div className="rounded-xl bg-white p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Received
                          </p>
                          <p className="mt-1 font-bold text-emerald-700">
                            {formatCurrency(customer.paidAmount)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 rounded-xl bg-violet-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                          Receivable Amount
                        </p>
                        <p className="mt-1 text-xl font-bold text-violet-700">
                          {formatCurrency(customer.outstanding)}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1050px]">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200 text-left">
                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Customer
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Credit Invoices
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Latest Invoice
                    </th>

                    <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">
                      Received Amount
                    </th>

                    <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">
                      Receivable Amount
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-12 text-center text-slate-500"
                      >
                        Loading receivable data from the cloud database...
                      </td>
                    </tr>
                  ) : customerOutstanding.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-12 text-center text-slate-500"
                      >
                        <p className="text-lg font-semibold text-slate-700">
                          No customer receivables found
                        </p>

                        <p className="mt-2">
                          All customer credit balances are cleared, or there
                          are no Credit sales invoices yet.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    customerOutstanding.map((customer) => (
                      <tr
                        key={customer.id}
                        className="border-b border-slate-100 transition hover:bg-violet-50"
                      >
                        <td className="px-6 py-5">
                          <p className="font-bold text-slate-900">
                            {customer.name}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            Customer Ledger
                          </p>
                        </td>

                        <td className="px-6 py-5">
                          <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-bold text-orange-700">
                            {customer.billCount} Invoice
                            {customer.billCount !== 1 ? "s" : ""}
                          </span>
                        </td>

                        <td className="px-6 py-5 text-slate-700">
                          {formatDate(customer.latestDate)}
                        </td>

                        <td
                          className="px-6 py-5 text-right font-bold"
                          style={{ color: "#059669" }}
                        >
                          {formatCurrency(customer.paidAmount)}
                        </td>

                        <td
                          className="px-6 py-5 text-right text-lg font-bold"
                          style={{ color: "#2563eb" }}
                        >
                          {formatCurrency(customer.outstanding)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-6 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl sm:mt-8 lg:mt-10">
            <div className="flex flex-col gap-4 border-b border-violet-200 bg-gradient-to-r from-violet-950 via-violet-800 to-violet-600 px-4 py-5 text-white sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 lg:py-6">
              <div>
                <h2 className="text-2xl font-black text-white">
                  Supplier Payables
                </h2>

                <p className="mt-1 text-violet-100">
                  Opening balance + Credit purchases − Debit Notes − supplier payments.
                </p>
              </div>

              <div className="rounded-full bg-violet-50 px-4 py-2 text-sm font-bold text-violet-700">
                Suppliers: {isLoading ? "..." : supplierOutstanding.length}
              </div>
            </div>

            <div className="p-4 md:hidden">
              {isLoading ? (
                <p className="py-10 text-center text-sm text-slate-500">
                  Loading payable data from the cloud database...
                </p>
              ) : supplierOutstanding.length === 0 ? (
                <div className="py-10 text-center text-slate-500">
                  <p className="text-lg font-semibold text-slate-700">
                    No supplier payables found
                  </p>
                  <p className="mt-2 text-sm">
                    All supplier credit balances are cleared, or there are no
                    Credit purchase bills yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {supplierOutstanding.map((supplier) => (
                    <article
                      key={supplier.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-bold text-slate-900">
                            {supplier.name}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            Supplier Ledger
                          </p>
                        </div>

                        <span className="shrink-0 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">
                          {supplier.billCount} Bill
                          {supplier.billCount !== 1 ? "s" : ""}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-white p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Latest Bill
                          </p>
                          <p className="mt-1 font-semibold text-slate-800">
                            {formatDate(supplier.latestDate)}
                          </p>
                        </div>

                        <div className="rounded-xl bg-white p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Paid
                          </p>
                          <p className="mt-1 font-bold text-emerald-700">
                            {formatCurrency(supplier.paidAmount)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 rounded-xl bg-violet-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                          Payable Amount
                        </p>
                        <p className="mt-1 text-xl font-bold text-violet-700">
                          {formatCurrency(supplier.outstanding)}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1050px]">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200 text-left">
                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Supplier
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Credit Bills
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Latest Bill
                    </th>

                    <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">
                      Paid Amount
                    </th>

                    <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">
                      Payable Amount
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-12 text-center text-slate-500"
                      >
                        Loading payable data from the cloud database...
                      </td>
                    </tr>
                  ) : supplierOutstanding.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-12 text-center text-slate-500"
                      >
                        <p className="text-lg font-semibold text-slate-700">
                          No supplier payables found
                        </p>

                        <p className="mt-2">
                          All supplier credit balances are cleared, or there
                          are no Credit purchase bills yet.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    supplierOutstanding.map((supplier) => (
                      <tr
                        key={supplier.id}
                        className="border-b border-slate-100 transition hover:bg-violet-50"
                      >
                        <td className="px-6 py-5">
                          <p className="font-bold text-slate-900">
                            {supplier.name}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            Supplier Ledger
                          </p>
                        </td>

                        <td className="px-6 py-5">
                          <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-bold text-orange-700">
                            {supplier.billCount} Bill
                            {supplier.billCount !== 1 ? "s" : ""}
                          </span>
                        </td>

                        <td className="px-6 py-5 text-slate-700">
                          {formatDate(supplier.latestDate)}
                        </td>

                        <td
                          className="px-6 py-5 text-right font-bold"
                          style={{ color: "#059669" }}
                        >
                          {formatCurrency(supplier.paidAmount)}
                        </td>

                        <td
                          className="px-6 py-5 text-right text-lg font-bold"
                          style={{ color: "#7e22ce" }}
                        >
                          {formatCurrency(supplier.outstanding)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-6 grid grid-cols-1 gap-4 sm:mt-8 sm:gap-6 xl:mt-10 xl:grid-cols-2">
            <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl">
              <div className="border-b border-slate-200 px-4 py-5 sm:px-6">
                <h2 className="text-xl font-bold text-slate-900">
                  Recent Credit Sales
                </h2>
              </div>

              <div className="divide-y divide-slate-100">
                {creditSales.slice(0, 5).map((sale) => (
                  <div
                    key={sale.id}
                    className="flex items-center justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-6"
                  >
                    <div className="min-w-0">
                      {canViewSales ? (
                        <Link
                          href={`/sales/invoice/${sale.id}`}
                          className="font-bold text-violet-700 transition hover:text-violet-900 hover:underline"
                        >
                          {sale.invoiceNumber}
                        </Link>
                      ) : (
                        <p className="font-bold text-slate-900">
                          {sale.invoiceNumber}
                        </p>
                      )}

                      <p className="mt-1 truncate text-sm text-slate-500">
                        {sale.customerName} · {formatDate(sale.date)}
                      </p>
                    </div>

                    <p
                      className="shrink-0 font-bold"
                      style={{ color: "#2563eb" }}
                    >
                      {formatCurrency(sale.grandTotal)}
                    </p>
                  </div>
                ))}

                {!isLoading && creditSales.length === 0 && (
                  <p className="px-6 py-10 text-center text-slate-500">
                    No credit sales invoices yet.
                  </p>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl">
              <div className="border-b border-slate-200 px-4 py-5 sm:px-6">
                <h2 className="text-xl font-bold text-slate-900">
                  Recent Credit Purchases
                </h2>
              </div>

              <div className="divide-y divide-slate-100">
                {creditPurchases.slice(0, 5).map((purchase) => (
                  <div
                    key={purchase.id}
                    className="flex items-center justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-6"
                  >
                    <div className="min-w-0">
                      {canViewPurchases ? (
                        <Link
                          href={`/purchase/bill/${purchase.id}`}
                          className="font-bold text-violet-700 transition hover:text-violet-900 hover:underline"
                        >
                          {purchase.billNumber}
                        </Link>
                      ) : (
                        <p className="font-bold text-slate-900">
                          {purchase.billNumber}
                        </p>
                      )}

                      <p className="mt-1 truncate text-sm text-slate-500">
                        {purchase.supplierName} · {formatDate(purchase.date)}
                      </p>
                    </div>

                    <p
                      className="shrink-0 font-bold"
                      style={{ color: "#7e22ce" }}
                    >
                      {formatCurrency(purchase.grandTotal)}
                    </p>
                  </div>
                ))}

                {!isLoading && creditPurchases.length === 0 && (
                  <p className="px-6 py-10 text-center text-slate-500">
                    No credit purchase bills yet.
                  </p>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}