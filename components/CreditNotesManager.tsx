"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type ProfileRow = { active_company_id: string | null };
type LedgerRow = { id: string; name: string };

type SaleItemRow = {
  id: string;
  sale_id: string;
  product_id: string | null;
  product_name: string | null;
  quantity: number | string | null;
  rate: number | string | null;
  gst_rate: number | string | null;
  base_amount: number | string | null;
  gst_amount: number | string | null;
  amount: number | string | null;
  unit_cost_snapshot: number | string | null;
  cogs_amount: number | string | null;
};

type SaleRow = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_id: string | null;
  customer: LedgerRow | LedgerRow[] | null;
  sale_items: SaleItemRow[] | null;
};

type CreditNoteItemRow = {
  id: string;
  source_sale_item_id: string;
  product_id: string;
  product_name: string;
  quantity: number | string | null;
  amount: number | string | null;
  cogs_amount: number | string | null;
};

type CreditNoteRow = {
  id: string;
  source_sale_id: string;
  credit_note_number: string;
  credit_note_date: string;
  reason: string;
  subtotal: number | string | null;
  gst_total: number | string | null;
  grand_total: number | string | null;
  cogs_total: number | string | null;
  status: "POSTED" | "VOID";
  void_reason: string | null;
  created_at: string;
  credit_note_items: CreditNoteItemRow[] | null;
};

type ReturnLine = {
  sourceSaleItemId: string;
  productId: string;
  productName: string;
  originalQuantity: number;
  remainingQuantity: number;
  rate: number;
  gstRate: number;
  sourceBaseAmount: number;
  sourceGstAmount: number;
  sourceAmount: number;
  returnQuantity: string;
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(amount: number) {
  return `₹${toNumber(amount).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function formatQuantity(amount: number) {
  return toNumber(amount).toLocaleString("en-IN", {
    maximumFractionDigits: 3,
  });
}

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getJoinedLedger(ledger: LedgerRow | LedgerRow[] | null) {
  return Array.isArray(ledger) ? ledger[0] || null : ledger;
}

function generateCreditNoteNumber() {
  const now = new Date();
  const datePart = now.toLocaleDateString("en-GB").split("/").reverse().join("");
  const timePart = `${now.getHours()}${now.getMinutes()}${now.getSeconds()}`.padStart(6, "0");
  return `CRN-${datePart}-${timePart}`;
}

function isCogsEnabledSale(sale: SaleRow) {
  const items = sale.sale_items || [];
  return (
    items.length > 0 &&
    items.every(
      (item) =>
        item.unit_cost_snapshot !== null &&
        item.unit_cost_snapshot !== undefined &&
        item.cogs_amount !== null &&
        item.cogs_amount !== undefined
    )
  );
}

function proportion(sourceAmount: number, originalQuantity: number, returnQuantity: number) {
  if (originalQuantity <= 0 || returnQuantity <= 0) return 0;
  return Number(((sourceAmount * returnQuantity) / originalQuantity).toFixed(2));
}

export default function CreditNotesManager() {
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [creditNotes, setCreditNotes] = useState<CreditNoteRow[]>([]);
  const [selectedSaleId, setSelectedSaleId] = useState("");
  const [creditNoteNumber, setCreditNoteNumber] = useState(generateCreditNoteNumber());
  const [creditNoteDate, setCreditNoteDate] = useState(getTodayDate());
  const [reason, setReason] = useState("");
  const [returnLines, setReturnLines] = useState<ReturnLine[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(""), 4500);
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
        setActiveCompanyId(null);
        setSales([]);
        setCreditNotes([]);
        showMessage("Please sign in to manage credit notes.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("active_company_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      const companyId = (profile as ProfileRow | null)?.active_company_id || null;
      setActiveCompanyId(companyId);

      if (!companyId) {
        setSales([]);
        setCreditNotes([]);
        showMessage("Select an active company from the Companies page first.");
        return;
      }

      const [salesResponse, notesResponse] = await Promise.all([
        supabase
          .from("sales")
          .select(
            `
              id,
              invoice_number,
              invoice_date,
              customer_id,
              customer:ledgers!sales_customer_id_fkey(id,name),
              sale_items(
                id,
                sale_id,
                product_id,
                product_name,
                quantity,
                rate,
                gst_rate,
                base_amount,
                gst_amount,
                amount,
                unit_cost_snapshot,
                cogs_amount
              )
            `
          )
          .eq("company_id", companyId)
          .order("invoice_date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("credit_notes")
          .select(
            `
              id,
              source_sale_id,
              credit_note_number,
              credit_note_date,
              reason,
              subtotal,
              gst_total,
              grand_total,
              cogs_total,
              status,
              void_reason,
              created_at,
              credit_note_items(
                id,
                source_sale_item_id,
                product_id,
                product_name,
                quantity,
                amount,
                cogs_amount
              )
            `
          )
          .eq("company_id", companyId)
          .order("credit_note_date", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);

      if (salesResponse.error) throw salesResponse.error;
      if (notesResponse.error) throw notesResponse.error;

      setSales((salesResponse.data || []) as unknown as SaleRow[]);
      setCreditNotes((notesResponse.data || []) as unknown as CreditNoteRow[]);
    } catch (error) {
      setSales([]);
      setCreditNotes([]);
      showMessage(error instanceof Error ? error.message : "Credit note data could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();

    const refreshEvents = [
      "vertexerp-sales-updated",
      "vertexerp-products-updated",
      "vertexerp-active-company-updated",
    ];

    refreshEvents.forEach((eventName) => window.addEventListener(eventName, loadData));

    return () => {
      refreshEvents.forEach((eventName) => window.removeEventListener(eventName, loadData));
    };
  }, []);

  const saleById = useMemo(() => {
    const map = new Map<string, SaleRow>();
    sales.forEach((sale) => map.set(sale.id, sale));
    return map;
  }, [sales]);

  const returnedQuantityByItem = useMemo(() => {
    const map = new Map<string, number>();

    creditNotes
      .filter((note) => note.status === "POSTED")
      .forEach((note) => {
        (note.credit_note_items || []).forEach((item) => {
          map.set(
            item.source_sale_item_id,
            (map.get(item.source_sale_item_id) || 0) + toNumber(item.quantity)
          );
        });
      });

    return map;
  }, [creditNotes]);

  const selectedSale = selectedSaleId ? saleById.get(selectedSaleId) || null : null;
  const selectedCustomer = selectedSale ? getJoinedLedger(selectedSale.customer) : null;

  const totals = useMemo(() => {
    return returnLines.reduce(
      (sum, line) => {
        const qty = Math.min(toNumber(line.returnQuantity), line.remainingQuantity);
        const base = proportion(line.sourceBaseAmount, line.originalQuantity, qty);
        const gst = proportion(line.sourceGstAmount, line.originalQuantity, qty);
        const amount = proportion(line.sourceAmount, line.originalQuantity, qty);

        return {
          subtotal: sum.subtotal + base,
          gstTotal: sum.gstTotal + gst,
          grandTotal: sum.grandTotal + amount,
          itemCount: qty > 0 ? sum.itemCount + 1 : sum.itemCount,
        };
      },
      { subtotal: 0, gstTotal: 0, grandTotal: 0, itemCount: 0 }
    );
  }, [returnLines]);

  function handleSaleChange(nextSaleId: string) {
    setSelectedSaleId(nextSaleId);
    const sale = saleById.get(nextSaleId) || null;

    if (!sale) {
      setReturnLines([]);
      return;
    }

    setReturnLines(
      (sale.sale_items || []).map((item) => {
        const originalQuantity = toNumber(item.quantity);
        const alreadyReturned = returnedQuantityByItem.get(item.id) || 0;
        const remainingQuantity = Math.max(0, originalQuantity - alreadyReturned);

        return {
          sourceSaleItemId: item.id,
          productId: item.product_id || "",
          productName: item.product_name || "Product",
          originalQuantity,
          remainingQuantity,
          rate: toNumber(item.rate),
          gstRate: toNumber(item.gst_rate),
          sourceBaseAmount: toNumber(item.base_amount),
          sourceGstAmount: toNumber(item.gst_amount),
          sourceAmount: toNumber(item.amount),
          returnQuantity: "",
        };
      })
    );
  }

  function updateReturnQuantity(index: number, value: string) {
    setReturnLines((lines) =>
      lines.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        const numberValue = Math.max(0, toNumber(value));
        return {
          ...line,
          returnQuantity:
            value === "" ? "" : String(Math.min(numberValue, line.remainingQuantity)),
        };
      })
    );
  }

  function fillRemainingQuantity(index: number) {
    setReturnLines((lines) =>
      lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, returnQuantity: String(line.remainingQuantity) } : line
      )
    );
  }

  function resetForm() {
    setSelectedSaleId("");
    setCreditNoteNumber(generateCreditNoteNumber());
    setCreditNoteDate(getTodayDate());
    setReason("");
    setReturnLines([]);
  }

  async function createCreditNote() {
    if (!activeCompanyId) {
      showMessage("Select an active company first.");
      return;
    }

    if (!selectedSale) {
      showMessage("Select a source sales invoice.");
      return;
    }

    if (!isCogsEnabledSale(selectedSale)) {
      showMessage("This invoice was recorded before COGS was enabled. Credit note is blocked for safety.");
      return;
    }

    if (!creditNoteNumber.trim()) {
      showMessage("Credit note number is required.");
      return;
    }

    if (!creditNoteDate) {
      showMessage("Credit note date is required.");
      return;
    }

    if (!reason.trim()) {
      showMessage("Credit note reason is required.");
      return;
    }

    const payloadItems = returnLines
      .map((line) => {
        const qty = Math.min(toNumber(line.returnQuantity), line.remainingQuantity);

        return {
          source_sale_item_id: line.sourceSaleItemId,
          product_id: line.productId,
          product_name: line.productName,
          quantity: qty,
          rate: line.rate,
          gst_rate: line.gstRate,
          base_amount: proportion(line.sourceBaseAmount, line.originalQuantity, qty),
          gst_amount: proportion(line.sourceGstAmount, line.originalQuantity, qty),
          amount: proportion(line.sourceAmount, line.originalQuantity, qty),
        };
      })
      .filter((item) => item.quantity > 0);

    if (payloadItems.length === 0) {
      showMessage("Enter return quantity for at least one item.");
      return;
    }

    setIsSaving(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("create_credit_note_with_stock", {
        p_company_id: activeCompanyId,
        p_source_sale_id: selectedSale.id,
        p_credit_note_number: creditNoteNumber.trim(),
        p_credit_note_date: creditNoteDate,
        p_reason: reason.trim(),
        p_items: payloadItems,
      });

      if (error) throw error;

      showMessage("Credit note posted successfully.");
      resetForm();
      await loadData();
      window.dispatchEvent(new Event("vertexerp-sales-updated"));
      window.dispatchEvent(new Event("vertexerp-products-updated"));
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Credit note could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  async function voidCreditNote(note: CreditNoteRow) {
    const voidReason = window.prompt(`Enter a reason to void ${note.credit_note_number}:`);
    if (!voidReason?.trim()) return;

    setIsSaving(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("void_credit_note_with_stock", {
        p_credit_note_id: note.id,
        p_void_reason: voidReason.trim(),
      });

      if (error) throw error;

      showMessage("Credit note voided successfully.");
      await loadData();
      window.dispatchEvent(new Event("vertexerp-sales-updated"));
      window.dispatchEvent(new Event("vertexerp-products-updated"));
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Credit note could not be voided.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-100 bg-white p-4 shadow-lg sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Credit Notes
            </h2>
            <p className="mt-1 text-sm text-slate-600 sm:text-base">
              Process sales returns without deleting invoices. Credit notes reduce revenue,
              GST and receivables while restoring stock and reversing COGS.
            </p>
          </div>

          <div className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
            Sales Return Safe
          </div>
        </div>

        {message && (
          <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700">
            {message}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-lg sm:p-6">
          <h3 className="text-xl font-bold text-slate-900">Create Credit Note</h3>
          <p className="mt-1 text-sm text-slate-600">
            Select a COGS-enabled invoice and enter returned quantities.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <label className="mb-2 block font-semibold text-slate-800">
                Source Sales Invoice
              </label>
              <select
                value={selectedSaleId}
                onChange={(event) => handleSaleChange(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              >
                <option value="">Select invoice</option>
                {sales.map((sale) => {
                  const customer = getJoinedLedger(sale.customer);
                  const disabled = !isCogsEnabledSale(sale);

                  return (
                    <option key={sale.id} value={sale.id} disabled={disabled}>
                      {sale.invoice_number} · {formatDate(sale.invoice_date)} ·{" "}
                      {customer?.name || "Customer"}
                      {disabled ? " · Legacy invoice" : ""}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="mb-2 block font-semibold text-slate-800">
                Credit Note Number
              </label>
              <input
                value={creditNoteNumber}
                onChange={(event) => setCreditNoteNumber(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-2 block font-semibold text-slate-800">
                Credit Note Date
              </label>
              <input
                type="date"
                value={creditNoteDate}
                onChange={(event) => setCreditNoteDate(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="mb-2 block font-semibold text-slate-800">Reason</label>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                placeholder="Customer returned goods"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </div>

          {selectedSale && (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-slate-900">{selectedSale.invoice_number}</p>
                  <p className="text-sm text-slate-600">
                    {selectedCustomer?.name || "Customer"} · {formatDate(selectedSale.invoice_date)}
                  </p>
                </div>

                <Link
                  href={`/sales/invoice/${selectedSale.id}`}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:w-auto"
                >
                  Open Invoice
                </Link>
              </div>
            </div>
          )}

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <p className="font-bold text-slate-900">Return Items</p>
              <p className="mt-1 text-sm text-slate-600">
                You cannot return more than the remaining invoice quantity.
              </p>
            </div>

            <div className="p-4">
              {!selectedSaleId ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  Select an invoice to load returnable items.
                </p>
              ) : returnLines.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  No returnable items are available for this invoice.
                </p>
              ) : (
                <div className="space-y-4">
                  {returnLines.map((line, index) => {
                    const qty = Math.min(toNumber(line.returnQuantity), line.remainingQuantity);
                    const amount = proportion(line.sourceAmount, line.originalQuantity, qty);

                    return (
                      <div
                        key={line.sourceSaleItemId}
                        className="rounded-2xl border border-slate-200 bg-white p-4"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900">{line.productName}</p>
                            <p className="mt-1 text-sm text-slate-600">
                              Sold: {formatQuantity(line.originalQuantity)} · Remaining:{" "}
                              {formatQuantity(line.remainingQuantity)} · Rate:{" "}
                              {formatCurrency(line.rate)}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => fillRemainingQuantity(index)}
                            disabled={line.remainingQuantity <= 0}
                            className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Return Full
                          </button>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-700">
                              Return Quantity
                            </label>
                            <input
                              type="number"
                              min="0"
                              max={line.remainingQuantity}
                              step="0.001"
                              value={line.returnQuantity}
                              onChange={(event) => updateReturnQuantity(index, event.target.value)}
                              disabled={line.remainingQuantity <= 0}
                              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-700">
                              Return Amount
                            </label>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-slate-900">
                              {formatCurrency(amount)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Subtotal</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {formatCurrency(totals.subtotal)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">GST</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {formatCurrency(totals.gstTotal)}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                Credit Total
              </p>
              <p className="mt-1 text-xl font-bold text-emerald-700">
                {formatCurrency(totals.grandTotal)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={createCreditNote}
            disabled={isSaving || isLoading || totals.itemCount === 0}
            className="mt-5 w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Post Credit Note"}
          </button>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-lg">
          <div className="border-b border-slate-200 p-4 sm:p-6">
            <h3 className="text-xl font-bold text-slate-900">Credit Note History</h3>
            <p className="mt-1 text-sm text-slate-600">
              Posted credit notes can be voided with audit reason.
            </p>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[920px]">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-left">
                  <th className="px-6 py-4 text-sm font-bold text-slate-700">Credit Note</th>
                  <th className="px-6 py-4 text-sm font-bold text-slate-700">Source Invoice</th>
                  <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">Credit Total</th>
                  <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">COGS Reverse</th>
                  <th className="px-6 py-4 text-sm font-bold text-slate-700">Status</th>
                  <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">Action</th>
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      Loading credit notes...
                    </td>
                  </tr>
                ) : creditNotes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      No credit notes created yet.
                    </td>
                  </tr>
                ) : (
                  creditNotes.map((note) => {
                    const sale = saleById.get(note.source_sale_id);

                    return (
                      <tr key={note.id} className="border-b border-slate-100 transition hover:bg-blue-50">
                        <td className="px-6 py-5">
                          <p className="font-bold text-slate-900">{note.credit_note_number}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatDate(note.credit_note_date)}</p>
                        </td>

                        <td className="px-6 py-5">
                          {sale ? (
                            <Link
                              href={`/sales/invoice/${sale.id}`}
                              className="font-semibold text-blue-600 transition hover:text-blue-800 hover:underline"
                            >
                              {sale.invoice_number}
                            </Link>
                          ) : (
                            <span className="text-slate-600">Sales Invoice</span>
                          )}
                          <p className="mt-1 text-xs text-slate-500">{note.reason}</p>
                        </td>

                        <td className="px-6 py-5 text-right font-bold text-emerald-700">
                          {formatCurrency(toNumber(note.grand_total))}
                        </td>

                        <td className="px-6 py-5 text-right font-bold text-purple-700">
                          {formatCurrency(toNumber(note.cogs_total))}
                        </td>

                        <td className="px-6 py-5">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              note.status === "POSTED"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {note.status}
                          </span>
                        </td>

                        <td className="px-6 py-5 text-right">
                          <button
                            type="button"
                            onClick={() => voidCreditNote(note)}
                            disabled={note.status !== "POSTED" || isSaving}
                            className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Void
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 md:hidden">
            {isLoading ? (
              <p className="py-10 text-center text-sm text-slate-500">Loading credit notes...</p>
            ) : creditNotes.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">No credit notes created yet.</p>
            ) : (
              <div className="space-y-4">
                {creditNotes.map((note) => {
                  const sale = saleById.get(note.source_sale_id);

                  return (
                    <article key={note.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-bold text-slate-900">{note.credit_note_number}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {formatDate(note.credit_note_date)} · {sale?.invoice_number || "Sales Invoice"}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                            note.status === "POSTED"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {note.status}
                        </span>
                      </div>

                      <p className="mt-3 text-sm text-slate-700">{note.reason}</p>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-white p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Credit</p>
                          <p className="font-bold text-slate-900">{formatCurrency(toNumber(note.grand_total))}</p>
                        </div>
                        <div className="rounded-xl bg-white p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">COGS Reverse</p>
                          <p className="font-bold text-slate-900">{formatCurrency(toNumber(note.cogs_total))}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => voidCreditNote(note)}
                        disabled={note.status !== "POSTED" || isSaving}
                        className="mt-4 w-full rounded-xl border border-red-200 bg-white px-4 py-2 font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Void Credit Note
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}