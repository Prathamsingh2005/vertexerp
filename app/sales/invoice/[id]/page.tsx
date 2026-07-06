"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";

type SaleItem = {
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

type Invoice = {
  id: string;
  invoiceNumber: string;
  date: string;
  paymentMode: string;
  customerName: string;
  customerMobile: string;
  customerGst: string;
  grandTotal: number;
  items: SaleItem[];
  subtotal: number;
  gstTotal: number;
  discountTotal: number;
};

type Company = {
  id: string;
  name: string;
  address: string;
  gstNumber: string;
  phone: string;
  email: string;
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

type CompanyRow = {
  id: string;
  name: string;
  address: string | null;
  gst_number: string | null;
  phone: string | null;
  email: string | null;
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

function formatCurrency(amount: number) {
  return `₹${Number(amount || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function getCustomer(
  customer: SaleRow["customer"]
): CustomerRow | null {
  return Array.isArray(customer) ? customer[0] || null : customer;
}

function mapInvoice(row: SaleRow): Invoice {
  const customer = getCustomer(row.customer);

  return {
    id: row.id,
    invoiceNumber: row.invoice_number || "",
    date: row.invoice_date || "",
    paymentMode: row.payment_mode || "Cash",
    customerName: customer?.name || "Unknown Customer",
    customerMobile: customer?.mobile || "",
    customerGst: customer?.gst_number || "",
    subtotal: Number(row.subtotal || 0),
    gstTotal: Number(row.gst_total || 0),
    discountTotal: Number(row.discount_total || 0),
    grandTotal: Number(row.grand_total || 0),
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
  };
}

function mapCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    name: row.name || "Your Company Name",
    address: row.address || "",
    gstNumber: row.gst_number || "",
    phone: row.phone || "",
    email: row.email || "",
  };
}

export default function InvoicePreviewPage() {
  const params = useParams();
  const invoiceId =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : "";

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadInvoice() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        if (!invoiceId) {
          setInvoice(null);
          setCompany(null);
          setErrorMessage("Invoice ID is missing.");
          return;
        }

        const supabase = createClient();

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          setInvoice(null);
          setCompany(null);
          setErrorMessage("Please sign in to view this invoice.");
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
          setInvoice(null);
          setCompany(null);
          setErrorMessage(
            "Select an active company from the Companies page first."
          );
          return;
        }

        const [invoiceResponse, companyResponse] = await Promise.all([
          supabase
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
            .eq("id", invoiceId)
            .eq("company_id", activeCompanyId)
            .maybeSingle(),
          supabase
            .from("companies")
            .select("id, name, address, gst_number, phone, email")
            .eq("id", activeCompanyId)
            .maybeSingle(),
        ]);

        if (invoiceResponse.error) {
          throw invoiceResponse.error;
        }

        if (companyResponse.error) {
          throw companyResponse.error;
        }

        if (!invoiceResponse.data) {
          setInvoice(null);
          setCompany(null);
          setErrorMessage(
            "This invoice is unavailable for the currently active company."
          );
          return;
        }

        setInvoice(mapInvoice(invoiceResponse.data as unknown as SaleRow));
        setCompany(
          companyResponse.data
            ? mapCompany(companyResponse.data as CompanyRow)
            : null
        );
      } catch (error) {
        setInvoice(null);
        setCompany(null);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Invoice could not be loaded."
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadInvoice();
  }, [invoiceId]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-slate-100">
        <Sidebar />

        <div className="min-w-0 flex-1">
          <Navbar />

          <main className="p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
            <div className="rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-xl sm:p-10">
              <p className="text-lg font-semibold text-slate-700">
                Loading invoice from the cloud database...
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex min-h-screen bg-slate-100">
        <Sidebar />

        <div className="min-w-0 flex-1">
          <Navbar />

          <main className="p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-lg sm:p-10">
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                Invoice Not Found
              </h1>

              <p className="mt-3 text-slate-600">
                {errorMessage ||
                  "This invoice may have been deleted or is unavailable."}
              </p>

              <Link
                href="/sales"
                className="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
              >
                Back to Sales
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const isCreditPayment =
    invoice.paymentMode.trim().toLowerCase() === "credit";

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
          }

          html,
          body {
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .invoice-print-hide {
            display: none !important;
          }

          .invoice-page-root,
          .invoice-content-root,
          .invoice-main-content {
            display: block !important;
            min-height: auto !important;
            width: 100% !important;
            background: white !important;
          }

          .invoice-main-content {
            margin: 0 !important;
            padding: 0 !important;
          }

          .invoice-card {
            max-width: none !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
          }

          .invoice-table-wrap {
            overflow: visible !important;
          }

          .invoice-table {
            min-width: 0 !important;
            font-size: 10px !important;
          }

          .invoice-table th,
          .invoice-table td {
            padding: 7px !important;
          }
        }
      `}</style>

      <div className="invoice-page-root flex min-h-screen bg-slate-100">
        <aside className="invoice-print-hide">
          <Sidebar />
        </aside>

        <div className="invoice-content-root min-w-0 flex-1">
          <div className="invoice-print-hide">
            <Navbar />
          </div>

          <main className="invoice-main-content p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
            <div className="invoice-print-hide mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <Link
                href="/sales"
                className="w-full rounded-xl border border-slate-300 bg-white px-6 py-3 text-center font-semibold text-slate-700 transition hover:bg-slate-100 sm:w-auto"
              >
                ← Back to Sales
              </Link>

              <button
                type="button"
                onClick={() => window.print()}
                className="w-full rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-700 sm:w-auto"
              >
                Print Invoice
              </button>
            </div>

            <section className="invoice-card mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-4 shadow-xl sm:p-6 lg:p-8">
              <div className="border-b border-slate-200 pb-5 sm:pb-6">
                <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
                  {company?.name || "Your Company Name"}
                </h2>

                <p className="mt-2 text-slate-600">
                  {company?.address || "Company address not available"}
                </p>

                <div className="mt-3 space-y-1 text-sm text-slate-600">
                  <p>
                    <span className="font-semibold text-slate-700">
                      GST Number:
                    </span>{" "}
                    {company?.gstNumber || "Not provided"}
                  </p>

                  <p>
                    <span className="font-semibold text-slate-700">
                      Phone:
                    </span>{" "}
                    {company?.phone || "Not provided"}
                  </p>

                  <p>
                    <span className="font-semibold text-slate-700">
                      Email:
                    </span>{" "}
                    {company?.email || "Not provided"}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-5 border-b border-slate-200 py-5 sm:gap-6 sm:py-6 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-bold tracking-[0.2em] text-blue-600">
                    SALES INVOICE
                  </p>

                  <h1 className="mt-3 break-words text-2xl font-bold text-slate-900 sm:text-3xl">
                    {invoice.invoiceNumber}
                  </h1>

                  <p className="mt-2 text-slate-600">
                    Invoice Date: {invoice.date}
                  </p>
                </div>

                <div className="w-full rounded-2xl bg-blue-50 px-5 py-4 print:border print:border-slate-200 print:bg-white sm:w-auto">
                  <p className="text-sm font-semibold text-blue-700">
                    Grand Total
                  </p>

                  <p className="mt-2 break-words text-2xl font-bold text-blue-600 sm:text-3xl">
                    {formatCurrency(invoice.grandTotal)}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 sm:mt-8 sm:gap-8 md:grid-cols-2">
                <div>
                  <p className="text-sm font-bold uppercase tracking-wider text-slate-500">
                    Customer Details
                  </p>

                  <h2 className="mt-3 text-xl font-bold text-slate-900">
                    {invoice.customerName}
                  </h2>

                  <p className="mt-2 text-slate-600">
                    Mobile: {invoice.customerMobile || "Not provided"}
                  </p>

                  <p className="mt-1 text-slate-600">
                    GST Number: {invoice.customerGst || "Not provided"}
                  </p>
                </div>

                <div className="md:text-right">
                  <p className="text-sm font-bold uppercase tracking-wider text-slate-500">
                    Payment Details
                  </p>

                  <p className="mt-3 text-lg font-semibold text-slate-900">
                    {invoice.paymentMode}
                  </p>

                  <p className="mt-2 text-slate-600">
                    Status:{" "}
                    <span
                      className={
                        isCreditPayment
                          ? "font-bold text-orange-600"
                          : "font-bold text-green-600"
                      }
                    >
                      {isCreditPayment ? "Pending" : "Paid"}
                    </span>
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-4 md:hidden">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900">
                    Invoice Items
                  </h2>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                    {invoice.items.length} Item
                    {invoice.items.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {invoice.items.map((item, index) => (
                  <article
                    key={`${item.productId}-${index}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 break-words text-base font-bold text-slate-900">
                        {item.productName}
                      </p>

                      <p className="shrink-0 text-lg font-bold text-blue-700">
                        {formatCurrency(item.amount)}
                      </p>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-white p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Quantity
                        </p>

                        <p className="mt-1 font-semibold text-slate-800">
                          {item.quantity}
                        </p>
                      </div>

                      <div className="rounded-xl bg-white p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Rate
                        </p>

                        <p className="mt-1 break-words font-semibold text-slate-800">
                          {formatCurrency(item.rate)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-white p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          GST
                        </p>

                        <p className="mt-1 font-semibold text-slate-800">
                          {item.gst}%
                        </p>
                      </div>

                      <div className="rounded-xl bg-white p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Discount
                        </p>

                        <p className="mt-1 break-words font-semibold text-slate-800">
                          {formatCurrency(item.discount)}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className="invoice-table-wrap mt-6 hidden overflow-x-auto border-y border-slate-200 md:block md:mt-8">
                <table className="invoice-table w-full min-w-[750px]">
                  <thead className="bg-slate-50">
                    <tr className="text-left">
                      <th className="px-5 py-4 text-sm font-bold text-slate-700">
                        Product
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

                      <th className="px-5 py-4 text-right text-sm font-bold text-slate-700">
                        Amount
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {invoice.items.map((item, index) => (
                      <tr
                        key={`${item.productId}-${index}`}
                        className="border-t border-slate-100"
                      >
                        <td className="px-5 py-4 font-bold text-slate-900">
                          {item.productName}
                        </td>

                        <td className="px-5 py-4 text-slate-700">
                          {item.quantity}
                        </td>

                        <td className="px-5 py-4 text-slate-700">
                          {formatCurrency(item.rate)}
                        </td>

                        <td className="px-5 py-4 text-slate-700">
                          {item.gst}%
                        </td>

                        <td className="px-5 py-4 text-slate-700">
                          {formatCurrency(item.discount)}
                        </td>

                        <td className="px-5 py-4 text-right font-bold text-slate-900">
                          {formatCurrency(item.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 w-full max-w-sm rounded-2xl bg-slate-50 p-4 print:border print:border-slate-200 print:bg-white sm:ml-auto sm:mt-6 sm:p-5">
                <div className="flex justify-between border-b border-slate-200 pb-3 text-slate-700">
                  <span>Subtotal</span>

                  <span className="font-semibold">
                    {formatCurrency(invoice.subtotal)}
                  </span>
                </div>

                <div className="flex justify-between border-b border-slate-200 py-3 text-slate-700">
                  <span>Total GST</span>

                  <span className="font-semibold">
                    {formatCurrency(invoice.gstTotal)}
                  </span>
                </div>

                <div className="flex justify-between border-b border-slate-200 py-3 text-slate-700">
                  <span>Discount</span>

                  <span className="font-semibold">
                    {formatCurrency(invoice.discountTotal)}
                  </span>
                </div>

                <div className="flex justify-between pt-4">
                  <span className="text-lg font-bold text-slate-900">
                    Grand Total
                  </span>

                  <span className="text-2xl font-bold text-blue-600">
                    {formatCurrency(invoice.grandTotal)}
                  </span>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </>
  );
}