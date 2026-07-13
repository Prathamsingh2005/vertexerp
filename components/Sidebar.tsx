"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpenText,
  Boxes,
  Building2,
  CircleDollarSign,
  Cloud,
  History,
  Landmark,
  LayoutDashboard,
  PackageMinus,
  ReceiptText,
  RotateCcw,
  ShoppingCart,
  WalletCards,
  X,
} from "lucide-react";

type NavigationItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  section?: string;
};

const navigationItems: NavigationItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/company", label: "Companies", icon: Building2 },
  { href: "/ledger", label: "Ledgers", icon: BookOpenText },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  {
    href: "/sales",
    label: "Sales",
    icon: ShoppingCart,
    section: "Transactions",
  },
  {
  href: "/credit-notes",
  label: "Credit Notes",
  icon: RotateCcw,
},
  { href: "/purchase", label: "Purchase", icon: ReceiptText },
  {
  href: "/debit-notes",
  label: "Debit Notes",
  icon: PackageMinus,
},
  { href: "/expenses", label: "Expenses", icon: WalletCards },
  { href: "/outstanding", label: "Outstanding", icon: CircleDollarSign },
  { href: "/payments", label: "Payments", icon: CircleDollarSign },
  {
    href: "/accounting",
    label: "Accounting",
    icon: Landmark,
    section: "Management",
  },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/audit-history", label: "Audit History", icon: History },
];

function isActiveRoute(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
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
};

function NavLinks({ pathname, onNavigate }: NavLinksProps) {
  return (
    <ul className="space-y-1.5">
      {navigationItems.map((item) => {
        const Icon = item.icon;
        const isActive = isActiveRoute(pathname, item.href);

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
                <Icon className="h-4.5 w-4.5" strokeWidth={2.2} />
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
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-xl font-black text-white shadow-lg shadow-blue-950/50">
        V
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

function CloudStatus() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600/20 text-blue-300">
          <Cloud className="h-4 w-4" />
        </span>

        <div>
          <p className="text-sm font-bold text-white">Cloud sync active</p>
          <p className="mt-0.5 text-xs text-slate-400">Supabase secured</p>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const isDesktop = useDesktopBreakpoint();
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  function closeMobileDrawer() {
    setIsMobileDrawerOpen(false);
  }

  useEffect(() => {
    function openMobileDrawer() {
      if (isDesktop === false) {
        setIsMobileDrawerOpen(true);
      }
    }

    window.addEventListener("vertexerp-open-navigation", openMobileDrawer);

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
          <NavLinks pathname={pathname} />
        </nav>

        <div className="mt-4 px-1">
          <CloudStatus />
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
          transition: "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)",
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

          <NavLinks pathname={pathname} onNavigate={closeMobileDrawer} />
        </div>

        <div className="p-4">
          <CloudStatus />
        </div>
      </aside>
    </div>
  );
}