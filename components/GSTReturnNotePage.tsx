"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import ProfessionalGSTReturnDocument, {
  type GSTReturnCompany,
  type GSTReturnItem,
  type GSTReturnMode,
  type GSTReturnParty,
  type GSTReturnStatus,
  type GSTReturnTotals,
} from "@/components/ProfessionalGSTReturnDocument";
import Sidebar from "@/components/Sidebar";
import { usePermissions } from "@/hooks/usePermissions";
import { createClient } from "@/lib/supabase/client";

type ProfileRow = {
  active_company_id: string | null;
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

type LedgerRow = {
  id: string;
  name: string;
  mobile: string | null;
  gst_number: string | null;
  state: string | null;
  state_code: string | null;
};

type SourceItemRow = {
  id: string;
  rate: number | string | null;
  gst_rate: number | string | null;
};

type SaleRow = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer: LedgerRow | LedgerRow[] | null;
  sale_items: SourceItemRow[] | null;
};

type PurchaseRow = {
  id: string;
  bill_number: string;
  purchase_date: string;
  supplier: LedgerRow | LedgerRow[] | null;
  purchase_items: SourceItemRow[] | null;
};

type ReturnItemRow = {
  id: string;
  source_sale_item_id?: string | null;
  source_purchase_item_id?: string | null;
  product_name: string;
  quantity: number | string | null;
  hsn_sac_code: string | null;
  taxable_amount: number | string | null;
  gst_amount: number | string | null;
  cgst_amount: number | string | null;
  sgst_amount: number | string | null;
  igst_amount: number | string | null;
  cess_amount: number | string | null;
  amount: number | string | null;
};

type CreditNoteRow = {
  id: string;
  source_sale_id: string;
  credit_note_number: string;
  credit_note_date: string;
  reason: string;
  taxable_total?: number | string | null;
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
  status: GSTReturnStatus;
  void_reason: string | null;
  credit_note_items: ReturnItemRow[] | null;
};

type DebitNoteRow = {
  id: string;
  source_purchase_id: string;
  debit_note_number: string;
  debit_note_date: string;
  reason: string;
  taxable_total?: number | string | null;
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
  status: GSTReturnStatus;
  void_reason: string | null;
  debit_note_items: ReturnItemRow[] | null;
};

type ReturnDocumentData = {
  status: GSTReturnStatus;
  company: GSTReturnCompany;
  party: GSTReturnParty;
  documentNumber: string;
  documentDate: string;
  referenceNumber: string;
  referenceDate: string;
  reason: string;
  voidReason: string;
  placeOfSupply: string;
  placeOfSupplyCode: string;
  taxType: string;
  items: GSTReturnItem[];
  totals: GSTReturnTotals;
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getJoinedLedger(
  ledger: LedgerRow | LedgerRow[] | null
): LedgerRow | null {
  return Array.isArray(ledger) ? ledger[0] || null : ledger;
}

function mapCompany(row: CompanyRow): GSTReturnCompany {
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

function mapParty(row: LedgerRow | null, mode: GSTReturnMode): GSTReturnParty {
  return {
    name:
      row?.name ||
      (mode === "credit" ? "Unknown Customer" : "Unknown Supplier"),
    mobile: row?.mobile || "",
    gstNumber: row?.gst_number || "",
    state: row?.state || "",
    stateCode: row?.state_code || "",
  };
}

function buildItems(
  returnItems: ReturnItemRow[],
  sourceItems: SourceItemRow[],
  mode: GSTReturnMode
) {
  const sourceItemById = new Map<string, SourceItemRow>();

  sourceItems.forEach((item) => {
    sourceItemById.set(item.id, item);
  });

  return returnItems.map<GSTReturnItem>((item) => {
    const sourceItemId =
      mode === "credit"
        ? item.source_sale_item_id || ""
        : item.source_purchase_item_id || "";

    const sourceItem = sourceItemById.get(sourceItemId);
    const quantity = toNumber(item.quantity);
    const taxableAmount = toNumber(item.taxable_amount);

    return {
      id: item.id,
      productName: item.product_name || "Product",
      hsnSacCode: item.hsn_sac_code || "",
      quantity,
      rate:
        toNumber(sourceItem?.rate) ||
        (quantity > 0 ? taxableAmount / quantity : 0),
      gstRate:
        toNumber(sourceItem?.gst_rate) ||
        (taxableAmount > 0
          ? (toNumber(item.gst_amount) / taxableAmount) * 100
          : 0),
      taxableAmount,
      cgstAmount: toNumber(item.cgst_amount),
      sgstAmount: toNumber(item.sgst_amount),
      igstAmount: toNumber(item.igst_amount),
      cessAmount: toNumber(item.cess_amount),
      amount: toNumber(item.amount),
    };
  });
}

export default function GSTReturnNotePage({
  mode,
}: {
  mode: GSTReturnMode;
}) {
  const params = useParams();
  const hasAutoPrinted = useRef(false);

  const noteId =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : "";

  const [documentData, setDocumentData] =
    useState<ReturnDocumentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const isCredit = mode === "credit";
  const backHref = isCredit ? "/credit-notes" : "/debit-notes";
  const documentName = isCredit ? "Credit Note" : "Debit Note";

  const {
    can,
    error: permissionError,
    isLoading: isPermissionLoading,
  } = usePermissions();

  const canViewDocument = isCredit
    ? can("credit_notes.view")
    : can("debit_notes.view");

  useEffect(() => {
    if (isPermissionLoading) {
      return;
    }

    if (!canViewDocument) {
      setDocumentData(null);
      setErrorMessage(
        permissionError ||
          `You do not have permission to view this ${documentName.toLowerCase()}.`
      );
      setIsLoading(false);
      return;
    }

    async function loadDocument() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        if (!noteId) {
          throw new Error(`${documentName} ID is missing.`);
        }

        const supabase = createClient();

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw new Error(
            `Please sign in to view this ${documentName.toLowerCase()}.`
          );
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
          (profile as ProfileRow | null)?.active_company_id || null;

        if (!companyId) {
          throw new Error(
            "Select an active company from the Companies page first."
          );
        }

        const companyPromise = supabase
          .from("companies")
          .select(
            "id, name, legal_name, trade_name, address, city, state, state_code, gst_number, phone, email"
          )
          .eq("id", companyId)
          .maybeSingle();

        if (isCredit) {
          const notePromise = supabase
            .from("credit_notes")
            .select(
              `
                id,
                source_sale_id,
                credit_note_number,
                credit_note_date,
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
                status,
                void_reason,
                credit_note_items(
                  id,
                  source_sale_item_id,
                  product_name,
                  quantity,
                  hsn_sac_code,
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
            .eq("id", noteId)
            .eq("company_id", companyId)
            .maybeSingle();

          const [noteResponse, companyResponse] = await Promise.all([
            notePromise,
            companyPromise,
          ]);

          if (noteResponse.error) {
            throw noteResponse.error;
          }

          if (companyResponse.error) {
            throw companyResponse.error;
          }

          if (!noteResponse.data || !companyResponse.data) {
            throw new Error(
              "This Credit Note is unavailable for the active company."
            );
          }

          const note =
            noteResponse.data as unknown as CreditNoteRow;

          const { data: sourceSale, error: sourceSaleError } =
            await supabase
              .from("sales")
              .select(
                `
                  id,
                  invoice_number,
                  invoice_date,
                  customer:ledgers!sales_customer_id_fkey(
                    id,
                    name,
                    mobile,
                    gst_number,
                    state,
                    state_code
                  ),
                  sale_items(
                    id,
                    rate,
                    gst_rate
                  )
                `
              )
              .eq("id", note.source_sale_id)
              .eq("company_id", companyId)
              .maybeSingle();

          if (sourceSaleError) {
            throw sourceSaleError;
          }

          const sale = sourceSale as unknown as SaleRow | null;
          const items = buildItems(
            note.credit_note_items || [],
            sale?.sale_items || [],
            "credit"
          );
          const taxableTotal =
            items.reduce(
              (total, item) => total + item.taxableAmount,
              0
            ) || toNumber(note.subtotal);

          setDocumentData({
            status: note.status,
            company: mapCompany(
              companyResponse.data as CompanyRow
            ),
            party: mapParty(
              getJoinedLedger(sale?.customer || null),
              "credit"
            ),
            documentNumber: note.credit_note_number,
            documentDate: note.credit_note_date,
            referenceNumber: sale?.invoice_number || "—",
            referenceDate: sale?.invoice_date || "",
            reason: note.reason || "Customer returned goods",
            voidReason: note.void_reason || "",
            placeOfSupply: note.place_of_supply || "",
            placeOfSupplyCode:
              note.place_of_supply_code || "",
            taxType: note.tax_type || "UNCLASSIFIED",
            items,
            totals: {
              taxableTotal,
              cgstTotal: toNumber(note.cgst_total),
              sgstTotal: toNumber(note.sgst_total),
              igstTotal: toNumber(note.igst_total),
              cessTotal: toNumber(note.cess_total),
              gstTotal: toNumber(note.gst_total),
              grandTotal: toNumber(note.grand_total),
            },
          });
        } else {
          const notePromise = supabase
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
                status,
                void_reason,
                debit_note_items(
                  id,
                  source_purchase_item_id,
                  product_name,
                  quantity,
                  hsn_sac_code,
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
            .eq("id", noteId)
            .eq("company_id", companyId)
            .maybeSingle();

          const [noteResponse, companyResponse] = await Promise.all([
            notePromise,
            companyPromise,
          ]);

          if (noteResponse.error) {
            throw noteResponse.error;
          }

          if (companyResponse.error) {
            throw companyResponse.error;
          }

          if (!noteResponse.data || !companyResponse.data) {
            throw new Error(
              "This Debit Note is unavailable for the active company."
            );
          }

          const note =
            noteResponse.data as unknown as DebitNoteRow;

          const { data: sourcePurchase, error: sourcePurchaseError } =
            await supabase
              .from("purchases")
              .select(
                `
                  id,
                  bill_number,
                  purchase_date,
                  supplier:ledgers!purchases_supplier_id_fkey(
                    id,
                    name,
                    mobile,
                    gst_number,
                    state,
                    state_code
                  ),
                  purchase_items(
                    id,
                    rate,
                    gst_rate
                  )
                `
              )
              .eq("id", note.source_purchase_id)
              .eq("company_id", companyId)
              .maybeSingle();

          if (sourcePurchaseError) {
            throw sourcePurchaseError;
          }

          const purchase =
            sourcePurchase as unknown as PurchaseRow | null;
          const items = buildItems(
            note.debit_note_items || [],
            purchase?.purchase_items || [],
            "debit"
          );
          const taxableTotal =
            items.reduce(
              (total, item) => total + item.taxableAmount,
              0
            ) || toNumber(note.subtotal);

          setDocumentData({
            status: note.status,
            company: mapCompany(
              companyResponse.data as CompanyRow
            ),
            party: mapParty(
              getJoinedLedger(purchase?.supplier || null),
              "debit"
            ),
            documentNumber: note.debit_note_number,
            documentDate: note.debit_note_date,
            referenceNumber: purchase?.bill_number || "—",
            referenceDate: purchase?.purchase_date || "",
            reason: note.reason || "Goods returned to supplier",
            voidReason: note.void_reason || "",
            placeOfSupply: note.place_of_supply || "",
            placeOfSupplyCode:
              note.place_of_supply_code || "",
            taxType: note.tax_type || "UNCLASSIFIED",
            items,
            totals: {
              taxableTotal,
              cgstTotal: toNumber(note.cgst_total),
              sgstTotal: toNumber(note.sgst_total),
              igstTotal: toNumber(note.igst_total),
              cessTotal: toNumber(note.cess_total),
              gstTotal: toNumber(note.gst_total),
              grandTotal: toNumber(note.grand_total),
            },
          });
        }
      } catch (error) {
        setDocumentData(null);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : `${documentName} could not be loaded.`
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadDocument();
  }, [
    canViewDocument,
    documentName,
    isCredit,
    isPermissionLoading,
    noteId,
    permissionError,
  ]);

  useEffect(() => {
    if (!documentData || hasAutoPrinted.current) {
      return;
    }

    const shouldPrint =
      new URLSearchParams(window.location.search).get("print") === "1";

    if (!shouldPrint) {
      return;
    }

    hasAutoPrinted.current = true;

    const timer = window.setTimeout(() => {
      window.print();
    }, 500);

    return () => window.clearTimeout(timer);
  }, [documentData]);

  if (isPermissionLoading || isLoading) {
    return (
      <ApplicationShell>
        <StatusCard
          text={`Loading professional ${documentName.toLowerCase()}...`}
        />
      </ApplicationShell>
    );
  }

  if (!documentData) {
    return (
      <ApplicationShell>
        <div className="rounded-3xl border border-violet-100 bg-white p-6 text-center shadow-lg sm:p-10">
          <h1 className="text-2xl font-bold text-slate-900">
            {documentName} Not Found
          </h1>

          <p className="mt-3 text-slate-600">
            {errorMessage ||
              `This ${documentName.toLowerCase()} may have been deleted or is unavailable.`}
          </p>

          <Link
            href={backHref}
            className="mt-6 inline-block rounded-xl bg-violet-700 px-6 py-3 font-semibold text-white transition hover:bg-violet-800"
          >
            Back to {isCredit ? "Credit Notes" : "Debit Notes"}
          </Link>
        </div>
      </ApplicationShell>
    );
  }

  return (
    <ApplicationShell plain>
      <ProfessionalGSTReturnDocument
        mode={mode}
        status={documentData.status}
        company={documentData.company}
        party={documentData.party}
        documentNumber={documentData.documentNumber}
        documentDate={documentData.documentDate}
        referenceNumber={documentData.referenceNumber}
        referenceDate={documentData.referenceDate}
        reason={documentData.reason}
        voidReason={documentData.voidReason}
        placeOfSupply={documentData.placeOfSupply}
        placeOfSupplyCode={documentData.placeOfSupplyCode}
        taxType={documentData.taxType}
        items={documentData.items}
        totals={documentData.totals}
        backHref={backHref}
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
          .erp-return-sidebar,
          .erp-return-navbar {
            display: none !important;
          }

          .erp-return-page,
          .erp-return-content,
          .erp-return-main {
            display: block !important;
            width: 100% !important;
            min-height: auto !important;
            background: white !important;
          }
        }
      `}</style>

      <div className="erp-return-page flex min-h-screen bg-[#f3f6fb]">
        <div className="erp-return-sidebar">
          <Sidebar />
        </div>

        <div className="erp-return-content min-w-0 flex-1 overflow-x-hidden">
          <div className="erp-return-navbar">
            <Navbar />
          </div>

          <main
            className={`erp-return-main ${
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
    <div className="rounded-3xl border border-violet-100 bg-white p-6 text-center shadow-xl sm:p-10">
      <p className="text-lg font-semibold text-slate-700">
        {text}
      </p>
    </div>
  );
}