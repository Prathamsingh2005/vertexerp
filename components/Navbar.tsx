"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePathname } from "next/navigation";

const pageDetails: Record<string, { title: string; subtitle: string }> = {
  "/": {
    title: "Dashboard",
    subtitle: "Welcome back 👋",
  },
  "/company": {
    title: "Company Management",
    subtitle: "Manage your business companies",
  },
  "/ledger": {
    title: "Ledger Management",
    subtitle: "Manage customers, suppliers and accounts",
  },
  "/inventory": {
    title: "Inventory Management",
    subtitle: "Manage products and stock levels",
  },
  "/sales": {
    title: "Sales & Billing",
    subtitle: "Create invoices and track customer payments",
  },
  "/purchase": {
    title: "Purchase & Stock Entry",
    subtitle: "Record supplier purchases and update stock",
  },
  "/expenses": {
    title: "Expenses",
    subtitle: "Track operational business expenses",
  },
  "/outstanding": {
    title: "Outstanding",
    subtitle: "Track customer receivables and supplier payables",
  },
  "/payments": {
    title: "Payments",
    subtitle: "Record customer receipts and supplier payments",
  },
  "/reports": {
    title: "Reports & Analytics",
    subtitle: "Track your business performance",
  },
};

function getUserName(
  metadata: Record<string, unknown> | undefined,
  email: string
) {
  const fullName = metadata?.full_name;

  if (typeof fullName === "string" && fullName.trim()) {
    return fullName.trim();
  }

  return email ? email.split("@")[0] : "Account";
}

export default function Navbar() {
  const pathname = usePathname();

  const [userName, setUserName] = useState("Account");
  const [userEmail, setUserEmail] = useState("");
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadCurrentUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isMounted) {
        return;
      }

      if (!user) {
        window.location.assign("/auth");
        return;
      }

      const email = user.email || "";

      setUserEmail(email);
      setUserName(getUserName(user.user_metadata, email));
      setIsLoadingUser(false);
    }

    loadCurrentUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        window.location.assign("/auth");
        return;
      }

      const email = session.user.email || "";

      setUserEmail(email);
      setUserName(getUserName(session.user.user_metadata, email));
      setIsLoadingUser(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const currentPage = pageDetails[pathname] || {
    title: "VertexERP",
    subtitle: "Run your business with confidence.",
  };

  const avatarText = useMemo(
    () => userName.charAt(0).toUpperCase() || "V",
    [userName]
  );

  async function handleLogout() {
    setIsSigningOut(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        window.alert("Unable to sign out. Please try again.");
        setIsSigningOut(false);
        return;
      }

      window.location.assign("/auth");
    } catch {
      window.alert("Unable to sign out. Please try again.");
      setIsSigningOut(false);
    }
  }

  return (
    <header className="flex min-h-20 items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 shadow-sm md:px-8">
      <div className="min-w-0">
        <h2 className="truncate text-2xl font-bold text-slate-900">
          {currentPage.title}
        </h2>

        <p className="mt-1 truncate text-sm text-slate-600">
          {currentPage.subtitle}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3 md:gap-5">
        <input
          type="text"
          placeholder="Search..."
          className="hidden w-72 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 lg:block"
        />

        <button
          type="button"
          aria-label="Notifications"
          className="hidden text-2xl transition hover:scale-110 sm:block"
        >
          🔔
        </button>

        <button
          type="button"
          aria-label="Theme"
          className="hidden text-2xl transition hover:scale-110 sm:block"
        >
          🌙
        </button>

        <div className="flex items-center gap-3 border-l border-slate-200 pl-3 md:pl-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 font-bold text-white">
            {avatarText}
          </div>

          <div className="hidden min-w-0 sm:block">
            <p className="max-w-44 truncate font-bold text-slate-900">
              {isLoadingUser ? "Loading..." : userName}
            </p>

            <p className="max-w-44 truncate text-sm text-slate-500">
              {userEmail || "Signed in user"}
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={isSigningOut}
            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSigningOut ? "Signing out..." : "Logout"}
          </button>
        </div>
      </div>
    </header>
  );
}