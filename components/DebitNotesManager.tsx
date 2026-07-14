"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ProfileRow = {
  active_company_id: string | null;
};

type LedgerRow = {
  id: string;
  name: string;
};

type ProductRow = {
  id: string;
  quantity: number | string | null;
};

type PurchaseItemRow = {
  id: string;
  purchase_id: string;
  product_id: string | null;
  product_name: string | null;
  quantity: number | string | null;
  rate: number | string | null;
  gst_rate: number | string | null;
  discount: number | string | null;
  base_amount: number | string | null;
  taxable_amount: number | string | null;
  gst_amount: number | string | null;
  cgst_amount: number | string | null;
  sgst_amount: number | string | null;
  igst_amount: number | string | null;
  cess_amount: number | string | null;
  hsn_sac_code: string | null;
  amount: number | string | null;
  inventory_unit_cost: number | string | null;
  inventory_cost_amount: number | string | null;
};

type PurchaseRow = {
  id: string;
  bill_number: string;
  purchase_date: string;
  payment_mode: string;
  place_of_supply: string | null;
  place_of_supply_code: string | null;
  tax_type: string | null;
  supplier_id: string | null;
  supplier: LedgerRow | LedgerRow[] | null;
  purchase_items: PurchaseItemRow[] | null;
};

type DebitNoteItemRow = {
  id: string;
  source_purchase_item_id: string;
  product_id: string;
  product_name: string;
  quantity: number | string | null;
  base_amount: number | string | null;
  discount: number | string | null;
  taxable_amount: number | string | null;
  gst_amount: number | string | null;
  cgst_amount: number | string | null;
  sgst_amount: number | string | null;
  igst_amount: number | string | null;
  cess_amount: number | string | null;
  hsn_sac_code: string | null;
  amount: number | string | null;
  inventory_cost_amount: number | string | null;
};

type DebitNoteRow = {
  id: string;
  source_purchase_id: string;
  debit_note_number: string;
  debit_note_date: string;
  reason: string;
  subtotal: number | string | null;
  gst_total: number | string | null;
  cgst_total: number | string | null;
  sgst_total: number | string | null;
  igst_total: number | string | null;
  cess_total: number | string | null;
  place_of_supply: string | null;
  place_of_supply_code: string | null;
  tax_type: string | null;
  grand_total: number | string | null;
  inventory_cost_total: number | string | null;
  variance_total: number | string | null;
  status: "POSTED" | "VOID";
  void_reason: string | null;
  created_at: string;
  debit_note_items: DebitNoteItemRow[] | null;
};

type ReturnedAmounts = {
  quantity: number;
  baseAmount: number;
  discount: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  amount: number;
};

type ReturnLine = {
  sourcePurchaseItemId: string;
  productId: string;
  productName: string;
  originalQuantity: number;
  remainingQuantity: number;
  currentStock: number;
  maxReturnQuantity: number;
  rate: number;
  gstRate: number;
  originalBaseAmount: number;
  originalDiscount: number;
  hsnSacCode: string;
  originalTaxableAmount: number;
  originalGstAmount: number;
  originalCgstAmount: number;
  originalSgstAmount: number;
  originalIgstAmount: number;
  originalCessAmount: number;
  remainingBaseAmount: number;
  remainingDiscount: number;
  remainingGstAmount: number;
  remainingCgstAmount: number;
  remainingSgstAmount: number;
  remainingIgstAmount: number;
  remainingCessAmount: number;
  remainingAmount: number;
  returnQuantity: string;
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number) {
  return `₹${toNumber(value).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function formatQuantity(value: number) {
  return toNumber(value).toLocaleString("en-IN", {
    maximumFractionDigits: 3,
  });
}

function formatDate(value: string) {
  if (!value) return "—";

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

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function generateDebitNoteNumber() {
  const now = new Date();
  const datePart = now
    .toLocaleDateString("en-GB")
    .split("/")
    .reverse()
    .join("");
  const timePart =
    `${now.getHours()}${now.getMinutes()}${now.getSeconds()}`.padStart(6, "0");

  return `DBN-${datePart}-${timePart}`;
}

function getJoinedLedger(
  ledger: LedgerRow | LedgerRow[] | null
): LedgerRow | null {
  return Array.isArray(ledger) ? ledger[0] || null : ledger;
}

function isCostingEnabledPurchase(purchase: PurchaseRow) {
  const items = purchase.purchase_items || [];

  return (
    items.length > 0 &&
    items.every(
      (item) =>
        item.inventory_unit_cost !== null &&
        item.inventory_unit_cost !== undefined &&
        item.inventory_cost_amount !== null &&
        item.inventory_cost_amount !== undefined
    )
  );
}

function calculateReturnAmounts(line: ReturnLine, returnQuantity: number) {
  if (returnQuantity <= 0 || line.originalQuantity <= 0) {
    return {
      baseAmount: 0,
      discount: 0,
      taxableAmount: 0,
      gstAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      cessAmount: 0,
      amount: 0,
    };
  }

  const isFullRemaining =
    Math.abs(returnQuantity - line.remainingQuantity) < 0.0005;

  const ratio = returnQuantity / line.originalQuantity;

  const baseAmount = Number(
    (
      isFullRemaining
        ? line.remainingBaseAmount
        : Math.min(
            line.remainingBaseAmount,
            line.originalBaseAmount * ratio
          )
    ).toFixed(2)
  );

  const discount = Number(
    (
      isFullRemaining
        ? line.remainingDiscount
        : Math.min(
            line.remainingDiscount,
            line.originalDiscount * ratio
          )
    ).toFixed(2)
  );

  const gstAmount = Number(
    (
      isFullRemaining
        ? line.remainingGstAmount
        : Math.min(
            line.remainingGstAmount,
            line.originalGstAmount * ratio
          )
    ).toFixed(2)
  );

  const cgstAmount = Number(
    (
      isFullRemaining
        ? line.remainingCgstAmount
        : Math.min(
            line.remainingCgstAmount,
            line.originalCgstAmount * ratio
          )
    ).toFixed(2)
  );

  const sgstAmount = Number(
    (
      isFullRemaining
        ? line.remainingSgstAmount
        : Math.min(
            line.remainingSgstAmount,
            line.originalSgstAmount * ratio
          )
    ).toFixed(2)
  );

  const igstAmount = Number(
    (
      isFullRemaining
        ? line.remainingIgstAmount
        : Math.min(
            line.remainingIgstAmount,
            line.originalIgstAmount * ratio
          )
    ).toFixed(2)
  );

  const cessAmount = Number(
    (
      isFullRemaining
        ? line.remainingCessAmount
        : Math.min(
            line.remainingCessAmount,
            line.originalCessAmount * ratio
          )
    ).toFixed(2)
  );

  const taxableAmount = Number(
    Math.max(baseAmount - discount, 0).toFixed(2)
  );

  return {
    baseAmount,
    discount,
    taxableAmount,
    gstAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    cessAmount,
    amount: Number(
      (taxableAmount + gstAmount + cessAmount).toFixed(2)
    ),
  };
}

export default function DebitNotesManager() {
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [debitNotes, setDebitNotes] = useState<DebitNoteRow[]>([]);

  const [selectedPurchaseId, setSelectedPurchaseId] = useState("");
  const [debitNoteNumber, setDebitNoteNumber] = useState(
    generateDebitNoteNumber()
  );
  const [debitNoteDate, setDebitNoteDate] = useState(getTodayDate());
  const [reason, setReason] = useState("");
  const [returnLines, setReturnLines] = useState<ReturnLine[]>([]);

  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);

    window.setTimeout(() => {
      setMessage("");
    }, 5000);
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
        setPurchases([]);
        setProducts([]);
        setDebitNotes([]);
        showMessage("Please sign in to manage debit notes.");
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
        setPurchases([]);
        setProducts([]);
        setDebitNotes([]);
        showMessage("Select an active company from the Companies page first.");
        return;
      }

      const [purchaseResponse, productResponse, noteResponse] =
        await Promise.all([
          supabase
            .from("purchases")
            .select(
              `
                id,
                bill_number,
                purchase_date,
                payment_mode,
                place_of_supply,
                place_of_supply_code,
                tax_type,
                supplier_id,
                supplier:ledgers!purchases_supplier_id_fkey(
                  id,
                  name
                ),
                purchase_items(
                  id,
                  purchase_id,
                  product_id,
                  product_name,
                  quantity,
                  rate,
                  gst_rate,
                  discount,
                  base_amount,
                  taxable_amount,
                  gst_amount,
                  cgst_amount,
                  sgst_amount,
                  igst_amount,
                  cess_amount,
                  hsn_sac_code,
                  amount,
                  inventory_unit_cost,
                  inventory_cost_amount
                )
              `
            )
            .eq("company_id", companyId)
            .order("purchase_date", { ascending: false })
            .order("created_at", { ascending: false }),

          supabase
            .from("products")
            .select("id, quantity")
            .eq("company_id", companyId),

          supabase
            .from("debit_notes")
            .select(
              `
                id,
                source_purchase_id,
                debit_note_number,
                debit_note_date,
                reason,
                subtotal,
                gst_total,
                cgst_total,
                sgst_total,
                igst_total,
                cess_total,
                place_of_supply,
                place_of_supply_code,
                tax_type,
                grand_total,
                inventory_cost_total,
                variance_total,
                status,
                void_reason,
                created_at,
                debit_note_items(
                  id,
                  source_purchase_item_id,
                  product_id,
                  product_name,
                  quantity,
                  base_amount,
                  discount,
                  taxable_amount,
                  gst_amount,
                  cgst_amount,
                  sgst_amount,
                  igst_amount,
                  cess_amount,
                  hsn_sac_code,
                  amount,
                  inventory_cost_amount
                )
              `
            )
            .eq("company_id", companyId)
            .order("debit_note_date", { ascending: false })
            .order("created_at", { ascending: false }),
        ]);

      if (purchaseResponse.error) {
        throw purchaseResponse.error;
      }

      if (productResponse.error) {
        throw productResponse.error;
      }

      if (noteResponse.error) {
        throw noteResponse.error;
      }

      setPurchases(
        (purchaseResponse.data || []) as unknown as PurchaseRow[]
      );
      setProducts((productResponse.data || []) as ProductRow[]);
      setDebitNotes(
        (noteResponse.data || []) as unknown as DebitNoteRow[]
      );
    } catch (error) {
      setPurchases([]);
      setProducts([]);
      setDebitNotes([]);

      showMessage(
        error instanceof Error
          ? error.message
          : "Debit note data could not be loaded."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();

    const refreshEvents = [
      "vertexerp-purchases-updated",
      "vertexerp-products-updated",
      "vertexerp-active-company-updated",
    ];

    refreshEvents.forEach((eventName) => {
      window.addEventListener(eventName, loadData);
    });

    return () => {
      refreshEvents.forEach((eventName) => {
        window.removeEventListener(eventName, loadData);
      });
    };
  }, []);

  const purchaseById = useMemo(() => {
    const map = new Map<string, PurchaseRow>();

    purchases.forEach((purchase) => {
      map.set(purchase.id, purchase);
    });

    return map;
  }, [purchases]);

  const productStockById = useMemo(() => {
    const map = new Map<string, number>();

    products.forEach((product) => {
      map.set(product.id, toNumber(product.quantity));
    });

    return map;
  }, [products]);

  const returnedBySourceItem = useMemo(() => {
    const map = new Map<string, ReturnedAmounts>();

    debitNotes
      .filter((note) => note.status === "POSTED")
      .forEach((note) => {
        (note.debit_note_items || []).forEach((item) => {
          const current = map.get(item.source_purchase_item_id) || {
            quantity: 0,
            baseAmount: 0,
            discount: 0,
            gstAmount: 0,
            cgstAmount: 0,
            sgstAmount: 0,
            igstAmount: 0,
            cessAmount: 0,
            amount: 0,
          };

          map.set(item.source_purchase_item_id, {
            quantity: current.quantity + toNumber(item.quantity),
            baseAmount: current.baseAmount + toNumber(item.base_amount),
            discount: current.discount + toNumber(item.discount),
            gstAmount:
              current.gstAmount + toNumber(item.gst_amount),
            cgstAmount:
              current.cgstAmount + toNumber(item.cgst_amount),
            sgstAmount:
              current.sgstAmount + toNumber(item.sgst_amount),
            igstAmount:
              current.igstAmount + toNumber(item.igst_amount),
            cessAmount:
              current.cessAmount + toNumber(item.cess_amount),
            amount: current.amount + toNumber(item.amount),
          });
        });
      });

    return map;
  }, [debitNotes]);

  const selectedPurchase = selectedPurchaseId
    ? purchaseById.get(selectedPurchaseId) || null
    : null;

  const selectedSupplier = selectedPurchase
    ? getJoinedLedger(selectedPurchase.supplier)
    : null;

  const totals = useMemo(() => {
    return returnLines.reduce(
      (sum, line) => {
        const returnQuantity = Math.min(
          toNumber(line.returnQuantity),
          line.maxReturnQuantity
        );

        const amounts = calculateReturnAmounts(line, returnQuantity);

        return {
          subtotal: sum.subtotal + amounts.taxableAmount,
          gstTotal: sum.gstTotal + amounts.gstAmount,
          cgstTotal: sum.cgstTotal + amounts.cgstAmount,
          sgstTotal: sum.sgstTotal + amounts.sgstAmount,
          igstTotal: sum.igstTotal + amounts.igstAmount,
          cessTotal: sum.cessTotal + amounts.cessAmount,
          grandTotal: sum.grandTotal + amounts.amount,
          itemCount:
            returnQuantity > 0 ? sum.itemCount + 1 : sum.itemCount,
        };
      },
      {
        subtotal: 0,
        gstTotal: 0,
        cgstTotal: 0,
        sgstTotal: 0,
        igstTotal: 0,
        cessTotal: 0,
        grandTotal: 0,
        itemCount: 0,
      }
    );
  }, [returnLines]);

  function handlePurchaseChange(nextPurchaseId: string) {
    setSelectedPurchaseId(nextPurchaseId);

    const purchase = purchaseById.get(nextPurchaseId) || null;

    if (!purchase) {
      setReturnLines([]);
      return;
    }

    setReturnLines(
      (purchase.purchase_items || []).map((item) => {
        const originalQuantity = toNumber(item.quantity);
        const returned = returnedBySourceItem.get(item.id) || {
          quantity: 0,
          baseAmount: 0,
          discount: 0,
          gstAmount: 0,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 0,
          cessAmount: 0,
          amount: 0,
        };

        const remainingQuantity = Math.max(
          0,
          Number((originalQuantity - returned.quantity).toFixed(3))
        );

        const currentStock = item.product_id
          ? productStockById.get(item.product_id) || 0
          : 0;

        return {
          sourcePurchaseItemId: item.id,
          productId: item.product_id || "",
          productName: item.product_name || "Product",
          originalQuantity,
          remainingQuantity,
          currentStock,
          maxReturnQuantity: Math.min(remainingQuantity, currentStock),
          rate: toNumber(item.rate),
          gstRate: toNumber(item.gst_rate),
          originalBaseAmount: toNumber(item.base_amount),
          originalDiscount: toNumber(item.discount),
          hsnSacCode: item.hsn_sac_code || "",
          originalTaxableAmount:
            toNumber(item.taxable_amount) ||
            Math.max(
              0,
              toNumber(item.base_amount) -
                toNumber(item.discount)
            ),
          originalGstAmount: toNumber(item.gst_amount),
          originalCgstAmount: toNumber(item.cgst_amount),
          originalSgstAmount: toNumber(item.sgst_amount),
          originalIgstAmount: toNumber(item.igst_amount),
          originalCessAmount: toNumber(item.cess_amount),
          remainingBaseAmount: Math.max(
            0,
            Number(
              (toNumber(item.base_amount) - returned.baseAmount).toFixed(2)
            )
          ),
          remainingDiscount: Math.max(
            0,
            Number(
              (toNumber(item.discount) - returned.discount).toFixed(2)
            )
          ),
          remainingGstAmount: Math.max(
            0,
            Number(
              (toNumber(item.gst_amount) - returned.gstAmount).toFixed(2)
            )
          ),
          remainingCgstAmount: Math.max(
            0,
            Number(
              (
                toNumber(item.cgst_amount) -
                returned.cgstAmount
              ).toFixed(2)
            )
          ),
          remainingSgstAmount: Math.max(
            0,
            Number(
              (
                toNumber(item.sgst_amount) -
                returned.sgstAmount
              ).toFixed(2)
            )
          ),
          remainingIgstAmount: Math.max(
            0,
            Number(
              (
                toNumber(item.igst_amount) -
                returned.igstAmount
              ).toFixed(2)
            )
          ),
          remainingCessAmount: Math.max(
            0,
            Number(
              (
                toNumber(item.cess_amount) -
                returned.cessAmount
              ).toFixed(2)
            )
          ),
          remainingAmount: Math.max(
            0,
            Number(
              (toNumber(item.amount) - returned.amount).toFixed(2)
            )
          ),
          returnQuantity: "",
        };
      })
    );
  }

  function updateReturnQuantity(index: number, value: string) {
    setReturnLines((currentLines) =>
      currentLines.map((line, lineIndex) => {
        if (lineIndex !== index) {
          return line;
        }

        const numericValue = Math.max(0, toNumber(value));

        return {
          ...line,
          returnQuantity:
            value === ""
              ? ""
              : String(Math.min(numericValue, line.maxReturnQuantity)),
        };
      })
    );
  }

  function fillMaximumReturn(index: number) {
    setReturnLines((currentLines) =>
      currentLines.map((line, lineIndex) =>
        lineIndex === index
          ? {
              ...line,
              returnQuantity: String(line.maxReturnQuantity),
            }
          : line
      )
    );
  }

  function resetForm() {
    setSelectedPurchaseId("");
    setDebitNoteNumber(generateDebitNoteNumber());
    setDebitNoteDate(getTodayDate());
    setReason("");
    setReturnLines([]);
  }

  async function createDebitNote() {
    if (!activeCompanyId) {
      showMessage("Select an active company first.");
      return;
    }

    if (!selectedPurchase) {
      showMessage("Select a source purchase bill.");
      return;
    }

    if (!isCostingEnabledPurchase(selectedPurchase)) {
      showMessage(
        "This bill was recorded before weighted-average costing was enabled. Debit note is blocked for safety."
      );
      return;
    }

    if (!debitNoteNumber.trim()) {
      showMessage("Debit note number is required.");
      return;
    }

    if (!debitNoteDate) {
      showMessage("Debit note date is required.");
      return;
    }

    if (!reason.trim()) {
      showMessage("Debit note reason is required.");
      return;
    }

    const payloadItems = returnLines
      .map((line) => ({
        source_purchase_item_id: line.sourcePurchaseItemId,
        product_id: line.productId,
        quantity: Math.min(
          toNumber(line.returnQuantity),
          line.maxReturnQuantity
        ),
      }))
      .filter((item) => item.quantity > 0);

    if (payloadItems.length === 0) {
      showMessage("Enter return quantity for at least one item.");
      return;
    }

    setIsSaving(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.rpc(
        "create_debit_note_with_stock",
        {
          p_company_id: activeCompanyId,
          p_source_purchase_id: selectedPurchase.id,
          p_debit_note_number: debitNoteNumber.trim(),
          p_debit_note_date: debitNoteDate,
          p_reason: reason.trim(),
          p_items: payloadItems,
        }
      );

      if (error) {
        throw error;
      }

      showMessage("Debit note posted successfully.");
      resetForm();
      await loadData();

      window.dispatchEvent(
        new Event("vertexerp-purchases-updated")
      );
      window.dispatchEvent(
        new Event("vertexerp-products-updated")
      );
      window.dispatchEvent(
        new Event("vertexerp-gst-data-updated")
      );
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Debit note could not be saved."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function voidDebitNote(note: DebitNoteRow) {
    const voidReason = window.prompt(
      `Enter a reason to void ${note.debit_note_number}:`
    );

    if (!voidReason?.trim()) {
      return;
    }

    setIsSaving(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.rpc(
        "void_debit_note_with_stock",
        {
          p_debit_note_id: note.id,
          p_void_reason: voidReason.trim(),
        }
      );

      if (error) {
        throw error;
      }

      showMessage("Debit note voided successfully.");
      await loadData();

      window.dispatchEvent(
        new Event("vertexerp-purchases-updated")
      );
      window.dispatchEvent(
        new Event("vertexerp-products-updated")
      );
      window.dispatchEvent(
        new Event("vertexerp-gst-data-updated")
      );
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Debit note could not be voided."
      );
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
              Debit Notes
            </h2>

            <p className="mt-1 text-sm text-slate-600 sm:text-base">
              Return purchased goods without deleting supplier bills. Debit
              notes reduce stock, inventory value, Input GST and supplier
              payable.
            </p>
          </div>

          <div className="rounded-full bg-violet-50 px-4 py-2 text-sm font-bold text-violet-700">
            Purchase Return Safe
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
          <h3 className="text-xl font-bold text-slate-900">
            Create Debit Note
          </h3>

          <p className="mt-1 text-sm text-slate-600">
            Select a costing-enabled purchase bill and enter returned
            quantities.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <label className="mb-2 block font-semibold text-slate-800">
                Source Purchase Bill
              </label>

              <select
                value={selectedPurchaseId}
                onChange={(event) =>
                  handlePurchaseChange(event.target.value)
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              >
                <option value="">Select bill</option>

                {purchases.map((purchase) => {
                  const supplier = getJoinedLedger(purchase.supplier);
                  const disabled =
                    !isCostingEnabledPurchase(purchase);

                  return (
                    <option
                      key={purchase.id}
                      value={purchase.id}
                      disabled={disabled}
                    >
                      {purchase.bill_number} ·{" "}
                      {formatDate(purchase.purchase_date)} ·{" "}
                      {supplier?.name || "Supplier"}
                      {disabled ? " · Legacy bill" : ""}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="mb-2 block font-semibold text-slate-800">
                Debit Note Number
              </label>

              <input
                value={debitNoteNumber}
                onChange={(event) =>
                  setDebitNoteNumber(event.target.value)
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-2 block font-semibold text-slate-800">
                Debit Note Date
              </label>

              <input
                type="date"
                value={debitNoteDate}
                onChange={(event) =>
                  setDebitNoteDate(event.target.value)
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="mb-2 block font-semibold text-slate-800">
                Reason
              </label>

              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                placeholder="Goods returned to supplier"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </div>

          {selectedPurchase && (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-slate-900">
                    {selectedPurchase.bill_number}
                  </p>

                  <p className="text-sm text-slate-600">
                    {selectedSupplier?.name || "Supplier"} ·{" "}
                    {formatDate(selectedPurchase.purchase_date)} ·{" "}
                    {selectedPurchase.payment_mode || "Cash"}
                  </p>

                  <p className="mt-1 text-xs font-semibold text-violet-700">
                    {selectedPurchase.tax_type === "INTRA_STATE"
                      ? "Intra-State Return · Input CGST + SGST Reverse"
                      : selectedPurchase.tax_type === "INTER_STATE"
                        ? "Inter-State Return · Input IGST Reverse"
                        : selectedPurchase.tax_type === "EXEMPT"
                          ? "Exempt / Nil GST Return"
                          : "GST Classification Pending"}
                  </p>
                </div>

                <Link
                  href={`/purchase/bill/${selectedPurchase.id}`}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:w-auto"
                >
                  Open Bill
                </Link>
              </div>
            </div>
          )}

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <p className="font-bold text-slate-900">
                Purchase Return Items
              </p>

              <p className="mt-1 text-sm text-slate-600">
                Maximum return is limited by both bill balance and current
                stock.
              </p>
            </div>

            <div className="p-4">
              {!selectedPurchaseId ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  Select a purchase bill to load returnable items.
                </p>
              ) : returnLines.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  No returnable items are available for this bill.
                </p>
              ) : (
                <div className="space-y-4">
                  {returnLines.map((line, index) => {
                    const returnQuantity = Math.min(
                      toNumber(line.returnQuantity),
                      line.maxReturnQuantity
                    );

                    const amounts = calculateReturnAmounts(
                      line,
                      returnQuantity
                    );

                    return (
                      <div
                        key={line.sourcePurchaseItemId}
                        className="rounded-2xl border border-slate-200 bg-white p-4"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900">
                              {line.productName}
                            </p>

                            <p className="mt-1 text-sm text-slate-600">
                              Purchased:{" "}
                              {formatQuantity(line.originalQuantity)} ·
                              Bill balance:{" "}
                              {formatQuantity(line.remainingQuantity)} ·
                              Current stock:{" "}
                              {formatQuantity(line.currentStock)}
                            </p>

                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              HSN: {line.hsnSacCode || "Pending"} · GST:{" "}
                              {line.gstRate}%
                            </p>

                            {line.currentStock <
                              line.remainingQuantity && (
                              <p className="mt-2 text-xs font-semibold text-amber-700">
                                Some purchased stock has already been sold or
                                adjusted. Maximum return is{" "}
                                {formatQuantity(
                                  line.maxReturnQuantity
                                )}.
                              </p>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              fillMaximumReturn(index)
                            }
                            disabled={line.maxReturnQuantity <= 0}
                            className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Return Maximum
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
                              max={line.maxReturnQuantity}
                              step="0.001"
                              value={line.returnQuantity}
                              onChange={(event) =>
                                updateReturnQuantity(
                                  index,
                                  event.target.value
                                )
                              }
                              disabled={line.maxReturnQuantity <= 0}
                              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-700">
                              Return Amount
                            </label>

                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-slate-900">
                              {formatCurrency(amounts.amount)}
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
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Taxable Return
              </p>

              <p className="mt-1 text-xl font-bold text-slate-900">
                {formatCurrency(totals.subtotal)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Input GST Reverse
              </p>

              <p className="mt-1 text-xl font-bold text-slate-900">
                {formatCurrency(totals.gstTotal)}
              </p>
            </div>

            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-violet-700">
                Debit Total
              </p>

              <p className="mt-1 text-xl font-bold text-violet-700">
                {formatCurrency(totals.grandTotal)}
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <GstSummaryCard
              label="Taxable Return"
              value={totals.subtotal}
            />
            <GstSummaryCard
              label="Input CGST Reverse"
              value={totals.cgstTotal}
            />
            <GstSummaryCard
              label="Input SGST Reverse"
              value={totals.sgstTotal}
            />
            <GstSummaryCard
              label="Input IGST Reverse"
              value={totals.igstTotal}
            />
          </div>

          <button
            type="button"
            onClick={createDebitNote}
            disabled={
              isSaving ||
              isLoading ||
              totals.itemCount === 0
            }
            className="mt-5 w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Post Debit Note"}
          </button>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-lg">
          <div className="border-b border-slate-200 p-4 sm:p-6">
            <h3 className="text-xl font-bold text-slate-900">
              Debit Note History
            </h3>

            <p className="mt-1 text-sm text-slate-600">
              Posted purchase returns can be voided with an audit reason.
            </p>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[980px]">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-left">
                  <th className="px-6 py-4 text-sm font-bold text-slate-700">
                    Debit Note
                  </th>

                  <th className="px-6 py-4 text-sm font-bold text-slate-700">
                    Source Bill
                  </th>

                  <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">
                    Debit Total
                  </th>

                  <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">
                    Inventory Removed
                  </th>

                  <th className="px-6 py-4 text-sm font-bold text-slate-700">
                    Status
                  </th>

                  <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-slate-500"
                    >
                      Loading debit notes...
                    </td>
                  </tr>
                ) : debitNotes.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-slate-500"
                    >
                      No debit notes created yet.
                    </td>
                  </tr>
                ) : (
                  debitNotes.map((note) => {
                    const purchase = purchaseById.get(
                      note.source_purchase_id
                    );

                    return (
                      <tr
                        key={note.id}
                        className="border-b border-slate-100 transition hover:bg-blue-50"
                      >
                        <td className="px-6 py-5">
                          <p className="font-bold text-slate-900">
                            {note.debit_note_number}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {formatDate(note.debit_note_date)}
                          </p>
                        </td>

                        <td className="px-6 py-5">
                          {purchase ? (
                            <Link
                              href={`/purchase/bill/${purchase.id}`}
                              className="font-semibold text-blue-600 transition hover:text-blue-800 hover:underline"
                            >
                              {purchase.bill_number}
                            </Link>
                          ) : (
                            <span className="text-slate-600">
                              Purchase Bill
                            </span>
                          )}

                          <p className="mt-1 text-xs text-slate-500">
                            {note.reason}
                          </p>
                        </td>

                        <td className="px-6 py-5 text-right font-bold text-violet-700">
                          {formatCurrency(
                            toNumber(note.grand_total)
                          )}
                          <p className="mt-1 text-[11px] font-semibold text-slate-500">
                            CGST {formatCurrency(toNumber(note.cgst_total))} ·
                            SGST {formatCurrency(toNumber(note.sgst_total))} ·
                            IGST {formatCurrency(toNumber(note.igst_total))}
                          </p>
                        </td>

                        <td className="px-6 py-5 text-right font-bold text-amber-700">
                          {formatCurrency(
                            toNumber(note.inventory_cost_total)
                          )}
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
                            onClick={() => voidDebitNote(note)}
                            disabled={
                              note.status !== "POSTED" ||
                              isSaving
                            }
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
              <p className="py-10 text-center text-sm text-slate-500">
                Loading debit notes...
              </p>
            ) : debitNotes.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">
                No debit notes created yet.
              </p>
            ) : (
              <div className="space-y-4">
                {debitNotes.map((note) => {
                  const purchase = purchaseById.get(
                    note.source_purchase_id
                  );

                  return (
                    <article
                      key={note.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-bold text-slate-900">
                            {note.debit_note_number}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {formatDate(note.debit_note_date)} ·{" "}
                            {purchase?.bill_number ||
                              "Purchase Bill"}
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

                      <p className="mt-3 text-sm text-slate-700">
                        {note.reason}
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-white p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Debit Total
                          </p>

                          <p className="font-bold text-slate-900">
                            {formatCurrency(
                              toNumber(note.grand_total)
                            )}
                          </p>
                          <p className="mt-1 text-[10px] font-semibold text-slate-500">
                            CGST {formatCurrency(toNumber(note.cgst_total))} ·
                            SGST {formatCurrency(toNumber(note.sgst_total))} ·
                            IGST {formatCurrency(toNumber(note.igst_total))}
                          </p>
                        </div>

                        <div className="rounded-xl bg-white p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Inventory Removed
                          </p>

                          <p className="font-bold text-slate-900">
                            {formatCurrency(
                              toNumber(
                                note.inventory_cost_total
                              )
                            )}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => voidDebitNote(note)}
                        disabled={
                          note.status !== "POSTED" ||
                          isSaving
                        }
                        className="mt-4 w-full rounded-xl border border-red-200 bg-white px-4 py-2 font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Void Debit Note
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


function GstSummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-violet-700">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-violet-800">
        {formatCurrency(value)}
      </p>
    </div>
  );
}