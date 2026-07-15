"use client";

import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import { usePermissions } from "@/hooks/usePermissions";

type PaymentType = "Customer Receipt" | "Supplier Payment";

type SaleRow = {
  id: string;
  customer_id: string | null;
  payment_mode: string;
  grand_total: number | string | null;
};

type PurchaseRow = {
  id: string;
  supplier_id: string | null;
  payment_mode: string;
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

type PartyBalance = {
  id: string;
  name: string;
  openingBalance: number;
  totalCredit: number;
  returnAdjustment: number;
  paidAmount: number;
  outstanding: number;
};

type ProfileRow = {
  active_company_id: string | null;
};

function toNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatCurrency(amount: number) {
  return `₹${toNumber(amount).toLocaleString("en-IN")}`;
}

function isCreditPayment(paymentMode: string) {
  return String(paymentMode || "").trim().toLowerCase() === "credit";
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
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

function getBalances(
  partyLedgers: LedgerRow[],
  entries: {
    partyId: string;
    partyName: string;
    amount: number;
  }[],
  returnAdjustments: {
    partyId: string;
    amount: number;
  }[],
  paymentType: PaymentType,
  payments: Payment[]
) {
  const balanceMap = new Map<string, PartyBalance>();

  partyLedgers.forEach((ledger) => {
    balanceMap.set(ledger.id, {
      id: ledger.id,
      name: ledger.name || "Unnamed Party",
      openingBalance: toNumber(ledger.opening_balance),
      totalCredit: 0,
      returnAdjustment: 0,
      paidAmount: 0,
      outstanding: 0,
    });
  });

  entries.forEach((entry) => {
    const party = balanceMap.get(entry.partyId);

    if (!party) {
      return;
    }

    party.totalCredit += entry.amount;
  });

  returnAdjustments.forEach((adjustment) => {
    const party = balanceMap.get(adjustment.partyId);

    if (!party) {
      return;
    }

    party.returnAdjustment += adjustment.amount;
  });

  payments
    .filter((payment) => payment.type === paymentType)
    .forEach((payment) => {
      const party = balanceMap.get(payment.partyId);

      if (party) {
        party.paidAmount += toNumber(payment.amount);
      }
    });

  return Array.from(balanceMap.values())
    .map((party) => {
      const grossDue = party.openingBalance + party.totalCredit;
      const adjustedDue = Math.max(0, grossDue - party.returnAdjustment);

      return {
        ...party,
        paidAmount: Math.min(party.paidAmount, adjustedDue),
        outstanding: Math.max(0, adjustedDue - party.paidAmount),
      };
    })
    .sort((first, second) => second.outstanding - first.outstanding);
}

export default function PaymentsPage() {
  const {
    access,
    can,
    error: permissionError,
    isLoading: isPermissionLoading,
  } = usePermissions();

  const canViewPayments = can("payments.view");
  const canCreatePayment = can("payments.create");
  const canEditPayment = can("payments.edit");
  const canDeletePayment = can("payments.delete");
  const hasWriteAccess =
    canCreatePayment || canEditPayment || canDeletePayment;

  const [sales, setSales] = useState<SaleRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [ledgers, setLedgers] = useState<LedgerRow[]>([]);
  const [creditNotes, setCreditNotes] = useState<CreditNoteRow[]>([]);
  const [debitNotes, setDebitNotes] = useState<DebitNoteRow[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [isDeletingPayment, setIsDeletingPayment] = useState(false);
  const [paymentPendingDeletion, setPaymentPendingDeletion] =
    useState<Payment | null>(null);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    type: "Customer Receipt" as PaymentType,
    partyId: "",
    date: getToday(),
    amount: "",
    paymentMode: "Cash",
    referenceNumber: "",
    notes: "",
  });

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);

    window.setTimeout(() => {
      setMessage("");
    }, 4000);
  }

  async function loadData() {
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
        setActiveCompanyId(null);
        showMessage("Please sign in before recording payments.");
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
          .select("id, customer_id, payment_mode, grand_total")
          .eq("company_id", companyId),
        supabase
          .from("purchases")
          .select("id, supplier_id, payment_mode, grand_total")
          .eq("company_id", companyId),
        supabase
          .from("payments")
          .select(
            "id, payment_type, party_id, payment_date, amount, payment_mode, reference_number, notes, created_at"
          )
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),
        supabase
          .from("ledgers")
          .select("id, name, ledger_type, opening_balance")
          .eq("company_id", companyId),
        supabase
          .from("credit_notes")
          .select("id, source_sale_id, grand_total, status")
          .eq("company_id", companyId)
          .eq("status", "POSTED"),
        supabase
          .from("debit_notes")
          .select("id, source_purchase_id, grand_total, status")
          .eq("company_id", companyId)
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
        nextLedgers.map((ledger) => [ledger.id, ledger.name])
      );

      setSales((salesResponse.data || []) as SaleRow[]);
      setPurchases((purchasesResponse.data || []) as PurchaseRow[]);
      setLedgers(nextLedgers);
      setCreditNotes((creditNotesResponse.data || []) as CreditNoteRow[]);
      setDebitNotes((debitNotesResponse.data || []) as DebitNoteRow[]);
      setPayments(
        ((paymentsResponse.data || []) as PaymentRow[]).map((payment) => ({
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
        }))
      );
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
          : "Payment data could not be loaded from the cloud database."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();

    window.addEventListener(
      "vertexerp-sales-updated",
      loadData
    );
    window.addEventListener(
      "vertexerp-purchases-updated",
      loadData
    );
    window.addEventListener(
      "vertexerp-payments-updated",
      loadData
    );
    window.addEventListener(
      "vertexerp-active-company-updated",
      loadData
    );
    window.addEventListener(
      "vertexerp-gst-data-updated",
      loadData
    );

    return () => {
      window.removeEventListener(
        "vertexerp-sales-updated",
        loadData
      );
      window.removeEventListener(
        "vertexerp-purchases-updated",
        loadData
      );
      window.removeEventListener(
        "vertexerp-payments-updated",
        loadData
      );
      window.removeEventListener(
        "vertexerp-active-company-updated",
        loadData
      );
      window.removeEventListener(
        "vertexerp-gst-data-updated",
        loadData
      );
    };
  }, []);

  const ledgerNameById = useMemo(() => {
    return new Map(ledgers.map((ledger) => [ledger.id, ledger.name]));
  }, [ledgers]);

  const customerCreditEntries = useMemo(() => {
    return sales
      .filter((sale) => isCreditPayment(sale.payment_mode))
      .filter((sale) => Boolean(sale.customer_id))
      .map((sale) => ({
        partyId: sale.customer_id as string,
        partyName:
          ledgerNameById.get(sale.customer_id as string) ||
          "Unknown Customer",
        amount: toNumber(sale.grand_total),
      }));
  }, [sales, ledgerNameById]);

  const supplierCreditEntries = useMemo(() => {
    return purchases
      .filter((purchase) => isCreditPayment(purchase.payment_mode))
      .filter((purchase) => Boolean(purchase.supplier_id))
      .map((purchase) => ({
        partyId: purchase.supplier_id as string,
        partyName:
          ledgerNameById.get(purchase.supplier_id as string) ||
          "Unknown Supplier",
        amount: toNumber(purchase.grand_total),
      }));
  }, [purchases, ledgerNameById]);

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

        if (!sourceSale?.customer_id) {
          return [];
        }

        return [
          {
            partyId: sourceSale.customer_id,
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

        if (!sourcePurchase?.supplier_id) {
          return [];
        }

        return [
          {
            partyId: sourcePurchase.supplier_id,
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

  const customerBalanceSummary = useMemo(() => {
    return getBalances(
      customerLedgers,
      customerCreditEntries,
      customerReturnAdjustments,
      "Customer Receipt",
      payments
    );
  }, [
    customerLedgers,
    customerCreditEntries,
    customerReturnAdjustments,
    payments,
  ]);

  const supplierBalanceSummary = useMemo(() => {
    return getBalances(
      supplierLedgers,
      supplierCreditEntries,
      supplierReturnAdjustments,
      "Supplier Payment",
      payments
    );
  }, [
    supplierLedgers,
    supplierCreditEntries,
    supplierReturnAdjustments,
    payments,
  ]);

  const customerBalances = useMemo(
    () =>
      customerBalanceSummary.filter((party) => party.outstanding > 0),
    [customerBalanceSummary]
  );

  const supplierBalances = useMemo(
    () =>
      supplierBalanceSummary.filter((party) => party.outstanding > 0),
    [supplierBalanceSummary]
  );

  const partyOptions = useMemo(() => {
    const balances =
      form.type === "Customer Receipt"
        ? customerBalanceSummary
        : supplierBalanceSummary;

    return balances.filter((party) => {
      const originalAmountForParty =
        editingPayment &&
        editingPayment.type === form.type &&
        editingPayment.partyId === party.id
          ? editingPayment.amount
          : 0;

      return party.outstanding + originalAmountForParty > 0;
    });
  }, [
    customerBalanceSummary,
    editingPayment,
    form.type,
    supplierBalanceSummary,
  ]);

  const selectedParty = partyOptions.find(
    (party) => party.id === form.partyId
  );

  const selectedPartyAvailableAmount = selectedParty
    ? selectedParty.outstanding +
      (editingPayment &&
      editingPayment.type === form.type &&
      editingPayment.partyId === selectedParty.id
        ? editingPayment.amount
        : 0)
    : 0;

  const totalReceivable = customerBalances.reduce(
    (total, customer) => total + customer.outstanding,
    0
  );

  const totalPayable = supplierBalances.reduce(
    (total, supplier) => total + supplier.outstanding,
    0
  );

  function resetForm(paymentType: PaymentType = "Customer Receipt") {
    setForm({
      type: paymentType,
      partyId: "",
      date: getToday(),
      amount: "",
      paymentMode: "Cash",
      referenceNumber: "",
      notes: "",
    });
  }

  function startEditingPayment(payment: Payment) {
    if (!canEditPayment) {
      showMessage("You do not have permission to edit payment entries.");
      return;
    }

    setEditingPayment(payment);
    setForm({
      type: payment.type,
      partyId: payment.partyId,
      date: payment.date,
      amount: String(payment.amount),
      paymentMode: payment.paymentMode,
      referenceNumber: payment.referenceNumber,
      notes: payment.notes,
    });

    window.setTimeout(() => {
      document
        .getElementById("payment-entry-form")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function cancelPaymentEdit() {
    setEditingPayment(null);
    resetForm();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (editingPayment ? !canEditPayment : !canCreatePayment) {
      showMessage(
        editingPayment
          ? "You do not have permission to edit payment entries."
          : "You do not have permission to create payment entries."
      );
      return;
    }

    const paymentAmount = toNumber(form.amount);

    if (!activeCompanyId) {
      showMessage(
        editingPayment
          ? "Select an active company before updating a payment."
          : "Select an active company before recording a payment."
      );
      return;
    }

    if (!selectedParty) {
      showMessage("Please select a customer or supplier.");
      return;
    }

    if (!form.date) {
      showMessage("Please select a payment date.");
      return;
    }

    if (paymentAmount <= 0) {
      showMessage("Enter a valid payment amount.");
      return;
    }

    if (paymentAmount > selectedPartyAvailableAmount) {
      showMessage(
        `Payment cannot exceed available amount of ${formatCurrency(
          selectedPartyAvailableAmount
        )}.`
      );
      return;
    }

    setIsSaving(true);

    try {
      const supabase = createClient();

      const { error } = editingPayment
        ? await supabase.rpc("update_payment_with_validation", {
            p_payment_id: editingPayment.id,
            p_payment_type: form.type,
            p_party_id: selectedParty.id,
            p_payment_date: form.date,
            p_amount: paymentAmount,
            p_payment_mode: form.paymentMode,
            p_reference_number: form.referenceNumber.trim(),
            p_notes: form.notes.trim(),
          })
        : await supabase.rpc("create_payment_with_validation", {
            p_company_id: activeCompanyId,
            p_payment_type: form.type,
            p_party_id: selectedParty.id,
            p_payment_date: form.date,
            p_amount: paymentAmount,
            p_payment_mode: form.paymentMode,
            p_reference_number: form.referenceNumber.trim(),
            p_notes: form.notes.trim(),
          });

      if (error) {
        throw error;
      }

      const successMessage = editingPayment
        ? `Payment of ${formatCurrency(paymentAmount)} updated successfully.`
        : `${form.type} of ${formatCurrency(
            paymentAmount
          )} saved successfully.`;

      setEditingPayment(null);
      resetForm();
      await loadData();

      window.dispatchEvent(new Event("vertexerp-payments-updated"));
      showMessage(successMessage);
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : editingPayment
            ? "Payment could not be updated."
            : "Payment could not be saved."
      );
    } finally {
      setIsSaving(false);
    }
  }

  function requestDeletePayment(payment: Payment) {
    if (!canDeletePayment) {
      showMessage("You do not have permission to delete payment entries.");
      return;
    }

    setPaymentPendingDeletion(payment);
  }

  async function confirmDeletePayment() {
    if (!canDeletePayment) {
      setPaymentPendingDeletion(null);
      showMessage("You do not have permission to delete payment entries.");
      return;
    }

    const payment = paymentPendingDeletion;

    if (!payment || isDeletingPayment) {
      return;
    }

    setIsDeletingPayment(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.rpc("delete_payment_entry", {
        p_payment_id: payment.id,
      });

      if (error) {
        throw error;
      }

      await loadData();
      window.dispatchEvent(new Event("vertexerp-payments-updated"));

      setPaymentPendingDeletion(null);

      showMessage(
        `Payment of ${formatCurrency(payment.amount)} deleted successfully.`
      );
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Payment could not be deleted."
      );
    } finally {
      setIsDeletingPayment(false);
    }
  }

  const canSubmitCurrentPayment = editingPayment
    ? canEditPayment
    : canCreatePayment;

  const isFormDisabled =
    isLoading ||
    !activeCompanyId ||
    isSaving ||
    !canSubmitCurrentPayment;

  const shouldShowPaymentForm =
    canCreatePayment || (canEditPayment && Boolean(editingPayment));

  return (
    <div className="flex min-h-screen bg-[#f3f6fb]">
      <Sidebar />

      <div className="min-w-0 flex-1 overflow-x-hidden">
        <Navbar />

        <main className="min-w-0 p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
          <section className="overflow-hidden rounded-[30px] bg-gradient-to-br from-violet-950 via-violet-800 to-violet-600 p-6 text-white shadow-2xl shadow-violet-900/20 sm:p-8 lg:p-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-violet-100 backdrop-blur">
                  <span>💳</span>
                  Payments Control Center
                </div>

                <h1 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                  Receipts &amp; Payments
                </h1>

                <p className="mt-3 max-w-2xl text-base leading-7 text-violet-100 sm:text-lg">
                  Record customer receipts, supplier payments and monitor
                  outstanding balances from one permission-aware workspace.
                </p>
              </div>

              <div className="rounded-2xl border border-white/15 bg-slate-950/25 px-5 py-4 backdrop-blur">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-200">
                  Active Access
                </p>

                <p className="mt-1 text-lg font-black">
                  {isPermissionLoading
                    ? "Loading..."
                    : access?.roleName || "No active role"}
                </p>

                <p className="mt-1 text-sm text-violet-100">
                  {hasWriteAccess ? "Operational access" : "Read-only access"}
                </p>
              </div>
            </div>
          </section>

          {permissionError && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-semibold text-red-700">
              {permissionError}
            </div>
          )}

          {!isPermissionLoading && !canViewPayments ? (
            <section className="mt-6 rounded-3xl border border-red-200 bg-white p-6 text-center shadow-xl sm:p-10">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl">
                🔒
              </div>

              <h2 className="mt-5 text-2xl font-black text-slate-900">
                Payments Access Restricted
              </h2>

              <p className="mx-auto mt-3 max-w-2xl leading-7 text-slate-600">
                Your current role does not include the payments.view
                permission. Ask the company Owner or Admin to update your role.
              </p>
            </section>
          ) : (
            <>
              {!isPermissionLoading && !hasWriteAccess && (
                <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 text-violet-900">
                  <p className="font-black">Read-only payment access</p>
                  <p className="mt-1 text-sm leading-6 text-violet-700">
                    You can review receivables, payables and payment history.
                    Create, edit and delete actions are hidden for your current
                    role.
                  </p>
                </div>
              )}

              {message && (
                <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 text-sm font-semibold text-violet-800 sm:text-base">
                  {message}
                </div>
              )}

              <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                <StatCard
                  eyebrow="Receivable"
                  label="Customer Receivable"
                  value={isLoading ? "..." : formatCurrency(totalReceivable)}
                  detail="Opening balance + credit sales − Credit Notes − receipts"
                  accentClassName="from-violet-600 to-fuchsia-500"
                />

                <StatCard
                  eyebrow="Payable"
                  label="Supplier Payable"
                  value={isLoading ? "..." : formatCurrency(totalPayable)}
                  detail="Opening balance + credit purchases − Debit Notes − payments"
                  accentClassName="from-indigo-600 to-violet-600"
                />
              </section>

              {shouldShowPaymentForm && (
                <form
                  id="payment-entry-form"
                  onSubmit={handleSubmit}
                  className="mt-6 min-w-0 overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-xl shadow-slate-200/60 sm:mt-8 lg:mt-10"
                >
                  <div className="bg-gradient-to-r from-violet-900 via-violet-800 to-violet-600 px-5 py-6 text-white sm:px-7 lg:px-8">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-200">
                          Protected Transaction Entry
                        </p>

                        <h2 className="mt-2 text-xl font-black sm:text-2xl">
                          {editingPayment
                            ? "Edit Payment Entry"
                            : "New Payment Entry"}
                        </h2>

                        <p className="mt-1 text-sm leading-6 text-violet-100 sm:text-base">
                          {editingPayment
                            ? "Update this payment securely. Previous values remain available in Audit History."
                            : "Record a full or partial payment against credit transactions."}
                        </p>
                      </div>

                      <span className="w-fit rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-black text-violet-50">
                        {editingPayment ? "Editing Entry" : "New Entry"}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 sm:p-6 lg:p-8">
                    {editingPayment && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 sm:text-base">
                        Editing {editingPayment.type.toLowerCase()} for{" "}
                        <strong>{editingPayment.partyName}</strong>. Saving
                        changes will retain an UPDATE record in Audit History.
                      </div>
                    )}

                    {!isLoading && !activeCompanyId && (
                      <div className="mt-5 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700 sm:text-base">
                        Select an active company from the{" "}
                        <strong>Companies</strong> page before recording a
                        payment.
                      </div>
                    )}

                    <fieldset disabled={isFormDisabled}>
                      <div className="mt-1 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                        <PaymentSelect
                          label="Transaction Type *"
                          value={form.type}
                          options={[
                            "Customer Receipt",
                            "Supplier Payment",
                          ]}
                          onChange={(value) =>
                            setForm((currentForm) => ({
                              ...currentForm,
                              type: value as PaymentType,
                              partyId: "",
                              amount: "",
                            }))
                          }
                        />

                        <div>
                          <label className="mb-2 block font-semibold text-slate-800">
                            {form.type === "Customer Receipt"
                              ? "Customer *"
                              : "Supplier *"}
                          </label>

                          <select
                            value={form.partyId}
                            onChange={(event) =>
                              setForm((currentForm) => ({
                                ...currentForm,
                                partyId: event.target.value,
                                amount: "",
                              }))
                            }
                            className="w-full rounded-xl border border-violet-200 bg-violet-50/40 px-4 py-3 text-slate-800 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
                          >
                            <option value="">
                              Select{" "}
                              {form.type === "Customer Receipt"
                                ? "customer"
                                : "supplier"}
                            </option>

                            {partyOptions.map((party) => (
                              <option key={party.id} value={party.id}>
                                {party.name} — {formatCurrency(party.outstanding)}
                              </option>
                            ))}
                          </select>

                          {!isLoading && partyOptions.length === 0 && (
                            <p className="mt-2 text-sm font-semibold text-amber-700">
                              No pending outstanding balance found.
                            </p>
                          )}
                        </div>

                        <PaymentInput
                          label="Payment Date *"
                          type="date"
                          value={form.date}
                          placeholder=""
                          onChange={(value) =>
                            setForm((currentForm) => ({
                              ...currentForm,
                              date: value,
                            }))
                          }
                        />

                        <PaymentInput
                          label="Payment Amount *"
                          type="number"
                          value={form.amount}
                          placeholder="Enter amount"
                          min="0"
                          step="0.01"
                          max={
                            selectedPartyAvailableAmount
                              ? String(selectedPartyAvailableAmount)
                              : undefined
                          }
                          onChange={(value) =>
                            setForm((currentForm) => ({
                              ...currentForm,
                              amount: value,
                            }))
                          }
                        />

                        <PaymentSelect
                          label="Payment Mode"
                          value={form.paymentMode}
                          options={[
                            "Cash",
                            "UPI",
                            "Bank Transfer",
                            "Card",
                            "Cheque",
                          ]}
                          onChange={(value) =>
                            setForm((currentForm) => ({
                              ...currentForm,
                              paymentMode: value,
                            }))
                          }
                        />

                        <PaymentInput
                          label="Reference Number"
                          value={form.referenceNumber}
                          placeholder="UPI / Cheque / Bank reference"
                          onChange={(value) =>
                            setForm((currentForm) => ({
                              ...currentForm,
                              referenceNumber: value,
                            }))
                          }
                        />
                      </div>

                      {selectedParty && (
                        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
                          <p className="text-sm font-black uppercase tracking-[0.12em] text-emerald-800">
                            {editingPayment
                              ? "Available Amount For This Edit"
                              : "Available Outstanding Balance"}
                          </p>

                          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                            <p className="text-lg font-black text-slate-900">
                              {selectedParty.name}
                            </p>

                            <p className="text-xl font-black text-emerald-700 sm:text-2xl">
                              {formatCurrency(selectedPartyAvailableAmount)}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="mt-6">
                        <label className="mb-2 block font-semibold text-slate-800">
                          Notes
                        </label>

                        <textarea
                          rows={4}
                          value={form.notes}
                          onChange={(event) =>
                            setForm((currentForm) => ({
                              ...currentForm,
                              notes: event.target.value,
                            }))
                          }
                          placeholder="Optional note for this payment..."
                          className="w-full resize-none rounded-xl border border-violet-200 bg-violet-50/40 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
                        />
                      </div>

                      <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:gap-4">
                        <button
                          type="submit"
                          disabled={isFormDisabled}
                          className="w-full rounded-xl bg-gradient-to-r from-violet-700 to-fuchsia-600 px-5 py-3 font-black text-white shadow-lg shadow-violet-300/40 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-7"
                        >
                          {isSaving
                            ? editingPayment
                              ? "Saving Changes..."
                              : "Saving Payment..."
                            : editingPayment
                              ? "Save Changes"
                              : "Save Payment"}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (editingPayment) {
                              cancelPaymentEdit();
                            } else {
                              resetForm();
                            }
                          }}
                          disabled={isSaving}
                          className="w-full rounded-xl border border-violet-200 bg-white px-5 py-3 font-bold text-violet-800 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-7"
                        >
                          {editingPayment ? "Cancel Edit" : "Reset"}
                        </button>
                      </div>
                    </fieldset>
                  </div>
                </form>
              )}

              <section className="mt-6 min-w-0 overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-xl shadow-slate-200/60 sm:mt-8 lg:mt-10">
                <div className="flex flex-col gap-4 border-b border-violet-100 bg-gradient-to-r from-violet-50 to-fuchsia-50 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 lg:py-6">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-500">
                      Transaction Register
                    </p>

                    <h2 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">
                      Payment History
                    </h2>

                    <p className="mt-1 text-sm text-slate-600 sm:text-base">
                      Customer receipts and supplier payment entries.
                    </p>
                  </div>

                  <span className="w-fit rounded-full bg-violet-100 px-4 py-2 text-sm font-black text-violet-800">
                    Entries: {payments.length}
                  </span>
                </div>

                <div className="p-4 md:hidden">
                  {isLoading ? (
                    <div className="py-10 text-center text-sm text-slate-500">
                      Loading payment history from the cloud database...
                    </div>
                  ) : payments.length === 0 ? (
                    <div className="py-10 text-center text-slate-500">
                      <p className="text-lg font-bold text-slate-700">
                        No payment entries yet
                      </p>

                      <p className="mt-2 text-sm">
                        {canCreatePayment
                          ? "Record a receipt or supplier payment from the form above."
                          : "No receipt or supplier payment has been recorded."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {payments.map((payment) => {
                        const isCustomerReceipt =
                          payment.type === "Customer Receipt";

                        return (
                          <article
                            key={payment.id}
                            className="rounded-2xl border border-violet-100 bg-violet-50/30 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-lg font-black text-slate-900">
                                  {payment.partyName}
                                </p>

                                <p className="mt-1 text-sm text-slate-500">
                                  {formatDate(payment.date)}
                                </p>
                              </div>

                              <span
                                className={
                                  isCustomerReceipt
                                    ? "shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700"
                                    : "shrink-0 rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700"
                                }
                              >
                                {isCustomerReceipt ? "Receipt" : "Payment"}
                              </span>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-3">
                              <InfoBox
                                label="Payment Mode"
                                value={payment.paymentMode}
                              />
                              <InfoBox
                                label="Amount"
                                value={formatCurrency(payment.amount)}
                                valueClassName={
                                  isCustomerReceipt
                                    ? "text-emerald-700"
                                    : "text-violet-700"
                                }
                              />
                            </div>

                            <div className="mt-3 rounded-xl bg-white p-3">
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                Reference
                              </p>
                              <p className="mt-1 break-words font-semibold text-slate-800">
                                {payment.referenceNumber || "—"}
                              </p>
                            </div>

                            {payment.notes && (
                              <div className="mt-3 rounded-xl bg-white p-3">
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                  Notes
                                </p>
                                <p className="mt-1 text-sm leading-6 text-slate-700">
                                  {payment.notes}
                                </p>
                              </div>
                            )}

                            {(canEditPayment || canDeletePayment) && (
                              <div
                                className={`mt-4 grid gap-3 ${
                                  canEditPayment && canDeletePayment
                                    ? "grid-cols-2"
                                    : "grid-cols-1"
                                }`}
                              >
                                {canEditPayment && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      startEditingPayment(payment)
                                    }
                                    className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-black text-violet-700 transition hover:bg-violet-100"
                                  >
                                    Edit
                                  </button>
                                )}

                                {canDeletePayment && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      requestDeletePayment(payment)
                                    }
                                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-black text-red-700 transition hover:bg-red-100"
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="hidden max-w-full overflow-x-auto md:block">
                  <table className="w-full min-w-[1050px]">
                    <thead className="bg-violet-50">
                      <tr className="border-b border-violet-100 text-left">
                        <TableHeader>Date</TableHeader>
                        <TableHeader>Type</TableHeader>
                        <TableHeader>Party</TableHeader>
                        <TableHeader>Mode</TableHeader>
                        <TableHeader>Reference</TableHeader>
                        <TableHeader align="right">Amount</TableHeader>
                        {(canEditPayment || canDeletePayment) && (
                          <TableHeader align="right">Action</TableHeader>
                        )}
                      </tr>
                    </thead>

                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td
                            colSpan={
                              canEditPayment || canDeletePayment ? 7 : 6
                            }
                            className="px-6 py-14 text-center text-slate-500"
                          >
                            Loading payment history from the cloud database...
                          </td>
                        </tr>
                      ) : payments.length === 0 ? (
                        <tr>
                          <td
                            colSpan={
                              canEditPayment || canDeletePayment ? 7 : 6
                            }
                            className="px-6 py-14 text-center text-slate-500"
                          >
                            <p className="text-lg font-bold text-slate-700">
                              No payment entries yet
                            </p>
                            <p className="mt-2">
                              {canCreatePayment
                                ? "Record a receipt or supplier payment from the form above."
                                : "No receipt or supplier payment has been recorded."}
                            </p>
                          </td>
                        </tr>
                      ) : (
                        payments.map((payment) => {
                          const isCustomerReceipt =
                            payment.type === "Customer Receipt";

                          return (
                            <tr
                              key={payment.id}
                              className="border-b border-slate-100 transition hover:bg-violet-50/60"
                            >
                              <td className="px-6 py-5 text-slate-700">
                                {formatDate(payment.date)}
                              </td>

                              <td className="px-6 py-5">
                                <span
                                  className={
                                    isCustomerReceipt
                                      ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700"
                                      : "rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700"
                                  }
                                >
                                  {payment.type}
                                </span>
                              </td>

                              <td className="px-6 py-5">
                                <p className="font-black text-slate-900">
                                  {payment.partyName}
                                </p>
                                {payment.notes && (
                                  <p className="mt-1 max-w-[220px] truncate text-sm text-slate-500">
                                    {payment.notes}
                                  </p>
                                )}
                              </td>

                              <td className="px-6 py-5 text-slate-700">
                                {payment.paymentMode}
                              </td>

                              <td className="px-6 py-5 text-slate-700">
                                {payment.referenceNumber || "—"}
                              </td>

                              <td
                                className={`px-6 py-5 text-right text-lg font-black ${
                                  isCustomerReceipt
                                    ? "text-emerald-700"
                                    : "text-violet-700"
                                }`}
                              >
                                {formatCurrency(payment.amount)}
                              </td>

                              {(canEditPayment || canDeletePayment) && (
                                <td className="px-6 py-5">
                                  <div className="flex justify-end gap-2">
                                    {canEditPayment && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          startEditingPayment(payment)
                                        }
                                        className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-black text-violet-700 transition hover:bg-violet-100"
                                      >
                                        Edit
                                      </button>
                                    )}

                                    {canDeletePayment && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          requestDeletePayment(payment)
                                        }
                                        className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-black text-red-700 transition hover:bg-red-100"
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </main>
      </div>

      <ConfirmDeleteModal
        isOpen={canDeletePayment && Boolean(paymentPendingDeletion)}
        title="Delete payment entry?"
        description={
          paymentPendingDeletion
            ? `This will remove the ${paymentPendingDeletion.type.toLowerCase()} of ${formatCurrency(
                paymentPendingDeletion.amount
              )} for ${paymentPendingDeletion.partyName}.`
            : ""
        }
        confirmLabel="Delete Payment"
        isDeleting={isDeletingPayment}
        onCancel={() => {
          if (!isDeletingPayment) {
            setPaymentPendingDeletion(null);
          }
        }}
        onConfirm={confirmDeletePayment}
      />
    </div>
  );
}

function StatCard({
  eyebrow,
  label,
  value,
  detail,
  accentClassName,
}: {
  eyebrow: string;
  label: string;
  value: string;
  detail: string;
  accentClassName: string;
}) {
  return (
    <article className="relative overflow-hidden rounded-3xl border border-violet-100 bg-white p-5 shadow-xl shadow-slate-200/60 sm:p-6">
      <div
        className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${accentClassName}`}
      />
      <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-500">
        {eyebrow}
      </p>
      <p className="mt-2 font-semibold text-slate-600">{label}</p>
      <h2 className="mt-3 break-words text-3xl font-black text-slate-950 sm:text-4xl">
        {value}
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">{detail}</p>
    </article>
  );
}

function PaymentInput({
  label,
  value,
  placeholder,
  onChange,
  type = "text",
  min,
  max,
  step,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  type?: string;
  min?: string;
  max?: string;
  step?: string;
}) {
  return (
    <div>
      <label className="mb-2 block font-semibold text-slate-800">
        {label}
      </label>
      <input
        type={type}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-violet-200 bg-violet-50/40 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
      />
    </div>
  );
}

function PaymentSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block font-semibold text-slate-800">
        {label}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-violet-200 bg-violet-50/40 px-4 py-3 text-slate-800 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function InfoBox({
  label,
  value,
  valueClassName = "text-slate-800",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl bg-white p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-1 break-words font-black ${valueClassName}`}>
        {value}
      </p>
    </div>
  );
}

function TableHeader({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-6 py-4 text-sm font-black text-slate-700 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}