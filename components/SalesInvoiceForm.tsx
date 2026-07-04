"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";

type Product = {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  quantity: number;
  lowStockAlert: number;
  gst: number;
  description: string;
};

type Ledger = {
  id: string;
  name: string;
  group: string;
  openingBalance: number;
  mobile: string;
  email: string;
  gst: string;
  address: string;
};

type SalesItemForm = {
  productId: string;
  quantity: string;
  rate: string;
  gst: string;
  discount: string;
};

type SavedSalesItem = {
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

type Sale = {
  id: string;
  invoiceNumber: string;
  date: string;
  paymentMode: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  customerGst: string;
  items: SavedSalesItem[];
  subtotal: number;
  gstTotal: number;
  discountTotal: number;
  grandTotal: number;
  createdAt: string;
};

const PRODUCTS_KEY = "VertexERP_products";
const LEDGERS_KEY = "VertexERP_ledgers";
const SALES_KEY = "VertexERP_sales";
const SALES_EVENT = "VertexERP-sales-updated";

function createEmptyItem(): SalesItemForm {
  return {
    productId: "",
    quantity: "",
    rate: "",
    gst: "18",
    discount: "0",
  };
}

export default function SalesInvoiceForm() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Ledger[]>([]);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    invoiceNumber: "",
    date: "",
    paymentMode: "Cash",
    customerId: "",
  });

  const [items, setItems] = useState<SalesItemForm[]>([
    createEmptyItem(),
  ]);

  useEffect(() => {
    try {
      const savedProducts = window.localStorage.getItem(PRODUCTS_KEY);
      const savedLedgers = window.localStorage.getItem(LEDGERS_KEY);

      if (savedProducts) {
        const parsedProducts = JSON.parse(savedProducts);

        if (Array.isArray(parsedProducts)) {
          setProducts(parsedProducts);
        }
      }

      if (savedLedgers) {
        const parsedLedgers = JSON.parse(savedLedgers);

        if (Array.isArray(parsedLedgers)) {
          const customerLedgers = parsedLedgers.filter(
            (ledger: Ledger) => ledger.group === "Customer"
          );

          setCustomers(customerLedgers);
        }
      }
    } catch {
      setMessage("Saved data could not be loaded. Please refresh and try again.");
    }
  }, []);

  const calculatedItems = useMemo(() => {
    return items.map((item) => {
      const selectedProduct = products.find(
        (product) => product.id === item.productId
      );

      const quantity = Math.max(0, Number(item.quantity) || 0);
      const rate = Math.max(0, Number(item.rate) || 0);
      const gst = Math.max(0, Number(item.gst) || 0);
      const discount = Math.max(0, Number(item.discount) || 0);

      const baseAmount = quantity * rate;
      const taxableAmount = Math.max(baseAmount - discount, 0);
      const gstAmount = (taxableAmount * gst) / 100;
      const amount = taxableAmount + gstAmount;

      return {
        productId: item.productId,
        productName: selectedProduct?.name || "Select product",
        quantity,
        rate,
        gst,
        discount,
        baseAmount,
        gstAmount,
        amount,
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
            gst: selectedProduct ? String(selectedProduct.gst) : "18",
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
    setItems((currentItems) => [...currentItems, createEmptyItem()]);
  }

  function removeItem(index: number) {
    if (items.length === 1) {
      setMessage("At least one invoice item is required.");
      return;
    }

    setItems((currentItems) =>
      currentItems.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  function resetForm() {
    setForm({
      invoiceNumber: "",
      date: "",
      paymentMode: "Cash",
      customerId: "",
    });

    setItems([createEmptyItem()]);
    setMessage("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

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
      setMessage("Please select an invoice date.");
      return;
    }

    if (!selectedCustomer) {
      setMessage(
        "Please select a customer. Create a ledger with the Customer group from the Ledger page first."
      );
      return;
    }

    if (validItems.length === 0) {
      setMessage("Add at least one valid product with quantity and rate.");
      return;
    }

    const stockError = validItems.find(
      (item) => item.quantity > item.availableStock
    );

    if (stockError) {
      setMessage(
        `Insufficient stock for ${stockError.productName}. Available stock: ${stockError.availableStock}.`
      );
      return;
    }

    const invoiceNumber =
      form.invoiceNumber.trim() ||
      `INV-${Date.now().toString().slice(-6)}`;

    const newSale: Sale = {
      id: crypto.randomUUID(),
      invoiceNumber,
      date: form.date,
      paymentMode: form.paymentMode,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      customerMobile: selectedCustomer.mobile || "",
      customerGst: selectedCustomer.gst || "",
      items: validItems.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        rate: item.rate,
        gst: item.gst,
        discount: item.discount,
        baseAmount: item.baseAmount,
        gstAmount: item.gstAmount,
        amount: item.amount,
      })),
      subtotal: totals.subtotal,
      gstTotal: totals.gstTotal,
      discountTotal: totals.discountTotal,
      grandTotal: totals.grandTotal,
      createdAt: new Date().toISOString(),
    };

    const updatedProducts = products.map((product) => {
      const relatedItems = validItems.filter(
        (item) => item.productId === product.id
      );

      if (relatedItems.length === 0) {
        return product;
      }

      const totalSoldQuantity = relatedItems.reduce(
        (sum, item) => sum + item.quantity,
        0
      );

      return {
        ...product,
        quantity: Math.max(
          0,
          Number(product.quantity || 0) - totalSoldQuantity
        ),
      };
    });

    try {
      const savedSales = window.localStorage.getItem(SALES_KEY);
      const oldSales: Sale[] = savedSales ? JSON.parse(savedSales) : [];

      window.localStorage.setItem(
        SALES_KEY,
        JSON.stringify([newSale, ...oldSales])
      );

      window.localStorage.setItem(
        PRODUCTS_KEY,
        JSON.stringify(updatedProducts)
      );

      setProducts(updatedProducts);
      window.dispatchEvent(new Event(SALES_EVENT));

      resetForm();

      setMessage(
        `Invoice ${invoiceNumber} saved successfully. Product stock updated.`
      );

      window.setTimeout(() => {
        setMessage("");
      }, 3500);
    } catch {
      setMessage("Invoice could not be saved. Please try again.");
    }
  }

  const selectedCustomer = customers.find(
    (customer) => customer.id === form.customerId
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 rounded-3xl border border-slate-100 bg-white p-8 shadow-xl"
    >
      <div className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Create Sales Invoice
          </h2>

          <p className="mt-1 text-slate-600">
            Save customer invoices and automatically reduce product stock.
          </p>
        </div>

        <div className="w-fit rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
          Draft Invoice
        </div>
      </div>

      {message && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 font-medium text-blue-700">
          {message}
        </div>
      )}

      {customers.length === 0 && (
        <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-orange-700">
          No customer ledger found. Create a ledger with the{" "}
          <strong>Customer</strong> group from the Ledger page first.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
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

      <div className="mt-10">
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
            className="w-fit rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 font-semibold text-blue-700 transition hover:bg-blue-100"
          >
            + Add Item
          </button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[1050px]">
            <thead className="bg-slate-50">
              <tr className="text-left">
                <th className="px-5 py-4 text-sm font-bold text-slate-700">
                  Product
                </th>

                <th className="px-5 py-4 text-sm font-bold text-slate-700">
                  Available Stock
                </th>

                <th className="px-5 py-4 text-sm font-bold text-slate-700">
                  Quantity
                </th>

                <th className="px-5 py-4 text-sm font-bold text-slate-700">
                  Rate
                </th>

                <th className="px-5 py-4 text-sm font-bold text-slate-700">
                  GST
                </th>

                <th className="px-5 py-4 text-sm font-bold text-slate-700">
                  Discount
                </th>

                <th className="px-5 py-4 text-sm font-bold text-slate-700">
                  Amount
                </th>

                <th className="px-5 py-4 text-sm font-bold text-slate-700">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {items.map((item, index) => {
                const calculatedItem = calculatedItems[index];

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
                            {product.name} ({product.sku})
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-5 py-4 font-semibold text-slate-700">
                      {calculatedItem.availableStock}
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
                      ₹
                      {calculatedItem.amount.toLocaleString("en-IN", {
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

      <div className="mt-8 ml-auto max-w-md rounded-2xl bg-slate-50 p-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 text-slate-700">
          <span>Subtotal</span>
          <span className="font-semibold">
            ₹{totals.subtotal.toLocaleString("en-IN")}
          </span>
        </div>

        <div className="flex items-center justify-between border-b border-slate-200 py-3 text-slate-700">
          <span>Total GST</span>
          <span className="font-semibold">
            ₹{totals.gstTotal.toLocaleString("en-IN")}
          </span>
        </div>

        <div className="flex items-center justify-between border-b border-slate-200 py-3 text-slate-700">
          <span>Discount</span>
          <span className="font-semibold">
            ₹{totals.discountTotal.toLocaleString("en-IN")}
          </span>
        </div>

        <div className="flex items-center justify-between pt-4">
          <span className="text-lg font-bold text-slate-900">Grand Total</span>
          <span className="text-2xl font-bold text-blue-600">
            ₹{totals.grandTotal.toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-4">
        <button
          type="submit"
          className="rounded-xl bg-blue-600 px-7 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-700 hover:shadow-xl"
        >
          Save Invoice & Update Stock
        </button>

        <button
          type="button"
          onClick={resetForm}
          className="rounded-xl border border-slate-300 bg-white px-7 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          Reset
        </button>
      </div>
    </form>
  );
}