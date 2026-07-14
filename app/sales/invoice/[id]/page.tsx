"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import ProfessionalGSTDocument, {
  type GSTCompany,
  type GSTDocumentItem,
  type GSTDocumentTotals,
  type GSTParty,
} from "@/components/ProfessionalGSTDocument";
import { createClient } from "@/lib/supabase/client";

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

type SaleItemRow = {
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
};

type SaleRow = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  payment_mode: string;
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
  sale_items: SaleItemRow[] | null;
};

type InvoiceData = {
  invoiceNumber: string;
  invoiceDate: string;
  paymentMode: string;
  placeOfSupply: string;
  placeOfSupplyCode: string;
  taxType: string;
  party: GSTParty;
  items: GSTDocumentItem[];
  totals: GSTDocumentTotals;
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getCustomer(
  customer: SaleRow["customer"]
): CustomerRow | null {
  return Array.isArray(customer)
    ? customer[0] || null
    : customer;
}

function mapCompany(row: CompanyRow): GSTCompany {
  return {
    name: row.name || "Your Company",
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

function mapInvoice(row: SaleRow): InvoiceData {
  const customer = getCustomer(row.customer);

  const items = (row.sale_items || []).map<GSTDocumentItem>(
    (item) => {
      const baseAmount = toNumber(item.base_amount);
      const discount = toNumber(item.discount);
      const taxableAmount =
        toNumber(item.taxable_amount) ||
        Math.max(0, baseAmount - discount);

      return {
        productId: item.product_id || "",
        productName: item.product_name || "Product",
        hsnSacCode: item.hsn_sac_code || "",
        quantity: toNumber(item.quantity),
        rate: toNumber(item.rate),
        discount,
        taxableAmount,
        gstRate: toNumber(item.gst_rate),
        cgstAmount: toNumber(item.cgst_amount),
        sgstAmount: toNumber(item.sgst_amount),
        igstAmount: toNumber(item.igst_amount),
        cessAmount: toNumber(item.cess_amount),
        amount: toNumber(item.amount),
      };
    }
  );

  const taxableTotal = items.reduce(
    (total, item) => total + item.taxableAmount,
    0
  );

  return {
    invoiceNumber: row.invoice_number || "",
    invoiceDate: row.invoice_date || "",
    paymentMode: row.payment_mode || "Cash",
    placeOfSupply:
      row.place_of_supply || customer?.state || "",
    placeOfSupplyCode:
      row.place_of_supply_code ||
      customer?.state_code ||
      "",
    taxType: row.tax_type || "UNCLASSIFIED",
    party: {
      name: customer?.name || "Unknown Customer",
      mobile: customer?.mobile || "",
      gstNumber: customer?.gst_number || "",
      state: customer?.state || "",
      stateCode: customer?.state_code || "",
    },
    items,
    totals: {
      subtotal: toNumber(row.subtotal),
      discountTotal: toNumber(row.discount_total),
      taxableTotal,
      cgstTotal: toNumber(row.cgst_total),
      sgstTotal: toNumber(row.sgst_total),
      igstTotal: toNumber(row.igst_total),
      cessTotal: toNumber(row.cess_total),
      gstTotal: toNumber(row.gst_total),
      grandTotal: toNumber(row.grand_total),
    },
  };
}

export default function SalesInvoicePage() {
  const params = useParams();

  const invoiceId =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : "";

  const [invoice, setInvoice] =
    useState<InvoiceData | null>(null);
  const [company, setCompany] =
    useState<GSTCompany | null>(null);
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

        const companyId =
          (profile as ProfileRow | null)?.active_company_id ||
          null;

        if (!companyId) {
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
              .eq("company_id", companyId)
              .maybeSingle(),
            supabase
              .from("companies")
              .select(
                "id, name, legal_name, trade_name, address, city, state, state_code, gst_number, phone, email"
              )
              .eq("id", companyId)
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
      <ApplicationShell>
        <StatusCard text="Loading professional GST invoice..." />
      </ApplicationShell>
    );
  }

  if (!invoice || !company) {
    return (
      <ApplicationShell>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-lg sm:p-10">
          <h1 className="text-2xl font-bold text-slate-900">
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
      </ApplicationShell>
    );
  }

  return (
    <ApplicationShell plain>
      <ProfessionalGSTDocument
        mode="sale"
        company={company}
        party={invoice.party}
        documentNumber={invoice.invoiceNumber}
        documentDate={invoice.invoiceDate}
        paymentMode={invoice.paymentMode}
        placeOfSupply={invoice.placeOfSupply}
        placeOfSupplyCode={invoice.placeOfSupplyCode}
        taxType={invoice.taxType}
        items={invoice.items}
        totals={invoice.totals}
        backHref="/sales"
      />
    </ApplicationShell>
  );
}

function ApplicationShell({
  children,
  plain = false,
}: {
  children: ReactNode;
  plain?: boolean;
}) {
  return (
    <>
      <style jsx global>{`
        @media print {
          .erp-document-sidebar,
          .erp-document-navbar {
            display: none !important;
          }

          .erp-document-page,
          .erp-document-content,
          .erp-document-main {
            display: block !important;
            width: 100% !important;
            min-height: auto !important;
            background: white !important;
          }
        }
      `}</style>

      <div className="erp-document-page flex min-h-screen bg-slate-100">
        <div className="erp-document-sidebar">
          <Sidebar />
        </div>

        <div className="erp-document-content min-w-0 flex-1">
          <div className="erp-document-navbar">
            <Navbar />
          </div>

          <main
            className={`erp-document-main ${
              plain
                ? "min-w-0"
                : "p-4 pb-24 sm:p-6 lg:p-8"
            }`}
          >
            {children}
          </main>
        </div>
      </div>
    </>
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