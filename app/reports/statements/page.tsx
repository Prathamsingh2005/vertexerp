"use client";

import PartyStatementManager from "@/components/PartyStatementManager";
import ReportPageShell from "@/components/ReportPageShell";

export default function PartyStatementsPage() {
  return (
    <ReportPageShell
      requiredPermission="reports.view"
      title="Party Statements"
      eyebrow="Party Accounts"
      description="Generate customer and supplier statements with documents, payments, return notes and running balances."
      icon="📖"
      showHero={false}
    >
      <PartyStatementManager />
    </ReportPageShell>
  );
}