"use client";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";

type Product = {
  id: string;
  name: string;
  sku: string;
  sellingPrice: number;
  quantity: number;
  gst: number;
  hsnSacCode: string;
};

type Customer = {
  id: string;
  name: string;
  mobile: string;
  gst: string;
  state: string;
  stateCode: string;
};

type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  selling_price: number | string | null;
  quantity: number | string | null;
  gst_rate: number | string | null;
  hsn_sac_code: string | null;
  is_service: boolean | null;
};

type LedgerRow = {
  id: string;
  name: string;
  mobile: string | null;
  gst_number: string | null;
  state: string | null;
  state_code: string | null;
};

type CompanyRow = {
  state: string | null;
  state_code: string | null;
};

type ProfileRow = {
  active_company_id: string | null;
};

type SalesItemForm = {
  productId: string;
  quantity: string;
  rate: string;
  gst: string;
  discount: string;
};

type TaxType =
  | "UNCLASSIFIED"
  | "INTRA_STATE"
  | "INTER_STATE"
  | "EXEMPT";

type CalculatedItem = {
  productId: string;
  productName: string;
  hsnSacCode: string;
  quantity: number;
  rate: number;
  gst: number;
  discount: number;
  baseAmount: number;
  taxableAmount: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  amount: number;
  availableStock: number;
};

type EditableSaleItem = {
  productId: string;
  productName: string;
  quantity: number;
  rate: number;
  gst: number;
  discount: number;
  baseAmount: number;
  gstAmount: number;
  amount: number;
};

type EditableSale = {
  id: string;
  invoiceNumber: string;
  date: string;
  paymentMode: string;
  customerId: string;
  customerName: string;
  notes: string;
  items: EditableSaleItem[];
};

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function createEmptyItem(): SalesItemForm {
  return {
    productId: "",
    quantity: "",
    rate: "",
    gst: "18",
    discount: "0",
  };
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number) {
  return `₹${toNumber(value).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name || "",
    sku: row.sku || "",
    sellingPrice: toNumber(row.selling_price),
    quantity: toNumber(row.quantity),
    gst: toNumber(row.gst_rate),
    hsnSacCode: row.hsn_sac_code || "",
  };
}

function mapCustomer(row: LedgerRow): Customer {
  return {
    id: row.id,
    name: row.name || "",
    mobile: row.mobile || "",
    gst: row.gst_number || "",
    state: row.state || "",
    stateCode: row.state_code || "",
  };
}

function getTaxType(
  companyStateCode: string,
  customerStateCode: string,
  gstTotal: number
): TaxType {
  if (gstTotal <= 0) {
    return "EXEMPT";
  }

  if (
    !/^[0-9]{2}$/.test(companyStateCode) ||
    !/^[0-9]{2}$/.test(customerStateCode)
  ) {
    return "UNCLASSIFIED";
  }

  return companyStateCode === customerStateCode
    ? "INTRA_STATE"
    : "INTER_STATE";
}

function getTaxTypeLabel(taxType: TaxType) {
  if (taxType === "INTRA_STATE") {
    return "Intra-State · CGST + SGST";
  }

  if (taxType === "INTER_STATE") {
    return "Inter-State · IGST";
  }

  if (taxType === "EXEMPT") {
    return "Exempt / Nil GST";
  }

  return "GST Setup Pending";
}

export default function SalesInvoiceForm() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(
    null
  );
  const [companyState, setCompanyState] = useState("");
  const [companyStateCode, setCompanyStateCode] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingSale, setEditingSale] =
    useState<EditableSale | null>(null);

  const [form, setForm] = useState({
    invoiceNumber: "",
    date: getToday(),
    paymentMode: "Cash",
    customerId: "",
  });

  const [items, setItems] = useState<SalesItemForm[]>([
    createEmptyItem(),
  ]);

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(""), 5000);
  }

  async function loadFormData() {
    setIsLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setProducts([]);
        setCustomers([]);
        setActiveCompanyId(null);
        setCompanyState("");
        setCompanyStateCode("");
        showMessage("Please sign in before creating an invoice.");
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
        setCustomers([]);
        setCompanyState("");
        setCompanyStateCode("");
        showMessage(
          "Select an active company from the Companies page first."
        );
        return;
      }

      const [
        productsResponse,
        customersResponse,
        companyResponse,
      ] = await Promise.all([
        supabase
          .from("products")
          .select(
            "id, name, sku, selling_price, quantity, gst_rate, hsn_sac_code, is_service"
          )
          .eq("company_id", companyId)
          .eq("is_service", false)
          .order("name"),
        supabase
          .from("ledgers")
          .select(
            "id, name, mobile, gst_number, state, state_code"
          )
          .eq("company_id", companyId)
          .eq("ledger_type", "Customer")
          .order("name"),
        supabase
          .from("companies")
          .select("state, state_code")
          .eq("id", companyId)
          .maybeSingle(),
      ]);

      if (productsResponse.error) {
        throw productsResponse.error;
      }

      if (customersResponse.error) {
        throw customersResponse.error;
      }

      if (companyResponse.error) {
        throw companyResponse.error;
      }

      const company = companyResponse.data as CompanyRow | null;

      setProducts(
        ((productsResponse.data || []) as ProductRow[]).map(
          mapProduct
        )
      );
      setCustomers(
        ((customersResponse.data || []) as LedgerRow[]).map(
          mapCustomer
        )
      );
      setCompanyState(company?.state || "");
      setCompanyStateCode(company?.state_code || "");
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Sales form data could not be loaded."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadFormData();

    const refreshEvents = [
      "vertexerp-active-company-updated",
      "vertexerp-ledgers-updated",
      "vertexerp-products-updated",
    ];

    refreshEvents.forEach((eventName) => {
      window.addEventListener(eventName, loadFormData);
    });

    return () => {
      refreshEvents.forEach((eventName) => {
        window.removeEventListener(eventName, loadFormData);
      });
    };
  }, []);

  useEffect(() => {
    function handleEditSale(event: Event) {
      const sale = (event as CustomEvent<EditableSale>).detail;

      if (!sale?.id) {
        return;
      }

      setEditingSale(sale);
      setForm({
        invoiceNumber: sale.invoiceNumber,
        date: sale.date,
        paymentMode: sale.paymentMode || "Cash",
        customerId: sale.customerId,
      });
      setItems(
        sale.items.length > 0
          ? sale.items.map((item) => ({
              productId: item.productId,
              quantity: String(item.quantity),
              rate: String(item.rate),
              gst: String(item.gst),
              discount: String(item.discount),
            }))
          : [createEmptyItem()]
      );

      window.setTimeout(() => {
        document
          .getElementById("sales-invoice-form")
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      }, 0);
    }

    window.addEventListener("vertexerp-edit-sale", handleEditSale);

    return () => {
      window.removeEventListener(
        "vertexerp-edit-sale",
        handleEditSale
      );
    };
  }, []);

  const selectedCustomer = customers.find(
    (customer) => customer.id === form.customerId
  );

  const editStockCreditByProduct = useMemo(() => {
    const quantityByProduct = new Map<string, number>();

    editingSale?.items.forEach((item) => {
      if (!item.productId) {
        return;
      }

      quantityByProduct.set(
        item.productId,
        (quantityByProduct.get(item.productId) || 0) +
          item.quantity
      );
    });

    return quantityByProduct;
  }, [editingSale]);

  const itemBaseCalculations = useMemo(() => {
    return items.map((item) => {
      const selectedProduct = products.find(
        (product) => product.id === item.productId
      );

      const quantity = Math.max(0, toNumber(item.quantity));
      const rate = Math.max(0, toNumber(item.rate));
      const gst = Math.max(0, toNumber(item.gst));
      const baseAmount = Number((quantity * rate).toFixed(2));
      const discount = Math.min(
        Math.max(0, toNumber(item.discount)),
        baseAmount
      );
      const taxableAmount = Number(
        Math.max(0, baseAmount - discount).toFixed(2)
      );
      const gstAmount = Number(
        ((taxableAmount * gst) / 100).toFixed(2)
      );

      return {
        selectedProduct,
        quantity,
        rate,
        gst,
        discount,
        baseAmount,
        taxableAmount,
        gstAmount,
      };
    });
  }, [items, products]);

  const draftGstTotal = useMemo(
    () =>
      itemBaseCalculations.reduce(
        (total, item) => total + item.gstAmount,
        0
      ),
    [itemBaseCalculations]
  );

  const taxType = getTaxType(
    companyStateCode,
    selectedCustomer?.stateCode || "",
    draftGstTotal
  );

  const calculatedItems = useMemo<CalculatedItem[]>(() => {
    return itemBaseCalculations.map((item, index) => {
      const cgstAmount =
        taxType === "INTRA_STATE"
          ? Number((item.gstAmount / 2).toFixed(2))
          : 0;

      const sgstAmount =
        taxType === "INTRA_STATE"
          ? Number((item.gstAmount - cgstAmount).toFixed(2))
          : 0;

      const igstAmount =
        taxType === "INTER_STATE" ? item.gstAmount : 0;

      return {
        productId: items[index].productId,
        productName:
          item.selectedProduct?.name || "Select product",
        hsnSacCode: item.selectedProduct?.hsnSacCode || "",
        quantity: item.quantity,
        rate: item.rate,
        gst: item.gst,
        discount: item.discount,
        baseAmount: item.baseAmount,
        taxableAmount: item.taxableAmount,
        gstAmount: item.gstAmount,
        cgstAmount,
        sgstAmount,
        igstAmount,
        amount: Number(
          (item.taxableAmount + item.gstAmount).toFixed(2)
        ),
        availableStock:
          (item.selectedProduct?.quantity || 0) +
          (editStockCreditByProduct.get(
            items[index].productId
          ) || 0),
      };
    });
  }, [
    editStockCreditByProduct,
    itemBaseCalculations,
    items,
    taxType,
  ]);

  const totals = useMemo(() => {
    return calculatedItems.reduce(
      (result, item) => ({
        subtotal: result.subtotal + item.baseAmount,
        taxableTotal:
          result.taxableTotal + item.taxableAmount,
        gstTotal: result.gstTotal + item.gstAmount,
        cgstTotal: result.cgstTotal + item.cgstAmount,
        sgstTotal: result.sgstTotal + item.sgstAmount,
        igstTotal: result.igstTotal + item.igstAmount,
        discountTotal:
          result.discountTotal + item.discount,
        grandTotal: result.grandTotal + item.amount,
      }),
      {
        subtotal: 0,
        taxableTotal: 0,
        gstTotal: 0,
        cgstTotal: 0,
        sgstTotal: 0,
        igstTotal: 0,
        discountTotal: 0,
        grandTotal: 0,
      }
    );
  }, [calculatedItems]);

  function updateItem(
    index: number,
    field: keyof SalesItemForm,
    value: string
  ) {
    setItems((currentItems) =>
      currentItems.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        if (field === "productId") {
          const selectedProduct = products.find(
            (product) => product.id === value
          );

          return {
            ...item,
            productId: value,
            rate: selectedProduct
              ? String(selectedProduct.sellingPrice)
              : "",
            gst: selectedProduct
              ? String(selectedProduct.gst)
              : "18",
          };
        }

        return {
          ...item,
          [field]: value,
        };
      })
    );
  }

  function addItem() {
    setItems((currentItems) => [
      ...currentItems,
      createEmptyItem(),
    ]);
  }

  function removeItem(index: number) {
    if (items.length === 1) {
      showMessage("At least one invoice item is required.");
      return;
    }

    setItems((currentItems) =>
      currentItems.filter(
        (_, itemIndex) => itemIndex !== index
      )
    );
  }

  function resetForm() {
    setForm({
      invoiceNumber: "",
      date: getToday(),
      paymentMode: "Cash",
      customerId: "",
    });
    setItems([createEmptyItem()]);
  }

  function cancelSaleEdit() {
    setEditingSale(null);
    resetForm();
  }

  function validateStock(
    validItems: CalculatedItem[]
  ): string | null {
    const requestedByProduct = new Map<string, number>();

    validItems.forEach((item) => {
      requestedByProduct.set(
        item.productId,
        (requestedByProduct.get(item.productId) || 0) +
          item.quantity
      );
    });

    for (const [
      productId,
      requestedQuantity,
    ] of requestedByProduct) {
      const product = products.find(
        (current) => current.id === productId
      );

      if (!product) {
        return "One or more selected products are unavailable.";
      }

      const availableQuantity =
        product.quantity +
        (editStockCreditByProduct.get(productId) || 0);

      if (requestedQuantity > availableQuantity) {
        return `Insufficient stock for ${product.name}. Available: ${availableQuantity}, requested: ${requestedQuantity}.`;
      }
    }

    return null;
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!activeCompanyId) {
      showMessage(
        "Select an active company before saving an invoice."
      );
      return;
    }

    if (!/^[0-9]{2}$/.test(companyStateCode)) {
      showMessage(
        "Complete the active Company State and State Code first."
      );
      return;
    }

    if (!selectedCustomer) {
      showMessage(
        "Please select a Customer ledger."
      );
      return;
    }

    if (!/^[0-9]{2}$/.test(selectedCustomer.stateCode)) {
      showMessage(
        "Complete the selected Customer State and State Code from the Ledger page."
      );
      return;
    }

    if (!form.date) {
      showMessage("Please select an invoice date.");
      return;
    }

    const validItems = calculatedItems.filter(
      (item) =>
        item.productId &&
        item.quantity > 0 &&
        item.rate > 0 &&
        item.productName !== "Select product"
    );

    if (validItems.length === 0) {
      showMessage(
        "Add at least one valid product with quantity and rate."
      );
      return;
    }

    const missingHsnItem = validItems.find(
      (item) => !/^[0-9]{4,8}$/.test(item.hsnSacCode)
    );

    if (missingHsnItem) {
      showMessage(
        `Complete the HSN Code for ${missingHsnItem.productName} from the Inventory page.`
      );
      return;
    }

    if (
      totals.gstTotal > 0 &&
      taxType === "UNCLASSIFIED"
    ) {
      showMessage(
        "GST Type could not be classified. Check Company and Customer State Codes."
      );
      return;
    }

    const stockError = validateStock(validItems);

    if (stockError) {
      showMessage(stockError);
      return;
    }

    const enteredInvoiceNumber =
      form.invoiceNumber.trim();

    if (editingSale && !enteredInvoiceNumber) {
      showMessage(
        "Invoice number is required when editing an invoice."
      );
      return;
    }

    const invoiceNumber =
      enteredInvoiceNumber ||
      `INV-${Date.now().toString().slice(-6)}`;

    const invoiceItems = validItems.map((item) => ({
      product_id: item.productId,
      product_name: item.productName,
      quantity: item.quantity,
      rate: item.rate,
      gst_rate: item.gst,
      discount: item.discount,
      base_amount: item.baseAmount,
      taxable_amount: item.taxableAmount,
      gst_amount: item.gstAmount,
      cgst_amount: item.cgstAmount,
      sgst_amount: item.sgstAmount,
      igst_amount: item.igstAmount,
      cess_amount: 0,
      hsn_sac_code: item.hsnSacCode,
      amount: item.amount,
    }));

    setIsSaving(true);

    try {
      const supabase = createClient();

      const { error } = editingSale
        ? await supabase.rpc("update_sale_with_stock", {
            p_sale_id: editingSale.id,
            p_customer_id: selectedCustomer.id,
            p_invoice_number: invoiceNumber,
            p_invoice_date: form.date,
            p_payment_mode: form.paymentMode,
            p_subtotal: totals.subtotal,
            p_gst_total: totals.gstTotal,
            p_discount_total: totals.discountTotal,
            p_grand_total: totals.grandTotal,
            p_notes: editingSale.notes,
            p_items: invoiceItems,
          })
        : await supabase.rpc("create_sale_with_stock", {
            p_company_id: activeCompanyId,
            p_customer_id: selectedCustomer.id,
            p_invoice_number: invoiceNumber,
            p_invoice_date: form.date,
            p_payment_mode: form.paymentMode,
            p_subtotal: totals.subtotal,
            p_gst_total: totals.gstTotal,
            p_discount_total: totals.discountTotal,
            p_grand_total: totals.grandTotal,
            p_items: invoiceItems,
          });

      if (error) {
        if (error.code === "23505") {
          showMessage(
            `Invoice number "${invoiceNumber}" already exists for this company.`
          );
          return;
        }

        throw error;
      }

      const successMessage = editingSale
        ? `Invoice ${invoiceNumber} updated with ${getTaxTypeLabel(
            taxType
          )} GST snapshots.`
        : `Invoice ${invoiceNumber} saved with ${getTaxTypeLabel(
            taxType
          )} GST snapshots.`;

      setEditingSale(null);
      resetForm();
      await loadFormData();

      window.dispatchEvent(
        new Event("vertexerp-sales-updated")
      );
      window.dispatchEvent(
        new Event("vertexerp-products-updated")
      );
      window.dispatchEvent(
        new Event("vertexerp-gst-data-updated")
      );

      showMessage(successMessage);
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Invoice could not be saved."
      );
    } finally {
      setIsSaving(false);
    }
  }

  const isFormDisabled =
    isLoading || !activeCompanyId || isSaving;

  return (
    <form
      id="sales-invoice-form"
      onSubmit={handleSubmit}
      className="mt-6 rounded-3xl border border-slate-100 bg-white p-4 shadow-xl sm:mt-8 sm:p-6 lg:p-8"
    >
      <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-6 lg:mb-8 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
            {editingSale
              ? "Edit GST Sales Invoice"
              : "Create GST Sales Invoice"}
          </h2>

          <p className="mt-1 text-sm text-slate-600 sm:text-base">
            Automatic Place of Supply, HSN and CGST/SGST or
            IGST snapshots.
          </p>
        </div>

        <div
          className={`w-fit rounded-full px-4 py-2 text-sm font-semibold ${
            editingSale
              ? "bg-amber-50 text-amber-700"
              : "bg-blue-50 text-blue-700"
          }`}
        >
          {editingSale
            ? "Editing Invoice"
            : "GST Classification Active"}
        </div>
      </div>

      {message && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 font-medium text-blue-700">
          {message}
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryBox
            label="Company State"
            value={
              companyStateCode
                ? `${companyState} (${companyStateCode})`
                : "Setup Pending"
            }
          />

          <SummaryBox
            label="Place of Supply"
            value={
              selectedCustomer?.stateCode
                ? `${selectedCustomer.state} (${selectedCustomer.stateCode})`
                : "Select Customer"
            }
          />

          <SummaryBox
            label="GST Type"
            value={getTaxTypeLabel(taxType)}
            valueClassName={
              taxType === "UNCLASSIFIED"
                ? "text-amber-700"
                : taxType === "INTER_STATE"
                  ? "text-violet-700"
                  : "text-emerald-700"
            }
          />
        </div>
      </div>

      {!isLoading &&
        activeCompanyId &&
        !/^[0-9]{2}$/.test(companyStateCode) && (
          <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-orange-700">
            Complete the active company State from the{" "}
            <strong>Companies</strong> page.
          </div>
        )}

      {!isLoading &&
        activeCompanyId &&
        products.length === 0 && (
          <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-orange-700">
            No goods products found. Service invoice support will
            be connected after the inventory-based GST sales flow.
          </div>
        )}

      <fieldset disabled={isFormDisabled}>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          <Field
            label="Invoice Number"
            value={form.invoiceNumber}
            placeholder="Example: INV-0001"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                invoiceNumber: value,
              }))
            }
          />

          <Field
            label="Invoice Date *"
            type="date"
            value={form.date}
            placeholder=""
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                date: value,
              }))
            }
          />

          <SelectField
            label="Payment Mode"
            value={form.paymentMode}
            options={[
              "Cash",
              "UPI",
              "Bank Transfer",
              "Credit",
              "Card",
            ]}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                paymentMode: value,
              }))
            }
          />

          <div>
            <label className="mb-2 block font-semibold text-slate-800">
              Customer Name *
            </label>

            <select
              value={form.customerId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  customerId: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
            >
              <option value="">Select customer</option>

              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                  {customer.stateCode
                    ? ` · ${customer.stateCode}`
                    : " · State Pending"}
                </option>
              ))}
            </select>
          </div>

          <ReadOnlyField
            label="Customer Mobile"
            value={selectedCustomer?.mobile || ""}
            placeholder="Customer mobile"
          />

          <ReadOnlyField
            label="Customer GST Number"
            value={selectedCustomer?.gst || ""}
            placeholder="Unregistered customer"
          />
        </div>

        <div className="mt-8 sm:mt-10">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                Invoice Items
              </h3>

              <p className="mt-1 text-sm text-slate-600">
                HSN and GST rate are loaded from Inventory.
              </p>
            </div>

            <button
              type="button"
              onClick={addItem}
              className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 font-semibold text-blue-700 transition hover:bg-blue-100 sm:w-fit"
            >
              + Add Item
            </button>
          </div>

          <div className="space-y-4 md:hidden">
            {items.map((item, index) => {
              const calculated = calculatedItems[index];

              return (
                <div
                  key={index}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <p className="font-bold text-slate-900">
                      Invoice Item {index + 1}
                    </p>

                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-sm font-semibold text-red-500"
                    >
                      Remove
                    </button>
                  </div>

                  <ProductSelect
                    value={item.productId}
                    products={products}
                    onChange={(value) =>
                      updateItem(index, "productId", value)
                    }
                  />

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <MiniField
                      label="Quantity"
                      value={item.quantity}
                      onChange={(value) =>
                        updateItem(index, "quantity", value)
                      }
                    />

                    <MiniField
                      label="Rate"
                      value={item.rate}
                      onChange={(value) =>
                        updateItem(index, "rate", value)
                      }
                    />

                    <MiniField
                      label="GST %"
                      value={item.gst}
                      onChange={(value) =>
                        updateItem(index, "gst", value)
                      }
                    />

                    <MiniField
                      label="Discount"
                      value={item.discount}
                      onChange={(value) =>
                        updateItem(index, "discount", value)
                      }
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <SummaryBox
                      label="HSN"
                      value={calculated.hsnSacCode || "Pending"}
                    />
                    <SummaryBox
                      label="Available Stock"
                      value={String(calculated.availableStock)}
                    />
                    <SummaryBox
                      label="Taxable"
                      value={formatCurrency(
                        calculated.taxableAmount
                      )}
                    />
                    <SummaryBox
                      label="Item Total"
                      value={formatCurrency(calculated.amount)}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 md:block">
            <table className="w-full min-w-[1200px]">
              <thead className="bg-slate-50">
                <tr className="text-left">
                  {[
                    "Product",
                    "HSN",
                    "Stock",
                    "Qty",
                    "Rate",
                    "GST",
                    "Discount",
                    "Taxable",
                    "Amount",
                    "Action",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="px-4 py-4 text-sm font-bold text-slate-700"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {items.map((item, index) => {
                  const calculated =
                    calculatedItems[index];

                  return (
                    <tr
                      key={index}
                      className="border-t border-slate-200"
                    >
                      <td className="px-4 py-4">
                        <ProductSelect
                          value={item.productId}
                          products={products}
                          onChange={(value) =>
                            updateItem(
                              index,
                              "productId",
                              value
                            )
                          }
                        />
                      </td>

                      <td className="px-4 py-4 font-semibold text-slate-700">
                        {calculated.hsnSacCode || "—"}
                      </td>

                      <td className="px-4 py-4 font-semibold text-slate-700">
                        {calculated.availableStock}
                      </td>

                      <td className="px-4 py-4">
                        <TableInput
                          value={item.quantity}
                          onChange={(value) =>
                            updateItem(
                              index,
                              "quantity",
                              value
                            )
                          }
                        />
                      </td>

                      <td className="px-4 py-4">
                        <TableInput
                          value={item.rate}
                          onChange={(value) =>
                            updateItem(index, "rate", value)
                          }
                        />
                      </td>

                      <td className="px-4 py-4">
                        <TableInput
                          value={item.gst}
                          onChange={(value) =>
                            updateItem(index, "gst", value)
                          }
                        />
                      </td>

                      <td className="px-4 py-4">
                        <TableInput
                          value={item.discount}
                          onChange={(value) =>
                            updateItem(
                              index,
                              "discount",
                              value
                            )
                          }
                        />
                      </td>

                      <td className="px-4 py-4 font-semibold text-slate-700">
                        {formatCurrency(
                          calculated.taxableAmount
                        )}
                      </td>

                      <td className="px-4 py-4 font-bold text-slate-900">
                        {formatCurrency(calculated.amount)}
                      </td>

                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="font-semibold text-red-500"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 max-w-none rounded-2xl bg-slate-50 p-5 sm:mt-8 sm:p-6 md:ml-auto md:max-w-lg">
          <TotalRow
            label="Gross Subtotal"
            value={totals.subtotal}
          />
          <TotalRow
            label="Discount"
            value={totals.discountTotal}
          />
          <TotalRow
            label="Taxable Value"
            value={totals.taxableTotal}
          />

          {taxType === "INTRA_STATE" && (
            <>
              <TotalRow
                label="CGST"
                value={totals.cgstTotal}
              />
              <TotalRow
                label="SGST"
                value={totals.sgstTotal}
              />
            </>
          )}

          {taxType === "INTER_STATE" && (
            <TotalRow
              label="IGST"
              value={totals.igstTotal}
            />
          )}

          <div className="flex items-center justify-between pt-4">
            <span className="text-lg font-bold text-slate-900">
              Grand Total
            </span>

            <span className="text-2xl font-bold text-blue-600">
              {formatCurrency(totals.grandTotal)}
            </span>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:gap-4">
          <button
            type="submit"
            className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-700 sm:w-auto sm:px-7"
          >
            {isSaving
              ? "Saving..."
              : editingSale
                ? "Save GST Invoice Changes"
                : "Save GST Invoice"}
          </button>

          <button
            type="button"
            onClick={
              editingSale ? cancelSaleEdit : resetForm
            }
            className="w-full rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-100 sm:w-auto sm:px-7"
          >
            {editingSale ? "Cancel Edit" : "Reset"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-2 block font-semibold text-slate-800">
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
      />
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
  placeholder,
}: {
  label: string;
  value: string;
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-2 block font-semibold text-slate-800">
        {label}
      </label>

      <input
        value={value}
        readOnly
        placeholder={placeholder}
        className="w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-slate-700"
      />
    </div>
  );
}

function SelectField({
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
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </div>
  );
}

function ProductSelect({
  value,
  products,
  onChange,
}: {
  value: string;
  products: Product[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) =>
        onChange(event.target.value)
      }
      className="w-full min-w-[210px] rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-800 outline-none focus:border-blue-500"
    >
      <option value="">Select product</option>

      {products.map((product) => (
        <option key={product.id} value={product.id}>
          {product.name}
          {product.sku ? ` (${product.sku})` : ""}
          {product.hsnSacCode
            ? ` · HSN ${product.hsnSacCode}`
            : " · HSN Pending"}
        </option>
      ))}
    </select>
  );
}

function MiniField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <input
        type="number"
        min="0"
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
      />
    </div>
  );
}

function TableInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="number"
      min="0"
      value={value}
      onChange={(event) =>
        onChange(event.target.value)
      }
      className="w-24 rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
    />
  );
}

function SummaryBox({
  label,
  value,
  valueClassName = "text-slate-900",
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

      <p
        className={`mt-1 break-words font-bold ${valueClassName}`}
      >
        {value}
      </p>
    </div>
  );
}

function TotalRow({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 py-3 text-slate-700">
      <span>{label}</span>
      <span className="font-semibold">
        {formatCurrency(value)}
      </span>
    </div>
  );
}