"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { usePermissions } from "@/hooks/usePermissions";
import { createClient } from "@/lib/supabase/client";

type Ledger = {
  name: string;
  mobile: string | null;
  email: string | null;
  gst_number: string | null;
  state: string | null;
  state_code: string | null;
  address: string | null;
};

type PurchaseItem = {
  id: string;
  product_name: string;
  hsn_sac_code: string | null;
  quantity: number | string | null;
  rate: number | string | null;
  gst_rate: number | string | null;
  taxable_amount: number | string | null;
  cgst_amount: number | string | null;
  sgst_amount: number | string | null;
  igst_amount: number | string | null;
  cess_amount: number | string | null;
  amount: number | string | null;
};

type Purchase = {
  id: string;
  company_id: string;
  supplier_id: string | null;
  bill_number: string;
  purchase_date: string;
  payment_mode: string;
  subtotal: number | string | null;
  discount_total: number | string | null;
  gst_total: number | string | null;
  cgst_total: number | string | null;
  sgst_total: number | string | null;
  igst_total: number | string | null;
  cess_total: number | string | null;
  grand_total: number | string | null;
  place_of_supply: string | null;
  place_of_supply_code: string | null;
  tax_type: string | null;
  reverse_charge_applicable: boolean;
  itc_status: string;
  itc_eligibility_percentage: number | string | null;
  itc_ineligibility_reason: string | null;
  itc_notes: string | null;
  eligible_cgst: number | string | null;
  eligible_sgst: number | string | null;
  eligible_igst: number | string | null;
  eligible_cess: number | string | null;
  ineligible_cgst: number | string | null;
  ineligible_sgst: number | string | null;
  ineligible_igst: number | string | null;
  ineligible_cess: number | string | null;
  rcm_cgst: number | string | null;
  rcm_sgst: number | string | null;
  rcm_igst: number | string | null;
  rcm_cess: number | string | null;
  supplier: Ledger | Ledger[] | null;
  purchase_items: PurchaseItem[] | null;
};

type Company = {
  name: string;
  legal_name: string | null;
  gst_number: string | null;
  state: string | null;
  state_code: string | null;
  address: string | null;
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: unknown) {
  return `₹${toNumber(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] || null : value;
}

function isValidGstin(value: string | null | undefined) {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(
    String(value || "").trim().toUpperCase(),
  );
}

export default function PurchaseBillDetailPage() {
  const params = useParams<{ id: string }>();
  const { can, isLoading: permissionLoading } = usePermissions();
  const canView = can("purchase.view");
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (permissionLoading) return;
    if (!canView) {
      setIsLoading(false);
      return;
    }

    async function loadPurchase() {
      setIsLoading(true);
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Please sign in to view this purchase bill.");

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("active_company_id")
          .eq("id", user.id)
          .maybeSingle();
        if (profileError) throw profileError;
        if (!profile?.active_company_id) throw new Error("Select an active company first.");

        const { data, error } = await supabase
          .from("purchases")
          .select(`
            id, company_id, supplier_id, bill_number, purchase_date, payment_mode,
            subtotal, discount_total, gst_total, cgst_total, sgst_total, igst_total,
            cess_total, grand_total, place_of_supply, place_of_supply_code, tax_type,
            reverse_charge_applicable, itc_status, itc_eligibility_percentage,
            itc_ineligibility_reason, itc_notes,
            eligible_cgst, eligible_sgst, eligible_igst, eligible_cess,
            ineligible_cgst, ineligible_sgst, ineligible_igst, ineligible_cess,
            rcm_cgst, rcm_sgst, rcm_igst, rcm_cess,
            supplier:ledgers!purchases_supplier_id_fkey(
              name, mobile, email, gst_number, state, state_code, address
            ),
            purchase_items(
              id, product_name, hsn_sac_code, quantity, rate, gst_rate,
              taxable_amount, cgst_amount, sgst_amount, igst_amount,
              cess_amount, amount
            )
          `)
          .eq("id", params.id)
          .eq("company_id", profile.active_company_id)
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Purchase bill not found in the active company.");

        const nextPurchase = data as unknown as Purchase;
        setPurchase(nextPurchase);

        const { data: companyData, error: companyError } = await supabase
          .from("companies")
          .select("name, legal_name, gst_number, state, state_code, address")
          .eq("id", nextPurchase.company_id)
          .maybeSingle();
        if (companyError) throw companyError;
        setCompany((companyData as Company | null) || null);
      } catch (error) {
        setPurchase(null);
        setCompany(null);
        setMessage(error instanceof Error ? error.message : "Purchase bill could not be loaded.");
      } finally {
        setIsLoading(false);
      }
    }

    loadPurchase();
  }, [params.id, canView, permissionLoading]);

  const supplier = first(purchase?.supplier || null);
  const eligibleItc = useMemo(
    () =>
      toNumber(purchase?.eligible_cgst) +
      toNumber(purchase?.eligible_sgst) +
      toNumber(purchase?.eligible_igst) +
      toNumber(purchase?.eligible_cess),
    [purchase],
  );
  const ineligibleItc = useMemo(
    () =>
      toNumber(purchase?.ineligible_cgst) +
      toNumber(purchase?.ineligible_sgst) +
      toNumber(purchase?.ineligible_igst) +
      toNumber(purchase?.ineligible_cess),
    [purchase],
  );
  const rcmTax = useMemo(
    () =>
      toNumber(purchase?.rcm_cgst) +
      toNumber(purchase?.rcm_sgst) +
      toNumber(purchase?.rcm_igst) +
      toNumber(purchase?.rcm_cess),
    [purchase],
  );

  const unregisteredSupplierItcRisk = Boolean(
    purchase &&
      !purchase.reverse_charge_applicable &&
      !isValidGstin(supplier?.gst_number) &&
      (purchase.itc_status === "ELIGIBLE" ||
        purchase.itc_status === "PARTIAL") &&
      eligibleItc > 0,
  );

  const protectedEligibleItc = unregisteredSupplierItcRisk
    ? 0
    : eligibleItc;

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 5mm;
          }

          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            min-height: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .purchase-print-hide {
            display: none !important;
          }

          .purchase-page-root,
          .purchase-content-root,
          .purchase-main-content {
            display: block !important;
            width: 100% !important;
            min-width: 0 !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
          }

          #purchase-bill-print {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            overflow: visible !important;
            font-size: 8px !important;
            line-height: 1.15 !important;
            break-inside: avoid-page !important;
            page-break-inside: avoid !important;
          }

          #purchase-bill-print header {
            padding: 8px 10px !important;
          }

          #purchase-bill-print header > div {
            gap: 8px !important;
          }

          #purchase-bill-print header h1 {
            margin-top: 2px !important;
            font-size: 17px !important;
            line-height: 1.1 !important;
          }

          #purchase-bill-print header p {
            margin-top: 2px !important;
            font-size: 8px !important;
            line-height: 1.2 !important;
          }

          #purchase-bill-print header .rounded-2xl {
            padding: 6px 8px !important;
            border-radius: 6px !important;
          }

          #purchase-bill-print header .rounded-2xl p:nth-child(2) {
            font-size: 14px !important;
          }

          #purchase-bill-print > section:first-of-type {
            grid-template-columns: 1fr 1fr !important;
          }

          #purchase-bill-print > section:first-of-type > div {
            padding: 8px 10px !important;
          }

          #purchase-bill-print > section:first-of-type h2 {
            margin: 0 !important;
            font-size: 8px !important;
          }

          #purchase-bill-print > section:first-of-type .mt-4 {
            margin-top: 4px !important;
          }

          #purchase-bill-print > section:first-of-type .space-y-2 > :not([hidden]) ~ :not([hidden]) {
            margin-top: 2px !important;
          }

          #purchase-bill-print > section:first-of-type .grid {
            grid-template-columns: 80px 1fr !important;
            gap: 4px !important;
            font-size: 8px !important;
          }

          #purchase-bill-print .overflow-x-auto {
            overflow: visible !important;
          }

          #purchase-bill-print table {
            width: 100% !important;
            min-width: 0 !important;
            table-layout: fixed !important;
            font-size: 7px !important;
          }

          #purchase-bill-print th,
          #purchase-bill-print td {
            padding: 3px 4px !important;
            line-height: 1.1 !important;
            overflow-wrap: anywhere !important;
          }

          #purchase-bill-print th:nth-child(1),
          #purchase-bill-print td:nth-child(1) { width: 23%; }
          #purchase-bill-print th:nth-child(2),
          #purchase-bill-print td:nth-child(2) { width: 8%; }
          #purchase-bill-print th:nth-child(3),
          #purchase-bill-print td:nth-child(3) { width: 5%; }
          #purchase-bill-print th:nth-child(4),
          #purchase-bill-print td:nth-child(4) { width: 10%; }
          #purchase-bill-print th:nth-child(5),
          #purchase-bill-print td:nth-child(5) { width: 6%; }
          #purchase-bill-print th:nth-child(6),
          #purchase-bill-print td:nth-child(6) { width: 10%; }
          #purchase-bill-print th:nth-child(7),
          #purchase-bill-print td:nth-child(7),
          #purchase-bill-print th:nth-child(8),
          #purchase-bill-print td:nth-child(8),
          #purchase-bill-print th:nth-child(9),
          #purchase-bill-print td:nth-child(9) { width: 9%; }
          #purchase-bill-print th:nth-child(10),
          #purchase-bill-print td:nth-child(10) { width: 11%; }

          #purchase-bill-print > section:last-of-type {
            grid-template-columns: 1fr 270px !important;
            gap: 8px !important;
            padding: 8px 10px !important;
          }

          #purchase-bill-print > section:last-of-type h2 {
            font-size: 11px !important;
          }

          #purchase-bill-print > section:last-of-type > div:first-child > div:nth-child(2) {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 4px !important;
            margin-top: 4px !important;
          }

          #purchase-bill-print > section:last-of-type > div:first-child > div:nth-child(2) > div {
            padding: 5px !important;
            border-radius: 6px !important;
          }

          #purchase-bill-print > section:last-of-type > div:first-child > div:nth-child(2) p {
            margin-top: 1px !important;
            font-size: 7px !important;
          }

          #purchase-bill-print > section:last-of-type > div:first-child > div:nth-child(2) p:last-child {
            font-size: 11px !important;
          }

          #purchase-bill-print > section:last-of-type > div:first-child > div:nth-child(3) {
            margin-top: 4px !important;
            padding: 5px 7px !important;
            border-radius: 6px !important;
            font-size: 7px !important;
            line-height: 1.2 !important;
          }

          #purchase-bill-print > section:last-of-type > div:last-child {
            padding: 6px 8px !important;
            border-radius: 6px !important;
          }

          #purchase-bill-print > section:last-of-type > div:last-child > div {
            padding-top: 2px !important;
            padding-bottom: 2px !important;
            font-size: 8px !important;
          }

          #purchase-bill-print > section:last-of-type > div:last-child > div:last-child {
            margin-top: 3px !important;
            padding-top: 4px !important;
          }

          #purchase-bill-print > section:last-of-type > div:last-child > div:last-child span:first-child {
            font-size: 10px !important;
          }

          #purchase-bill-print > section:last-of-type > div:last-child > div:last-child span:last-child {
            font-size: 14px !important;
          }

          #purchase-bill-print footer {
            display: none !important;
          }
        }
      `}</style>

      <div className="purchase-page-root flex min-h-screen bg-[#f3f6fb]">
        <div className="purchase-print-hide">
          <Sidebar />
        </div>
        <div className="purchase-content-root min-w-0 flex-1 overflow-x-hidden">
          <div className="purchase-print-hide">
            <Navbar />
          </div>
          <main className="purchase-main-content p-4 pb-24 sm:p-6 lg:p-8">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
            <Link href="/purchase" className="font-black text-violet-700 hover:text-violet-900">
              ← Back to Purchases
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!purchase}
              className="rounded-xl bg-violet-600 px-5 py-3 font-black text-white transition hover:bg-violet-700 disabled:opacity-60"
            >
              Print Purchase Bill
            </button>
          </div>

          {permissionLoading || isLoading ? (
            <div className="rounded-3xl bg-white p-10 text-center font-semibold text-slate-600 shadow-xl">
              Loading purchase bill...
            </div>
          ) : !canView ? (
            <div className="rounded-3xl border border-red-200 bg-white p-10 text-center shadow-xl">
              <h1 className="text-2xl font-black text-slate-900">Purchase access restricted</h1>
            </div>
          ) : message || !purchase ? (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-8 font-semibold text-red-700">
              {message || "Purchase bill not found."}
            </div>
          ) : (
            <article id="purchase-bill-print" className="mx-auto max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <header className="bg-gradient-to-r from-violet-950 via-violet-800 to-violet-700 p-6 text-white sm:p-8">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-200">
                      GST Purchase Bill
                    </p>
                    <h1 className="mt-2 text-3xl font-black">{company?.legal_name || company?.name || "Company"}</h1>
                    <p className="mt-2 text-sm text-violet-100">
                      GSTIN: {company?.gst_number || "Unregistered"} · {company?.state || "State pending"}
                      {company?.state_code ? ` (${company.state_code})` : ""}
                    </p>
                    {company?.address && <p className="mt-1 max-w-2xl text-sm text-violet-100">{company.address}</p>}
                  </div>
                  <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                    <p className="text-xs font-black uppercase tracking-wide text-violet-200">Bill Number</p>
                    <p className="mt-1 text-2xl font-black">{purchase.bill_number}</p>
                    <p className="mt-2 text-sm text-violet-100">{formatDate(purchase.purchase_date)}</p>
                  </div>
                </div>
              </header>

              {unregisteredSupplierItcRisk && (
                <div className="border-b border-rose-200 bg-rose-50 px-5 py-4 text-sm leading-6 text-rose-900 sm:px-6">
                  <p className="font-black">
                    ITC compliance risk: unregistered supplier
                  </p>
                  <p className="mt-1">
                    This bill is stored as {purchase.itc_status.replaceAll(
                      "_",
                      " ",
                    )}, but the supplier does not have a valid GSTIN and RCM is
                    not applicable. {formatCurrency(eligibleItc)} is therefore
                    excluded from the protected Eligible ITC display until the
                    supplier GSTIN or ITC treatment is corrected.
                  </p>
                </div>
              )}

              <section className="grid grid-cols-1 gap-0 border-b border-slate-200 md:grid-cols-2">
                <InfoSection title="Supplier">
                  <InfoRow label="Name" value={supplier?.name || "Supplier"} />
                  <InfoRow label="GSTIN" value={supplier?.gst_number || "Unregistered"} />
                  <InfoRow label="State" value={supplier?.state ? `${supplier.state}${supplier.state_code ? ` (${supplier.state_code})` : ""}` : "—"} />
                  <InfoRow label="Mobile" value={supplier?.mobile || "—"} />
                  <InfoRow label="Email" value={supplier?.email || "—"} />
                </InfoSection>
                <InfoSection title="Transaction">
                  <InfoRow label="Payment Mode" value={purchase.payment_mode || "Cash"} />
                  <InfoRow label="Tax Type" value={purchase.tax_type || "UNCLASSIFIED"} />
                  <InfoRow label="Place of Supply" value={purchase.place_of_supply ? `${purchase.place_of_supply}${purchase.place_of_supply_code ? ` (${purchase.place_of_supply_code})` : ""}` : "—"} />
                  <InfoRow label="RCM" value={purchase.reverse_charge_applicable ? "Applicable" : "Not Applicable"} />
                  <InfoRow label="ITC Status" value={purchase.itc_status.replaceAll("_", " ")} />
                </InfoSection>
              </section>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px]">
                  <thead className="bg-violet-50">
                    <tr>
                      {["Item", "HSN", "Qty", "Rate", "GST %", "Taxable", "CGST", "SGST", "IGST", "Total"].map((heading) => (
                        <th key={heading} className="border-b border-violet-100 px-4 py-3 text-left text-sm font-black text-slate-700">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(purchase.purchase_items || []).map((item) => (
                      <tr key={item.id} className="border-b border-slate-100">
                        <td className="px-4 py-4 font-bold text-slate-900">{item.product_name}</td>
                        <td className="px-4 py-4 text-slate-600">{item.hsn_sac_code || "—"}</td>
                        <td className="px-4 py-4 text-slate-700">{toNumber(item.quantity)}</td>
                        <td className="px-4 py-4 text-slate-700">{formatCurrency(item.rate)}</td>
                        <td className="px-4 py-4 text-slate-700">{toNumber(item.gst_rate)}%</td>
                        <td className="px-4 py-4 text-slate-700">{formatCurrency(item.taxable_amount)}</td>
                        <td className="px-4 py-4 text-slate-700">{formatCurrency(item.cgst_amount)}</td>
                        <td className="px-4 py-4 text-slate-700">{formatCurrency(item.sgst_amount)}</td>
                        <td className="px-4 py-4 text-slate-700">{formatCurrency(item.igst_amount)}</td>
                        <td className="px-4 py-4 font-black text-slate-900">{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <section className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_390px]">
                <div>
                  <h2 className="text-xl font-black text-slate-900">GST Compliance Snapshot</h2>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Snapshot
                      label={
                        unregisteredSupplierItcRisk
                          ? "Protected Eligible ITC"
                          : "Eligible ITC"
                      }
                      value={protectedEligibleItc}
                      tone="green"
                    />
                    <Snapshot label="Ineligible ITC" value={ineligibleItc} tone="red" />
                    <Snapshot label="RCM Tax Review" value={rcmTax} tone="violet" />
                  </div>
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                    <p><strong>Eligibility:</strong> {toNumber(purchase.itc_eligibility_percentage)}%</p>
                    <p><strong>Reason:</strong> {purchase.itc_ineligibility_reason || "—"}</p>
                    <p><strong>Notes:</strong> {purchase.itc_notes || "—"}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
                  <TotalRow label="Subtotal" value={purchase.subtotal} />
                  <TotalRow label="Discount" value={purchase.discount_total} />
                  <TotalRow label="CGST" value={purchase.cgst_total} />
                  <TotalRow label="SGST" value={purchase.sgst_total} />
                  <TotalRow label="IGST" value={purchase.igst_total} />
                  <TotalRow label="Cess" value={purchase.cess_total} />
                  <div className="mt-3 flex items-center justify-between border-t border-violet-200 pt-4">
                    <span className="text-lg font-black text-slate-900">Grand Total</span>
                    <span className="text-2xl font-black text-violet-700">{formatCurrency(purchase.grand_total)}</span>
                  </div>
                </div>
              </section>

              <footer className="border-t border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900 sm:p-6">
                Operational document and GST review snapshot. Final ITC, RCM payment and return filing require statutory verification.
              </footer>
            </article>
          )}
          </main>
        </div>
      </div>
    </>
  );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-200 p-5 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0 sm:p-6">
      <h2 className="text-sm font-black uppercase tracking-[0.16em] text-violet-700">{title}</h2>
      <div className="mt-4 space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 text-sm">
      <span className="font-semibold text-slate-500">{label}</span>
      <span className="break-words font-bold text-slate-800">{value}</span>
    </div>
  );
}

function Snapshot({ label, value, tone }: { label: string; value: number; tone: "green" | "red" | "violet" }) {
  const style = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    red: "border-rose-200 bg-rose-50 text-rose-800",
    violet: "border-violet-200 bg-violet-50 text-violet-800",
  }[tone];
  return (
    <div className={`rounded-2xl border p-4 ${style}`}>
      <p className="text-xs font-black uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-2 text-xl font-black">{formatCurrency(value)}</p>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="font-semibold text-slate-600">{label}</span>
      <strong className="text-slate-900">{formatCurrency(value)}</strong>
    </div>
  );
}