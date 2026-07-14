"use client";

import Link from "next/link";
import { type ReactNode, useMemo } from "react";

export type GSTReturnMode = "credit" | "debit";
export type GSTReturnStatus = "POSTED" | "VOID";

export type GSTReturnCompany = {
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

export type GSTReturnParty = {
  name: string;
  mobile: string;
  gstNumber: string;
  state: string;
  stateCode: string;
};

export type GSTReturnItem = {
  id: string;
  productName: string;
  hsnSacCode: string;
  quantity: number;
  rate: number;
  gstRate: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  amount: number;
};

export type GSTReturnTotals = {
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  cessTotal: number;
  gstTotal: number;
  grandTotal: number;
};

type ProfessionalGSTReturnDocumentProps = {
  mode: GSTReturnMode;
  status: GSTReturnStatus;
  company: GSTReturnCompany;
  party: GSTReturnParty;
  documentNumber: string;
  documentDate: string;
  referenceNumber: string;
  referenceDate: string;
  reason: string;
  voidReason?: string;
  placeOfSupply: string;
  placeOfSupplyCode: string;
  taxType: string;
  items: GSTReturnItem[];
  totals: GSTReturnTotals;
  backHref: string;
};

type HsnSummary = {
  key: string;
  hsnSacCode: string;
  gstRate: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  totalTax: number;
};

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

function formatCurrency(value: number) {
  return `₹${roundMoney(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatCompactNumber(value: number) {
  return roundMoney(value).toLocaleString("en-IN", {
    maximumFractionDigits: 3,
  });
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

function underHundred(value: number) {
  if (value < 20) {
    return ONES[value];
  }

  const tens = Math.floor(value / 10);
  const ones = value % 10;

  return `${TENS[tens]}${ones ? ` ${ONES[ones]}` : ""}`;
}

function underThousand(value: number) {
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  const parts: string[] = [];

  if (hundreds) {
    parts.push(`${ONES[hundreds]} Hundred`);
  }

  if (remainder) {
    parts.push(underHundred(remainder));
  }

  return parts.join(" ");
}

function integerToIndianWords(value: number): string {
  const integer = Math.floor(Math.abs(value));

  if (integer === 0) {
    return "Zero";
  }

  const crore = Math.floor(integer / 10000000);
  const lakh = Math.floor((integer % 10000000) / 100000);
  const thousand = Math.floor((integer % 100000) / 1000);
  const remainder = integer % 1000;
  const parts: string[] = [];

  if (crore) {
    parts.push(`${integerToIndianWords(crore)} Crore`);
  }

  if (lakh) {
    parts.push(`${underHundred(lakh)} Lakh`);
  }

  if (thousand) {
    parts.push(`${underHundred(thousand)} Thousand`);
  }

  if (remainder) {
    parts.push(underThousand(remainder));
  }

  return parts.join(" ");
}

function amountInWords(value: number) {
  const rounded = roundMoney(value);
  const rupees = Math.floor(rounded);
  const paise = Math.round((rounded - rupees) * 100);

  if (!paise) {
    return `${integerToIndianWords(rupees)} Rupees Only`;
  }

  return `${integerToIndianWords(
    rupees
  )} Rupees and ${integerToIndianWords(paise)} Paise Only`;
}

function getTaxTypeLabel(taxType: string) {
  if (taxType === "INTRA_STATE") {
    return "Intra-State Return";
  }

  if (taxType === "INTER_STATE") {
    return "Inter-State Return";
  }

  if (taxType === "EXEMPT") {
    return "Exempt / Nil Rated Return";
  }

  if (taxType === "ZERO_RATED") {
    return "Zero-Rated Return";
  }

  return "GST Classification Pending";
}

function buildHsnSummary(items: GSTReturnItem[]) {
  const grouped = new Map<string, HsnSummary>();

  items.forEach((item) => {
    const code = item.hsnSacCode || "Unclassified";
    const key = `${code}-${item.gstRate}`;
    const current = grouped.get(key) || {
      key,
      hsnSacCode: code,
      gstRate: item.gstRate,
      taxableAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      cessAmount: 0,
      totalTax: 0,
    };

    current.taxableAmount = roundMoney(
      current.taxableAmount + item.taxableAmount
    );
    current.cgstAmount = roundMoney(
      current.cgstAmount + item.cgstAmount
    );
    current.sgstAmount = roundMoney(
      current.sgstAmount + item.sgstAmount
    );
    current.igstAmount = roundMoney(
      current.igstAmount + item.igstAmount
    );
    current.cessAmount = roundMoney(
      current.cessAmount + item.cessAmount
    );
    current.totalTax = roundMoney(
      current.cgstAmount +
        current.sgstAmount +
        current.igstAmount +
        current.cessAmount
    );

    grouped.set(key, current);
  });

  return Array.from(grouped.values());
}

export default function ProfessionalGSTReturnDocument({
  mode,
  status,
  company,
  party,
  documentNumber,
  documentDate,
  referenceNumber,
  referenceDate,
  reason,
  voidReason,
  placeOfSupply,
  placeOfSupplyCode,
  taxType,
  items,
  totals,
  backHref,
}: ProfessionalGSTReturnDocumentProps) {
  const hsnSummary = useMemo(
    () => buildHsnSummary(items),
    [items]
  );

  const isCredit = mode === "credit";
  const title = isCredit ? "CREDIT NOTE" : "DEBIT NOTE";
  const nature = isCredit ? "Sales Return" : "Purchase Return";
  const partyTitle = isCredit ? "CUSTOMER DETAILS" : "SUPPLIER DETAILS";
  const referenceLabel = isCredit
    ? "Original Invoice"
    : "Original Purchase Bill";
  const taxPrefix = isCredit ? "Output" : "Input";
  const displayCompanyName =
    company.tradeName || company.name || "Your Company";
  const companyAddress = [
    company.address,
    company.city,
    company.state,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 4mm;
          }

          html,
          body {
            background: #ffffff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .gst-return-print-hide {
            display: none !important;
          }

          .gst-return-screen {
            padding: 0 !important;
            background: #ffffff !important;
          }

          .gst-return-sheet {
            width: 100% !important;
            min-height: auto !important;
            margin: 0 !important;
            border: 1px solid #111827 !important;
            box-shadow: none !important;
            zoom: 0.91;
            font-size: 9px !important;
            line-height: 1.18 !important;
          }

          .gst-return-sheet .p-3 {
            padding: 6px !important;
          }

          .gst-return-sheet .py-2 {
            padding-top: 5px !important;
            padding-bottom: 5px !important;
          }

          .gst-return-sheet .py-1\\.5 {
            padding-top: 4px !important;
            padding-bottom: 4px !important;
          }

          .gst-return-sheet .mt-5 {
            margin-top: 8px !important;
          }

          .gst-return-sheet .mt-3 {
            margin-top: 5px !important;
          }

          .gst-return-sheet .mt-2 {
            margin-top: 4px !important;
          }

          .gst-return-sheet .mt-1 {
            margin-top: 2px !important;
          }

          .gst-return-items-table,
          .gst-return-tax-summary table {
            width: 100% !important;
            min-width: 0 !important;
            table-layout: fixed !important;
          }

          .gst-return-items-table th,
          .gst-return-items-table td,
          .gst-return-tax-summary th,
          .gst-return-tax-summary td {
            padding: 4px 5px !important;
            overflow-wrap: anywhere;
          }

          .gst-return-items-table thead {
            display: table-header-group;
          }

          .gst-return-items-table tr,
          .gst-return-tax-summary,
          .gst-return-amount-words {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .gst-return-footer {
            min-height: 76px !important;
          }

          .gst-return-footer > div {
            padding: 6px !important;
          }

          .gst-return-sheet,
          .gst-return-sheet * {
            font-family: Arial, Helvetica, sans-serif !important;
          }
        }
      `}</style>

      <div className="gst-return-screen min-h-screen bg-slate-100 px-3 py-5 sm:px-6 lg:px-8">
        <div className="gst-return-print-hide mx-auto mb-4 flex max-w-[210mm] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={backHref}
            className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-center text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            ← Back
          </Link>

          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-[#2f1c6a] px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-[#4c3296]"
          >
            Print {title}
          </button>
        </div>

        <article className="gst-return-sheet relative mx-auto min-h-[297mm] w-full max-w-[210mm] overflow-hidden border border-slate-900 bg-white text-[11px] leading-[1.35] text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
          {status === "VOID" && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-hidden">
              <span className="-rotate-30 border-[8px] border-red-500/25 px-12 py-4 text-[86px] font-black tracking-[0.2em] text-red-500/25">
                VOID
              </span>
            </div>
          )}

          <div className="relative z-10">
            <div className="border-b border-slate-900 bg-[#f7f5ff] px-3 py-2 text-center">
              <h1 className="text-[15px] font-black tracking-[0.18em] text-[#2f1c6a]">
                {title}
              </h1>
              <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
                {nature}
              </p>
            </div>

            <section className="grid border-b border-slate-900 md:grid-cols-[1.2fr_0.8fr]">
              <div className="border-b border-slate-900 p-3 md:border-b-0 md:border-r">
                <div className="flex items-start gap-3">
                  <div className="relative flex h-14 w-14 shrink-0 items-center justify-center border border-[#2f1c6a] bg-[#673de6]">
                    <span className="text-xl font-black tracking-[-0.12em] text-white">
                      VX
                    </span>
                    <span className="absolute bottom-1.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#ffcd35]" />
                  </div>

                  <div className="min-w-0">
                    <h2 className="text-[16px] font-black uppercase leading-tight text-slate-950">
                      {displayCompanyName}
                    </h2>

                    {company.legalName &&
                      company.legalName !== displayCompanyName && (
                        <p className="mt-0.5 font-semibold">
                          Legal Name: {company.legalName}
                        </p>
                      )}

                    <p className="mt-1 whitespace-pre-line">
                      {companyAddress ||
                        "Business address not provided"}
                    </p>

                    <div className="mt-1 grid gap-x-4 sm:grid-cols-2">
                      <p>
                        <strong>GSTIN:</strong>{" "}
                        {company.gstNumber || "Unregistered"}
                      </p>
                      <p>
                        <strong>State Code:</strong>{" "}
                        {company.stateCode || "—"}
                      </p>
                      <p>
                        <strong>Phone:</strong>{" "}
                        {company.phone || "—"}
                      </p>
                      <p className="break-all">
                        <strong>Email:</strong>{" "}
                        {company.email || "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2">
                <DocumentCell
                  label={`${title} Number`}
                  value={documentNumber}
                />
                <DocumentCell
                  label={`${title} Date`}
                  value={formatDate(documentDate)}
                />
                <DocumentCell
                  label={referenceLabel}
                  value={referenceNumber || "—"}
                />
                <DocumentCell
                  label="Reference Date"
                  value={formatDate(referenceDate)}
                />
                <DocumentCell
                  label="GST Return Type"
                  value={getTaxTypeLabel(taxType)}
                />
                <DocumentCell
                  label="Document Status"
                  value={status}
                  valueClassName={
                    status === "VOID"
                      ? "text-red-700"
                      : "text-emerald-700"
                  }
                />
              </div>
            </section>

            <section className="grid border-b border-slate-900 md:grid-cols-[1.2fr_0.8fr]">
              <div className="border-b border-slate-900 p-3 md:border-b-0 md:border-r">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#554d70]">
                  {partyTitle}
                </p>

                <h3 className="mt-1 text-[14px] font-black uppercase">
                  {party.name}
                </h3>

                <p className="mt-1">
                  <strong>Mobile:</strong>{" "}
                  {party.mobile || "Not provided"}
                </p>
                <p>
                  <strong>GSTIN:</strong>{" "}
                  {party.gstNumber ||
                    (isCredit
                      ? "Unregistered customer"
                      : "Unregistered supplier")}
                </p>
                <p>
                  <strong>State:</strong>{" "}
                  {party.state
                    ? `${party.state}${
                        party.stateCode
                          ? ` (${party.stateCode})`
                          : ""
                      }`
                    : "Not provided"}
                </p>
              </div>

              <div className="p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#554d70]">
                  RETURN DETAILS
                </p>

                <div className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
                  <span>Place of Supply</span>
                  <strong>
                    {placeOfSupply
                      ? `${placeOfSupply}${
                          placeOfSupplyCode
                            ? ` (${placeOfSupplyCode})`
                            : ""
                        }`
                      : "Not classified"}
                  </strong>
                  <span>Returned Items</span>
                  <strong>{items.length}</strong>
                  <span>Taxable Return</span>
                  <strong>
                    {formatCurrency(totals.taxableTotal)}
                  </strong>
                  <span>GST Reversed</span>
                  <strong>
                    {formatCurrency(totals.gstTotal)}
                  </strong>
                </div>
              </div>
            </section>

            <section className="border-b border-slate-900 px-3 py-2">
              <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
                Reason for Return
              </p>
              <p className="mt-1 font-bold">
                {reason || "Return adjustment"}
              </p>

              {status === "VOID" && voidReason && (
                <p className="mt-1 text-red-700">
                  <strong>Void Reason:</strong> {voidReason}
                </p>
              )}
            </section>

            <div className="overflow-x-auto">
              <table className="gst-return-items-table w-full min-w-[760px] border-collapse">
                <thead>
                  <tr className="bg-[#f4f1ff]">
                    <TableHeader className="w-10 text-center">
                      S.No.
                    </TableHeader>
                    <TableHeader>Description of Goods</TableHeader>
                    <TableHeader className="w-[74px] text-center">
                      HSN/SAC
                    </TableHeader>
                    <TableHeader className="w-[55px] text-right">
                      Qty
                    </TableHeader>
                    <TableHeader className="w-[80px] text-right">
                      Rate
                    </TableHeader>
                    <TableHeader className="w-[88px] text-right">
                      Taxable
                    </TableHeader>
                    <TableHeader className="w-[50px] text-right">
                      GST
                    </TableHeader>
                    <TableHeader className="w-[78px] text-right">
                      Tax
                    </TableHeader>
                    <TableHeader className="w-[94px] text-right">
                      Amount
                    </TableHeader>
                  </tr>
                </thead>

                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id || `${item.productName}-${index}`}>
                      <TableCell className="text-center align-top">
                        {index + 1}
                      </TableCell>
                      <TableCell className="align-top">
                        <p className="font-bold uppercase">
                          {item.productName}
                        </p>
                      </TableCell>
                      <TableCell className="text-center align-top">
                        {item.hsnSacCode || "—"}
                      </TableCell>
                      <TableCell className="text-right align-top">
                        {formatCompactNumber(item.quantity)}
                      </TableCell>
                      <TableCell className="text-right align-top">
                        {formatCompactNumber(item.rate)}
                      </TableCell>
                      <TableCell className="text-right align-top">
                        {formatCompactNumber(item.taxableAmount)}
                      </TableCell>
                      <TableCell className="text-right align-top">
                        {formatCompactNumber(item.gstRate)}%
                      </TableCell>
                      <TableCell className="text-right align-top">
                        {formatCompactNumber(
                          item.cgstAmount +
                            item.sgstAmount +
                            item.igstAmount +
                            item.cessAmount
                        )}
                      </TableCell>
                      <TableCell className="text-right align-top font-bold">
                        {formatCompactNumber(item.amount)}
                      </TableCell>
                    </tr>
                  ))}

                  <tr className="font-bold">
                    <TableCell colSpan={3} className="text-right">
                      Total
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCompactNumber(
                        items.reduce(
                          (total, item) =>
                            total + item.quantity,
                          0
                        )
                      )}
                    </TableCell>
                    <TableCell />
                    <TableCell className="text-right">
                      {formatCompactNumber(totals.taxableTotal)}
                    </TableCell>
                    <TableCell />
                    <TableCell className="text-right">
                      {formatCompactNumber(totals.gstTotal)}
                    </TableCell>
                    <TableCell className="text-right text-[12px]">
                      {formatCurrency(totals.grandTotal)}
                    </TableCell>
                  </tr>
                </tbody>
              </table>
            </div>

            <section className="gst-return-amount-words grid border-t border-slate-900 md:grid-cols-[1.2fr_0.8fr]">
              <div className="border-b border-slate-900 p-3 md:border-b-0 md:border-r">
                <p className="text-[10px] text-slate-600">
                  Amount (in words)
                </p>
                <p className="mt-1 font-black uppercase">
                  INR {amountInWords(totals.grandTotal)}
                </p>
              </div>

              <div>
                <AmountRow
                  label="Taxable Return"
                  value={totals.taxableTotal}
                />
                {totals.cgstTotal > 0 && (
                  <AmountRow
                    label={`${taxPrefix} CGST Reversed`}
                    value={totals.cgstTotal}
                  />
                )}
                {totals.sgstTotal > 0 && (
                  <AmountRow
                    label={`${taxPrefix} SGST Reversed`}
                    value={totals.sgstTotal}
                  />
                )}
                {totals.igstTotal > 0 && (
                  <AmountRow
                    label={`${taxPrefix} IGST Reversed`}
                    value={totals.igstTotal}
                  />
                )}
                {totals.cessTotal > 0 && (
                  <AmountRow
                    label="Cess Reversed"
                    value={totals.cessTotal}
                  />
                )}
                <AmountRow
                  label={isCredit ? "Credit Total" : "Debit Total"}
                  value={totals.grandTotal}
                  strong
                />
              </div>
            </section>

            <section className="gst-return-tax-summary border-t border-slate-900">
              <div className="bg-[#f4f1ff] px-3 py-1.5 text-center font-black uppercase tracking-[0.08em]">
                HSN/SAC Tax Reversal Summary
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] border-collapse">
                  <thead>
                    <tr>
                      <TableHeader className="text-center">
                        HSN/SAC
                      </TableHeader>
                      <TableHeader className="text-right">
                        Taxable
                      </TableHeader>
                      <TableHeader className="text-right">
                        GST Rate
                      </TableHeader>
                      <TableHeader className="text-right">
                        CGST
                      </TableHeader>
                      <TableHeader className="text-right">
                        SGST
                      </TableHeader>
                      <TableHeader className="text-right">
                        IGST
                      </TableHeader>
                      <TableHeader className="text-right">
                        Cess
                      </TableHeader>
                      <TableHeader className="text-right">
                        Total Tax
                      </TableHeader>
                    </tr>
                  </thead>

                  <tbody>
                    {hsnSummary.map((row) => (
                      <tr key={row.key}>
                        <TableCell className="text-center">
                          {row.hsnSacCode}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCompactNumber(row.taxableAmount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCompactNumber(row.gstRate)}%
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCompactNumber(row.cgstAmount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCompactNumber(row.sgstAmount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCompactNumber(row.igstAmount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCompactNumber(row.cessAmount)}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCompactNumber(row.totalTax)}
                        </TableCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <footer className="gst-return-footer grid min-h-[112px] border-t border-slate-900 md:grid-cols-[1.2fr_0.8fr]">
              <div className="border-b border-slate-900 p-3 md:border-b-0 md:border-r">
                <p className="font-black">Declaration</p>
                <p className="mt-1 max-w-xl">
                  This return document adjusts the referenced
                  transaction for the returned goods and the GST
                  amounts shown above.
                </p>

                <p className="mt-5 text-[10px] text-slate-600">
                  This is a computer-generated document from
                  VertexERP.
                </p>
              </div>

              <div className="flex flex-col justify-between p-3 text-right">
                <div>
                  <p>For</p>
                  <p className="font-black uppercase">
                    {displayCompanyName}
                  </p>
                </div>

                <div>
                  <div className="ml-auto w-44 border-t border-slate-900 pt-1 text-center font-semibold">
                    Authorised Signatory
                  </div>
                </div>
              </div>
            </footer>
          </div>
        </article>
      </div>
    </>
  );
}

function DocumentCell({
  label,
  value,
  valueClassName = "",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="min-h-[52px] border-b border-r border-slate-900 p-2 last:border-r-0">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-600">
        {label}
      </p>
      <p
        className={`mt-1 break-words font-bold ${valueClassName}`}
      >
        {value || "—"}
      </p>
    </div>
  );
}

function TableHeader({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`border-r border-t border-slate-900 px-2 py-2 font-bold last:border-r-0 ${className}`}
    >
      {children}
    </th>
  );
}

function TableCell({
  children,
  className = "",
  colSpan,
}: {
  children?: ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`border-r border-t border-slate-900 px-2 py-2 last:border-r-0 ${className}`}
    >
      {children}
    </td>
  );
}

function AmountRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between border-b border-slate-900 px-3 py-1.5 last:border-b-0 ${
        strong ? "text-[12px] font-black" : ""
      }`}
    >
      <span>{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}