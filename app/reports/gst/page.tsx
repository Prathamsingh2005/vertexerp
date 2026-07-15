"use client";

import GSTReportsManager from "@/components/GSTReportsManager";
import ReportPageShell from "@/components/ReportPageShell";

export default function GSTReportsPage() {
  return (
    <ReportPageShell
      requiredPermission="gst_reports.view"
      title="GST Reports"
      eyebrow="GST Review Center"
      description="Review GST summaries, transactions, reconciliation findings and HSN/SAC data."
      icon="🧮"
      showHero={false}
    >
      <GSTReportsManager />
    </ReportPageShell>
  );
}