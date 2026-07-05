"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type SalesItem = {
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
  items: SalesItem[];
  subtotal: number;
  gstTotal: number;
  discountTotal: number;
  grandTotal: number;
  createdAt: string;
};

type ProfileRow = {
  active_company_id: string | null;
};

type CustomerRow = {
  id: string;
  name: string;
  mobile: string | null;
  gst_number: string | null;
};

type SaleRow = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  payment_mode: string;
  customer_id: string | null;
  subtotal: number | string | null;
  gst_total: number | string | null;
  discount_total: number | string | null;
  grand_total: number | string | null;
  created_at: string;
  customer: CustomerRow | CustomerRow[] | null;
  sale_items:
    | {
        product_id: string | null;
        product_name: string;
        quantity: number | string | null;
        rate: number | string | null;
        gst_rate: number | string | null;
        discount: number | string | null;
        base_amount: number | string | null;
        gst_amount: number | string | null;
        amount: number | string | null;
      }[]
    | null;
};

function getCustomer(customer: SaleRow["customer"]): CustomerRow | null {
  return Array.isArray(customer) ? customer[0] || null : customer;
}

function mapSaleRow(row: SaleRow): Sale {
  const customer = getCustomer(row.customer);

  return {
    id: row.id,
    invoiceNumber: row.invoice_number || "",
    date: row.invoice_date || "",
    paymentMode: row.payment_mode || "Cash",
    customerId: row.customer_id || customer?.id || "",
    customerName: customer?.name || "Unknown Customer",
    customerMobile: customer?.mobile || "",
    customerGst: customer?.gst_number || "",
    items: (row.sale_items || []).map((item) => ({
      productId: item.product_id || "",
      productName: item.product_name || "Product",
      quantity: Number(item.quantity || 0),
      rate: Number(item.rate || 0),
      gst: Number(item.gst_rate || 0),
      discount: Number(item.discount || 0),
      baseAmount: Number(item.base_amount || 0),
      gstAmount: Number(item.gst_amount || 0),
      amount: Number(item.amount || 0),
    })),
    subtotal: Number(row.subtotal || 0),
    gstTotal: Number(row.gst_total || 0),
    discountTotal: Number(row.discount_total || 0),
    grandTotal: Number(row.grand_total || 0),
    createdAt: row.created_at || "",
  };
}

export default function SalesInvoiceTable() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(""), 4000);
  }

  async function loadSales() {
    setIsLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setSales([]);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("active_company_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      const activeCompanyId =
        (profile as ProfileRow | null)?.active_company_id || null;

      if (!activeCompanyId) {
        setSales([]);
        return;
      }

      const { data, error } = await supabase
        .from("sales")
        .select(
          `
            id,
            invoice_number,
            invoice_date,
            payment_mode,
            customer_id,
            subtotal,
            gst_total,
            discount_total,
            grand_total,
            created_at,
            customer:ledgers!sales_customer_id_fkey(
              id,
              name,
              mobile,
              gst_number
            ),
            sale_items(
              product_id,
              product_name,
              quantity,
              rate,
              gst_rate,
              discount,
              base_amount,
              gst_amount,
              amount
            )
          `
        )
        .eq("company_id", activeCompanyId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setSales(((data || []) as unknown as SaleRow[]).map(mapSaleRow));
    } catch (error) {
      setSales([]);
      showMessage(
        error instanceof Error ? error.message : "Invoices could not be loaded."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadSales();

    window.addEventListener("vertexerp-sales-updated", loadSales);
    window.addEventListener("vertexerp-active-company-updated", loadSales);

    return () => {
      window.removeEventListener("vertexerp-sales-updated", loadSales);
      window.removeEventListener("vertexerp-active-company-updated", loadSales);
    };
  }, []);

  async function deleteInvoice(invoice: Sale) {
    const shouldDelete = window.confirm(
      `Delete invoice ${invoice.invoiceNumber}? Product stock will be restored.`
    );

    if (!shouldDelete) return;

    try {
      const supabase = createClient();

      const { error } = await supabase.rpc("delete_sale_with_stock", {
        p_sale_id: invoice.id,
      });

      if (error) throw error;

      setSales((currentSales) =>
        currentSales.filter((sale) => sale.id !== invoice.id)
      );

      window.dispatchEvent(new Event("vertexerp-sales-updated"));
      window.dispatchEvent(new Event("vertexerp-products-updated"));
      showMessage("Invoice deleted and product stock restored.");
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : "Invoice could not be deleted."
      );
    }
  }

  function getPaymentStatus(paymentMode: string) {
    return paymentMode.trim().toLowerCase() === "credit"
      ? { label: "Pending", className: "bg-orange-100 text-orange-700" }
      : { label: "Paid", className: "bg-green-100 text-green-700" };
  }

  return (
    <div className="mt-10 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-8 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Recent Sales Invoices
          </h2>
          <p className="mt-1 text-slate-600">
            View saved invoices, customer details and payment status.
          </p>
        </div>

        <div className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
          Total Invoices: {sales.length}
        </div>
      </div>

      {message && (
        <div className="mx-6 mt-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 font-medium text-blue-700">
          {message}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px]">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200 text-left">
              <th className="px-6 py-4 text-sm font-bold text-slate-700">Invoice No.</th>
              <th className="px-6 py-4 text-sm font-bold text-slate-700">Customer</th>
              <th className="px-6 py-4 text-sm font-bold text-slate-700">Date</th>
              <th className="px-6 py-4 text-sm font-bold text-slate-700">Payment Mode</th>
              <th className="px-6 py-4 text-sm font-bold text-slate-700">Amount</th>
              <th className="px-6 py-4 text-sm font-bold text-slate-700">Status</th>
              <th className="px-6 py-4 text-sm font-bold text-slate-700">Action</th>
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                  Loading sales invoices from the cloud database...
                </td>
              </tr>
            ) : sales.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                  <p className="text-lg font-semibold text-slate-700">
                    No sales invoices saved yet
                  </p>
                  <p className="mt-2">Create an invoice using the form above.</p>
                </td>
              </tr>
            ) : (
              sales.map((sale) => {
                const status = getPaymentStatus(sale.paymentMode);

                return (
                  <tr key={sale.id} className="border-b border-slate-100 transition hover:bg-blue-50">
                    <td className="px-6 py-5">
                      <Link
                        href={`/sales/invoice/${sale.id}`}
                        className="font-bold text-blue-600 transition hover:text-blue-800 hover:underline"
                      >
                        {sale.invoiceNumber}
                      </Link>
                      <p className="mt-1 text-xs text-slate-500">
                        {sale.items.length} Item{sale.items.length !== 1 ? "s" : ""}
                      </p>
                    </td>

                    <td className="px-6 py-5">
                      <p className="font-bold text-slate-900">{sale.customerName}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {sale.customerMobile || "No mobile added"}
                      </p>
                    </td>

                    <td className="px-6 py-5 text-slate-700">{sale.date}</td>
                    <td className="px-6 py-5 text-slate-700">{sale.paymentMode}</td>
                    <td className="px-6 py-5 font-bold text-slate-900">
                      ₹{sale.grandTotal.toLocaleString("en-IN")}
                    </td>

                    <td className="px-6 py-5">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${status.className}`}>
                        {status.label}
                      </span>
                    </td>

                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <Link
                          href={`/sales/invoice/${sale.id}`}
                          className="font-semibold text-blue-600 transition hover:text-blue-800"
                        >
                          View
                        </Link>
                        <button
                          type="button"
                          onClick={() => deleteInvoice(sale)}
                          className="font-semibold text-red-500 transition hover:text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}