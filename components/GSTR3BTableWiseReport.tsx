"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ProfileRow = {
  active_company_id: string | null;
};

type CompanyRow = {
  state: string | null;
  state_code: string | null;
};

type LedgerRow = {
  id: string;
  name: string;
  gst_number: string | null;
};

type TaxItemRow = {
  taxable_amount: number | string | null;
  cgst_amount: number | string | null;
  sgst_amount: number | string | null;
  igst_amount: number | string | null;
  cess_amount: number | string | null;
};

type SaleRow = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  tax_type: string | null;
  place_of_supply: string | null;
  place_of_supply_code: string | null;
  customer: LedgerRow | LedgerRow[] | null;
  sale_items: TaxItemRow[] | null;
};

type CreditNoteRow = {
  id: string;
  source_sale_id: string;
  credit_note_number: string;
  credit_note_date: string;
  tax_type: string | null;
  place_of_supply: string | null;
  place_of_supply_code: string | null;
  status: "POSTED" | "VOID";
  credit_note_items: TaxItemRow[] | null;
};

type PurchaseRow = {
  id: string;
  bill_number: string;
  purchase_date: string;
  tax_type: string | null;
  place_of_supply: string | null;
  place_of_supply_code: string | null;
  reverse_charge_applicable: boolean | null;
  itc_status: string | null;
  itc_ineligibility_reason: string | null;
  eligible_cgst: number | string | null;
  eligible_sgst: number | string | null;
  eligible_igst: number | string | null;
  eligible_cess: number | string | null;
  ineligible_cgst: number | string | null;
  ineligible_sgst: number | string | null;
  ineligible_igst: number | string | null;
  ineligible_cess: number | string | null;
  supplier: LedgerRow | LedgerRow[] | null;
  purchase_items: TaxItemRow[] | null;
};

type DebitNoteRow = {
  id: string;
  source_purchase_id: string;
  debit_note_number: string;
  debit_note_date: string;
  status: "POSTED" | "VOID";
  source_itc_percentage: number | string | null;
  debit_note_items: TaxItemRow[] | null;
};

type SourceSaleRow = {
  id: string;
  tax_type: string | null;
  place_of_supply: string | null;
  place_of_supply_code: string | null;
  customer: LedgerRow | LedgerRow[] | null;
};

type SourcePurchaseRow = {
  id: string;
  tax_type: string | null;
  place_of_supply: string | null;
  place_of_supply_code: string | null;
  reverse_charge_applicable: boolean | null;
};

type TaxVector = {
  taxable: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  count: number;
};

type GstrRow = TaxVector & {
  code: string;
  label: string;
  note: string;
};

type StateRow = {
  key: string;
  stateCode: string;
  stateName: string;
  unregisteredTaxable: number;
  unregisteredIgst: number;
  compositionTaxable: number;
  compositionIgst: number;
  uinTaxable: number;
  uinIgst: number;
};

type ReviewGap = {
  title: string;
  detail: string;
  severity: "WARNING" | "INFO";
};

type ReportData = {
  section31: GstrRow[];
  section311: GstrRow[];
  section32: StateRow[];
  table4: GstrRow[];
  table5: GstrRow[];
  table51: GstrRow[];
  liability: TaxVector;
  netItc: TaxVector;
  estimatedCashBeforeSetoff: number;
  pendingReviewTax: number;
  unclassifiedSalesCount: number;
  unclassifiedPurchaseCount: number;
  unsafeEligibleCount: number;
  gaps: ReviewGap[];
};

const EMPTY_VECTOR: TaxVector = {
  taxable: 0,
  igst: 0,
  cgst: 0,
  sgst: 0,
  cess: 0,
  count: 0,
};

const VALID_GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

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

function emptyVector(): TaxVector {
  return { ...EMPTY_VECTOR };
}

function addVector(left: TaxVector, right: TaxVector): TaxVector {
  return {
    taxable: roundMoney(left.taxable + right.taxable),
    igst: roundMoney(left.igst + right.igst),
    cgst: roundMoney(left.cgst + right.cgst),
    sgst: roundMoney(left.sgst + right.sgst),
    cess: roundMoney(left.cess + right.cess),
    count: left.count + right.count,
  };
}

function subtractVector(left: TaxVector, right: TaxVector): TaxVector {
  return {
    taxable: roundMoney(left.taxable - right.taxable),
    igst: roundMoney(left.igst - right.igst),
    cgst: roundMoney(left.cgst - right.cgst),
    sgst: roundMoney(left.sgst - right.sgst),
    cess: roundMoney(left.cess - right.cess),
    count: left.count - right.count,
  };
}

function clampTaxVector(vector: TaxVector): TaxVector {
  return {
    taxable: roundMoney(Math.max(vector.taxable, 0)),
    igst: roundMoney(Math.max(vector.igst, 0)),
    cgst: roundMoney(Math.max(vector.cgst, 0)),
    sgst: roundMoney(Math.max(vector.sgst, 0)),
    cess: roundMoney(Math.max(vector.cess, 0)),
    count: Math.max(vector.count, 0),
  };
}

function totalTax(vector: TaxVector) {
  return roundMoney(vector.igst + vector.cgst + vector.sgst + vector.cess);
}

function vectorFromItems(items: TaxItemRow[] | null): TaxVector {
  return (items || []).reduce<TaxVector>(
    (total, item) => ({
      taxable: total.taxable + toNumber(item.taxable_amount),
      igst: total.igst + toNumber(item.igst_amount),
      cgst: total.cgst + toNumber(item.cgst_amount),
      sgst: total.sgst + toNumber(item.sgst_amount),
      cess: total.cess + toNumber(item.cess_amount),
      count: total.count,
    }),
    { ...EMPTY_VECTOR, count: 1 },
  );
}

function vectorFromPurchaseEligibility(
  purchase: PurchaseRow,
  eligible: boolean,
): TaxVector {
  return {
    taxable: 0,
    igst: toNumber(
      eligible ? purchase.eligible_igst : purchase.ineligible_igst,
    ),
    cgst: toNumber(
      eligible ? purchase.eligible_cgst : purchase.ineligible_cgst,
    ),
    sgst: toNumber(
      eligible ? purchase.eligible_sgst : purchase.ineligible_sgst,
    ),
    cess: toNumber(
      eligible ? purchase.eligible_cess : purchase.ineligible_cess,
    ),
    count: 1,
  };
}

function vectorFromDebitNoteReversal(note: DebitNoteRow): TaxVector {
  const tax = vectorFromItems(note.debit_note_items);
  const percentage = Math.min(
    Math.max(toNumber(note.source_itc_percentage), 0),
    100,
  );

  return {
    taxable: 0,
    igst: roundMoney((tax.igst * percentage) / 100),
    cgst: roundMoney((tax.cgst * percentage) / 100),
    sgst: roundMoney((tax.sgst * percentage) / 100),
    cess: roundMoney((tax.cess * percentage) / 100),
    count: 1,
  };
}

function getJoinedLedger(
  ledger: LedgerRow | LedgerRow[] | null,
): LedgerRow | null {
  return Array.isArray(ledger) ? ledger[0] || null : ledger;
}

function isValidGstin(value: string | null | undefined) {
  return VALID_GSTIN.test(String(value || "").trim().toUpperCase());
}

function isBlockedReason(reason: string | null) {
  const normalized = String(reason || "").trim().toLowerCase();

  return [
    "personal / non-business use",
    "motor vehicle restriction",
    "food & beverages",
    "club / membership",
    "construction of immovable property",
    "goods lost / stolen / destroyed",
  ].includes(normalized);
}

function getIneligibleReportingBucket(reason: string | null) {
  const normalized = String(reason || "").trim().toLowerCase();

  if (isBlockedReason(reason)) return "B1" as const;
  if (normalized === "time limit expired") return "D2" as const;
  if (normalized === "composition supplier") return "EXCLUDE" as const;
  return "B2" as const;
}

function supplySection(taxType: string | null) {
  const normalized = String(taxType || "UNCLASSIFIED").toUpperCase();

  if (normalized === "ZERO_RATED") return "3.1(b)";
  if (normalized === "EXEMPT") return "3.1(c)";
  if (normalized === "NON_GST") return "3.1(e)";
  if (normalized === "INTRA_STATE" || normalized === "INTER_STATE") {
    return "3.1(a)";
  }

  return "UNCLASSIFIED";
}

function makeGstrRow(
  code: string,
  label: string,
  vector: TaxVector,
  note: string,
): GstrRow {
  return {
    code,
    label,
    ...vector,
    note,
  };
}

function makeStateKey(code: string, name: string) {
  return `${code || "--"}|${name || "State not available"}`;
}

function buildReport({
  company,
  sales,
  creditNotes,
  purchases,
  debitNotes,
  sourceSales,
  sourcePurchases,
}: {
  company: CompanyRow | null;
  sales: SaleRow[];
  creditNotes: CreditNoteRow[];
  purchases: PurchaseRow[];
  debitNotes: DebitNoteRow[];
  sourceSales: SourceSaleRow[];
  sourcePurchases: SourcePurchaseRow[];
}): ReportData {
  const grossBySection = new Map<string, TaxVector>();
  const creditBySection = new Map<string, TaxVector>();
  const sourceSaleById = new Map(sourceSales.map((sale) => [sale.id, sale]));
  const sourcePurchaseById = new Map(
    sourcePurchases.map((purchase) => [purchase.id, purchase]),
  );

  let unclassifiedSalesCount = 0;
  let unclassifiedPurchaseCount = 0;
  let unsafeEligibleCount = 0;
  let pendingReviewTax = 0;

  sales.forEach((sale) => {
    const section = supplySection(sale.tax_type);
    const vector = vectorFromItems(sale.sale_items);

    if (section === "UNCLASSIFIED") {
      unclassifiedSalesCount += 1;
      return;
    }

    grossBySection.set(
      section,
      addVector(grossBySection.get(section) || emptyVector(), vector),
    );
  });

  creditNotes
    .filter((note) => note.status === "POSTED")
    .forEach((note) => {
      const source = sourceSaleById.get(note.source_sale_id);
      const section = supplySection(note.tax_type || source?.tax_type || null);
      const vector = vectorFromItems(note.credit_note_items);

      if (section === "UNCLASSIFIED") {
        unclassifiedSalesCount += 1;
        return;
      }

      creditBySection.set(
        section,
        addVector(creditBySection.get(section) || emptyVector(), vector),
      );
    });

  const section31a = subtractVector(
    grossBySection.get("3.1(a)") || emptyVector(),
    creditBySection.get("3.1(a)") || emptyVector(),
  );
  const section31b = subtractVector(
    grossBySection.get("3.1(b)") || emptyVector(),
    creditBySection.get("3.1(b)") || emptyVector(),
  );
  const section31c = subtractVector(
    grossBySection.get("3.1(c)") || emptyVector(),
    creditBySection.get("3.1(c)") || emptyVector(),
  );
  const section31e = subtractVector(
    grossBySection.get("3.1(e)") || emptyVector(),
    creditBySection.get("3.1(e)") || emptyVector(),
  );

  let grossRcm = emptyVector();
  let rcmDebitReduction = emptyVector();

  purchases.forEach((purchase) => {
    const itemTax = vectorFromItems(purchase.purchase_items);
    const supplier = getJoinedLedger(purchase.supplier);

    if (String(purchase.tax_type || "UNCLASSIFIED") === "UNCLASSIFIED") {
      unclassifiedPurchaseCount += 1;
    }

    if (purchase.itc_status === "PENDING_REVIEW") {
      pendingReviewTax += totalTax(itemTax);
    }

    if (
      !purchase.reverse_charge_applicable &&
      !isValidGstin(supplier?.gst_number) &&
      (purchase.itc_status === "ELIGIBLE" ||
        purchase.itc_status === "PARTIAL")
    ) {
      unsafeEligibleCount += 1;
    }

    if (purchase.reverse_charge_applicable) {
      grossRcm = addVector(grossRcm, itemTax);
    }
  });

  debitNotes
    .filter((note) => note.status === "POSTED")
    .forEach((note) => {
      const source = sourcePurchaseById.get(note.source_purchase_id);

      if (source?.reverse_charge_applicable) {
        rcmDebitReduction = addVector(
          rcmDebitReduction,
          vectorFromItems(note.debit_note_items),
        );
      }
    });

  const section31d = subtractVector(grossRcm, rcmDebitReduction);

  const section31: GstrRow[] = [
    makeGstrRow(
      "3.1(a)",
      "Outward taxable supplies (other than zero-rated, nil-rated and exempt)",
      section31a,
      "Net of posted Sales Credit Notes classified as taxable supplies.",
    ),
    makeGstrRow(
      "3.1(b)",
      "Outward taxable supplies (zero-rated)",
      section31b,
      "Uses ZERO_RATED transaction classification, net of posted Credit Notes.",
    ),
    makeGstrRow(
      "3.1(c)",
      "Other outward supplies (nil-rated and exempt)",
      section31c,
      "Uses EXEMPT transaction classification. Tax heads should normally remain zero.",
    ),
    makeGstrRow(
      "3.1(d)",
      "Inward supplies liable to reverse charge",
      section31d,
      "RCM Purchase Bills net of posted Purchase Returns linked to RCM purchases.",
    ),
    makeGstrRow(
      "3.1(e)",
      "Non-GST outward supplies",
      section31e,
      "Populates only when a transaction is explicitly classified as NON_GST.",
    ),
  ];

  const section311 = [
    makeGstrRow(
      "3.1.1(i)",
      "Taxable supplies on which electronic commerce operator pays tax u/s 9(5)",
      emptyVector(),
      "Section 9(5) operator-supply classification is not yet stored separately in VertexERP.",
    ),
    makeGstrRow(
      "3.1.1(ii)",
      "Tax payable by electronic commerce operator u/s 9(5)",
      emptyVector(),
      "Electronic commerce operator liability is not yet configured.",
    ),
  ];

  const section32Map = new Map<string, StateRow>();

  function addUnregisteredStateSupply(
    stateCode: string,
    stateName: string,
    vector: TaxVector,
    multiplier: 1 | -1,
  ) {
    const key = makeStateKey(stateCode, stateName);
    const current = section32Map.get(key) || {
      key,
      stateCode: stateCode || "—",
      stateName: stateName || "State not available",
      unregisteredTaxable: 0,
      unregisteredIgst: 0,
      compositionTaxable: 0,
      compositionIgst: 0,
      uinTaxable: 0,
      uinIgst: 0,
    };

    current.unregisteredTaxable = roundMoney(
      current.unregisteredTaxable + multiplier * vector.taxable,
    );
    current.unregisteredIgst = roundMoney(
      current.unregisteredIgst + multiplier * vector.igst,
    );

    section32Map.set(key, current);
  }

  sales.forEach((sale) => {
    if (String(sale.tax_type || "") !== "INTER_STATE") return;

    const customer = getJoinedLedger(sale.customer);
    if (isValidGstin(customer?.gst_number)) return;

    addUnregisteredStateSupply(
      sale.place_of_supply_code || "",
      sale.place_of_supply || "",
      vectorFromItems(sale.sale_items),
      1,
    );
  });

  creditNotes
    .filter((note) => note.status === "POSTED")
    .forEach((note) => {
      const source = sourceSaleById.get(note.source_sale_id);
      const taxType = note.tax_type || source?.tax_type || "";
      if (taxType !== "INTER_STATE") return;

      const customer = getJoinedLedger(source?.customer || null);
      if (isValidGstin(customer?.gst_number)) return;

      addUnregisteredStateSupply(
        note.place_of_supply_code || source?.place_of_supply_code || "",
        note.place_of_supply || source?.place_of_supply || "",
        vectorFromItems(note.credit_note_items),
        -1,
      );
    });

  const section32 = Array.from(section32Map.values())
    .map((row) => ({
      ...row,
      unregisteredTaxable: Math.max(row.unregisteredTaxable, 0),
      unregisteredIgst: Math.max(row.unregisteredIgst, 0),
    }))
    .filter(
      (row) =>
        row.unregisteredTaxable > 0 ||
        row.unregisteredIgst > 0 ||
        row.compositionTaxable > 0 ||
        row.uinTaxable > 0,
    )
    .sort((left, right) =>
      `${left.stateCode}${left.stateName}`.localeCompare(
        `${right.stateCode}${right.stateName}`,
      ),
    );

  let itcA3 = emptyVector();
  let itcA5 = emptyVector();
  let reversalB1 = emptyVector();
  let reversalB2 = emptyVector();
  let informationD2 = emptyVector();

  purchases.forEach((purchase) => {
    const supplier = getJoinedLedger(purchase.supplier);
    const eligible = vectorFromPurchaseEligibility(purchase, true);
    const ineligible = vectorFromPurchaseEligibility(purchase, false);
    const eligibleAllowed =
      Boolean(purchase.reverse_charge_applicable) ||
      isValidGstin(supplier?.gst_number);

    if (!eligibleAllowed) return;
    if (purchase.itc_status === "PENDING_REVIEW") return;
    if (purchase.itc_status === "NOT_APPLICABLE") return;

    const reportingBucket = getIneligibleReportingBucket(
      purchase.itc_ineligibility_reason,
    );

    let available = eligible;

    if (reportingBucket === "B1" || reportingBucket === "B2") {
      available = addVector(available, ineligible);
    }

    if (purchase.reverse_charge_applicable) {
      itcA3 = addVector(itcA3, available);
    } else {
      itcA5 = addVector(itcA5, available);
    }

    if (reportingBucket === "B1") {
      reversalB1 = addVector(reversalB1, ineligible);
    } else if (reportingBucket === "B2") {
      reversalB2 = addVector(reversalB2, ineligible);
    } else if (reportingBucket === "D2") {
      informationD2 = addVector(informationD2, ineligible);
    }
  });

  debitNotes
    .filter((note) => note.status === "POSTED")
    .forEach((note) => {
      reversalB2 = addVector(
        reversalB2,
        vectorFromDebitNoteReversal(note),
      );
    });

  const totalItcAvailable = addVector(itcA3, itcA5);
  const totalItcReversed = addVector(reversalB1, reversalB2);
  const netItc = clampTaxVector(
    subtractVector(totalItcAvailable, totalItcReversed),
  );

  const table4: GstrRow[] = [
    makeGstrRow(
      "4(A)(1)",
      "Import of goods",
      emptyVector(),
      "Import-of-goods ITC is not separately classified in the current purchase workflow.",
    ),
    makeGstrRow(
      "4(A)(2)",
      "Import of services",
      emptyVector(),
      "Import-of-services ITC is not separately classified in the current purchase workflow.",
    ),
    makeGstrRow(
      "4(A)(3)",
      "Inward supplies liable to reverse charge",
      itcA3,
      "Eligible ITC snapshot on RCM purchases. Claim remains subject to RCM tax payment and statutory conditions.",
    ),
    makeGstrRow(
      "4(A)(4)",
      "Inward supplies from ISD",
      emptyVector(),
      "Input Service Distributor credit is not separately recorded in VertexERP.",
    ),
    makeGstrRow(
      "4(A)(5)",
      "All other ITC",
      itcA5,
      "Eligible ITC on non-RCM purchases after supplier-GSTIN guardrails.",
    ),
    makeGstrRow(
      "4(B)(1)",
      "ITC reversed as per Rules 38, 42, 43 and section 17(5)",
      reversalB1,
      "Non-reclaimable blocked / restricted ITC mapped from permanent purchase ineligibility reasons.",
    ),
    makeGstrRow(
      "4(B)(2)",
      "Other ITC reversals",
      reversalB2,
      "Reclaimable / other restrictions plus eligible ITC reversals generated from posted Purchase Returns / Debit Notes.",
    ),
    makeGstrRow(
      "4(C)",
      "Net ITC available (A minus B)",
      netItc,
      "Operational net ITC before portal reconciliation, set-off and filing review.",
    ),
    makeGstrRow(
      "4(D)(1)",
      "ITC reclaimed which was reversed under 4(B)(2) earlier",
      emptyVector(),
      "ITC reclaim tracking is not yet implemented.",
    ),
    makeGstrRow(
      "4(D)(2)",
      "Ineligible ITC / restricted credit information",
      informationD2,
      "Currently populated from Time Limit Expired purchase restrictions. Place-of-Supply restrictions need a dedicated reason field.",
    ),
  ];

  let intraExempt = emptyVector();
  let interExempt = emptyVector();
  let intraExemptReturns = emptyVector();
  let interExemptReturns = emptyVector();
  const companyStateCode = String(company?.state_code || "");

  purchases.forEach((purchase) => {
    if (String(purchase.tax_type || "") !== "EXEMPT") return;

    const vector = vectorFromItems(purchase.purchase_items);
    const isIntra =
      companyStateCode && purchase.place_of_supply_code
        ? companyStateCode === purchase.place_of_supply_code
        : true;

    if (isIntra) intraExempt = addVector(intraExempt, vector);
    else interExempt = addVector(interExempt, vector);
  });

  debitNotes
    .filter((note) => note.status === "POSTED")
    .forEach((note) => {
      const source = sourcePurchaseById.get(note.source_purchase_id);
      if (String(source?.tax_type || "") !== "EXEMPT") return;

      const vector = vectorFromItems(note.debit_note_items);
      const isIntra =
        companyStateCode && source?.place_of_supply_code
          ? companyStateCode === source.place_of_supply_code
          : true;

      if (isIntra) {
        intraExemptReturns = addVector(intraExemptReturns, vector);
      } else {
        interExemptReturns = addVector(interExemptReturns, vector);
      }
    });

  const table5: GstrRow[] = [
    makeGstrRow(
      "5.1(a)-Inter",
      "Inter-State supplies from composition, exempt and nil-rated suppliers",
      subtractVector(interExempt, interExemptReturns),
      "Current records combine exempt and nil-rated inward supplies; composition supplier classification is not separate.",
    ),
    makeGstrRow(
      "5.1(a)-Intra",
      "Intra-State supplies from composition, exempt and nil-rated suppliers",
      subtractVector(intraExempt, intraExemptReturns),
      "Current records combine exempt and nil-rated inward supplies; composition supplier classification is not separate.",
    ),
    makeGstrRow(
      "5.1(b)-Inter",
      "Inter-State non-GST inward supplies",
      emptyVector(),
      "Non-GST inward-supply classification is not yet stored separately.",
    ),
    makeGstrRow(
      "5.1(b)-Intra",
      "Intra-State non-GST inward supplies",
      emptyVector(),
      "Non-GST inward-supply classification is not yet stored separately.",
    ),
  ];

  const table51: GstrRow[] = [
    makeGstrRow(
      "5.1",
      "Interest and late fee for previous tax period",
      emptyVector(),
      "Interest and late-fee computation is not tracked in VertexERP yet; verify the GST Portal system-computed amount.",
    ),
  ];

  const liability = [section31a, section31b, section31d].reduce(
    (total, row) => addVector(total, row),
    emptyVector(),
  );

  const estimatedCashBeforeSetoff = roundMoney(
    Math.max(totalTax(liability) - totalTax(netItc), 0),
  );

  const gaps: ReviewGap[] = [];

  if (unclassifiedSalesCount > 0) {
    gaps.push({
      title: "Unclassified outward documents excluded",
      detail: `${unclassifiedSalesCount} Sales / Credit Note document(s) could not be placed in Table 3.1. Complete GST tax classification first.`,
      severity: "WARNING",
    });
  }

  if (unclassifiedPurchaseCount > 0) {
    gaps.push({
      title: "Unclassified purchase documents need review",
      detail: `${unclassifiedPurchaseCount} Purchase Bill(s) have pending GST classification and may affect RCM or Table 5 working values.`,
      severity: "WARNING",
    });
  }

  if (pendingReviewTax > 0) {
    gaps.push({
      title: "ITC still pending review",
      detail: `${formatCurrency(
        pendingReviewTax,
      )} of purchase GST remains Pending Review and is not included in Net ITC.`,
      severity: "WARNING",
    });
  }

  if (unsafeEligibleCount > 0) {
    gaps.push({
      title: "Unregistered-supplier ITC risk",
      detail: `${unsafeEligibleCount} legacy purchase bill(s) are marked Eligible / Partial without a valid supplier GSTIN under normal charge. They are excluded from Table 4(A)(5).`,
      severity: "WARNING",
    });
  }

  gaps.push(
    {
      title: "Table 3.2 composition and UIN categories",
      detail:
        "The current customer ledger does not separately classify Composition Taxpayers and UIN holders, so those columns remain zero. Unregistered inter-state supplies are derived from missing/invalid recipient GSTIN.",
      severity: "INFO",
    },
    {
      title: "Imports, ISD, ITC reclaim and rule-specific reversals",
      detail:
        "These statutory categories are shown but remain zero until dedicated transaction classifications are added. Do not treat zero as final confirmation that no portal value exists.",
      severity: "INFO",
    },
    {
      title: "Tax payment set-off",
      detail:
        "The estimated cash figure is total liability minus total Net ITC only. CGST/SGST/IGST utilization order, interest, late fee and electronic-ledger balances require separate statutory set-off logic.",
      severity: "INFO",
    },
  );

  return {
    section31,
    section311,
    section32,
    table4,
    table5,
    table51,
    liability,
    netItc,
    estimatedCashBeforeSetoff,
    pendingReviewTax: roundMoney(pendingReviewTax),
    unclassifiedSalesCount,
    unclassifiedPurchaseCount,
    unsafeEligibleCount,
    gaps,
  };
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildRowsForExport(report: ReportData) {
  const rows: unknown[][] = [
    [
      "Section",
      "Description",
      "Taxable Value",
      "IGST",
      "CGST",
      "SGST/UTGST",
      "Cess",
      "Document Count",
      "Review Note",
    ],
  ];

  [
    ...report.section31,
    ...report.section311,
    ...report.table4,
    ...report.table5,
    ...report.table51,
  ].forEach(
    (row) => {
      rows.push([
        row.code,
        row.label,
        row.taxable,
        row.igst,
        row.cgst,
        row.sgst,
        row.cess,
        row.count,
        row.note,
      ]);
    },
  );

  rows.push([]);
  rows.push([
    "Table 3.2 State",
    "State Name",
    "Unregistered Taxable",
    "Unregistered IGST",
    "Composition Taxable",
    "Composition IGST",
    "UIN Taxable",
    "UIN IGST",
  ]);

  report.section32.forEach((row) => {
    rows.push([
      row.stateCode,
      row.stateName,
      row.unregisteredTaxable,
      row.unregisteredIgst,
      row.compositionTaxable,
      row.compositionIgst,
      row.uinTaxable,
      row.uinIgst,
    ]);
  });

  rows.push([]);
  rows.push(["Payment Planning", "Amount"]);
  rows.push(["Total Tax Liability", totalTax(report.liability)]);
  rows.push(["Net ITC Available", totalTax(report.netItc)]);
  rows.push([
    "Estimated Cash Before Statutory Set-off",
    report.estimatedCashBeforeSetoff,
  ]);

  return rows;
}

export default function GSTR3BTableWiseReport({
  fromDate,
  toDate,
}: {
  fromDate?: string;
  toDate?: string;
}) {
  const [report, setReport] = useState<ReportData | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  async function loadReport() {
    setIsLoading(true);
    setMessage("");

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Please sign in to view the GSTR-3B working paper.");
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("active_company_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      const companyId =
        (profile as ProfileRow | null)?.active_company_id || null;

      if (!companyId) {
        throw new Error("Select an active company first.");
      }

      const companyPromise = supabase
        .from("companies")
        .select("state, state_code")
        .eq("id", companyId)
        .maybeSingle();

      let salesQuery = supabase
        .from("sales")
        .select(`
          id,
          invoice_number,
          invoice_date,
          tax_type,
          place_of_supply,
          place_of_supply_code,
          customer:ledgers!sales_customer_id_fkey(id,name,gst_number),
          sale_items(taxable_amount,cgst_amount,sgst_amount,igst_amount,cess_amount)
        `)
        .eq("company_id", companyId);

      let creditQuery = supabase
        .from("credit_notes")
        .select(`
          id,
          source_sale_id,
          credit_note_number,
          credit_note_date,
          tax_type,
          place_of_supply,
          place_of_supply_code,
          status,
          credit_note_items(taxable_amount,cgst_amount,sgst_amount,igst_amount,cess_amount)
        `)
        .eq("company_id", companyId)
        .eq("status", "POSTED");

      let purchaseQuery = supabase
        .from("purchases")
        .select(`
          id,
          bill_number,
          purchase_date,
          tax_type,
          place_of_supply,
          place_of_supply_code,
          reverse_charge_applicable,
          itc_status,
          itc_ineligibility_reason,
          eligible_cgst,
          eligible_sgst,
          eligible_igst,
          eligible_cess,
          ineligible_cgst,
          ineligible_sgst,
          ineligible_igst,
          ineligible_cess,
          supplier:ledgers!purchases_supplier_id_fkey(id,name,gst_number),
          purchase_items(taxable_amount,cgst_amount,sgst_amount,igst_amount,cess_amount)
        `)
        .eq("company_id", companyId);

      let debitQuery = supabase
        .from("debit_notes")
        .select(`
          id,
          source_purchase_id,
          debit_note_number,
          debit_note_date,
          status,
          source_itc_percentage,
          debit_note_items(taxable_amount,cgst_amount,sgst_amount,igst_amount,cess_amount)
        `)
        .eq("company_id", companyId)
        .eq("status", "POSTED");

      if (fromDate) {
        salesQuery = salesQuery.gte("invoice_date", fromDate);
        creditQuery = creditQuery.gte("credit_note_date", fromDate);
        purchaseQuery = purchaseQuery.gte("purchase_date", fromDate);
        debitQuery = debitQuery.gte("debit_note_date", fromDate);
      }

      if (toDate) {
        salesQuery = salesQuery.lte("invoice_date", toDate);
        creditQuery = creditQuery.lte("credit_note_date", toDate);
        purchaseQuery = purchaseQuery.lte("purchase_date", toDate);
        debitQuery = debitQuery.lte("debit_note_date", toDate);
      }

      const [companyResponse, salesResponse, creditResponse, purchaseResponse, debitResponse] =
        await Promise.all([
          companyPromise,
          salesQuery,
          creditQuery,
          purchaseQuery,
          debitQuery,
        ]);

      if (companyResponse.error) throw companyResponse.error;
      if (salesResponse.error) throw salesResponse.error;
      if (creditResponse.error) throw creditResponse.error;
      if (purchaseResponse.error) throw purchaseResponse.error;
      if (debitResponse.error) throw debitResponse.error;

      const sales = (salesResponse.data || []) as unknown as SaleRow[];
      const creditNotes = (creditResponse.data || []) as unknown as CreditNoteRow[];
      const purchases = (purchaseResponse.data || []) as unknown as PurchaseRow[];
      const debitNotes = (debitResponse.data || []) as unknown as DebitNoteRow[];

      const sourceSaleIds = Array.from(
        new Set(creditNotes.map((note) => note.source_sale_id).filter(Boolean)),
      );
      const sourcePurchaseIds = Array.from(
        new Set(
          debitNotes.map((note) => note.source_purchase_id).filter(Boolean),
        ),
      );

      let sourceSales: SourceSaleRow[] = [];
      let sourcePurchases: SourcePurchaseRow[] = [];

      if (sourceSaleIds.length > 0) {
        const { data, error } = await supabase
          .from("sales")
          .select(`
            id,
            tax_type,
            place_of_supply,
            place_of_supply_code,
            customer:ledgers!sales_customer_id_fkey(id,name,gst_number)
          `)
          .eq("company_id", companyId)
          .in("id", sourceSaleIds);

        if (error) throw error;
        sourceSales = (data || []) as unknown as SourceSaleRow[];
      }

      if (sourcePurchaseIds.length > 0) {
        const { data, error } = await supabase
          .from("purchases")
          .select(`
            id,
            tax_type,
            place_of_supply,
            place_of_supply_code,
            reverse_charge_applicable
          `)
          .eq("company_id", companyId)
          .in("id", sourcePurchaseIds);

        if (error) throw error;
        sourcePurchases = (data || []) as SourcePurchaseRow[];
      }

      setReport(
        buildReport({
          company: (companyResponse.data as CompanyRow | null) || null,
          sales,
          creditNotes,
          purchases,
          debitNotes,
          sourceSales,
          sourcePurchases,
        }),
      );
    } catch (error) {
      setReport(null);
      setMessage(
        error instanceof Error
          ? error.message
          : "GSTR-3B table-wise report could not be generated.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadReport();

    const events = [
      "vertexerp-sales-updated",
      "vertexerp-purchases-updated",
      "vertexerp-gst-data-updated",
      "vertexerp-active-company-updated",
    ];

    events.forEach((eventName) =>
      window.addEventListener(eventName, loadReport),
    );

    return () => {
      events.forEach((eventName) =>
        window.removeEventListener(eventName, loadReport),
      );
    };
  }, [fromDate, toDate]);

  const reviewCount = useMemo(() => {
    if (!report) return 0;
    return report.gaps.filter((gap) => gap.severity === "WARNING").length;
  }, [report]);

  function exportReport() {
    if (!report) return;
    downloadCsv(
      `vertexerp-gstr3b-tablewise-${fromDate || "all"}-${toDate || "all"}.csv`,
      buildRowsForExport(report),
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-xl shadow-violet-100/40">
      <div className="bg-gradient-to-r from-violet-950 via-violet-800 to-violet-700 p-5 text-white sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-violet-100">
              <FileSpreadsheet className="h-5 w-5" />
              <p className="text-sm font-black uppercase tracking-[0.18em]">
                GSTR-3B Working Paper
              </p>
            </div>
            <h2 className="mt-3 text-2xl font-black sm:text-3xl">
              Exact Table-wise Review Layout
            </h2>
            <p className="mt-2 max-w-3xl leading-7 text-violet-100">
              Review Table 3.1, 3.1.1, 3.2, Table 4 ITC, Table 5 inward
              supplies and tax-payment planning from VertexERP books.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={loadReport}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-3 font-black text-white transition hover:bg-white/20 disabled:opacity-60"
            >
              <RefreshCw
                className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
            <button
              type="button"
              onClick={exportReport}
              disabled={!report || isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 font-black text-violet-700 transition hover:bg-violet-50 disabled:opacity-60"
            >
              <Download className="h-5 w-5" />
              Export Table-wise CSV
            </button>
          </div>
        </div>
      </div>

      {message && (
        <div className="border-b border-red-200 bg-red-50 px-5 py-4 font-semibold text-red-700 sm:px-6">
          {message}
        </div>
      )}

      {isLoading && !report ? (
        <div className="p-10 text-center font-semibold text-slate-600">
          Generating GSTR-3B table-wise working paper...
        </div>
      ) : report ? (
        <div className="space-y-6 p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Tax Liability"
              value={totalTax(report.liability)}
              tone="rose"
            />
            <Metric
              label="Net ITC"
              value={totalTax(report.netItc)}
              tone="emerald"
            />
            <Metric
              label="Cash Before Set-off"
              value={report.estimatedCashBeforeSetoff}
              tone="violet"
            />
            <Metric
              label="Review Controls"
              value={reviewCount}
              isCurrency={false}
              tone={reviewCount > 0 ? "amber" : "slate"}
            />
          </div>

          <ReportTable
            title="Table 3.1 — Details of Outward Supplies and Inward Supplies Liable to Reverse Charge"
            description="Net values after posted Credit Notes and relevant RCM Purchase Returns."
            rows={report.section31}
          />

          <ReportTable
            title="Table 3.1.1 — Supplies notified under section 9(5)"
            description="Displayed in portal order; dedicated e-commerce-operator classification is not yet configured."
            rows={report.section311}
          />

          <StateWiseTable rows={report.section32} />

          <ReportTable
            title="Table 4 — Eligible ITC"
            description="Eligible, reversed, net and ineligible ITC from purchase compliance snapshots."
            rows={report.table4}
          />

          <ReportTable
            title="Table 5 — Values of Exempt, Nil-rated and Non-GST Inward Supplies"
            description="Current books distinguish Exempt/Nil inward supplies; Non-GST and composition categories need dedicated classification."
            rows={report.table5}
            taxColumns={false}
          />

          <ReportTable
            title="Table 5.1 — Interest and Late Fee"
            description="Portal/system-computed interest and late fee review placeholder."
            rows={report.table51}
          />

          <PaymentPlanning report={report} />

          <div className="overflow-hidden rounded-3xl border border-amber-200 bg-amber-50">
            <div className="flex items-center gap-3 border-b border-amber-200 px-5 py-4 text-amber-900">
              <AlertTriangle className="h-6 w-6" />
              <div>
                <h3 className="text-lg font-black">Filing Controls & Data Gaps</h3>
                <p className="text-sm text-amber-800">
                  Clear warning items before relying on this working paper for filing.
                </p>
              </div>
            </div>
            <div className="divide-y divide-amber-200">
              {report.gaps.map((gap) => (
                <div key={gap.title} className="flex gap-3 px-5 py-4">
                  {gap.severity === "WARNING" ? (
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                  ) : (
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-violet-700" />
                  )}
                  <div>
                    <p className="font-black text-slate-900">{gap.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-700">
                      {gap.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm leading-6 text-violet-900">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              This report mirrors the GSTR-3B table structure as an operational
              working paper. Final portal values, GSTR-2B availability, RCM cash
              payment, statutory reversals, interest, late fee and tax-credit
              utilization must still be reviewed before filing.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Metric({
  label,
  value,
  isCurrency = true,
  tone,
}: {
  label: string;
  value: number;
  isCurrency?: boolean;
  tone: "rose" | "emerald" | "violet" | "amber" | "slate";
}) {
  const styles = {
    rose: "border-rose-200 bg-rose-50 text-rose-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    violet: "border-violet-200 bg-violet-50 text-violet-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    slate: "border-slate-200 bg-slate-50 text-slate-800",
  }[tone];

  return (
    <article className={`rounded-2xl border p-4 ${styles}`}>
      <p className="text-xs font-black uppercase tracking-wide opacity-75">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black">
        {isCurrency ? formatCurrency(value) : value.toLocaleString("en-IN")}
      </p>
    </article>
  );
}

function ReportTable({
  title,
  description,
  rows,
  taxColumns = true,
}: {
  title: string;
  description: string;
  rows: GstrRow[];
  taxColumns?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
        <h3 className="text-lg font-black text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      <div className="max-w-full overflow-x-auto">
        <table className="w-full min-w-[1050px]">
          <thead className="bg-white">
            <tr>
              <Header>Section</Header>
              <Header>Description</Header>
              <Header align="right">Taxable Value</Header>
              {taxColumns && <Header align="right">IGST</Header>}
              {taxColumns && <Header align="right">CGST</Header>}
              {taxColumns && <Header align="right">SGST/UTGST</Header>}
              {taxColumns && <Header align="right">Cess</Header>}
              <Header>Review Note</Header>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.code} className="border-t border-slate-100 align-top">
                <td className="px-4 py-4 font-black text-violet-700">
                  {row.code}
                </td>
                <td className="px-4 py-4 font-semibold text-slate-900">
                  {row.label}
                </td>
                <MoneyCell value={row.taxable} />
                {taxColumns && <MoneyCell value={row.igst} />}
                {taxColumns && <MoneyCell value={row.cgst} />}
                {taxColumns && <MoneyCell value={row.sgst} />}
                {taxColumns && <MoneyCell value={row.cess} />}
                <td className="min-w-[300px] px-4 py-4 text-sm leading-6 text-slate-600">
                  {row.note}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StateWiseTable({ rows }: { rows: StateRow[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
        <h3 className="text-lg font-black text-slate-900">
          Table 3.2 — Inter-State Supplies to Unregistered, Composition and UIN Recipients
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          State-wise unregistered supplies are derived from inter-state invoices
          without a valid recipient GSTIN.
        </p>
      </div>
      <div className="max-w-full overflow-x-auto">
        <table className="w-full min-w-[1120px]">
          <thead className="bg-white">
            <tr>
              <Header>State</Header>
              <Header align="right">Unregistered Taxable</Header>
              <Header align="right">Unregistered IGST</Header>
              <Header align="right">Composition Taxable</Header>
              <Header align="right">Composition IGST</Header>
              <Header align="right">UIN Taxable</Header>
              <Header align="right">UIN IGST</Header>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                  No qualifying inter-state unregistered supplies were found for
                  this period.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.key} className="border-t border-slate-100">
                  <td className="px-4 py-4 font-bold text-slate-900">
                    {row.stateCode} · {row.stateName}
                  </td>
                  <MoneyCell value={row.unregisteredTaxable} />
                  <MoneyCell value={row.unregisteredIgst} />
                  <MoneyCell value={row.compositionTaxable} />
                  <MoneyCell value={row.compositionIgst} />
                  <MoneyCell value={row.uinTaxable} />
                  <MoneyCell value={row.uinIgst} />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PaymentPlanning({ report }: { report: ReportData }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-violet-200 bg-violet-50/50">
      <div className="border-b border-violet-200 px-5 py-4">
        <h3 className="text-lg font-black text-slate-900">
          Tax Payment Planning Review
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Liability and available ITC by tax head. Statutory utilization order is
          intentionally not auto-posted here.
        </p>
      </div>
      <div className="grid gap-4 p-5 lg:grid-cols-2">
        <TaxHeadBlock title="Tax Liability" vector={report.liability} />
        <TaxHeadBlock title="Net ITC Available" vector={report.netItc} />
      </div>
      <div className="border-t border-violet-200 px-5 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-black text-slate-900">
            Estimated Cash Before Statutory Set-off
          </span>
          <span className="text-2xl font-black text-violet-700">
            {formatCurrency(report.estimatedCashBeforeSetoff)}
          </span>
        </div>
      </div>
    </div>
  );
}

function TaxHeadBlock({ title, vector }: { title: string; vector: TaxVector }) {
  return (
    <div className="rounded-2xl border border-white bg-white p-4 shadow-sm">
      <p className="font-black text-slate-900">{title}</p>
      <div className="mt-3 space-y-2">
        <SmallRow label="IGST" value={vector.igst} />
        <SmallRow label="CGST" value={vector.cgst} />
        <SmallRow label="SGST/UTGST" value={vector.sgst} />
        <SmallRow label="Cess" value={vector.cess} />
        <div className="flex items-center justify-between border-t border-slate-200 pt-2 font-black">
          <span>Total</span>
          <span>{formatCurrency(totalTax(vector))}</span>
        </div>
      </div>
    </div>
  );
}

function SmallRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-slate-600">{label}</span>
      <strong className="text-slate-900">{formatCurrency(value)}</strong>
    </div>
  );
}

function Header({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`border-b border-slate-200 px-4 py-3 text-sm font-black text-slate-700 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function MoneyCell({ value }: { value: number }) {
  return (
    <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-slate-800">
      {formatCurrency(value)}
    </td>
  );
}