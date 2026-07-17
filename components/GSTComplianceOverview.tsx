"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type SummaryRow = {
  purchase_count: number | string | null;
  gross_input_gst: number | string | null;
  eligible_itc: number | string | null;
  ineligible_itc: number | string | null;
  pending_review_itc: number | string | null;
  rcm_tax_payable: number | string | null;
  eligible_itc_reversal: number | string | null;
  ineligible_tax_adjustment: number | string | null;
  net_eligible_itc: number | string | null;
  unregistered_supplier_risk_count: number | string | null;
  unregistered_supplier_risk_itc: number | string | null;
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number) {
  return `₹${toNumber(value).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

export default function GSTComplianceOverview({
  fromDate,
  toDate,
}: {
  fromDate?: string;
  toDate?: string;
}) {
  const [summary, setSummary] = useState<SummaryRow | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  async function loadSummary() {
    setIsLoading(true);
    setMessage("");

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Please sign in to view GST compliance.");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("active_company_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile?.active_company_id) {
        throw new Error("Select an active company first.");
      }

      const { data, error } = await supabase.rpc("get_gst_compliance_summary", {
        p_company_id: profile.active_company_id,
        p_from_date: fromDate || null,
        p_to_date: toDate || null,
      });

      if (error) throw error;
      setSummary(((data || [])[0] as SummaryRow | undefined) || null);
    } catch (error) {
      setSummary(null);
      setMessage(error instanceof Error ? error.message : "GST compliance summary could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadSummary();
    const events = [
      "vertexerp-purchases-updated",
      "vertexerp-gst-data-updated",
      "vertexerp-active-company-updated",
    ];
    events.forEach((eventName) => window.addEventListener(eventName, loadSummary));
    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, loadSummary));
    };
  }, [fromDate, toDate]);

  function exportCsv() {
    if (!summary) return;
    const rows = [
      ["Section", "Amount"],
      ["Gross Input GST", toNumber(summary.gross_input_gst)],
      ["Eligible ITC", toNumber(summary.eligible_itc)],
      ["Eligible ITC Reversal", toNumber(summary.eligible_itc_reversal)],
      ["Net Eligible ITC", toNumber(summary.net_eligible_itc)],
      ["Ineligible ITC", toNumber(summary.ineligible_itc)],
      ["Pending Review ITC", toNumber(summary.pending_review_itc)],
      ["RCM Tax Payable Review", toNumber(summary.rcm_tax_payable)],
      ["Ineligible Tax Return Adjustment", toNumber(summary.ineligible_tax_adjustment)],
      ["Unregistered Supplier Risk ITC", toNumber(summary.unregistered_supplier_risk_itc)],
      ["Unregistered Supplier Risk Bills", toNumber(summary.unregistered_supplier_risk_count)],
    ];
    const csv = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vertexerp-gst-compliance-${fromDate || "all"}-${toDate || "all"}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-xl shadow-violet-100/40">
      <div className="flex flex-col gap-4 bg-gradient-to-r from-violet-950 via-violet-800 to-violet-700 px-5 py-5 text-white sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-200">
            GSTR-3B ITC Review
          </p>
          <h2 className="mt-2 text-2xl font-black">RCM &amp; ITC Compliance Position</h2>
          <p className="mt-1 text-sm text-violet-100">
            Eligible, blocked, pending and purchase-return ITC snapshots.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadSummary}
            disabled={isLoading}
            className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 font-black text-white transition hover:bg-white/20 disabled:opacity-60"
          >
            {isLoading ? "Loading..." : "Refresh"}
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!summary}
            className="rounded-xl bg-white px-4 py-2.5 font-black text-violet-700 transition hover:bg-violet-50 disabled:opacity-60"
          >
            Export CSV
          </button>
        </div>
      </div>

      {message && (
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-4 font-semibold text-amber-800 sm:px-6">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-5">
        <Metric label="Gross Input GST" value={toNumber(summary?.gross_input_gst)} />
        <Metric label="Net Eligible ITC" value={toNumber(summary?.net_eligible_itc)} tone="green" />
        <Metric label="Ineligible / Blocked" value={toNumber(summary?.ineligible_itc)} tone="red" />
        <Metric label="Pending Review" value={toNumber(summary?.pending_review_itc)} tone="amber" />
        <Metric label="RCM Tax Review" value={toNumber(summary?.rcm_tax_payable)} tone="violet" />
        <Metric label="ITC Reversal" value={toNumber(summary?.eligible_itc_reversal)} tone="red" />
        <Metric label="Purchase Bills" value={toNumber(summary?.purchase_count)} isCurrency={false} />
        <Metric label="Eligible Before Reversal" value={toNumber(summary?.eligible_itc)} tone="green" />
        <Metric
          label="Unregistered Supplier Risk"
          value={toNumber(summary?.unregistered_supplier_risk_itc)}
          tone="red"
        />
        <Metric
          label="Risk Purchase Bills"
          value={toNumber(summary?.unregistered_supplier_risk_count)}
          tone="red"
          isCurrency={false}
        />
      </div>

      {toNumber(summary?.unregistered_supplier_risk_count) > 0 && (
        <div className="mx-5 mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900 sm:mx-6 sm:mb-6">
          <p className="font-black">
            Eligible ITC has been protected from unregistered-supplier records
          </p>
          <p className="mt-1">
            {toNumber(summary?.unregistered_supplier_risk_count)} purchase
            bill(s) contain Eligible or Partially Eligible ITC without a valid
            Supplier GSTIN under normal charge. Their stored credit of{" "}
            {formatCurrency(
              toNumber(summary?.unregistered_supplier_risk_itc),
            )} is excluded from Net Eligible ITC until corrected.
          </p>
        </div>
      )}

      <div className="border-t border-violet-100 p-5 sm:p-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ReviewBlock
            title="GSTR-3B Section 4 Review"
            rows={[
              ["4(A) ITC Available", toNumber(summary?.eligible_itc)],
              ["4(B) ITC Reversed", toNumber(summary?.eligible_itc_reversal)],
              ["4(D) Ineligible ITC", toNumber(summary?.ineligible_itc)],
              ["Net Eligible ITC", toNumber(summary?.net_eligible_itc)],
            ]}
          />
          <ReviewBlock
            title="RCM & Pending Review"
            rows={[
              ["Reverse Charge Tax Review", toNumber(summary?.rcm_tax_payable)],
              ["ITC Pending Classification", toNumber(summary?.pending_review_itc)],
              ["Ineligible Return Adjustment", toNumber(summary?.ineligible_tax_adjustment)],
              ["Unregistered Supplier Risk", toNumber(summary?.unregistered_supplier_risk_itc)],
            ]}
          />
        </div>

        <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          These values are operational review figures. GSTR-2B availability,
          blocked-credit rules, RCM cash payment, statutory reversals and final
          filing must be verified before submission.
        </p>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  tone = "slate",
  isCurrency = true,
}: {
  label: string;
  value: number;
  tone?: "slate" | "green" | "red" | "amber" | "violet";
  isCurrency?: boolean;
}) {
  const styles = {
    slate: "border-slate-200 bg-slate-50 text-slate-900",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    red: "border-rose-200 bg-rose-50 text-rose-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    violet: "border-violet-200 bg-violet-50 text-violet-800",
  }[tone];

  return (
    <article className={`rounded-2xl border p-4 ${styles}`}>
      <p className="text-xs font-black uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-black">
        {isCurrency ? formatCurrency(value) : value.toLocaleString("en-IN")}
      </p>
    </article>
  );
}

function ReviewBlock({
  title,
  rows,
}: {
  title: string;
  rows: [string, number][];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <h3 className="bg-slate-50 px-4 py-3 font-black text-slate-900">{title}</h3>
      <div className="divide-y divide-slate-100">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 px-4 py-3">
            <span className="text-slate-600">{label}</span>
            <strong className="text-slate-900">{formatCurrency(value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}