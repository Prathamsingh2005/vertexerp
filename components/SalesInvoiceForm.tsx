"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Product = {
  id: string;
  name: string;
  sku: string;
  sellingPrice: number;
  quantity: number;
  gst: number;
};

type Customer = {
  id: string;
  name: string;
  mobile: string;
  gst: string;
};

type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  selling_price: number | string | null;
  quantity: number | string | null;
  gst_rate: number | string | null;
};

type LedgerRow = {
  id: string;
  name: string;
  mobile: string | null;
  gst_number: string | null;
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

type CalculatedItem = {
  productId: string;
  productName: string;
  quantity: number;
  rate: number;
  gst: number;
  discount: number;
  baseAmount: number;
  gstAmount: number;
  amount: number;
  availableStock: number;
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

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name || "",
    sku: row.sku || "",
    sellingPrice: Number(row.selling_price || 0),
    quantity: Number(row.quantity || 0),
    gst: Number(row.gst_rate || 0),
  };
}

function mapCustomer(row: LedgerRow): Customer {
  return {
    id: row.id,
    name: row.name || "",
    mobile: row.mobile || "",
    gst: row.gst_number || "",
  };
}

export default function SalesInvoiceForm() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
    window.setTimeout(() => setMessage(""), 4500);
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
        showMessage("Please sign in before creating an invoice.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("active_company_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      const companyId =
        (profile as ProfileRow | null)?.active_company_id || null;

      setActiveCompanyId(companyId);

      if (!companyId) {
        setProducts([]);
        setCustomers([]);
        showMessage("Select an active company from the Companies page first.");
        return;
      }

      const [productsResponse, customersResponse] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, sku, selling_price, quantity, gst_rate")
          .eq("company_id", companyId)
          .order("name"),
        supabase
          .from("ledgers")
          .select("id, name, mobile, gst_number")
          .eq("company_id", companyId)
          .eq("ledger_type", "Customer")
          .order("name"),
      ]);

      if (productsResponse.error) throw productsResponse.error;
      if (customersResponse.error) throw customersResponse.error;

      setProducts((productsResponse.data || []).map(mapProduct));
      setCustomers((customersResponse.data || []).map(mapCustomer));
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

    window.addEventListener(
      "vertexerp-active-company-updated",
      loadFormData
    );

    return () => {
      window.removeEventListener(
        "vertexerp-active-company-updated",
        loadFormData
      );
    };
  }, []);

  const calculatedItems = useMemo<CalculatedItem[]>(() => {
    return items.map((item) => {
      const selectedProduct = products.find(
        (product) => product.id === item.productId
      );

      const quantity = Math.max(0, Number(item.quantity) || 0);
      const rate = Math.max(0, Number(item.rate) || 0);
      const gst = Math.max(0, Number(item.gst) || 0);
      const discount = Math.max(0, Number(item.discount) || 0);
      const baseAmount = quantity * rate;
      const taxableAmount = Math.max(0, baseAmount - discount);
      const gstAmount = (taxableAmount * gst) / 100;

      return {
        productId: item.productId,
        productName: selectedProduct?.name || "Select product",
        quantity,
        rate,
        gst,
        discount,
        baseAmount,
        gstAmount,
        amount: taxableAmount + gstAmount,
        availableStock: selectedProduct?.quantity || 0,
      };
    });
  }, [items, products]);

  const totals = useMemo(() => {
    return calculatedItems.reduce(
      (result, item) => ({
        subtotal: result.subtotal + item.baseAmount,
        gstTotal: result.gstTotal + item.gstAmount,
        discountTotal: result.discountTotal + item.discount,
        grandTotal: result.grandTotal + item.amount,
      }),
      {
        subtotal: 0,
        gstTotal: 0,
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
        if (itemIndex !== index) return item;

        if (field === "productId") {
          const selectedProduct = products.find(
            (product) => product.id === value
          );

          return {
            ...item,
            productId: value,
            rate: selectedProduct ? String(selectedProduct.sellingPrice) : "",
            gst: selectedProduct ? String(selectedProduct.gst) : "18",
          };
        }

        return { ...item, [field]: value };
      })
    );
  }

  function addItem() {
    setItems((currentItems) => [...currentItems, createEmptyItem()]);
  }

  function removeItem(index: number) {
    if (items.length === 1) {
      showMessage("At least one invoice item is required.");
      return;
    }

    setItems((currentItems) =>
      currentItems.filter((_, itemIndex) => itemIndex !== index)
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

  function validateStock(validItems: CalculatedItem[]): string | null {
    const requestedByProduct = new Map<string, number>();

    validItems.forEach((item) => {
      requestedByProduct.set(
        item.productId,
        (requestedByProduct.get(item.productId) || 0) + item.quantity
      );
    });

    for (const [productId, requestedQuantity] of requestedByProduct) {
      const product = products.find((current) => current.id === productId);

      if (!product) {
        return "One or more selected products are unavailable.";
      }

      if (requestedQuantity > product.quantity) {
        return `Insufficient stock for ${product.name}. Available stock: ${product.quantity}, requested: ${requestedQuantity}.`;
      }
    }

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeCompanyId) {
      showMessage("Select an active company before creating an invoice.");
      return;
    }

    const selectedCustomer = customers.find(
      (customer) => customer.id === form.customerId
    );

    const validItems = calculatedItems.filter(
      (item) =>
        item.productId &&
        item.quantity > 0 &&
        item.rate > 0 &&
        item.productName !== "Select product"
    );

    if (!form.date) {
      showMessage("Please select an invoice date.");
      return;
    }

    if (!selectedCustomer) {
      showMessage(
        "Please select a customer. Create a ledger with the Customer group first."
      );
      return;
    }

    if (validItems.length === 0) {
      showMessage("Add at least one valid product with quantity and rate.");
      return;
    }

    const stockError = validateStock(validItems);
    if (stockError) {
      showMessage(stockError);
      return;
    }

    const invoiceNumber =
      form.invoiceNumber.trim() ||
      `INV-${Date.now().toString().slice(-6)}`;

    setIsSaving(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.rpc("create_sale_with_stock", {
        p_company_id: activeCompanyId,
        p_customer_id: selectedCustomer.id,
        p_invoice_number: invoiceNumber,
        p_invoice_date: form.date,
        p_payment_mode: form.paymentMode,
        p_subtotal: totals.subtotal,
        p_gst_total: totals.gstTotal,
        p_discount_total: totals.discountTotal,
        p_grand_total: totals.grandTotal,
        p_items: validItems.map((item) => ({
          product_id: item.productId,
          product_name: item.productName,
          quantity: item.quantity,
          rate: item.rate,
          gst_rate: item.gst,
          discount: item.discount,
          base_amount: item.baseAmount,
          gst_amount: item.gstAmount,
          amount: item.amount,
        })),
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

      resetForm();
      await loadFormData();

      window.dispatchEvent(new Event("vertexerp-sales-updated"));
      window.dispatchEvent(new Event("vertexerp-products-updated"));

      showMessage(
        `Invoice ${invoiceNumber} saved and product stock updated successfully.`
      );
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : "Invoice could not be saved."
      );
    } finally {
      setIsSaving(false);
    }
  }

  const selectedCustomer = customers.find(
    (customer) => customer.id === form.customerId
  );

  const isFormDisabled = isLoading || !activeCompanyId || isSaving;

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 rounded-3xl border border-slate-100 bg-white p-4 shadow-xl sm:mt-8 sm:p-6 lg:p-8"
    >
      <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-6 lg:mb-8 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
            Create Sales Invoice
          </h2>
          <p className="mt-1 text-sm text-slate-600 sm:text-base">
            Save customer invoices and automatically reduce product stock.
          </p>
        </div>

        <div className="w-fit rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
          Cloud Invoice
        </div>
      </div>

      {message && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 font-medium text-blue-700">
          {message}
        </div>
      )}

      {!isLoading && !activeCompanyId && (
        <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-orange-700">
          Select an active company from the <strong>Companies</strong> page
          before creating an invoice.
        </div>
      )}

      {!isLoading && activeCompanyId && customers.length === 0 && (
        <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-orange-700">
          No customer ledger found. Create a ledger with the{" "}
          <strong>Customer</strong> group from the Ledger page first.
        </div>
      )}

      {!isLoading && activeCompanyId && products.length === 0 && (
        <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-orange-700">
          No products found. Add products from the <strong>Inventory</strong>{" "}
          page first.
        </div>
      )}

      <fieldset disabled={isFormDisabled}>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="mb-2 block font-semibold text-slate-800">
              Invoice Number
            </label>
            <input
              type="text"
              value={form.invoiceNumber}
              onChange={(event) =>
                setForm({ ...form, invoiceNumber: event.target.value })
              }
              placeholder="Example: INV-0001"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-2 block font-semibold text-slate-800">
              Invoice Date *
            </label>
            <input
              type="date"
              value={form.date}
              onChange={(event) =>
                setForm({ ...form, date: event.target.value })
              }
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-2 block font-semibold text-slate-800">
              Payment Mode
            </label>
            <select
              value={form.paymentMode}
              onChange={(event) =>
                setForm({ ...form, paymentMode: event.target.value })
              }
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
            >
              <option>Cash</option>
              <option>UPI</option>
              <option>Bank Transfer</option>
              <option>Credit</option>
              <option>Card</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block font-semibold text-slate-800">
              Customer Name *
            </label>
            <select
              value={form.customerId}
              onChange={(event) =>
                setForm({ ...form, customerId: event.target.value })
              }
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
            >
              <option value="">Select customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block font-semibold text-slate-800">
              Customer Mobile
            </label>
            <input
              type="text"
              value={selectedCustomer?.mobile || ""}
              readOnly
              placeholder="Customer mobile will appear here"
              className="w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-slate-700 placeholder:text-slate-500 outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block font-semibold text-slate-800">
              Customer GST Number
            </label>
            <input
              type="text"
              value={selectedCustomer?.gst || ""}
              readOnly
              placeholder="Customer GST will appear here"
              className="w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-slate-700 placeholder:text-slate-500 outline-none"
            />
          </div>
        </div>

        <div className="mt-8 sm:mt-10">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                Invoice Items
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Select products and enter quantity for this sale.
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
                      className="text-sm font-semibold text-red-500 transition hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Product
                    </label>

                    <select
                      value={item.productId}
                      onChange={(event) =>
                        updateItem(index, "productId", event.target.value)
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-800 outline-none focus:border-blue-500"
                    >
                      <option value="">Select product</option>

                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                          {product.sku ? ` (${product.sku})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-xl bg-white px-4 py-3">
                    <span className="text-sm font-semibold text-slate-600">
                      Available Stock
                    </span>

                    <span className="font-bold text-slate-900">
                      {calculated.availableStock}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Quantity
                      </label>

                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(index, "quantity", event.target.value)
                        }
                        placeholder="0"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Rate
                      </label>

                      <input
                        type="number"
                        min="0"
                        value={item.rate}
                        onChange={(event) =>
                          updateItem(index, "rate", event.target.value)
                        }
                        placeholder="₹ 0"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        GST
                      </label>

                      <select
                        value={item.gst}
                        onChange={(event) =>
                          updateItem(index, "gst", event.target.value)
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-800 outline-none focus:border-blue-500"
                      >
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                        <option value="28">28%</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Discount
                      </label>

                      <input
                        type="number"
                        min="0"
                        value={item.discount}
                        onChange={(event) =>
                          updateItem(index, "discount", event.target.value)
                        }
                        placeholder="₹ 0"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-xl bg-white px-4 py-3">
                    <span className="text-sm font-semibold text-slate-600">
                      Item Amount
                    </span>

                    <span className="font-bold text-slate-900">
                      ₹{calculated.amount.toLocaleString("en-IN", {
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 md:block">
            <table className="w-full min-w-[1050px]">
              <thead className="bg-slate-50">
                <tr className="text-left">
                  <th className="px-5 py-4 text-sm font-bold text-slate-700">Product</th>
                  <th className="px-5 py-4 text-sm font-bold text-slate-700">Available Stock</th>
                  <th className="px-5 py-4 text-sm font-bold text-slate-700">Quantity</th>
                  <th className="px-5 py-4 text-sm font-bold text-slate-700">Rate</th>
                  <th className="px-5 py-4 text-sm font-bold text-slate-700">GST</th>
                  <th className="px-5 py-4 text-sm font-bold text-slate-700">Discount</th>
                  <th className="px-5 py-4 text-sm font-bold text-slate-700">Amount</th>
                  <th className="px-5 py-4 text-sm font-bold text-slate-700">Action</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item, index) => {
                  const calculated = calculatedItems[index];

                  return (
                    <tr key={index} className="border-t border-slate-200">
                      <td className="px-5 py-4">
                        <select
                          value={item.productId}
                          onChange={(event) =>
                            updateItem(index, "productId", event.target.value)
                          }
                          className="w-full min-w-[190px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 outline-none focus:border-blue-500"
                        >
                          <option value="">Select product</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name}
                              {product.sku ? ` (${product.sku})` : ""}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-5 py-4 font-semibold text-slate-700">
                        {calculated.availableStock}
                      </td>

                      <td className="px-5 py-4">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(event) =>
                            updateItem(index, "quantity", event.target.value)
                          }
                          placeholder="0"
                          className="w-24 rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                        />
                      </td>

                      <td className="px-5 py-4">
                        <input
                          type="number"
                          min="0"
                          value={item.rate}
                          onChange={(event) =>
                            updateItem(index, "rate", event.target.value)
                          }
                          placeholder="₹ 0"
                          className="w-28 rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                        />
                      </td>

                      <td className="px-5 py-4">
                        <select
                          value={item.gst}
                          onChange={(event) =>
                            updateItem(index, "gst", event.target.value)
                          }
                          className="w-24 rounded-xl border border-slate-300 px-3 py-2 text-slate-800 outline-none focus:border-blue-500"
                        >
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                          <option value="28">28%</option>
                        </select>
                      </td>

                      <td className="px-5 py-4">
                        <input
                          type="number"
                          min="0"
                          value={item.discount}
                          onChange={(event) =>
                            updateItem(index, "discount", event.target.value)
                          }
                          placeholder="₹ 0"
                          className="w-28 rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                        />
                      </td>

                      <td className="px-5 py-4 font-bold text-slate-900">
                        ₹{calculated.amount.toLocaleString("en-IN", {
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="font-semibold text-red-500 transition hover:text-red-700"
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

        <div className="mt-6 max-w-none rounded-2xl bg-slate-50 p-5 sm:mt-8 sm:p-6 md:ml-auto md:max-w-md">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 text-slate-700">
            <span>Subtotal</span>
            <span className="font-semibold">₹{totals.subtotal.toLocaleString("en-IN")}</span>
          </div>
          <div className="flex items-center justify-between border-b border-slate-200 py-3 text-slate-700">
            <span>Total GST</span>
            <span className="font-semibold">₹{totals.gstTotal.toLocaleString("en-IN")}</span>
          </div>
          <div className="flex items-center justify-between border-b border-slate-200 py-3 text-slate-700">
            <span>Discount</span>
            <span className="font-semibold">₹{totals.discountTotal.toLocaleString("en-IN")}</span>
          </div>
          <div className="flex items-center justify-between pt-4">
            <span className="text-lg font-bold text-slate-900">Grand Total</span>
            <span className="text-2xl font-bold text-blue-600">₹{totals.grandTotal.toLocaleString("en-IN")}</span>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:gap-4">
          <button
            type="submit"
            className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-700 hover:shadow-xl sm:w-auto sm:px-7"
          >
            {isSaving ? "Saving Invoice..." : "Save Invoice & Update Stock"}
          </button>

          <button
            type="button"
            onClick={resetForm}
            className="w-full rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-100 sm:w-auto sm:px-7"
          >
            Reset
          </button>
        </div>
      </fieldset>
    </form>
  );
}