"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpenText,
  Boxes,
  Building2,
  ChevronLeft,
  ChevronRight,
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
  Settings2,
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

const DESKTOP_SIDEBAR_STORAGE_KEY =
  "vertexerp-desktop-sidebar-collapsed";

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
      "/reports/profit",
      "/reports/payments",
      "/reports/statements",
      "/reports/balance-sheet",
      "/reports/cash-bank-book",
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
    href: "/settings",
    label: "Settings & Support",
    icon: Settings2,
    section: "System",
    exact: true,
  },
  {
    href: "/settings/team",
    label: "Team Management",
    icon: UserRoundCog,
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
  item: NavigationItem,
) {
  if (
    item.activePrefixes?.some((prefix) =>
      matchesRoute(pathname, prefix),
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
  const [isDesktop, setIsDesktop] = useState<boolean | null>(
    null,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      "(min-width: 1024px)",
    );

    function updateBreakpoint() {
      setIsDesktop(mediaQuery.matches);
    }

    updateBreakpoint();

    mediaQuery.addEventListener(
      "change",
      updateBreakpoint,
    );

    return () => {
      mediaQuery.removeEventListener(
        "change",
        updateBreakpoint,
      );
    };
  }, []);

  return isDesktop;
}

type NavLinksProps = {
  pathname: string;
  items: NavigationItem[];
  isCollapsed?: boolean;
  onNavigate?: () => void;
};

function NavLinks({
  pathname,
  items,
  isCollapsed = false,
  onNavigate,
}: NavLinksProps) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = isActiveRoute(
          pathname,
          item,
        );

        return (
          <li key={item.href}>
            {item.section && (
              isCollapsed ? (
                <div
                  className="mx-auto mb-3 mt-5 h-px w-8 bg-slate-800"
                  aria-hidden="true"
                />
              ) : (
                <p className="mb-2 mt-5 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  {item.section}
                </p>
              )
            )}

            <Link
              href={item.href}
              onClick={onNavigate}
              title={isCollapsed ? item.label : undefined}
              aria-label={isCollapsed ? item.label : undefined}
              className={`group flex items-center rounded-xl text-sm font-semibold transition-all duration-200 ${
                isCollapsed
                  ? "h-12 justify-center px-2"
                  : "gap-3 px-3 py-3"
              } ${
                isActive
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-950/40"
                  : "text-slate-300 hover:bg-white/[0.07] hover:text-white"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
                  isActive
                    ? "bg-white/15 text-white"
                    : "bg-white/[0.06] text-slate-400 group-hover:bg-white/[0.1] group-hover:text-slate-100"
                }`}
              >
                <Icon
                  className="h-[18px] w-[18px]"
                  strokeWidth={2.2}
                />
              </span>

              {!isCollapsed && (
                <span className="min-w-0 truncate">
                  {item.label}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Brand({
  isCollapsed = false,
  onClick,
}: {
  isCollapsed?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href="/dashboard"
      onClick={onClick}
      title={isCollapsed ? "VertexERP Dashboard" : undefined}
      aria-label={isCollapsed ? "VertexERP Dashboard" : undefined}
      className={`flex items-center ${
        isCollapsed
          ? "justify-center"
          : "gap-3"
      }`}
    >
      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-lg font-black text-white shadow-lg shadow-blue-950/50">
        VX

        <span className="absolute bottom-1.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-amber-300" />
      </div>

      {!isCollapsed && (
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black tracking-tight text-white">
            VertexERP
          </h1>

          <p className="mt-0.5 truncate text-xs font-medium text-slate-400">
            Business Control Center
          </p>
        </div>
      )}
    </Link>
  );
}

function CloudStatus({
  roleName,
  isLoading,
  isCollapsed = false,
}: {
  roleName: string;
  isLoading: boolean;
  isCollapsed?: boolean;
}) {
  if (isCollapsed) {
    return (
      <div
        title={
          isLoading
            ? "Checking cloud access..."
            : `Cloud sync active · ${roleName || "No active role"}`
        }
        className="flex h-12 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/70"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600/20 text-blue-300">
          <Cloud className="h-4 w-4" />
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600/20 text-blue-300">
          <Cloud className="h-4 w-4" />
        </span>

        <div className="min-w-0">
          <p className="text-sm font-bold text-white">
            Cloud sync active
          </p>

          <p className="mt-0.5 truncate text-xs text-slate-400">
            {isLoading
              ? "Checking access..."
              : roleName || "No active role"}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const isDesktop = useDesktopBreakpoint();

  const [
    isMobileDrawerOpen,
    setIsMobileDrawerOpen,
  ] = useState(false);

  const [
    isDesktopCollapsed,
    setIsDesktopCollapsed,
  ] = useState(false);

  const {
    access,
    can,
    isLoading,
  } = usePermissions();

  const visibleItems = useMemo(() => {
    return navigationItems.filter((item) => {
      if (!item.permission) {
        return true;
      }

      if (isLoading) {
        return (
          item.href === "/dashboard" ||
          item.href === "/company"
        );
      }

      if (!access) {
        return (
          item.href === "/dashboard" ||
          item.href === "/company"
        );
      }

      return can(item.permission);
    });
  }, [access, can, isLoading]);

  function closeMobileDrawer() {
    setIsMobileDrawerOpen(false);
  }

  function toggleDesktopSidebar() {
    setIsDesktopCollapsed((currentValue) => {
      const nextValue = !currentValue;

      window.localStorage.setItem(
        DESKTOP_SIDEBAR_STORAGE_KEY,
        String(nextValue),
      );

      window.dispatchEvent(
        new CustomEvent(
          "vertexerp-desktop-sidebar-updated",
          {
            detail: {
              collapsed: nextValue,
            },
          },
        ),
      );

      return nextValue;
    });
  }

  useEffect(() => {
    const storedValue = window.localStorage.getItem(
      DESKTOP_SIDEBAR_STORAGE_KEY,
    );

    setIsDesktopCollapsed(storedValue === "true");

    function handleDesktopToggle() {
      if (window.matchMedia("(min-width: 1024px)").matches) {
        toggleDesktopSidebar();
      }
    }

    window.addEventListener(
      "vertexerp-toggle-desktop-sidebar",
      handleDesktopToggle,
    );

    return () => {
      window.removeEventListener(
        "vertexerp-toggle-desktop-sidebar",
        handleDesktopToggle,
      );
    };
  }, []);

  useEffect(() => {
    function openMobileDrawer() {
      if (isDesktop === false) {
        setIsMobileDrawerOpen(true);
      }
    }

    window.addEventListener(
      "vertexerp-open-navigation",
      openMobileDrawer,
    );

    return () => {
      window.removeEventListener(
        "vertexerp-open-navigation",
        openMobileDrawer,
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

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMobileDrawer();
      }
    }

    window.addEventListener(
      "keydown",
      handleEscape,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleEscape,
      );
    };
  }, [isMobileDrawerOpen]);

  if (isDesktop === null) {
    return null;
  }

  if (isDesktop) {
    return (
      <aside
        className={`sticky top-0 self-start flex h-[100dvh] shrink-0 flex-col border-r border-slate-800 bg-slate-950 text-white transition-[width,padding] duration-300 ease-out ${
          isDesktopCollapsed
            ? "w-[88px] p-3"
            : "w-[272px] p-4"
        }`}
      >
        <button
          type="button"
          onClick={toggleDesktopSidebar}
          aria-label={
            isDesktopCollapsed
              ? "Expand sidebar"
              : "Collapse sidebar"
          }
          title={
            isDesktopCollapsed
              ? "Expand sidebar"
              : "Collapse sidebar"
          }
          className="absolute -right-3 top-[84px] z-20 flex h-7 w-7 items-center justify-center rounded-full border border-violet-200 bg-white text-violet-700 shadow-lg shadow-slate-950/20 transition hover:scale-110 hover:bg-violet-50 active:scale-95"
        >
          {isDesktopCollapsed ? (
            <ChevronRight
              className="h-4 w-4"
              strokeWidth={2.5}
            />
          ) : (
            <ChevronLeft
              className="h-4 w-4"
              strokeWidth={2.5}
            />
          )}
        </button>

        <div
          className={`border-b border-slate-800 pb-5 pt-2 ${
            isDesktopCollapsed
              ? "px-0"
              : "px-2"
          }`}
        >
          <Brand isCollapsed={isDesktopCollapsed} />
        </div>

        <div
          className={`mb-3 mt-5 flex items-center ${
            isDesktopCollapsed
              ? "justify-center px-0"
              : "justify-between px-3"
          }`}
        >
          {!isDesktopCollapsed && (
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
              Workspace
            </p>
          )}

          <span
            title="Workspace online"
            className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.8)]"
          />
        </div>

        <nav
          className={`min-h-0 flex-1 overflow-y-auto ${
            isDesktopCollapsed ? "pr-0" : "pr-1"
          }`}
        >
          <NavLinks
            pathname={pathname}
            items={visibleItems}
            isCollapsed={isDesktopCollapsed}
          />
        </nav>

        <div className={isDesktopCollapsed ? "mt-4" : "mt-4 px-1"}>
          <CloudStatus
            roleName={access?.roleName || ""}
            isLoading={isLoading}
            isCollapsed={isDesktopCollapsed}
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
        pointerEvents: isMobileDrawerOpen
          ? "auto"
          : "none",
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
          backgroundColor:
            "rgba(2, 6, 23, 0.64)",
          backdropFilter: isMobileDrawerOpen
            ? "blur(3px)"
            : "none",
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
            <X
              className="h-5 w-5"
              strokeWidth={2.5}
            />
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