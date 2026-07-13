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
  cessAmount: number;
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
  customerState: string;
  customerStateCode: string;
  placeOfSupply: string;
  placeOfSupplyCode: string;
  taxType: string;
  subtotal: number;
  discountTotal: number;
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  cessTotal: number;
  gstTotal: number;
  grandTotal: number;
  items: SaleItem[];
};

type Company = {
  id: string;
  name: string;
  legalName: string;
  tradeName: string;
  address: string;
  city: string;
  state: string;
  stateCode: string;
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
  state: string | null;
  state_code: string | null;
};

type CompanyRow = {
  id: string;
  name: string;
  legal_name: string | null;
  trade_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  state_code: string | null;
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
  place_of_supply: string | null;
  place_of_supply_code: string | null;
  tax_type: string | null;
  subtotal: number | string | null;
  gst_total: number | string | null;
  discount_total: number | string | null;
  cgst_total: number | string | null;
  sgst_total: number | string | null;
  igst_total: number | string | null;
  cess_total: number | string | null;
  grand_total: number | string | null;
  customer: CustomerRow | CustomerRow[] | null;
  sale_items:
    | {
        product_id: string | null;
        product_name: string;
        hsn_sac_code: string | null;
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
        amount: number | string | null;
      }[]
    | null;
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

function formatDate(value: string) {
  if (!value) {
    return "—";
  }

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

function getCustomer(
  customer: SaleRow["customer"]
): CustomerRow | null {
  return Array.isArray(customer)
    ? customer[0] || null
    : customer;
}

function getTaxTypeLabel(taxType: string) {
  if (taxType === "INTRA_STATE") {
    return "Intra-State Supply";
  }

  if (taxType === "INTER_STATE") {
    return "Inter-State Supply";
  }

  if (taxType === "EXEMPT") {
    return "Exempt / Nil GST Supply";
  }

  if (taxType === "ZERO_RATED") {
    return "Zero-Rated Supply";
  }

  return "GST Classification Pending";
}

function mapInvoice(row: SaleRow): Invoice {
  const customer = getCustomer(row.customer);
  const items = (row.sale_items || []).map((item) => ({
    productId: item.product_id || "",
    productName: item.product_name || "Product",
    hsnSacCode: item.hsn_sac_code || "",
    quantity: toNumber(item.quantity),
    rate: toNumber(item.rate),
    gst: toNumber(item.gst_rate),
    discount: toNumber(item.discount),
    baseAmount: toNumber(item.base_amount),
    taxableAmount: toNumber(item.taxable_amount),
    gstAmount: toNumber(item.gst_amount),
    cgstAmount: toNumber(item.cgst_amount),
    sgstAmount: toNumber(item.sgst_amount),
    igstAmount: toNumber(item.igst_amount),
    cessAmount: toNumber(item.cess_amount),
    amount: toNumber(item.amount),
  }));

  const taxableTotal = items.reduce(
    (total, item) =>
      total +
      (item.taxableAmount ||
        Math.max(0, item.baseAmount - item.discount)),
    0
  );

  return {
    id: row.id,
    invoiceNumber: row.invoice_number || "",
    date: row.invoice_date || "",
    paymentMode: row.payment_mode || "Cash",
    customerName: customer?.name || "Unknown Customer",
    customerMobile: customer?.mobile || "",
    customerGst: customer?.gst_number || "",
    customerState: customer?.state || "",
    customerStateCode: customer?.state_code || "",
    placeOfSupply:
      row.place_of_supply || customer?.state || "",
    placeOfSupplyCode:
      row.place_of_supply_code ||
      customer?.state_code ||
      "",
    taxType: row.tax_type || "UNCLASSIFIED",
    subtotal: toNumber(row.subtotal),
    discountTotal: toNumber(row.discount_total),
    taxableTotal,
    cgstTotal: toNumber(row.cgst_total),
    sgstTotal: toNumber(row.sgst_total),
    igstTotal: toNumber(row.igst_total),
    cessTotal: toNumber(row.cess_total),
    gstTotal: toNumber(row.gst_total),
    grandTotal: toNumber(row.grand_total),
    items,
  };
}

function mapCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    name: row.name || "Your Company Name",
    legalName: row.legal_name || "",
    tradeName: row.trade_name || "",
    address: row.address || "",
    city: row.city || "",
    state: row.state || "",
    stateCode: row.state_code || "",
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

  const [invoice, setInvoice] = useState<Invoice | null>(
    null
  );
  const [company, setCompany] = useState<Company | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadInvoice() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        if (!invoiceId) {
          setErrorMessage("Invoice ID is missing.");
          return;
        }

        const supabase = createClient();

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          setErrorMessage(
            "Please sign in to view this invoice."
          );
          return;
        }

        const { data: profile, error: profileError } =
          await supabase
            .from("profiles")
            .select("active_company_id")
            .eq("id", user.id)
            .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        const activeCompanyId =
          (profile as ProfileRow | null)
            ?.active_company_id || null;

        if (!activeCompanyId) {
          setErrorMessage(
            "Select an active company from the Companies page first."
          );
          return;
        }

        const [invoiceResponse, companyResponse] =
          await Promise.all([
            supabase
              .from("sales")
              .select(
                `
                  id,
                  invoice_number,
                  invoice_date,
                  payment_mode,
                  customer_id,
                  place_of_supply,
                  place_of_supply_code,
                  tax_type,
                  subtotal,
                  gst_total,
                  discount_total,
                  cgst_total,
                  sgst_total,
                  igst_total,
                  cess_total,
                  grand_total,
                  customer:ledgers!sales_customer_id_fkey(
                    id,
                    name,
                    mobile,
                    gst_number,
                    state,
                    state_code
                  ),
                  sale_items(
                    product_id,
                    product_name,
                    hsn_sac_code,
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
                    amount
                  )
                `
              )
              .eq("id", invoiceId)
              .eq("company_id", activeCompanyId)
              .maybeSingle(),
            supabase
              .from("companies")
              .select(
                "id, name, legal_name, trade_name, address, city, state, state_code, gst_number, phone, email"
              )
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
          setErrorMessage(
            "This invoice is unavailable for the active company."
          );
          return;
        }

        setInvoice(
          mapInvoice(
            invoiceResponse.data as unknown as SaleRow
          )
        );
        setCompany(
          companyResponse.data
            ? mapCompany(
                companyResponse.data as CompanyRow
              )
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
      <PageShell>
        <StatusCard text="Loading GST invoice from the cloud database..." />
      </PageShell>
    );
  }

  if (!invoice) {
    return (
      <PageShell>
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
      </PageShell>
    );
  }

  const isCreditPayment =
    invoice.paymentMode.trim().toLowerCase() ===
    "credit";

  const hasGstSplit =
    invoice.cgstTotal > 0 ||
    invoice.sgstTotal > 0 ||
    invoice.igstTotal > 0 ||
    invoice.taxType === "EXEMPT";

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
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
            width: 100% !important;
            min-height: auto !important;
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
            font-size: 9px !important;
          }

          .invoice-table th,
          .invoice-table td {
            padding: 6px !important;
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
            <div className="invoice-print-hide mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href="/sales"
                className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-center font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                ← Back to Sales
              </Link>

              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-700"
              >
                Print GST Invoice
              </button>
            </div>

            <section className="invoice-card mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-4 shadow-xl sm:p-6 lg:p-8">
              <header className="border-b border-slate-200 pb-5 sm:pb-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
                      Tax Invoice
                    </p>

                    <h2 className="mt-2 text-2xl font-black text-slate-900">
                      {company?.tradeName ||
                        company?.name ||
                        "Your Company Name"}
                    </h2>

                    {company?.legalName && (
                      <p className="mt-1 font-semibold text-slate-700">
                        Legal Name: {company.legalName}
                      </p>
                    )}

                    <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                      {[company?.address, company?.city]
                        .filter(Boolean)
                        .join(", ") ||
                        "Company address not available"}
                    </p>

                    <p className="mt-1 text-sm text-slate-600">
                      {[company?.state, company?.stateCode]
                        .filter(Boolean)
                        .join(" · ") ||
                        "Company state not configured"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <p>
                      <strong>GSTIN:</strong>{" "}
                      {company?.gstNumber || "Unregistered"}
                    </p>
                    <p className="mt-1">
                      <strong>Phone:</strong>{" "}
                      {company?.phone || "Not provided"}
                    </p>
                    <p className="mt-1">
                      <strong>Email:</strong>{" "}
                      {company?.email || "Not provided"}
                    </p>
                  </div>
                </div>
              </header>

              <div className="grid grid-cols-1 gap-4 border-b border-slate-200 py-5 sm:grid-cols-2 lg:grid-cols-4">
                <MetaBox
                  label="Invoice Number"
                  value={invoice.invoiceNumber}
                />
                <MetaBox
                  label="Invoice Date"
                  value={formatDate(invoice.date)}
                />
                <MetaBox
                  label="Place of Supply"
                  value={
                    invoice.placeOfSupply
                      ? `${invoice.placeOfSupply} (${invoice.placeOfSupplyCode || "—"})`
                      : "Not classified"
                  }
                />
                <MetaBox
                  label="Supply Type"
                  value={getTaxTypeLabel(
                    invoice.taxType
                  )}
                  valueClassName={
                    invoice.taxType === "UNCLASSIFIED"
                      ? "text-amber-700"
                      : "text-emerald-700"
                  }
                />
              </div>

              {!hasGstSplit && (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                  This is a legacy invoice without CGST/SGST/IGST
                  snapshots. Edit and save it only after confirming
                  Company State, Customer State and product HSN data.
                </div>
              )}

              <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Bill To
                  </p>

                  <h3 className="mt-2 text-xl font-bold text-slate-900">
                    {invoice.customerName}
                  </h3>

                  <p className="mt-2 text-sm text-slate-600">
                    Mobile:{" "}
                    {invoice.customerMobile ||
                      "Not provided"}
                  </p>

                  <p className="mt-1 text-sm text-slate-600">
                    GSTIN:{" "}
                    {invoice.customerGst ||
                      "Unregistered customer"}
                  </p>

                  <p className="mt-1 text-sm text-slate-600">
                    State:{" "}
                    {invoice.customerState
                      ? `${invoice.customerState} (${invoice.customerStateCode || "—"})`
                      : "Not provided"}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4 md:text-right">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Payment
                  </p>

                  <p className="mt-2 text-lg font-bold text-slate-900">
                    {invoice.paymentMode}
                  </p>

                  <p className="mt-2 text-sm text-slate-600">
                    Status:{" "}
                    <span
                      className={
                        isCreditPayment
                          ? "font-bold text-orange-600"
                          : "font-bold text-emerald-600"
                      }
                    >
                      {isCreditPayment
                        ? "Pending"
                        : "Paid"}
                    </span>
                  </p>

                  <p className="mt-3 text-3xl font-black text-blue-600">
                    {formatCurrency(invoice.grandTotal)}
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-4 md:hidden">
                {invoice.items.map((item, index) => (
                  <article
                    key={`${item.productId}-${index}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-900">
                          {item.productName}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          HSN: {item.hsnSacCode || "—"}
                        </p>
                      </div>

                      <p className="font-bold text-blue-700">
                        {formatCurrency(item.amount)}
                      </p>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <InfoBox
                        label="Quantity"
                        value={String(item.quantity)}
                      />
                      <InfoBox
                        label="Rate"
                        value={formatCurrency(item.rate)}
                      />
                      <InfoBox
                        label="Taxable"
                        value={formatCurrency(
                          item.taxableAmount
                        )}
                      />
                      <InfoBox
                        label="GST"
                        value={`${item.gst}% · ${formatCurrency(
                          item.gstAmount
                        )}`}
                      />
                    </div>
                  </article>
                ))}
              </div>

              <div className="invoice-table-wrap mt-8 hidden overflow-x-auto border-y border-slate-200 md:block">
                <table className="invoice-table w-full min-w-[1050px]">
                  <thead className="bg-slate-50">
                    <tr className="text-left">
                      {[
                        "Item",
                        "HSN",
                        "Qty",
                        "Rate",
                        "Discount",
                        "Taxable",
                        "GST %",
                        "CGST",
                        "SGST",
                        "IGST",
                        "Amount",
                      ].map((heading) => (
                        <th
                          key={heading}
                          className="px-3 py-4 text-xs font-bold text-slate-700"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {invoice.items.map((item, index) => (
                      <tr
                        key={`${item.productId}-${index}`}
                        className="border-t border-slate-100"
                      >
                        <td className="px-3 py-4 font-bold text-slate-900">
                          {item.productName}
                        </td>
                        <td className="px-3 py-4 text-slate-700">
                          {item.hsnSacCode || "—"}
                        </td>
                        <td className="px-3 py-4 text-slate-700">
                          {item.quantity}
                        </td>
                        <td className="px-3 py-4 text-slate-700">
                          {formatCurrency(item.rate)}
                        </td>
                        <td className="px-3 py-4 text-slate-700">
                          {formatCurrency(item.discount)}
                        </td>
                        <td className="px-3 py-4 text-slate-700">
                          {formatCurrency(
                            item.taxableAmount
                          )}
                        </td>
                        <td className="px-3 py-4 text-slate-700">
                          {item.gst}%
                        </td>
                        <td className="px-3 py-4 text-slate-700">
                          {formatCurrency(
                            item.cgstAmount
                          )}
                        </td>
                        <td className="px-3 py-4 text-slate-700">
                          {formatCurrency(
                            item.sgstAmount
                          )}
                        </td>
                        <td className="px-3 py-4 text-slate-700">
                          {formatCurrency(
                            item.igstAmount
                          )}
                        </td>
                        <td className="px-3 py-4 text-right font-bold text-slate-900">
                          {formatCurrency(item.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 w-full max-w-md rounded-2xl bg-slate-50 p-5 print:border print:border-slate-200 print:bg-white sm:ml-auto">
                <TotalRow
                  label="Gross Subtotal"
                  value={invoice.subtotal}
                />
                <TotalRow
                  label="Discount"
                  value={invoice.discountTotal}
                />
                <TotalRow
                  label="Taxable Value"
                  value={invoice.taxableTotal}
                />

                {invoice.taxType === "INTRA_STATE" && (
                  <>
                    <TotalRow
                      label="CGST"
                      value={invoice.cgstTotal}
                    />
                    <TotalRow
                      label="SGST"
                      value={invoice.sgstTotal}
                    />
                  </>
                )}

                {invoice.taxType === "INTER_STATE" && (
                  <TotalRow
                    label="IGST"
                    value={invoice.igstTotal}
                  />
                )}

                {invoice.cessTotal > 0 && (
                  <TotalRow
                    label="Cess"
                    value={invoice.cessTotal}
                  />
                )}

                {invoice.taxType === "UNCLASSIFIED" && (
                  <TotalRow
                    label="Total GST"
                    value={invoice.gstTotal}
                  />
                )}

                <div className="flex justify-between pt-4">
                  <span className="text-lg font-bold text-slate-900">
                    Grand Total
                  </span>

                  <span className="text-2xl font-black text-blue-600">
                    {formatCurrency(invoice.grandTotal)}
                  </span>
                </div>
              </div>

              <footer className="mt-8 border-t border-slate-200 pt-5 text-center text-sm text-slate-500">
                This is a computer-generated invoice from
                VertexERP.
              </footer>
            </section>
          </main>
        </div>
      </div>
    </>
  );
}

function PageShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <div className="min-w-0 flex-1">
        <Navbar />

        <main className="p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function StatusCard({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-xl sm:p-10">
      <p className="text-lg font-semibold text-slate-700">
        {text}
      </p>
    </div>
  );
}

function MetaBox({
  label,
  value,
  valueClassName = "text-slate-900",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
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

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 break-words font-semibold text-slate-800">
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
    <div className="flex justify-between border-b border-slate-200 py-3 text-slate-700">
      <span>{label}</span>
      <span className="font-semibold">
        {formatCurrency(value)}
      </span>
    </div>
  );
}