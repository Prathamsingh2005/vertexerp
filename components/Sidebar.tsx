"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpenText,
  Boxes,
  Building2,
  CircleDollarSign,
  Cloud,
  FileSpreadsheet,
  HardDriveDownload,
  History,
  Landmark,
  LayoutDashboard,
  PackageMinus,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  UserRoundCog,
  WalletCards,
  X,
} from "lucide-react";
import type { PermissionCode } from "@/lib/permissions";
import { usePermissions } from "@/hooks/usePermissions";

type NavigationItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  section?: string;
  exact?: boolean;
  activePrefixes?: string[];
  permission?: PermissionCode;
};

const navigationItems: NavigationItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    permission: "dashboard.view",
  },
  {
    href: "/company",
    label: "Companies",
    icon: Building2,
    permission: "company.view",
  },
  {
    href: "/ledger",
    label: "Ledgers",
    icon: BookOpenText,
    permission: "ledgers.view",
  },
  {
    href: "/inventory",
    label: "Inventory",
    icon: Boxes,
    permission: "inventory.view",
  },
  {
    href: "/sales",
    label: "Sales",
    icon: ShoppingCart,
    section: "Transactions",
    permission: "sales.view",
  },
  {
    href: "/credit-notes",
    label: "Credit Notes",
    icon: RotateCcw,
    permission: "credit_notes.view",
  },
  {
    href: "/purchase",
    label: "Purchase",
    icon: ReceiptText,
    permission: "purchase.view",
  },
  {
    href: "/debit-notes",
    label: "Debit Notes",
    icon: PackageMinus,
    permission: "debit_notes.view",
  },
  {
    href: "/expenses",
    label: "Expenses",
    icon: WalletCards,
    permission: "expenses.view",
  },
  {
    href: "/outstanding",
    label: "Outstanding",
    icon: CircleDollarSign,
    permission: "outstanding.view",
  },
  {
    href: "/payments",
    label: "Payments",
    icon: CircleDollarSign,
    permission: "payments.view",
  },
  {
    href: "/accounting",
    label: "Accounting",
    icon: Landmark,
    section: "Management",
    permission: "accounting.view",
  },
  {
    href: "/reports",
    label: "Reports",
    icon: BarChart3,
    exact: true,
    activePrefixes: [
      "/reports/customer",
      "/reports/supplier",
      "/reports/sales",
      "/reports/purchase",
      "/reports/stock",
      "/reports/payments",
      "/reports/statements",
    ],
    permission: "reports.view",
  },
  {
    href: "/reports/gst",
    label: "GST Reports",
    icon: FileSpreadsheet,
    permission: "gst_reports.view",
  },
  {
    href: "/audit-history",
    label: "Audit History",
    icon: History,
    permission: "audit.view",
  },
  {
    href: "/settings/team",
    label: "Team Management",
    icon: UserRoundCog,
    section: "System",
    permission: "team.view",
  },
  {
    href: "/settings/roles",
    label: "Roles & Permissions",
    icon: ShieldCheck,
    permission: "roles.view",
  },
  {
    href: "/settings/backup",
    label: "Backup & Export",
    icon: HardDriveDownload,
    permission: "backup.export",
  },
];

function matchesRoute(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

function isActiveRoute(
  pathname: string,
  item: NavigationItem
) {
  if (
    item.activePrefixes?.some((prefix) =>
      matchesRoute(pathname, prefix)
    )
  ) {
    return true;
  }

  if (item.exact) {
    return pathname === item.href;
  }

  return matchesRoute(pathname, item.href);
}

function useDesktopBreakpoint() {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");

    function updateBreakpoint() {
      setIsDesktop(mediaQuery.matches);
    }

    updateBreakpoint();
    mediaQuery.addEventListener("change", updateBreakpoint);

    return () => {
      mediaQuery.removeEventListener("change", updateBreakpoint);
    };
  }, []);

  return isDesktop;
}

type NavLinksProps = {
  pathname: string;
  onNavigate?: () => void;
  items: NavigationItem[];
};

function NavLinks({
  pathname,
  onNavigate,
  items,
}: NavLinksProps) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = isActiveRoute(pathname, item);

        return (
          <li key={item.href}>
            {item.section && (
              <p className="mb-2 mt-5 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                {item.section}
              </p>
            )}

            <Link
              href={item.href}
              onClick={onNavigate}
              className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-950/40"
                  : "text-slate-300 hover:bg-white/[0.07] hover:text-white"
              }`}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                  isActive
                    ? "bg-white/15 text-white"
                    : "bg-white/[0.06] text-slate-400 group-hover:bg-white/[0.1] group-hover:text-slate-100"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
              </span>

              <span>{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Brand({ onClick }: { onClick?: () => void }) {
  return (
    <Link
      href="/dashboard"
      onClick={onClick}
      className="flex items-center gap-3"
    >
      <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-lg font-black text-white shadow-lg shadow-blue-950/50">
        VX
        <span className="absolute bottom-1.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-amber-300" />
      </div>

      <div>
        <h1 className="text-xl font-black tracking-tight text-white">
          VertexERP
        </h1>
        <p className="mt-0.5 text-xs font-medium text-slate-400">
          Business Control Center
        </p>
      </div>
    </Link>
  );
}

function CloudStatus({
  roleName,
  isLoading,
}: {
  roleName: string;
  isLoading: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600/20 text-blue-300">
          <Cloud className="h-4 w-4" />
        </span>

        <div className="min-w-0">
          <p className="text-sm font-bold text-white">
            Cloud sync active
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-400">
            {isLoading ? "Checking access..." : roleName || "No active role"}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const isDesktop = useDesktopBreakpoint();
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] =
    useState(false);
  const { access, can, isLoading } = usePermissions();

  const visibleItems = useMemo(() => {
    return navigationItems.filter((item) => {
      if (!item.permission) {
        return true;
      }

      if (isLoading) {
        return item.href === "/dashboard" || item.href === "/company";
      }

      if (!access) {
        return item.href === "/dashboard" || item.href === "/company";
      }

      return can(item.permission);
    });
  }, [access, can, isLoading]);

  function closeMobileDrawer() {
    setIsMobileDrawerOpen(false);
  }

  useEffect(() => {
    function openMobileDrawer() {
      if (isDesktop === false) {
        setIsMobileDrawerOpen(true);
      }
    }

    window.addEventListener(
      "vertexerp-open-navigation",
      openMobileDrawer
    );

    return () => {
      window.removeEventListener(
        "vertexerp-open-navigation",
        openMobileDrawer
      );
    };
  }, [isDesktop]);

  useEffect(() => {
    if (isDesktop) {
      setIsMobileDrawerOpen(false);
    }
  }, [isDesktop]);

  useEffect(() => {
    if (!isMobileDrawerOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMobileDrawer();
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isMobileDrawerOpen]);

  if (isDesktop === null) {
    return null;
  }

  if (isDesktop) {
    return (
      <aside className="sticky top-0 flex h-screen w-[272px] shrink-0 flex-col border-r border-slate-800 bg-slate-950 p-4 text-white">
        <div className="border-b border-slate-800 px-2 pb-5 pt-2">
          <Brand />
        </div>

        <div className="mb-3 mt-5 flex items-center justify-between px-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Workspace
          </p>
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.8)]" />
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto pr-1">
          <NavLinks pathname={pathname} items={visibleItems} />
        </nav>

        <div className="mt-4 px-1">
          <CloudStatus
            roleName={access?.roleName || ""}
            isLoading={isLoading}
          />
        </div>
      </aside>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        pointerEvents: isMobileDrawerOpen ? "auto" : "none",
      }}
    >
      <button
        type="button"
        onClick={closeMobileDrawer}
        aria-label="Close navigation"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: isMobileDrawerOpen ? 1 : 0,
          backgroundColor: "rgba(2, 6, 23, 0.64)",
          backdropFilter: isMobileDrawerOpen ? "blur(3px)" : "none",
          transition: "opacity 220ms ease",
        }}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="VertexERP navigation"
        className="flex h-[100dvh] w-[min(84vw,340px)] flex-col border-r border-slate-800 bg-slate-950 text-white shadow-2xl"
        style={{
          position: "absolute",
          inset: "0 auto 0 0",
          transform: isMobileDrawerOpen
            ? "translateX(0)"
            : "translateX(-105%)",
          transition:
            "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-5">
          <Brand onClick={closeMobileDrawer} />

          <button
            type="button"
            onClick={closeMobileDrawer}
            aria-label="Close navigation"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] text-slate-200 transition hover:bg-white/[0.12] active:scale-95"
          >
            <X className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Workspace
          </p>

          <NavLinks
            pathname={pathname}
            onNavigate={closeMobileDrawer}
            items={visibleItems}
          />
        </div>

        <div className="p-4">
          <CloudStatus
            roleName={access?.roleName || ""}
            isLoading={isLoading}
          />
        </div>
      </aside>
    </div>
  );
}