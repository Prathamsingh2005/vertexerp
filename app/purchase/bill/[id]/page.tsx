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

type SupplierRow = {
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

type PurchaseItemRow = {
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

type PurchaseRow = {
  id: string;
  bill_number: string;
  purchase_date: string;
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
  supplier: SupplierRow | SupplierRow[] | null;
  purchase_items: PurchaseItemRow[] | null;
};

type PurchaseData = {
  billNumber: string;
  purchaseDate: string;
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

function getSupplier(
  supplier: PurchaseRow["supplier"]
): SupplierRow | null {
  return Array.isArray(supplier)
    ? supplier[0] || null
    : supplier;
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

function mapPurchase(row: PurchaseRow): PurchaseData {
  const supplier = getSupplier(row.supplier);

  const items = (row.purchase_items || []).map<GSTDocumentItem>(
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
    billNumber: row.bill_number || "",
    purchaseDate: row.purchase_date || "",
    paymentMode: row.payment_mode || "Cash",
    placeOfSupply: row.place_of_supply || "",
    placeOfSupplyCode: row.place_of_supply_code || "",
    taxType: row.tax_type || "UNCLASSIFIED",
    party: {
      name: supplier?.name || "Unknown Supplier",
      mobile: supplier?.mobile || "",
      gstNumber: supplier?.gst_number || "",
      state: supplier?.state || "",
      stateCode: supplier?.state_code || "",
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

export default function PurchaseBillPage() {
  const params = useParams();

  const billId =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : "";

  const [bill, setBill] =
    useState<PurchaseData | null>(null);
  const [company, setCompany] =
    useState<GSTCompany | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadPurchaseBill() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        if (!billId) {
          setErrorMessage("Purchase bill ID is missing.");
          return;
        }

        const supabase = createClient();

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          setErrorMessage(
            "Please sign in to view this purchase bill."
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

        const [purchaseResponse, companyResponse] =
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
                  subtotal,
                  gst_total,
                  discount_total,
                  cgst_total,
                  sgst_total,
                  igst_total,
                  cess_total,
                  grand_total,
                  supplier:ledgers!purchases_supplier_id_fkey(
                    id,
                    name,
                    mobile,
                    gst_number,
                    state,
                    state_code
                  ),
                  purchase_items(
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
              .eq("id", billId)
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

        if (purchaseResponse.error) {
          throw purchaseResponse.error;
        }

        if (companyResponse.error) {
          throw companyResponse.error;
        }

        if (!purchaseResponse.data) {
          setErrorMessage(
            "This purchase bill is unavailable for the active company."
          );
          return;
        }

        setBill(
          mapPurchase(
            purchaseResponse.data as unknown as PurchaseRow
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
        setBill(null);
        setCompany(null);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Purchase bill could not be loaded."
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadPurchaseBill();
  }, [billId]);

  if (isLoading) {
    return (
      <ApplicationShell>
        <StatusCard text="Loading professional purchase tax bill..." />
      </ApplicationShell>
    );
  }

  if (!bill || !company) {
    return (
      <ApplicationShell>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-lg sm:p-10">
          <h1 className="text-2xl font-bold text-slate-900">
            Purchase Bill Not Found
          </h1>

          <p className="mt-3 text-slate-600">
            {errorMessage ||
              "This purchase bill may have been deleted or is unavailable."}
          </p>

          <Link
            href="/purchase"
            className="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
          >
            Back to Purchase
          </Link>
        </div>
      </ApplicationShell>
    );
  }

  return (
    <ApplicationShell plain>
      <ProfessionalGSTDocument
        mode="purchase"
        company={company}
        party={bill.party}
        documentNumber={bill.billNumber}
        documentDate={bill.purchaseDate}
        paymentMode={bill.paymentMode}
        placeOfSupply={bill.placeOfSupply}
        placeOfSupplyCode={bill.placeOfSupplyCode}
        taxType={bill.taxType}
        items={bill.items}
        totals={bill.totals}
        backHref="/purchase"
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