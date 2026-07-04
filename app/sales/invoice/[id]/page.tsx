"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

type SaleItem = {
  productId: string;
  productName: string;
  quantity: number;
  rate: number;
  gst: number;
  discount: number;
  amount: number;
};

type Sale = {
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

const SALES_KEY = "VertexERP_sales";
const COMPANIES_KEY = "VertexERP_companies";

function formatCurrency(amount: number) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

export default function InvoicePreviewPage() {
  const params = useParams();

  const invoiceId = typeof params.id === "string" ? params.id : "";

  const [invoice, setInvoice] = useState<Sale | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const savedSales = window.localStorage.getItem(SALES_KEY);
      const savedCompanies = window.localStorage.getItem(COMPANIES_KEY);

      const sales: Sale[] = savedSales ? JSON.parse(savedSales) : [];

      const companies: Company[] = savedCompanies
        ? JSON.parse(savedCompanies)
        : [];

      const selectedInvoice = sales.find(
        (sale) => sale.id === invoiceId
      );

      setInvoice(selectedInvoice || null);
      setCompany(companies[0] || null);
    } catch {
      setInvoice(null);
      setCompany(null);
    } finally {
      setIsLoaded(true);
    }
  }, [invoiceId]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen bg-slate-100">
        <Sidebar />

        <div className="flex-1">
          <Navbar />

          <main className="p-8">
            <p className="text-lg font-semibold text-slate-700">
              Loading invoice...
            </p>
          </main>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex min-h-screen bg-slate-100">
        <Sidebar />

        <div className="flex-1">
          <Navbar />

          <main className="p-8">
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-lg">
              <h1 className="text-3xl font-bold text-slate-900">
                Invoice Not Found
              </h1>

              <p className="mt-3 text-slate-600">
                This invoice may have been deleted or is unavailable.
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

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            margin: 12mm;
          }

          .invoice-print-hide {
            display: none !important;
          }

          .invoice-page-root {
            display: block !important;
            min-height: auto !important;
            background: white !important;
          }

          .invoice-main-content {
            padding: 0 !important;
          }

          .invoice-card {
            max-width: none !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      <div className="invoice-page-root flex min-h-screen bg-slate-100">
        <aside className="invoice-print-hide">
          <Sidebar />
        </aside>

        <div className="flex-1">
          <div className="invoice-print-hide">
            <Navbar />
          </div>

          <main className="invoice-main-content p-8">
            <div className="invoice-print-hide mb-6 flex flex-wrap items-center justify-between gap-4">
              <Link
                href="/sales"
                className="inline-block rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                ← Back to Sales
              </Link>

              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-700"
              >
                Print Invoice
              </button>
            </div>

            <section className="invoice-card mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
              <div className="border-b border-slate-200 pb-6">
                <h2 className="text-2xl font-bold text-slate-900">
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

              <div className="flex flex-col gap-6 border-b border-slate-200 py-6 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-bold tracking-[0.2em] text-blue-600">
                    SALES INVOICE
                  </p>

                  <h1 className="mt-3 text-3xl font-bold text-slate-900">
                    {invoice.invoiceNumber}
                  </h1>

                  <p className="mt-2 text-slate-600">
                    Invoice Date: {invoice.date}
                  </p>
                </div>

                <div className="rounded-2xl bg-blue-50 px-5 py-4">
                  <p className="text-sm font-semibold text-blue-700">
                    Grand Total
                  </p>

                  <p className="mt-2 text-3xl font-bold text-blue-600">
                    {formatCurrency(invoice.grandTotal)}
                  </p>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2">
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
                        invoice.paymentMode === "Credit"
                          ? "font-bold text-orange-600"
                          : "font-bold text-green-600"
                      }
                    >
                      {invoice.paymentMode === "Credit"
                        ? "Pending"
                        : "Paid"}
                    </span>
                  </p>
                </div>
              </div>

              <div className="mt-8 overflow-x-auto border-y border-slate-200">
                <table className="w-full min-w-[750px]">
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

              <div className="ml-auto mt-6 max-w-sm rounded-2xl bg-slate-50 p-5">
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