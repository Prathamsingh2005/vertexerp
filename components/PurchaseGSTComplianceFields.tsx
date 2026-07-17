"use client";

export type PurchaseItcStatus =
  | "PENDING_REVIEW"
  | "ELIGIBLE"
  | "INELIGIBLE"
  | "PARTIAL"
  | "NOT_APPLICABLE";

export type PurchaseGstComplianceValue = {
  reverseChargeApplicable: boolean;
  itcStatus: PurchaseItcStatus;
  itcEligibilityPercentage: number;
  itcIneligibilityReason: string;
  itcNotes: string;
};

export const DEFAULT_PURCHASE_GST_COMPLIANCE: PurchaseGstComplianceValue = {
  reverseChargeApplicable: false,
  itcStatus: "PENDING_REVIEW",
  itcEligibilityPercentage: 0,
  itcIneligibilityReason: "",
  itcNotes: "",
};

const INELIGIBILITY_REASONS = [
  "Personal / Non-business Use",
  "Motor Vehicle Restriction",
  "Food & Beverages",
  "Club / Membership",
  "Construction of Immovable Property",
  "Goods Lost / Stolen / Destroyed",
  "Composition Supplier",
  "Time Limit Expired",
  "Invoice Missing in GSTR-2B",
  "Other",
];

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number) {
  return `₹${toNumber(value).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function isValidGstin(value: string) {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(
    String(value || "").trim().toUpperCase(),
  );
}

export default function PurchaseGSTComplianceFields({
  value,
  onChange,
  cgstTotal,
  sgstTotal,
  igstTotal,
  cessTotal,
  supplierName = "",
  supplierGstin = "",
  disabled = false,
}: {
  value: PurchaseGstComplianceValue;
  onChange: (nextValue: PurchaseGstComplianceValue) => void;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  cessTotal: number;
  supplierName?: string;
  supplierGstin?: string;
  disabled?: boolean;
}) {
  const totalTax =
    toNumber(cgstTotal) +
    toNumber(sgstTotal) +
    toNumber(igstTotal) +
    toNumber(cessTotal);

  const supplierHasValidGstin = isValidGstin(supplierGstin);
  const normalChargeItcBlocked =
    totalTax > 0 &&
    !value.reverseChargeApplicable &&
    !supplierHasValidGstin;

  const percentage =
    value.itcStatus === "ELIGIBLE"
      ? 100
      : value.itcStatus === "PARTIAL"
        ? Math.min(Math.max(toNumber(value.itcEligibilityPercentage), 0), 100)
        : 0;

  const effectivePercentage = normalChargeItcBlocked ? 0 : percentage;
  const eligibleItc = Number(
    ((totalTax * effectivePercentage) / 100).toFixed(2),
  );
  const ineligibleItc = normalChargeItcBlocked
    ? totalTax
    : value.itcStatus === "PENDING_REVIEW" ||
        value.itcStatus === "NOT_APPLICABLE"
      ? 0
      : Number((totalTax - eligibleItc).toFixed(2));

  function patch(next: Partial<PurchaseGstComplianceValue>) {
    onChange({ ...value, ...next });
  }

  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-violet-200 bg-gradient-to-br from-white to-violet-50/60 shadow-lg shadow-violet-100/50 sm:mt-8">
      <div className="border-b border-violet-200 bg-gradient-to-r from-violet-950 via-violet-800 to-violet-700 px-5 py-5 text-white sm:px-6">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-200">
          GST Compliance Review
        </p>
        <h3 className="mt-2 text-xl font-black">RCM &amp; Input Tax Credit</h3>
        <p className="mt-1 text-sm leading-6 text-violet-100">
          Classify reverse charge and ITC treatment before preparing GSTR-3B.
        </p>
      </div>

      <div className="p-5 sm:p-6">
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-violet-200 bg-white p-4">
          <input
            type="checkbox"
            checked={value.reverseChargeApplicable}
            disabled={disabled}
            onChange={(event) => {
              const nextRcm = event.target.checked;
              patch({
                reverseChargeApplicable: nextRcm,
                itcStatus: nextRcm ? "PENDING_REVIEW" : value.itcStatus,
                itcEligibilityPercentage: nextRcm
                  ? 0
                  : value.itcEligibilityPercentage,
                itcIneligibilityReason: nextRcm
                  ? ""
                  : value.itcIneligibilityReason,
              });
            }}
            className="mt-1 h-5 w-5 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
          />
          <span>
            <span className="block font-black text-slate-900">
              Reverse Charge Applicable (RCM)
            </span>
            <span className="mt-1 block text-sm leading-6 text-slate-600">
              Marks this purchase tax as recipient-paid RCM liability for GST review.
            </span>
          </span>
        </label>

        {normalChargeItcBlocked && (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900">
            <p className="font-black">
              Eligible ITC is blocked for this supplier
            </p>
            <p className="mt-1">
              {supplierName || "The selected supplier"} does not have a valid
              GSTIN. Under normal charge, keep ITC as Pending Review,
              Ineligible, or Not Applicable. Add the correct GSTIN in Ledgers
              before selecting Eligible or Partially Eligible.
            </p>
          </div>
        )}

        {value.reverseChargeApplicable && (
          <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm leading-6 text-violet-900">
            <p className="font-black">RCM review protection is active</p>
            <p className="mt-1">
              ITC has been reset to Pending Review. Verify that the supply is
              legally covered by reverse charge and confirm tax payment before
              treating any credit as eligible.
            </p>
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <label className="mb-2 block font-bold text-slate-800">
              ITC Treatment
            </label>
            <select
              value={value.itcStatus}
              disabled={disabled}
              onChange={(event) => {
                const nextStatus = event.target.value as PurchaseItcStatus;
                patch({
                  itcStatus: nextStatus,
                  itcEligibilityPercentage:
                    nextStatus === "ELIGIBLE"
                      ? 100
                      : nextStatus === "PARTIAL"
                        ? value.itcEligibilityPercentage || 50
                        : 0,
                  itcIneligibilityReason:
                    nextStatus === "ELIGIBLE" || nextStatus === "PENDING_REVIEW"
                      ? ""
                      : value.itcIneligibilityReason,
                });
              }}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
            >
              <option value="PENDING_REVIEW">Pending Review</option>
              <option
                value="ELIGIBLE"
                disabled={normalChargeItcBlocked}
              >
                Eligible
                {normalChargeItcBlocked
                  ? " · Valid Supplier GSTIN Required"
                  : ""}
              </option>
              <option value="INELIGIBLE">Ineligible / Blocked</option>
              <option
                value="PARTIAL"
                disabled={normalChargeItcBlocked}
              >
                Partially Eligible
                {normalChargeItcBlocked
                  ? " · Valid Supplier GSTIN Required"
                  : ""}
              </option>
              <option value="NOT_APPLICABLE">Not Applicable</option>
            </select>
          </div>

          {value.itcStatus === "PARTIAL" ? (
            <div>
              <label className="mb-2 block font-bold text-slate-800">
                Eligible ITC Percentage
              </label>
              <input
                type="number"
                min="0.01"
                max="99.99"
                step="0.01"
                disabled={disabled}
                value={value.itcEligibilityPercentage}
                onChange={(event) =>
                  patch({
                    itcEligibilityPercentage: Math.min(
                      Math.max(toNumber(event.target.value), 0),
                      100,
                    ),
                  })
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
              />
            </div>
          ) : (
            <div>
              <label className="mb-2 block font-bold text-slate-800">
                Calculated Eligibility
              </label>
              <div className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 font-black text-slate-700">
                {percentage}%
              </div>
            </div>
          )}
        </div>

        {(value.itcStatus === "INELIGIBLE" || value.itcStatus === "PARTIAL") && (
          <div className="mt-4">
            <label className="mb-2 block font-bold text-slate-800">
              Ineligibility / Restriction Reason
            </label>
            <select
              value={value.itcIneligibilityReason}
              disabled={disabled}
              onChange={(event) =>
                patch({ itcIneligibilityReason: event.target.value })
              }
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
            >
              <option value="">Select reason</option>
              {INELIGIBILITY_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-4">
          <label className="mb-2 block font-bold text-slate-800">
            ITC Review Notes
          </label>
          <textarea
            rows={3}
            value={value.itcNotes}
            disabled={disabled}
            onChange={(event) => patch({ itcNotes: event.target.value })}
            placeholder="Optional accountant or compliance note"
            className="w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
          />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <PreviewCard label="Purchase GST" value={totalTax} />
          <PreviewCard label="Eligible ITC" value={eligibleItc} emphasis="eligible" />
          <PreviewCard
            label={
              normalChargeItcBlocked
                ? "Compliance Risk GST"
                : "Ineligible ITC"
            }
            value={ineligibleItc}
            emphasis="blocked"
          />
          <PreviewCard
            label="RCM Tax Review"
            value={value.reverseChargeApplicable ? totalTax : 0}
            emphasis="rcm"
          />
        </div>

        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          This is an operational review classification. Final ITC eligibility,
          blocked credit, RCM cash payment and statutory set-off must be verified
          before filing.
        </div>
      </div>
    </section>
  );
}

function PreviewCard({
  label,
  value,
  emphasis = "normal",
}: {
  label: string;
  value: number;
  emphasis?: "normal" | "eligible" | "blocked" | "rcm";
}) {
  const styles = {
    normal: "border-slate-200 bg-white text-slate-900",
    eligible: "border-emerald-200 bg-emerald-50 text-emerald-800",
    blocked: "border-rose-200 bg-rose-50 text-rose-800",
    rcm: "border-violet-200 bg-violet-50 text-violet-800",
  }[emphasis];

  return (
    <div className={`rounded-2xl border p-4 ${styles}`}>
      <p className="text-xs font-black uppercase tracking-wide opacity-70">
        {label}
      </p>
      <p className="mt-2 text-xl font-black">{formatCurrency(value)}</p>
    </div>
  );
}