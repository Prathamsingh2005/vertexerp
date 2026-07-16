"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  BookOpenCheck,
  Boxes,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Cloud,
  DatabaseBackup,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Gauge,
  Headphones,
  History,
  Landmark,
  Layers3,
  LockKeyhole,
  Mail,
  Maximize2,
  Menu,
  MessageCircle,
  MonitorSmartphone,
  MousePointer2,
  PackageCheck,
  Pause,
  Phone,
  Play,
  ReceiptText,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  WalletCards,
  Workflow,
  X,
  Zap,
} from "lucide-react";

const SUPPORT_EMAIL = "prathamgaur2005@gmail.com";
const SUPPORT_PHONE = "+91 87370 72778";
const SUPPORT_PHONE_RAW = "918737072778";

const productFeatures = [
  {
    icon: ShoppingCart,
    title: "Sales & GST Invoicing",
    description:
      "Create professional invoices with HSN snapshots and automatic CGST, SGST or IGST classification.",
  },
  {
    icon: ReceiptText,
    title: "Purchase Management",
    description:
      "Record supplier bills, update stock and keep purchases connected with accounting.",
  },
  {
    icon: Boxes,
    title: "Inventory & Costing",
    description:
      "Track stock, low-stock alerts, weighted-average cost, inventory value and COGS.",
  },
  {
    icon: Landmark,
    title: "Double-Entry Accounting",
    description:
      "Use journals, contra entries, trial balance, general ledger and profit and loss reports.",
  },
  {
    icon: CircleDollarSign,
    title: "Payments & Outstanding",
    description:
      "Record receipts and payments while monitoring receivables and payables in real time.",
  },
  {
    icon: RotateCcw,
    title: "Credit & Debit Notes",
    description:
      "Process sales and purchase returns without removing the original transaction history.",
  },
  {
    icon: BarChart3,
    title: "Business Reports",
    description:
      "Review sales, purchases, stock, payments, parties and profitability from one center.",
  },
  {
    icon: History,
    title: "Audit & Period Lock",
    description:
      "Protect financial history with traceable changes and controlled accounting periods.",
  },
  {
    icon: Users,
    title: "Team & Permissions",
    description:
      "Give every team member access according to their role and business responsibility.",
  },
  {
    icon: DatabaseBackup,
    title: "Backup & Export",
    description:
      "Prepare company backups and export business tables for operational control.",
  },
  {
    icon: FileSpreadsheet,
    title: "GST Reporting",
    description:
      "Review tax classifications and identify GST data that still needs attention.",
  },
  {
    icon: Building2,
    title: "Multi-Company Workspace",
    description:
      "Operate multiple businesses from one account while keeping company data separated.",
  },
];


const showcaseGroups = ["All", "Overview", "Operations", "Finance", "Control"] as const;
type ShowcaseGroup = (typeof showcaseGroups)[number];

const showcaseItems = [
  { id: "dashboard", group: "Overview", label: "Dashboard", eyebrow: "Command Center", icon: Gauge, image: "/vertexerp-showcase-hq/dashboard.png", title: "See the complete business before opening a report.", description: "Revenue, expenses, inventory, accounting profit and recent activity come together in one permission-aware dashboard.", points: ["Performance summary", "Quick daily actions", "Recent business activity"] },
  { id: "company", group: "Overview", label: "Companies", eyebrow: "Multi-Company", icon: Building2, image: "/vertexerp-showcase-hq/company.png", title: "Manage multiple businesses without mixing their records.", description: "Keep GST details, users and operational data separated for every company inside the same account.", points: ["Up to five companies", "GST overview", "Company-wise access"] },
  { id: "ledgers", group: "Overview", label: "Ledgers", eyebrow: "Party Masters", icon: BookOpenCheck, image: "/vertexerp-showcase-hq/ledgers.png", title: "Organize customers, suppliers, banks and cash accounts.", description: "Create GST-ready party masters and reuse them across transactions, balances and reports.", points: ["Customer and supplier masters", "Receivable and payable balances", "Bank and cash ledgers"] },
  { id: "inventory", group: "Overview", label: "Inventory", eyebrow: "Stock Intelligence", icon: Boxes, image: "/vertexerp-showcase-hq/inventory.png", title: "Control products, stock and inventory value.", description: "Manage HSN/SAC, GST, quantities, low-stock alerts and weighted inventory value from one catalogue.", points: ["Live stock", "Low-stock attention", "Inventory valuation"] },
  { id: "sales", group: "Operations", label: "Sales", eyebrow: "GST Billing", icon: ShoppingCart, image: "/vertexerp-showcase-hq/sales.png", title: "Create GST invoices and monitor sales exposure.", description: "Keep stock, GST, customer balances and reports connected while recording sales invoices.", points: ["GST-ready invoices", "Customer receivables", "Sales summaries"] },
  { id: "credit-notes", group: "Operations", label: "Credit Notes", eyebrow: "Sales Returns", icon: RotateCcw, image: "/vertexerp-showcase-hq/credit-notes.png", title: "Process customer returns without deleting invoices.", description: "Reverse stock, COGS, revenue, GST and receivables through a controlled credit-note workflow.", points: ["Original invoice preserved", "Stock restoration", "GST adjustment"] },
  { id: "purchase", group: "Operations", label: "Purchases", eyebrow: "Stock Entry", icon: ReceiptText, image: "/vertexerp-showcase-hq/purchase.png", title: "Record supplier bills and update stock together.", description: "Capture purchase bills, inventory additions and supplier payable exposure in one connected flow.", points: ["GST purchase bills", "Supplier payables", "Inventory updates"] },
  { id: "debit-notes", group: "Operations", label: "Debit Notes", eyebrow: "Purchase Returns", icon: RotateCcw, image: "/vertexerp-showcase-hq/debit-notes.png", title: "Return purchases without deleting supplier bills.", description: "Adjust stock, input GST, inventory value and supplier balances while preserving history.", points: ["Bill history preserved", "Value reversal", "Supplier adjustment"] },
  { id: "expenses", group: "Operations", label: "Expenses", eyebrow: "Operating Costs", icon: WalletCards, image: "/vertexerp-showcase-hq/expenses.png", title: "Track daily business expenses clearly.", description: "Record rent, salary, transport, utilities and other costs inside the accounting-aware platform.", points: ["Structured entry", "Cost visibility", "Accounting integration"] },
  { id: "outstanding", group: "Operations", label: "Outstanding", eyebrow: "Balances", icon: CircleDollarSign, image: "/vertexerp-showcase-hq/outstanding.png", title: "Know what customers owe and suppliers are due.", description: "Combine opening balances, credit transactions, notes and payments into one outstanding position.", points: ["Receivables", "Payables", "Net position"] },
  { id: "payments", group: "Operations", label: "Payments", eyebrow: "Cash Movement", icon: CircleDollarSign, image: "/vertexerp-showcase-hq/payments.png", title: "Record receipts and payments against real balances.", description: "Capture customer receipts and supplier payments while reducing pending balances automatically.", points: ["Customer receipts", "Supplier payments", "Balance sync"] },
  { id: "accounting", group: "Finance", label: "Accounting", eyebrow: "Double Entry", icon: Landmark, image: "/vertexerp-showcase-hq/accounting.png", title: "Use a real double-entry accounting foundation.", description: "Manage chart of accounts, journals, contra vouchers, history and finalized accounting periods.", points: ["Balanced vouchers", "Chart of accounts", "Period locks"] },
  { id: "reports", group: "Finance", label: "Analytics", eyebrow: "Business Intelligence", icon: BarChart3, image: "/vertexerp-showcase-hq/reports.png", title: "Turn daily entries into clear business intelligence.", description: "Review accounting, GST, sales, purchases, stock and outstanding analytics from one center.", points: ["Live analytics", "Connected data", "Management overview"] },
  { id: "report-center", group: "Finance", label: "Report Center", eyebrow: "Quick Access", icon: FileSpreadsheet, image: "/vertexerp-showcase-hq/report-center.png", title: "Open every important report without searching.", description: "Reach GST, parties, sales, purchases, stock, profitability and payment reports quickly.", points: ["Nine connected reports", "Permission-aware access", "Clear descriptions"] },
  { id: "gst-reports", group: "Finance", label: "GST Reports", eyebrow: "Tax Position", icon: FileSpreadsheet, image: "/vertexerp-showcase-hq/gst-reports.png", title: "Review GST transactions and data quality together.", description: "Inspect tax details and detect missing HSN/SAC, classification or calculation issues.", points: ["Transaction register", "GST reconciliation", "Data checks"] },
  { id: "audit-history", group: "Finance", label: "Audit History", eyebrow: "Traceability", icon: History, image: "/vertexerp-showcase-hq/audit-history.png", title: "Keep important business changes traceable.", description: "Review protected creates, updates, deletes and restores across operational and finance records.", points: ["Protected history", "Finance review", "Operational traceability"] },
  { id: "settings", group: "Control", label: "Settings", eyebrow: "Administration", icon: Workflow, image: "/vertexerp-showcase-hq/settings.png", title: "Manage administration and support from one page.", description: "Open team, roles, backup and direct support tools according to current permissions.", points: ["Central administration", "Permission-aware tools", "Direct support"] },
  { id: "team", group: "Control", label: "Team", eyebrow: "People & Access", icon: Users, image: "/vertexerp-showcase-hq/team.png", title: "Invite employees without sharing the owner account.", description: "Assign controlled roles, review member status and deactivate access while protecting ownership.", points: ["Employee invitations", "Role assignment", "Member status"] },
  { id: "roles", group: "Control", label: "Roles", eyebrow: "Permission Matrix", icon: ShieldCheck, image: "/vertexerp-showcase-hq/roles.png", title: "See exactly what every business role can do.", description: "Review module and action access for owners, administrators, accountants, sales staff and viewers.", points: ["Seven roles", "Module permissions", "Action visibility"] },
  { id: "backup", group: "Control", label: "Backup", eyebrow: "Data Protection", icon: DatabaseBackup, image: "/vertexerp-showcase-hq/backup.png", title: "Export company data without exposing credentials.", description: "Prepare secure JSON backups and table-wise CSV exports for business, accounting and audit data.", points: ["Company-scoped backup", "JSON export", "Table-wise CSV"] },
] as const;

const workflowSteps = [
  {
    number: "01",
    icon: Building2,
    title: "Create your company",
    description:
      "Add business identity, registered state, contact information and GST details.",
  },
  {
    number: "02",
    icon: Layers3,
    title: "Configure business masters",
    description:
      "Create customer and supplier ledgers, products, taxes, HSN/SAC and opening stock.",
  },
  {
    number: "03",
    icon: MousePointer2,
    title: "Record daily transactions",
    description:
      "Create invoices, purchases, payments, expenses, credit notes and debit notes.",
  },
  {
    number: "04",
    icon: Gauge,
    title: "Control and improve",
    description:
      "Monitor dashboards, stock, outstanding balances, reports, accounting and audit history.",
  },
];

const trustItems = [
  {
    icon: Cloud,
    title: "Cloud workspace",
    description:
      "Access your business workspace through a responsive modern web application.",
  },
  {
    icon: ShieldCheck,
    title: "Permission-aware access",
    description:
      "Navigation and actions adapt to the permissions assigned to each business role.",
  },
  {
    icon: History,
    title: "Traceable activity",
    description:
      "Important creates, updates, voids and business changes remain easier to review.",
  },
  {
    icon: LockKeyhole,
    title: "Accounting controls",
    description:
      "Lock completed periods and reduce accidental changes to finalized records.",
  },
];

const platformReasons = [
  {
    icon: Workflow,
    title: "Connected business flow",
    description:
      "A sale can update stock, customer balance and accounting without managing separate disconnected tools.",
  },
  {
    icon: Zap,
    title: "Faster daily work",
    description:
      "Clear forms, focused actions and reusable masters reduce repetitive entry across daily operations.",
  },
  {
    icon: MonitorSmartphone,
    title: "Responsive by design",
    description:
      "Use the workspace comfortably on desktop, tablet and mobile layouts.",
  },
  {
    icon: FileCheck2,
    title: "GST-ready structure",
    description:
      "Company state, party state and HSN/SAC information support cleaner tax classification.",
  },
  {
    icon: UserCheck,
    title: "Role-based experience",
    description:
      "Owners, managers, accountants, sales staff and viewers can see the tools relevant to them.",
  },
  {
    icon: Headphones,
    title: "Direct human support",
    description:
      "Contact VertexERP support through email, WhatsApp or phone whenever assistance is needed.",
  },
];

const experienceTabs = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: Gauge,
    title: "See the business before opening a report.",
    description:
      "The dashboard brings important sales, purchase, stock, outstanding and recent activity signals into one visual workspace.",
    points: [
      "Business summary cards",
      "Sales performance preview",
      "Recent operational activity",
      "Fast navigation to daily modules",
    ],
  },
  {
    id: "transactions",
    label: "Transactions",
    icon: ShoppingCart,
    title: "Move from entry to impact in one flow.",
    description:
      "Create sales, purchases and payments with business data already connected to ledgers, inventory and reports.",
    points: [
      "Guided invoice forms",
      "Automatic stock movement",
      "Party balance updates",
      "Tax-aware transaction structure",
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: BarChart3,
    title: "Turn daily records into useful decisions.",
    description:
      "Use sales, purchase, stock, party, payment, GST and profitability reports without rebuilding data manually.",
    points: [
      "Central reporting workspace",
      "Customer and supplier insights",
      "Profit and loss visibility",
      "GST readiness indicators",
    ],
  },
  {
    id: "control",
    label: "Control",
    icon: ShieldCheck,
    title: "Give access without giving up control.",
    description:
      "Manage roles, permissions, audit history, backup exports and accounting period restrictions from the same platform.",
    points: [
      "Permission-based sidebar",
      "Restricted action buttons",
      "Audit-focused workflows",
      "Company backup exports",
    ],
  },
];

const highlights = [
  "Up to 5 companies per account",
  "Mobile-responsive ERP workspace",
  "Role and permission controls",
  "Stock and COGS safeguards",
];

const whatsappMessage = encodeURIComponent(
  "Hello VertexERP Support, I need help with VertexERP."
);

function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-[15px] bg-gradient-to-br from-[#7c3aed] via-[#673de6] to-[#4338ca] shadow-[0_12px_30px_rgba(103,61,230,0.32)]">
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
          Vertex<span className="text-[#7c3aed]">ERP</span>
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

function PreviewMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-4 backdrop-blur-xl">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-violet-200">
        {label}
      </p>
      <p className="mt-2 text-xl font-black text-white sm:text-2xl">
        {value}
      </p>
      <p className="mt-1 text-[11px] font-bold text-emerald-300">{detail}</p>
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

function ProductPreview() {
  const bars = [42, 58, 48, 74, 64, 88, 78];

  return (
    <div className="relative mx-auto w-full max-w-[690px]">
      <div className="absolute -inset-12 rounded-[56px] bg-violet-500/20 blur-3xl" />
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-300/20 blur-2xl" />

      <div className="landing-float relative overflow-hidden rounded-[34px] border border-white/20 bg-[#120a2f]/90 p-3 shadow-[0_45px_120px_rgba(15,7,44,0.58)] backdrop-blur-2xl sm:p-4">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.08),transparent_35%,rgba(124,58,237,0.12))]" />

        <div className="relative overflow-hidden rounded-[27px] bg-[#f8f6ff]">
          <div className="flex items-center justify-between border-b border-[#e5dcff] bg-white px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-[#673de6] text-xs font-black text-white">
                VX
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-amber-300" />
              </div>
              <div>
                <p className="text-xs font-black text-[#2f1c6a]">
                  VertexERP
                </p>
                <p className="text-[9px] font-semibold text-[#8c85a8]">
                  Business overview
                </p>
              </div>
            </div>

            <span className="inline-flex items-center gap-2 rounded-full bg-[#e8f9ef] px-3 py-1 text-[10px] font-black text-[#00875a]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00b67a]" />
              Cloud active
            </span>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
            <div className="rounded-2xl bg-gradient-to-br from-[#3b237d] to-[#673de6] p-4 text-white shadow-lg shadow-violet-200">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-violet-200">
                Sales Revenue
              </p>
              <p className="mt-2 text-xl font-black">₹18.6L</p>
              <p className="mt-1 text-[10px] font-bold text-emerald-300">
                Current period
              </p>
            </div>
            <div className="rounded-2xl border border-[#e5dcff] bg-white p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8c85a8]">
                Net Profit
              </p>
              <p className="mt-2 text-xl font-black text-[#2f1c6a]">₹2.84L</p>
              <p className="mt-1 text-[10px] font-bold text-[#00a76f]">
                Accounting P&amp;L
              </p>
            </div>
            <div className="rounded-2xl border border-[#e5dcff] bg-white p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8c85a8]">
                Inventory Value
              </p>
              <p className="mt-2 text-xl font-black text-[#2f1c6a]">₹15.2L</p>
              <p className="mt-1 text-[10px] font-bold text-[#00a76f]">
                Weighted average
              </p>
            </div>
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
                      className="w-full rounded-t-lg bg-gradient-to-t from-[#673de6] to-[#b69cff] shadow-[0_8px_16px_rgba(103,61,230,0.18)]"
                      style={{ height: `${height}%` }}
                    />
                    <span className="text-[9px] font-bold text-[#aaa3bf]">
                      {[
                        "M",
                        "T",
                        "W",
                        "T",
                        "F",
                        "S",
                        "S",
                      ][index]}
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

      <div className="landing-float-delay absolute -bottom-8 -left-4 hidden rounded-2xl border border-white/20 bg-white/95 p-4 shadow-[0_24px_60px_rgba(16,8,49,0.28)] backdrop-blur sm:block">
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


type ShowcaseItemId = (typeof showcaseItems)[number]["id"];

function ProductShowcase() {
  const [activeGroup, setActiveGroup] = useState<ShowcaseGroup>("All");
  const [activeId, setActiveId] = useState<ShowcaseItemId>(
    showcaseItems[0].id
  );
  const [isPaused, setIsPaused] = useState(false);
  const [isImageOpen, setIsImageOpen] = useState(false);

  const visibleItems = useMemo(
    () =>
      activeGroup === "All"
        ? showcaseItems
        : showcaseItems.filter((item) => item.group === activeGroup),
    [activeGroup]
  );

  const activeIndex = Math.max(
    0,
    visibleItems.findIndex((item) => item.id === activeId)
  );

  const activeItem = visibleItems[activeIndex] || showcaseItems[0];

  useEffect(() => {
    const firstVisibleItem = visibleItems[0];

    if (
      firstVisibleItem &&
      !visibleItems.some((item) => item.id === activeId)
    ) {
      setActiveId(firstVisibleItem.id);
    }
  }, [activeId, visibleItems]);

  useEffect(() => {
    if (isPaused || isImageOpen || visibleItems.length < 2) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveId((current) => {
        const index = visibleItems.findIndex(
          (item) => item.id === current
        );

        const nextIndex =
          index < 0 ? 0 : (index + 1) % visibleItems.length;

        return visibleItems[nextIndex].id;
      });
    }, 4800);

    return () => window.clearInterval(timer);
  }, [isPaused, isImageOpen, visibleItems]);

  useEffect(() => {
    if (!isImageOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsImageOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isImageOpen]);

  function selectGroup(group: ShowcaseGroup) {
    setActiveGroup(group);

    const first =
      group === "All"
        ? showcaseItems[0]
        : showcaseItems.find((item) => item.group === group);

    if (first) {
      setActiveId(first.id);
    }
  }

  function previous() {
    const previousIndex =
      (activeIndex - 1 + visibleItems.length) % visibleItems.length;

    setActiveId(visibleItems[previousIndex].id);
  }

  function next() {
    const nextIndex = (activeIndex + 1) % visibleItems.length;
    setActiveId(visibleItems[nextIndex].id);
  }

  const ActiveIcon = activeItem.icon;
  const mobileProgress =
    ((activeIndex + 1) / visibleItems.length) * 100;

  return (
    <div
      className="mt-10 sm:mt-14"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
    >
      <div className="landing-scrollbar-none -mx-4 flex flex-nowrap justify-start gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0">
        {showcaseGroups.map((group) => (
          <button
            key={group}
            type="button"
            onClick={() => selectGroup(group)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-black transition ${
              activeGroup === group
                ? "border-violet-600 bg-violet-600 text-white shadow-lg shadow-violet-200"
                : "border-violet-100 bg-white text-slate-600 hover:border-violet-300 hover:text-violet-700"
            }`}
          >
            {group}
          </button>
        ))}
      </div>

      <div className="mt-5 overflow-hidden rounded-[24px] border border-violet-100 bg-white shadow-[0_20px_60px_rgba(76,29,149,0.12)] sm:mt-7 sm:rounded-[34px] sm:shadow-[0_30px_90px_rgba(76,29,149,0.13)]">
        <div className="grid lg:grid-cols-[310px_minmax(0,1fr)]">
          <aside className="hidden border-r border-violet-900/60 bg-slate-950 p-5 text-white lg:block">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
                  Product Tour
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {visibleItems.length} real screens
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsPaused((current) => !current)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 transition hover:bg-white/10"
                aria-label={
                  isPaused ? "Play product tour" : "Pause product tour"
                }
              >
                {isPaused ? (
                  <Play className="h-4 w-4" />
                ) : (
                  <Pause className="h-4 w-4" />
                )}
              </button>
            </div>

            <div className="landing-scrollbar-none mt-5 flex max-h-[590px] flex-col gap-2 overflow-y-auto pr-1">
              {visibleItems.map((item, index) => {
                const Icon = item.icon;
                const active = item.id === activeItem.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveId(item.id)}
                    className={`flex min-w-0 items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                      active
                        ? "border-violet-400/40 bg-violet-600 text-white shadow-lg"
                        : "border-white/5 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        active
                          ? "bg-white/15"
                          : "bg-white/[0.06] text-violet-300"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black">
                        {item.label}
                      </span>
                      <span
                        className={`mt-0.5 block truncate text-[10px] font-bold uppercase tracking-[0.12em] ${
                          active
                            ? "text-violet-100"
                            : "text-slate-500"
                        }`}
                      >
                        {item.eyebrow}
                      </span>
                    </span>

                    <span
                      className={`text-xs font-black ${
                        active ? "text-white" : "text-slate-600"
                      }`}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="min-w-0 bg-gradient-to-br from-[#f7f5ff] via-white to-[#eef2ff] p-3 sm:p-6 lg:p-8">
            <div className="rounded-2xl bg-slate-950 p-3 text-white lg:hidden">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600">
                  <ActiveIcon className="h-5 w-5" />
                </span>

                <div className="min-w-0 flex-1">
                  <label
                    htmlFor="mobile-showcase-screen"
                    className="block text-[10px] font-black uppercase tracking-[0.16em] text-violet-300"
                  >
                    Choose product screen
                  </label>

                  <select
                    id="mobile-showcase-screen"
                    value={activeItem.id}
                    onChange={(event) =>
                      setActiveId(
                        event.target.value as ShowcaseItemId
                      )
                    }
                    className="mt-1 w-full appearance-none bg-transparent text-sm font-black text-white outline-none"
                  >
                    {visibleItems.map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                        className="bg-slate-950 text-white"
                      >
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setIsPaused((current) => !current)
                  }
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5"
                  aria-label={
                    isPaused
                      ? "Play product tour"
                      : "Pause product tour"
                  }
                >
                  {isPaused ? (
                    <Play className="h-4 w-4" />
                  ) : (
                    <Pause className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-5 sm:mt-0 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-violet-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-violet-700 shadow-sm sm:text-xs sm:tracking-[0.16em]">
                  <ActiveIcon className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {activeItem.eyebrow}
                  </span>
                </div>

                <h3 className="mt-4 text-xl font-black tracking-[-0.03em] text-slate-950 sm:text-3xl">
                  {activeItem.title}
                </h3>

                <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
                  {activeItem.description}
                </p>
              </div>

              <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
                <button
                  type="button"
                  onClick={previous}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-200 bg-white text-violet-700 shadow-sm transition hover:border-violet-400 sm:h-11 sm:w-11"
                  aria-label="Previous screen"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <div className="min-w-[72px] text-center text-sm font-black text-slate-500">
                  {activeIndex + 1} / {visibleItems.length}
                </div>

                <button
                  type="button"
                  onClick={next}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-200 bg-white text-violet-700 shadow-sm transition hover:border-violet-400 sm:h-11 sm:w-11"
                  aria-label="Next screen"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsImageOpen(true)}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-3 text-xs font-black text-white shadow-sm transition hover:bg-violet-700 sm:h-11 sm:px-4 sm:text-sm"
                >
                  <Maximize2 className="h-4 w-4" />
                  <span className="hidden min-[390px]:inline">
                    Full screen
                  </span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsImageOpen(true)}
              className="group mt-5 block w-full overflow-hidden rounded-[20px] border border-violet-200 bg-slate-950 p-1.5 text-left shadow-[0_18px_50px_rgba(15,23,42,0.24)] sm:mt-6 sm:rounded-[28px] sm:p-3 sm:shadow-[0_25px_70px_rgba(15,23,42,0.26)]"
              aria-label={`Open ${activeItem.label} screenshot in full screen`}
            >
              <div className="flex items-center justify-between rounded-t-[15px] border-b border-white/10 px-3 py-2.5 sm:rounded-t-[21px] sm:px-4 sm:py-3">
                <div className="flex gap-1.5 sm:gap-2">
                  <span className="h-2 w-2 rounded-full bg-red-400 sm:h-2.5 sm:w-2.5" />
                  <span className="h-2 w-2 rounded-full bg-amber-400 sm:h-2.5 sm:w-2.5" />
                  <span className="h-2 w-2 rounded-full bg-emerald-400 sm:h-2.5 sm:w-2.5" />
                </div>

                <p className="max-w-[52%] truncate text-[8px] font-black uppercase tracking-[0.1em] text-violet-100 sm:text-[10px] sm:tracking-[0.14em]">
                  VertexERP • {activeItem.label}
                </p>

                <span className="flex items-center gap-1.5 text-[8px] font-black text-emerald-300 sm:gap-2 sm:text-[10px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 sm:h-2 sm:w-2" />
                  Live UI
                </span>
              </div>

              <div className="relative aspect-[4/3] overflow-hidden rounded-b-[15px] bg-[#f4f6fb] sm:aspect-[16/9] sm:rounded-b-[21px]">
                <div
                  key={activeItem.id}
                  className="showcase-reveal absolute inset-0"
                >
                  <Image
                    src={activeItem.image}
                    alt={`${activeItem.label} screen in VertexERP`}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 900px"
                    unoptimized
                    className="object-cover object-top sm:object-contain"
                  />
                </div>

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/20 via-transparent to-white/5 sm:from-slate-950/10" />

                <div className="absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-xl bg-slate-950/85 px-3 py-2 text-xs font-black text-white shadow-lg backdrop-blur sm:hidden">
                  <Maximize2 className="h-4 w-4" />
                  Tap to expand
                </div>
              </div>
            </button>

            <div className="mt-4 grid gap-2 sm:mt-5 sm:grid-cols-3 sm:gap-3">
              {activeItem.points.map((point) => (
                <div
                  key={point}
                  className="flex items-start gap-3 rounded-2xl border border-violet-100 bg-white p-3 shadow-sm sm:p-4"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <Check className="h-4 w-4" />
                  </span>

                  <p className="text-sm font-bold leading-6 text-slate-700">
                    {point}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 sm:hidden">
              <div className="h-1.5 overflow-hidden rounded-full bg-violet-100">
                <div
                  className="h-full rounded-full bg-violet-600 transition-[width] duration-500"
                  style={{ width: `${mobileProgress}%` }}
                />
              </div>
            </div>

            <div className="mt-5 hidden gap-1.5 sm:flex">
              {visibleItems.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveId(item.id)}
                  className={`h-1.5 flex-1 rounded-full transition ${
                    index <= activeIndex
                      ? "bg-violet-600"
                      : "bg-violet-100 hover:bg-violet-200"
                  }`}
                  aria-label={`Open ${item.label}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {isImageOpen && (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-slate-950/95 p-3 backdrop-blur-md sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label={`${activeItem.label} full-screen screenshot`}
        >
          <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3 pb-3 text-white">
            <div className="min-w-0">
              <p className="truncate text-sm font-black sm:text-base">
                VertexERP • {activeItem.label}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                Swipe horizontally to inspect the full desktop interface.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsImageOpen(false)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white transition hover:bg-white/20"
              aria-label="Close full-screen screenshot"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="landing-scrollbar-none mx-auto min-h-0 w-full max-w-[1600px] flex-1 overflow-auto rounded-2xl bg-[#f4f6fb] shadow-2xl">
            <div className="min-w-[980px]">
              <Image
                src={activeItem.image}
                alt={`${activeItem.label} full VertexERP screen`}
                width={1600}
                height={900}
                unoptimized
                priority
                className="h-auto w-full"
              />
            </div>
          </div>

          <div className="mx-auto mt-3 flex w-full max-w-[1600px] items-center justify-between gap-3">
            <button
              type="button"
              onClick={previous}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>

            <span className="text-xs font-black text-slate-400">
              {activeIndex + 1} / {visibleItems.length}
            </span>

            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  light = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  align?: "left" | "center";
  light?: boolean;
}) {
  return (
    <div
      className={
        align === "center"
          ? "mx-auto max-w-3xl text-center"
          : "max-w-2xl"
      }
    >
      <p
        className={`text-sm font-black uppercase tracking-[0.2em] ${
          light ? "text-violet-300" : "text-[#673de6]"
        }`}
      >
        {eyebrow}
      </p>
      <h2
        className={`mt-4 text-3xl font-black tracking-[-0.04em] sm:text-5xl ${
          light ? "text-white" : "text-[#2f1c6a]"
        }`}
      >
        {title}
      </h2>
      <p
        className={`mt-5 text-base leading-8 sm:text-lg ${
          light ? "text-violet-100/75" : "text-[#6f6982]"
        }`}
      >
        {description}
      </p>
    </div>
  );
}

function ExperiencePanel({
  activeTab,
}: {
  activeTab: (typeof experienceTabs)[number];
}) {
  const Icon = activeTab.icon;

  return (
    <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.07] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-7">
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-500/25 blur-3xl" />
      <div className="relative grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
        <div>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-200 ring-1 ring-white/10">
            <Icon className="h-7 w-7" />
          </span>

          <h3 className="mt-6 text-2xl font-black tracking-tight text-white sm:text-3xl">
            {activeTab.title}
          </h3>
          <p className="mt-4 leading-7 text-violet-100/70">
            {activeTab.description}
          </p>

          <div className="mt-6 space-y-3">
            {activeTab.points.map((point) => (
              <div key={point} className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
                  <Check className="h-4 w-4" />
                </span>
                <p className="text-sm font-bold text-white/85">{point}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[26px] border border-white/10 bg-[#f8f6ff] p-3 shadow-2xl shadow-black/20 sm:p-4">
          <div className="rounded-[21px] bg-white p-4">
            <div className="flex items-center justify-between border-b border-[#ece6f8] pb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#673de6] text-xs font-black text-white">
                  VX
                </span>
                <div>
                  <p className="text-sm font-black text-[#2f1c6a]">
                    {activeTab.label} Workspace
                  </p>
                  <p className="text-[10px] font-semibold text-[#938ba8]">
                    Clean, focused and permission-aware
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-[#e8f9ef] px-3 py-1 text-[10px] font-black text-[#00875a]">
                Ready
              </span>
            </div>

            <div className="mt-4 grid grid-cols-[92px_1fr] gap-3">
              <div className="space-y-2 rounded-2xl bg-[#2f1c6a] p-3">
                {["Home", "Sales", "Stock", "Reports"].map((item, index) => (
                  <div
                    key={item}
                    className={`rounded-lg px-2 py-2 text-[9px] font-black ${
                      index === 0
                        ? "bg-[#673de6] text-white"
                        : "text-violet-200/60"
                    }`}
                  >
                    {item}
                  </div>
                ))}
              </div>

              <div className="min-w-0 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-[#ede7ff] p-3">
                    <p className="text-[9px] font-bold text-[#8c85a8]">
                      Current activity
                    </p>
                    <p className="mt-1 text-base font-black text-[#2f1c6a]">
                      ₹8.42L
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#e8f9ef] p-3">
                    <p className="text-[9px] font-bold text-[#62927e]">
                      Workflow status
                    </p>
                    <p className="mt-1 text-base font-black text-[#00875a]">
                      Connected
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-[#e8e2f4] p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-[#2f1c6a]">
                      Guided workspace
                    </p>
                    <Search className="h-3.5 w-3.5 text-[#8c85a8]" />
                  </div>
                  <div className="mt-3 space-y-2">
                    {[78, 58, 88].map((width, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="h-6 w-6 rounded-lg bg-[#ede7ff]" />
                        <span className="h-2 rounded-full bg-[#e5def4]" style={{ width: `${width}%` }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeExperience, setActiveExperience] = useState("dashboard");

  const activeExperienceTab =
    experienceTabs.find((tab) => tab.id === activeExperience) ||
    experienceTabs[0];

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
            transform: translateY(26px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes landingFloat {
          0%,
          100% {
            transform: translateY(0) rotateX(0deg);
          }
          50% {
            transform: translateY(-10px) rotateX(0.5deg);
          }
        }

        @keyframes landingGlow {
          0%,
          100% {
            opacity: 0.45;
            transform: scale(1);
          }
          50% {
            opacity: 0.75;
            transform: scale(1.08);
          }
        }

        @keyframes landingMarquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }

        @keyframes showcaseReveal {
          from {
            opacity: 0.2;
            transform: translateY(12px) scale(0.985);
            filter: blur(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }

        .landing-fade-up {
          animation: landingFadeUp 720ms ease-out both;
        }

        .landing-fade-up-delay {
          animation: landingFadeUp 850ms 120ms ease-out both;
        }

        .landing-float {
          animation: landingFloat 6s ease-in-out infinite;
          transform-style: preserve-3d;
        }

        .landing-float-delay {
          animation: landingFloat 6s 1.2s ease-in-out infinite;
        }

        .landing-glow {
          animation: landingGlow 7s ease-in-out infinite;
        }

        .landing-marquee {
          width: max-content;
          animation: landingMarquee 28s linear infinite;
        }

        .showcase-reveal {
          animation: showcaseReveal 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
          will-change: transform, opacity, filter;
        }

        .landing-scrollbar-none {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .landing-scrollbar-none::-webkit-scrollbar {
          display: none;
        }

        .landing-grid {
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.055) 1px, transparent 1px);
          background-size: 52px 52px;
          mask-image: linear-gradient(to bottom, black 25%, transparent 88%);
        }

        @media (prefers-reduced-motion: reduce) {
          html {
            scroll-behavior: auto;
          }

          .landing-fade-up,
          .landing-fade-up-delay,
          .landing-float,
          .landing-float-delay,
          .landing-glow,
          .landing-marquee,
          .showcase-reveal {
            animation: none !important;
          }
        }
      `}</style>

      <div className="min-h-screen overflow-x-hidden bg-[#f8f6ff] text-[#2f1c6a]">
        <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#100725]/80 backdrop-blur-2xl">
          <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link href="/" aria-label="VertexERP home">
              <Brand dark />
            </Link>

            <nav className="hidden items-center gap-7 lg:flex">
              {[
                ["Why VertexERP", "#why"],
                ["Features", "#features"],
                ["Experience", "#experience"],
                ["How It Works", "#workflow"],
                ["Security", "#security"],
                ["Contact", "#contact"],
              ].map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  className="text-sm font-bold text-violet-100/70 transition hover:text-white"
                >
                  {label}
                </a>
              ))}
            </nav>

            <div className="hidden items-center gap-3 lg:flex">
              <Link
                href="/auth"
                className="rounded-xl px-4 py-2.5 text-sm font-black text-white transition hover:bg-white/10"
              >
                Sign In
              </Link>
              <Link
                href="/auth"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-black text-[#5025d1] shadow-[0_12px_30px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 hover:bg-[#ffcd35] hover:text-[#2f1c6a]"
              >
                Start Free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <button
              type="button"
              onClick={() => setIsMenuOpen((current) => !current)}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white lg:hidden"
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
            <div className="border-t border-white/10 bg-[#100725]/95 px-4 py-5 backdrop-blur-2xl lg:hidden">
              <div className="mx-auto flex max-w-7xl flex-col gap-2">
                {[
                  ["Why VertexERP", "#why"],
                  ["Features", "#features"],
                  ["Experience", "#experience"],
                  ["How It Works", "#workflow"],
                  ["Security", "#security"],
                  ["Contact", "#contact"],
                ].map(([label, href]) => (
                  <a
                    key={href}
                    href={href}
                    onClick={() => setIsMenuOpen(false)}
                    className="rounded-xl px-4 py-3 font-bold text-violet-100/80 transition hover:bg-white/10 hover:text-white"
                  >
                    {label}
                  </a>
                ))}

                <Link
                  href="/auth"
                  onClick={() => setIsMenuOpen(false)}
                  className="mt-2 rounded-xl bg-white px-5 py-3 text-center font-black text-[#5025d1]"
                >
                  Start Free
                </Link>
              </div>
            </div>
          )}
        </header>

        <main>
          <section className="relative min-h-screen overflow-hidden bg-[#100725] pt-20 text-white">
            <div className="landing-grid absolute inset-0" />
            <div className="landing-glow absolute -left-40 top-20 h-[520px] w-[520px] rounded-full bg-violet-600/30 blur-[110px]" />
            <div className="landing-glow absolute -right-40 top-10 h-[480px] w-[480px] rounded-full bg-fuchsia-500/20 blur-[120px]" />
            <div className="absolute bottom-0 left-1/2 h-64 w-[80%] -translate-x-1/2 rounded-full bg-indigo-500/15 blur-[100px]" />

            <div className="relative mx-auto grid min-h-[calc(100vh-80px)] max-w-7xl items-center gap-16 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:pb-24 lg:pt-14">
              <div className="landing-fade-up max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-black text-violet-100 shadow-2xl backdrop-blur-xl">
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  Modern cloud ERP for growing Indian businesses
                </div>

                <h1 className="mt-8 text-4xl font-black leading-[1.02] tracking-[-0.055em] sm:text-6xl lg:text-[72px]">
                  Run every part of your business
                  <span className="block bg-gradient-to-r from-violet-300 via-white to-amber-200 bg-clip-text text-transparent">
                    from one connected workspace.
                  </span>
                </h1>

                <p className="mt-7 max-w-xl text-base leading-8 text-violet-100/70 sm:text-lg">
                  Bring billing, inventory, accounting, GST, payments, reports,
                  team permissions and audit controls together without switching
                  between disconnected systems.
                </p>

                <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/auth"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 font-black text-[#5025d1] shadow-[0_18px_45px_rgba(0,0,0,0.25)] transition hover:-translate-y-1 hover:bg-[#ffcd35] hover:text-[#2f1c6a]"
                  >
                    Start Free
                    <ArrowRight className="h-5 w-5" />
                  </Link>

                  <a
                    href="#experience"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-6 py-4 font-black text-white backdrop-blur transition hover:-translate-y-1 hover:bg-white/15"
                  >
                    Explore the Platform
                    <ChevronRight className="h-5 w-5" />
                  </a>
                </div>

                <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {highlights.map((highlight) => (
                    <div
                      key={highlight}
                      className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.07] p-3 backdrop-blur"
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                      <span className="text-xs font-bold leading-5 text-violet-100/80">
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

            <div className="relative border-y border-white/10 bg-white/[0.04] py-5 backdrop-blur">
              <div className="overflow-hidden">
                <div className="landing-marquee flex items-center gap-4 pr-4">
                  {[...Array(2)].flatMap((_, copyIndex) =>
                    [
                      "Sales & GST",
                      "Inventory",
                      "Accounting",
                      "Payments",
                      "Reports",
                      "Team Permissions",
                      "Audit Controls",
                      "Backup & Export",
                    ].map((item) => (
                      <div
                        key={`${copyIndex}-${item}`}
                        className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.06] px-5 py-2 text-sm font-black text-violet-100/80"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                        {item}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>

          <section
            id="why"
            className="scroll-mt-24 bg-white"
          >
            <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
              <SectionHeading
                eyebrow="Why VertexERP"
                title="Built to connect daily work with business control."
                description="VertexERP is designed around the way a growing business actually works: masters, transactions, stock, balances, accounting, reports and permissions moving together."
              />

              <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {platformReasons.map((reason) => {
                  const Icon = reason.icon;

                  return (
                    <article
                      key={reason.title}
                      className="group relative overflow-hidden rounded-[28px] border border-[#e5def4] bg-[#faf9ff] p-6 transition duration-300 hover:-translate-y-2 hover:border-violet-300 hover:bg-white hover:shadow-[0_24px_60px_rgba(47,28,106,0.12)]"
                    >
                      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-violet-200/30 blur-2xl transition group-hover:bg-violet-300/40" />
                      <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ede7ff] text-[#673de6] transition group-hover:bg-[#673de6] group-hover:text-white">
                        <Icon className="h-6 w-6" />
                      </span>
                      <h3 className="relative mt-5 text-xl font-black text-[#2f1c6a]">
                        {reason.title}
                      </h3>
                      <p className="relative mt-3 text-sm leading-7 text-[#736c87]">
                        {reason.description}
                      </p>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <section
            id="features"
            className="mx-auto max-w-7xl scroll-mt-24 px-4 py-24 sm:px-6 lg:px-8 lg:py-32"
          >
            <SectionHeading
              eyebrow="Real Product Experience"
              title="Explore the actual VertexERP workspace."
              description="Move through real product screens with a lightweight automatic tour. Pause it, filter by category or open any module manually."
            />

            <ProductShowcase />

            <div className="mt-20">
              <div className="mx-auto max-w-3xl text-center">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-violet-700">Connected Capabilities</p>
                <h3 className="mt-3 text-2xl font-black tracking-[-0.03em] text-slate-950 sm:text-3xl">The modules behind the complete business workflow.</h3>
              </div>

              <div className="mt-9 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                {productFeatures.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <article key={feature.title} className="group rounded-[26px] border border-[#e4dcf5] bg-white p-6 shadow-[0_12px_35px_rgba(47,28,106,0.06)] transition duration-300 hover:-translate-y-2 hover:border-[#b9a8ee] hover:shadow-[0_22px_50px_rgba(47,28,106,0.12)]">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ede7ff] text-[#673de6] transition group-hover:bg-[#673de6] group-hover:text-white"><Icon className="h-6 w-6" /></span>
                      <h3 className="mt-5 text-lg font-black text-[#2f1c6a]">{feature.title}</h3>
                      <p className="mt-3 text-sm leading-7 text-[#736c87]">{feature.description}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <section
            id="experience"
            className="relative scroll-mt-24 overflow-hidden bg-[#100725]"
          >
            <div className="landing-grid absolute inset-0 opacity-50" />
            <div className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-violet-600/20 blur-[100px]" />

            <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
              <SectionHeading
                light
                eyebrow="UI & UX Experience"
                title="A focused workspace that explains itself."
                description="Users should not need to search through confusing screens. VertexERP groups daily work into clear modules, visible actions and responsive layouts."
              />

              <div className="mt-12 flex flex-wrap justify-center gap-3">
                {experienceTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = tab.id === activeExperience;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveExperience(tab.id)}
                      className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black transition ${
                        isActive
                          ? "border-white bg-white text-[#5025d1] shadow-xl"
                          : "border-white/10 bg-white/[0.06] text-violet-100/70 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-8">
                <ExperiencePanel activeTab={activeExperienceTab} />
              </div>
            </div>
          </section>

          <section
            id="workflow"
            className="scroll-mt-24 bg-[#ebe4ff]"
          >
            <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
              <SectionHeading
                eyebrow="How To Use VertexERP"
                title="Go from setup to daily control in four clear steps."
                description="The platform keeps business setup simple and then guides users into the daily workflows that matter most."
              />

              <div className="relative mt-14 grid gap-5 lg:grid-cols-4">
                <div className="absolute left-[12%] right-[12%] top-12 hidden h-px bg-gradient-to-r from-transparent via-violet-400 to-transparent lg:block" />

                {workflowSteps.map((step) => {
                  const Icon = step.icon;

                  return (
                    <article
                      key={step.number}
                      className="relative rounded-[28px] border border-white/80 bg-white p-6 shadow-[0_12px_35px_rgba(47,28,106,0.08)]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="inline-flex rounded-full bg-[#ede7ff] px-3 py-1 text-sm font-black text-[#673de6]">
                          {step.number}
                        </span>
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2f1c6a] text-white">
                          <Icon className="h-5 w-5" />
                        </span>
                      </div>
                      <h3 className="mt-6 text-lg font-black text-[#2f1c6a]">
                        {step.title}
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-[#736c87]">
                        {step.description}
                      </p>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="mx-auto grid max-w-7xl gap-14 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-32">
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
                  "Party balances connected with receipts and payments",
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

            <div className="relative rounded-[34px] bg-gradient-to-br from-[#2f1c6a] via-[#3f248d] to-[#673de6] p-4 shadow-[0_35px_90px_rgba(47,28,106,0.3)] sm:p-6">
              <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-amber-300/15 blur-2xl" />
              <div className="relative rounded-[26px] bg-white p-5">
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
                  Business records remain company-aware and daily actions are
                  protected by controlled permissions and financial workflows.
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

          <section
            id="contact"
            className="scroll-mt-24 bg-[#f2edff]"
          >
            <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
              <div className="grid overflow-hidden rounded-[36px] bg-[#100725] shadow-[0_35px_90px_rgba(47,28,106,0.25)] lg:grid-cols-[0.9fr_1.1fr]">
                <div className="relative overflow-hidden p-7 text-white sm:p-10 lg:p-12">
                  <div className="landing-grid absolute inset-0 opacity-60" />
                  <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-violet-600/30 blur-3xl" />

                  <div className="relative">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-violet-200">
                      <Headphones className="h-4 w-4" />
                      VertexERP Support
                    </span>

                    <h2 className="mt-6 text-3xl font-black tracking-[-0.04em] sm:text-5xl">
                      Need help getting your business workspace ready?
                    </h2>
                    <p className="mt-5 max-w-xl leading-8 text-violet-100/70">
                      Contact support for account access, company setup,
                      invoicing, GST, inventory, accounting, reports or team
                      permissions.
                    </p>

                    <div className="mt-8 flex flex-wrap gap-3">
                      <a
                        href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
                          "VertexERP Support Request"
                        )}`}
                        className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-black text-[#5025d1] transition hover:-translate-y-1 hover:bg-amber-300 hover:text-[#2f1c6a]"
                      >
                        Email Support
                        <ArrowUpRight className="h-4 w-4" />
                      </a>
                      <a
                        href={`https://wa.me/${SUPPORT_PHONE_RAW}?text=${whatsappMessage}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 font-black text-white transition hover:-translate-y-1 hover:bg-white/15"
                      >
                        WhatsApp Support
                        <ArrowUpRight className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 bg-white p-6 sm:p-8 lg:p-10">
                  <a
                    href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
                      "VertexERP Support Request"
                    )}`}
                    className="group flex items-center gap-4 rounded-3xl border border-[#e5def4] bg-[#faf9ff] p-5 transition hover:border-violet-300 hover:bg-white hover:shadow-xl"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#ede7ff] text-[#673de6]">
                      <Mail className="h-6 w-6" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8c85a8]">
                        Email Support
                      </p>
                      <p className="mt-1 break-all font-black text-[#2f1c6a]">
                        {SUPPORT_EMAIL}
                      </p>
                    </div>
                    <ArrowUpRight className="h-5 w-5 text-[#8c85a8] transition group-hover:text-[#673de6]" />
                  </a>

                  <a
                    href={`https://wa.me/${SUPPORT_PHONE_RAW}?text=${whatsappMessage}`}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center gap-4 rounded-3xl border border-[#e5def4] bg-[#faf9ff] p-5 transition hover:border-violet-300 hover:bg-white hover:shadow-xl"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#e8f9ef] text-[#00875a]">
                      <MessageCircle className="h-6 w-6" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8c85a8]">
                        WhatsApp Support
                      </p>
                      <p className="mt-1 font-black text-[#2f1c6a]">
                        {SUPPORT_PHONE}
                      </p>
                    </div>
                    <ArrowUpRight className="h-5 w-5 text-[#8c85a8] transition group-hover:text-[#673de6]" />
                  </a>

                  <a
                    href={`tel:+${SUPPORT_PHONE_RAW}`}
                    className="group flex items-center gap-4 rounded-3xl border border-[#e5def4] bg-[#faf9ff] p-5 transition hover:border-violet-300 hover:bg-white hover:shadow-xl"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fff4cc] text-[#9a6a00]">
                      <Phone className="h-6 w-6" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8c85a8]">
                        Phone Support
                      </p>
                      <p className="mt-1 font-black text-[#2f1c6a]">
                        {SUPPORT_PHONE}
                      </p>
                    </div>
                    <ArrowUpRight className="h-5 w-5 text-[#8c85a8] transition group-hover:text-[#673de6]" />
                  </a>

                  <div className="rounded-3xl border border-violet-100 bg-violet-50 p-5">
                    <div className="flex items-start gap-3">
                      <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-violet-700" />
                      <p className="text-sm leading-7 text-violet-900">
                        Please include your registered email and company name so
                        the support request can be understood quickly.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
            <div className="relative overflow-hidden rounded-[38px] bg-gradient-to-br from-[#673de6] via-[#5b2bd6] to-[#2f1c6a] px-6 py-14 text-center shadow-[0_35px_90px_rgba(103,61,230,0.28)] sm:px-12 sm:py-20">
              <div className="landing-grid absolute inset-0 opacity-50" />
              <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute -bottom-24 -right-20 h-64 w-64 rounded-full bg-[#ffcd35]/20 blur-3xl" />

              <div className="relative">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur">
                  <BadgeCheck className="h-7 w-7" />
                </div>
                <p className="mt-6 text-sm font-black uppercase tracking-[0.22em] text-violet-100">
                  Start building better control
                </p>
                <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-black tracking-[-0.04em] text-white sm:text-5xl">
                  Bring billing, stock, accounting and business control into one connected workspace.
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

        <footer className="bg-[#100725] text-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.35fr_0.65fr_0.65fr_1fr] lg:px-8">
            <div>
              <Brand dark />
              <p className="mt-5 max-w-md text-sm leading-7 text-violet-200/65">
                Cloud-based billing, inventory, accounting, GST, payments,
                reports and business controls for growing Indian businesses.
              </p>
            </div>

            <div>
              <p className="font-black">Product</p>
              <div className="mt-4 space-y-3 text-sm text-violet-200/65">
                <a href="#why" className="block hover:text-white">
                  Why VertexERP
                </a>
                <a href="#features" className="block hover:text-white">
                  Features
                </a>
                <a href="#experience" className="block hover:text-white">
                  Experience
                </a>
                <a href="#security" className="block hover:text-white">
                  Security
                </a>
              </div>
            </div>

            <div>
              <p className="font-black">Access</p>
              <div className="mt-4 space-y-3 text-sm text-violet-200/65">
                <Link href="/auth" className="block hover:text-white">
                  Sign In
                </Link>
                <Link href="/auth" className="block hover:text-white">
                  Create Account
                </Link>
                <a href="#workflow" className="block hover:text-white">
                  How It Works
                </a>
              </div>
            </div>

            <div>
              <p className="font-black">Contact & Support</p>
              <div className="mt-4 space-y-3 text-sm text-violet-200/65">
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="flex items-start gap-2 hover:text-white"
                >
                  <Mail className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="break-all">{SUPPORT_EMAIL}</span>
                </a>
                <a
                  href={`https://wa.me/${SUPPORT_PHONE_RAW}?text=${whatsappMessage}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 hover:text-white"
                >
                  <MessageCircle className="h-4 w-4" />
                  {SUPPORT_PHONE}
                </a>
                <a
                  href={`tel:+${SUPPORT_PHONE_RAW}`}
                  className="flex items-center gap-2 hover:text-white"
                >
                  <Phone className="h-4 w-4" />
                  Call Support
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 px-4 py-6 text-center text-xs text-violet-200/45">
            © {new Date().getFullYear()} VertexERP. Run your business with
            confidence.
          </div>
        </footer>
      </div>
    </>
  );
}