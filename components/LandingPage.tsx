"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Boxes,
  Building2,
  Check,
  ChevronRight,
  CircleDollarSign,
  Cloud,
  FileText,
  History,
  Landmark,
  LockKeyhole,
  Menu,
  PackageCheck,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Users,
  WalletCards,
  X,
} from "lucide-react";

const productFeatures = [
  {
    icon: ShoppingCart,
    title: "Sales & GST Invoicing",
    description:
      "Create sales invoices with customer state, HSN snapshots and automatic CGST, SGST or IGST classification.",
  },
  {
    icon: ReceiptText,
    title: "Purchase Management",
    description:
      "Record supplier bills, increase stock safely and keep purchase history connected with accounting.",
  },
  {
    icon: Boxes,
    title: "Inventory & Costing",
    description:
      "Track stock, low-stock alerts, weighted-average cost, inventory value and cost of goods sold.",
  },
  {
    icon: Landmark,
    title: "Double-Entry Accounting",
    description:
      "Use chart of accounts, journals, contra entries, trial balance, general ledger and profit and loss.",
  },
  {
    icon: CircleDollarSign,
    title: "Payments & Outstanding",
    description:
      "Record customer receipts and supplier payments while monitoring receivables and payables.",
  },
  {
    icon: RotateCcw,
    title: "Credit & Debit Notes",
    description:
      "Process sales returns and purchase returns without deleting original invoices or supplier bills.",
  },
  {
    icon: BarChart3,
    title: "Business Reports",
    description:
      "Review sales, purchases, stock, payments, parties and accounting profitability from one reporting center.",
  },
  {
    icon: History,
    title: "Audit & Period Lock",
    description:
      "Protect financial history with audit records, controlled edits and accounting period locks.",
  },
];

const workflowSteps = [
  {
    number: "01",
    title: "Create a company",
    description:
      "Add business identity, registered state, contact information and optional GST details.",
  },
  {
    number: "02",
    title: "Configure masters",
    description:
      "Create customer and supplier ledgers, then add products with HSN, GST and stock information.",
  },
  {
    number: "03",
    title: "Record transactions",
    description:
      "Create invoices, purchase bills, payments, expenses, credit notes and debit notes.",
  },
  {
    number: "04",
    title: "Control the business",
    description:
      "Monitor stock, outstanding balances, accounting reports, profitability and audit history.",
  },
];

const trustItems = [
  {
    icon: Cloud,
    title: "Cloud workspace",
    description: "Access company data through a modern web application.",
  },
  {
    icon: ShieldCheck,
    title: "Company-wise access",
    description: "Business records stay linked to the authenticated owner.",
  },
  {
    icon: History,
    title: "Audit trail",
    description: "Important creates, updates and voids remain traceable.",
  },
  {
    icon: LockKeyhole,
    title: "Period controls",
    description: "Lock completed accounting periods against changes.",
  },
];

const highlights = [
  "Up to 5 companies per account",
  "Mobile-responsive ERP workspace",
  "Supabase cloud authentication",
  "Stock and COGS safeguards",
];

function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-[15px] bg-[#673de6] shadow-[0_12px_30px_rgba(103,61,230,0.28)]">
        <span className="text-lg font-black tracking-[-0.12em] text-white">
          VX
        </span>
        <span className="absolute bottom-[7px] left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#ffcd35]" />
      </div>

      <div>
        <p
          className={`text-lg font-black tracking-tight ${
            dark ? "text-white" : "text-[#2f1c6a]"
          }`}
        >
          Vertex<span className="text-[#673de6]">ERP</span>
        </p>
        <p
          className={`text-[11px] font-semibold tracking-wide ${
            dark ? "text-violet-200/70" : "text-[#727586]"
          }`}
        >
          Business Control Center
        </p>
      </div>
    </div>
  );
}

function ProductPreview() {
  const bars = [42, 58, 48, 74, 64, 88, 78];

  return (
    <div className="relative mx-auto w-full max-w-[640px]">
      <div className="absolute -inset-8 rounded-[48px] bg-[#673de6]/20 blur-3xl" />

      <div className="landing-float relative overflow-hidden rounded-[30px] border border-white/40 bg-[#2f1c6a] p-3 shadow-[0_35px_90px_rgba(47,28,106,0.32)] sm:p-4">
        <div className="overflow-hidden rounded-[24px] bg-[#f8f6ff]">
          <div className="flex items-center justify-between border-b border-[#e5dcff] bg-white px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#673de6] text-xs font-black text-white">
                VX
              </div>
              <div>
                <p className="text-xs font-black text-[#2f1c6a]">
                  VertexERP
                </p>
                <p className="text-[9px] font-semibold text-[#8c85a8]">
                  Sample workspace
                </p>
              </div>
            </div>

            <span className="inline-flex items-center gap-2 rounded-full bg-[#e8f9ef] px-3 py-1 text-[10px] font-black text-[#00875a]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00b67a]" />
              Cloud active
            </span>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
            <PreviewCard
              label="Sales Revenue"
              value="₹18.6L"
              detail="Current period"
            />
            <PreviewCard
              label="Net Profit"
              value="₹2.84L"
              detail="Accounting P&L"
            />
            <PreviewCard
              label="Inventory Value"
              value="₹15.2L"
              detail="Weighted average"
            />
          </div>

          <div className="grid gap-4 px-4 pb-4 sm:grid-cols-[1.4fr_0.9fr] sm:px-5 sm:pb-5">
            <div className="rounded-2xl border border-[#e5dcff] bg-white p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-black text-[#2f1c6a]">
                    Business Performance
                  </p>
                  <p className="mt-1 text-xs font-medium text-[#8c85a8]">
                    Revenue activity preview
                  </p>
                </div>
                <span className="rounded-full bg-[#ede7ff] px-3 py-1 text-[10px] font-black text-[#673de6]">
                  Live
                </span>
              </div>

              <div className="mt-6 flex h-36 items-end gap-2 sm:gap-3">
                {bars.map((height, index) => (
                  <div
                    key={index}
                    className="flex flex-1 flex-col items-center gap-2"
                  >
                    <div
                      className="w-full rounded-t-lg bg-gradient-to-t from-[#673de6] to-[#9f7aea]"
                      style={{ height: `${height}%` }}
                    />
                    <span className="text-[9px] font-bold text-[#aaa3bf]">
                      {["M", "T", "W", "T", "F", "S", "S"][index]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[#e5dcff] bg-white p-4">
              <p className="text-sm font-black text-[#2f1c6a]">
                Recent Activity
              </p>

              <div className="mt-4 space-y-3">
                <Activity
                  icon={FileText}
                  title="Sales invoice posted"
                  detail="Stock and accounting updated"
                />
                <Activity
                  icon={PackageCheck}
                  title="Purchase recorded"
                  detail="Inventory value updated"
                />
                <Activity
                  icon={BookOpenCheck}
                  title="Period controlled"
                  detail="Audit-safe workflow"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="landing-float-delay absolute -bottom-7 -left-3 hidden rounded-2xl border border-[#ded3ff] bg-white p-4 shadow-[0_20px_50px_rgba(47,28,106,0.18)] sm:block">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f9ef] text-[#00875a]">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-black text-[#2f1c6a]">
              Accounting connected
            </p>
            <p className="text-xs font-medium text-[#8c85a8]">
              Stock, COGS and audit controls
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-[#e5dcff] bg-white p-4">
      <p className="text-xs font-bold text-[#8c85a8]">{label}</p>
      <p className="mt-2 text-xl font-black text-[#2f1c6a]">{value}</p>
      <p className="mt-1 text-[10px] font-bold text-[#00a76f]">{detail}</p>
    </div>
  );
}

function Activity({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof FileText;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ede7ff] text-[#673de6]">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-black text-[#2f1c6a]">{title}</p>
        <p className="mt-0.5 text-[10px] font-medium text-[#9a93ae]">
          {detail}
        </p>
      </div>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  description: string;
  align?: "left" | "center";
}) {
  return (
    <div
      className={
        align === "center"
          ? "mx-auto max-w-3xl text-center"
          : "max-w-2xl"
      }
    >
      <p className="text-sm font-black uppercase tracking-[0.2em] text-[#673de6]">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-[#2f1c6a] sm:text-5xl">
        {title}
      </h2>
      <p className="mt-5 text-base leading-8 text-[#6f6982] sm:text-lg">
        {description}
      </p>
    </div>
  );
}

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      <style jsx global>{`
        html {
          scroll-behavior: smooth;
        }

        body {
          background: #f8f6ff;
        }

        @keyframes landingFadeUp {
          from {
            opacity: 0;
            transform: translateY(24px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes landingFloat {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }

        .landing-fade-up {
          animation: landingFadeUp 700ms ease-out both;
        }

        .landing-fade-up-delay {
          animation: landingFadeUp 800ms 120ms ease-out both;
        }

        .landing-float {
          animation: landingFloat 6s ease-in-out infinite;
        }

        .landing-float-delay {
          animation: landingFloat 6s 1.2s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          html {
            scroll-behavior: auto;
          }

          .landing-fade-up,
          .landing-fade-up-delay,
          .landing-float,
          .landing-float-delay {
            animation: none !important;
          }
        }
      `}</style>

      <div className="min-h-screen overflow-x-hidden bg-[#f8f6ff] text-[#2f1c6a]">
        <header className="fixed inset-x-0 top-0 z-50 border-b border-[#e7e0f5] bg-white/90 backdrop-blur-xl">
          <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link href="/" aria-label="VertexERP home">
              <Brand />
            </Link>

            <nav className="hidden items-center gap-8 lg:flex">
              {[
                ["Features", "#features"],
                ["How It Works", "#workflow"],
                ["Accounting", "#accounting"],
                ["Security", "#security"],
              ].map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  className="text-sm font-bold text-[#554d70] transition hover:text-[#673de6]"
                >
                  {label}
                </a>
              ))}
            </nav>

            <div className="hidden items-center gap-3 lg:flex">
              <Link
                href="/auth"
                className="rounded-xl px-4 py-2.5 text-sm font-black text-[#2f1c6a] transition hover:bg-[#f1edff]"
              >
                Sign In
              </Link>
              <Link
                href="/auth"
                className="inline-flex items-center gap-2 rounded-xl bg-[#673de6] px-5 py-2.5 text-sm font-black text-white shadow-[0_12px_30px_rgba(103,61,230,0.25)] transition hover:-translate-y-0.5 hover:bg-[#5025d1]"
              >
                Start Free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <button
              type="button"
              onClick={() => setIsMenuOpen((current) => !current)}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#ddd4f4] bg-white text-[#2f1c6a] lg:hidden"
              aria-label="Toggle navigation"
            >
              {isMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>

          {isMenuOpen && (
            <div className="border-t border-[#e7e0f5] bg-white px-4 py-5 lg:hidden">
              <div className="mx-auto flex max-w-7xl flex-col gap-2">
                {[
                  ["Features", "#features"],
                  ["How It Works", "#workflow"],
                  ["Accounting", "#accounting"],
                  ["Security", "#security"],
                ].map(([label, href]) => (
                  <a
                    key={href}
                    href={href}
                    onClick={() => setIsMenuOpen(false)}
                    className="rounded-xl px-4 py-3 font-bold text-[#554d70] transition hover:bg-[#f1edff] hover:text-[#673de6]"
                  >
                    {label}
                  </a>
                ))}

                <Link
                  href="/auth"
                  onClick={() => setIsMenuOpen(false)}
                  className="mt-2 rounded-xl bg-[#673de6] px-5 py-3 text-center font-black text-white"
                >
                  Start Free
                </Link>
              </div>
            </div>
          )}
        </header>

        <main>
          <section className="relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(103,61,230,0.16),transparent_34%),radial-gradient(circle_at_90%_10%,rgba(255,205,53,0.18),transparent_30%)]" />

            <div className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-14 px-4 pb-20 pt-32 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:pt-28">
              <div className="landing-fade-up max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#d9ceff] bg-white px-4 py-2 text-sm font-black text-[#673de6] shadow-sm">
                  <Sparkles className="h-4 w-4" />
                  Modern cloud ERP for Indian businesses
                </div>

                <h1 className="mt-7 text-4xl font-black leading-[1.04] tracking-[-0.045em] text-[#2f1c6a] sm:text-6xl lg:text-[68px]">
                  One workspace to run your
                  <span className="block text-[#673de6]">
                    entire business.
                  </span>
                </h1>

                <p className="mt-6 max-w-xl text-base leading-8 text-[#625b78] sm:text-lg">
                  Manage billing, inventory, accounting, payments, reports
                  and audit controls without switching between disconnected
                  tools.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/auth"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#673de6] px-6 py-4 font-black text-white shadow-[0_18px_45px_rgba(103,61,230,0.25)] transition hover:-translate-y-1 hover:bg-[#5025d1]"
                  >
                    Start Free
                    <ArrowRight className="h-5 w-5" />
                  </Link>

                  <a
                    href="#features"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#d8cff0] bg-white px-6 py-4 font-black text-[#2f1c6a] transition hover:-translate-y-1 hover:border-[#673de6] hover:text-[#673de6]"
                  >
                    Explore Features
                    <ChevronRight className="h-5 w-5" />
                  </a>
                </div>

                <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {highlights.map((highlight) => (
                    <div
                      key={highlight}
                      className="flex items-start gap-2 rounded-2xl border border-[#e5def4] bg-white/80 p-3 shadow-sm"
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#00a76f]" />
                      <span className="text-xs font-bold leading-5 text-[#554d70]">
                        {highlight}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="landing-fade-up-delay">
                <ProductPreview />
              </div>
            </div>
          </section>

          <section className="border-y border-[#e7e0f5] bg-white">
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
              <p className="text-center text-sm font-bold text-[#6f6982]">
                Designed for retailers, wholesalers, distributors and growing
                small businesses.
              </p>
            </div>
          </section>

          <section
            id="features"
            className="mx-auto max-w-7xl scroll-mt-24 px-4 py-24 sm:px-6 lg:px-8 lg:py-32"
          >
            <SectionHeading
              eyebrow="Connected Features"
              title="Business operations and accounting, working together."
              description="Each module is connected so daily transactions update the right stock, party balances and accounting records."
            />

            <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {productFeatures.map((feature) => {
                const Icon = feature.icon;

                return (
                  <article
                    key={feature.title}
                    className="group rounded-[26px] border border-[#e4dcf5] bg-white p-6 shadow-[0_12px_35px_rgba(47,28,106,0.06)] transition duration-300 hover:-translate-y-2 hover:border-[#b9a8ee] hover:shadow-[0_22px_50px_rgba(47,28,106,0.12)]"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ede7ff] text-[#673de6] transition group-hover:bg-[#673de6] group-hover:text-white">
                      <Icon className="h-6 w-6" />
                    </span>

                    <h3 className="mt-5 text-lg font-black text-[#2f1c6a]">
                      {feature.title}
                    </h3>

                    <p className="mt-3 text-sm leading-7 text-[#736c87]">
                      {feature.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>

          <section
            id="workflow"
            className="scroll-mt-24 bg-[#ebe4ff]"
          >
            <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
              <SectionHeading
                eyebrow="Simple Workflow"
                title="Get from setup to daily control in four steps."
                description="VertexERP keeps business entry familiar while connecting operational and financial records."
              />

              <div className="mt-14 grid gap-5 lg:grid-cols-4">
                {workflowSteps.map((step) => (
                  <article
                    key={step.number}
                    className="rounded-[26px] border border-white/80 bg-white p-6 shadow-[0_12px_35px_rgba(47,28,106,0.08)]"
                  >
                    <span className="inline-flex rounded-full bg-[#ede7ff] px-3 py-1 text-sm font-black text-[#673de6]">
                      {step.number}
                    </span>
                    <h3 className="mt-5 text-lg font-black text-[#2f1c6a]">
                      {step.title}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-[#736c87]">
                      {step.description}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section
            id="accounting"
            className="mx-auto grid max-w-7xl scroll-mt-24 gap-14 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-32"
          >
            <div>
              <SectionHeading
                align="left"
                eyebrow="Accounting Foundation"
                title="More than invoice software."
                description="Operational transactions connect with inventory cost, double-entry accounting and business profitability."
              />

              <div className="mt-8 space-y-4">
                {[
                  "Chart of Accounts, Journal and Contra",
                  "Trial Balance, General Ledger and Profit & Loss",
                  "Weighted-average inventory costing and COGS",
                  "Period locking and controlled transaction changes",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e8f9ef] text-[#00a76f]">
                      <Check className="h-4 w-4" />
                    </span>
                    <p className="font-bold leading-7 text-[#554d70]">
                      {item}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[30px] bg-[#2f1c6a] p-4 shadow-[0_30px_80px_rgba(47,28,106,0.25)] sm:p-6">
              <div className="rounded-[24px] bg-white p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-black text-[#2f1c6a]">
                      Accounting Snapshot
                    </p>
                    <p className="mt-1 text-xs font-medium text-[#938ba8]">
                      Sample period
                    </p>
                  </div>
                  <span className="rounded-full bg-[#e8f9ef] px-3 py-1 text-xs font-black text-[#00875a]">
                    Balanced
                  </span>
                </div>

                <div className="mt-6 space-y-3">
                  {[
                    ["Sales Revenue", "₹18,61,540", "Credit"],
                    ["Cost of Goods Sold", "₹15,20,136", "Debit"],
                    ["Operating Expenses", "₹57,000", "Debit"],
                    ["Net Profit", "₹2,84,404", "Result"],
                  ].map(([name, value, side]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between rounded-2xl bg-[#f5f2ff] px-4 py-4"
                    >
                      <div>
                        <p className="text-sm font-black text-[#2f1c6a]">
                          {name}
                        </p>
                        <p className="mt-1 text-xs font-medium text-[#938ba8]">
                          {side}
                        </p>
                      </div>
                      <p className="font-black text-[#493b73]">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section
            id="security"
            className="scroll-mt-24 border-y border-[#e7e0f5] bg-white"
          >
            <div className="mx-auto grid max-w-7xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:px-8 lg:py-32">
              <div>
                <span className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#ede7ff] text-[#673de6]">
                  <LockKeyhole className="h-8 w-8" />
                </span>
                <h2 className="mt-6 text-3xl font-black tracking-[-0.03em] text-[#2f1c6a] sm:text-4xl">
                  Built for control, traceability and secure access.
                </h2>
                <p className="mt-5 max-w-xl leading-8 text-[#6f6982]">
                  Business records remain linked to the authenticated account
                  and protected by controlled financial workflows.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {trustItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <article
                      key={item.title}
                      className="rounded-2xl border border-[#e4dcf5] bg-[#faf9ff] p-5"
                    >
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ede7ff] text-[#673de6]">
                        <Icon className="h-5 w-5" />
                      </span>
                      <h3 className="mt-4 font-black text-[#2f1c6a]">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-[#736c87]">
                        {item.description}
                      </p>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
            <div className="relative overflow-hidden rounded-[34px] bg-[#673de6] px-6 py-14 text-center shadow-[0_30px_80px_rgba(103,61,230,0.25)] sm:px-12 sm:py-20">
              <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute -bottom-24 -right-20 h-64 w-64 rounded-full bg-[#ffcd35]/20 blur-3xl" />

              <div className="relative">
                <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-100">
                  Start building better control
                </p>
                <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-black tracking-[-0.03em] text-white sm:text-5xl">
                  Bring billing, stock and accounting into one connected
                  workspace.
                </h2>
                <p className="mx-auto mt-5 max-w-2xl leading-8 text-violet-100">
                  Create an account and begin organizing your business with
                  VertexERP.
                </p>

                <Link
                  href="/auth"
                  className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-4 font-black text-[#5025d1] shadow-xl transition hover:-translate-y-1 hover:bg-[#ffcd35] hover:text-[#2f1c6a]"
                >
                  Create Free Account
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
            </div>
          </section>
        </main>

        <footer className="bg-[#2f1c6a] text-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_0.6fr_0.6fr] lg:px-8">
            <div>
              <Brand dark />
              <p className="mt-5 max-w-md text-sm leading-7 text-violet-200/70">
                Cloud-based billing, inventory, accounting and reporting for
                growing Indian businesses.
              </p>
            </div>

            <div>
              <p className="font-black">Product</p>
              <div className="mt-4 space-y-3 text-sm text-violet-200/70">
                <a href="#features" className="block hover:text-white">
                  Features
                </a>
                <a href="#accounting" className="block hover:text-white">
                  Accounting
                </a>
                <a href="#security" className="block hover:text-white">
                  Security
                </a>
              </div>
            </div>

            <div>
              <p className="font-black">Access</p>
              <div className="mt-4 space-y-3 text-sm text-violet-200/70">
                <Link href="/auth" className="block hover:text-white">
                  Sign In
                </Link>
                <Link href="/auth" className="block hover:text-white">
                  Create Account
                </Link>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 px-4 py-6 text-center text-xs text-violet-200/50">
            © {new Date().getFullYear()} VertexERP. Run your business with
            confidence.
          </div>
        </footer>
      </div>
    </>
  );
}