"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import CompanyManager from "@/components/CompanyManager";
import { usePermissions } from "@/hooks/usePermissions";
import { createClient } from "@/lib/supabase/client";

type CompanyStatRow = {
  id: string;
  gst_number: string | null;
  created_at: string;
};

export default function CompanyPage() {
  const [companies, setCompanies] = useState<CompanyStatRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const {
    access,
    can,
    error: permissionError,
    isLoading: isPermissionLoading,
  } = usePermissions();

  const canViewCompanies = can("company.view");
  // Creating a new company is account-level and protected by the
  // companies_owner_insert RLS policy, not by an active-company permission.
  const canCreateCompany = true;

  const loadCompanyStats = useCallback(async () => {
    if (!canViewCompanies) {
      setCompanies([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setCompanies([]);
        return;
      }

      const { data, error } = await supabase
        .from("companies")
        .select("id, gst_number, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setCompanies((data || []) as CompanyStatRow[]);
    } catch {
      setCompanies([]);
    } finally {
      setIsLoading(false);
    }
  }, [canViewCompanies]);

  useEffect(() => {
    if (isPermissionLoading || !canViewCompanies) {
      return;
    }

    loadCompanyStats();
    window.addEventListener("smarterp-companies-updated", loadCompanyStats);

    return () => {
      window.removeEventListener(
        "smarterp-companies-updated",
        loadCompanyStats,
      );
    };
  }, [canViewCompanies, isPermissionLoading, loadCompanyStats]);

  const currentMonthCompanies = useMemo(() => {
    const today = new Date();

    return companies.filter((company) => {
      const created = new Date(company.created_at);

      return (
        created.getMonth() === today.getMonth() &&
        created.getFullYear() === today.getFullYear()
      );
    }).length;
  }, [companies]);

  const gstRegisteredCompanies = useMemo(
    () =>
      companies.filter((company) => Boolean(company.gst_number?.trim())).length,
    [companies],
  );

  function scrollToCompanyForm() {
    document.getElementById("company-form")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <div className="flex min-h-screen bg-[#f3f6fb]">
      <Sidebar />

      <div className="min-w-0 flex-1 overflow-x-hidden">
        <Navbar />

        <main className="min-w-0 p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
          <section className="overflow-hidden rounded-[30px] bg-gradient-to-br from-violet-950 via-violet-800 to-violet-600 p-6 text-white shadow-2xl shadow-violet-900/20 sm:p-8 lg:p-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-violet-100 backdrop-blur">
                  <span>🏢</span>
                  Workspace Administration
                </div>

                <h1 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                  Company Management
                </h1>

                <p className="mt-3 max-w-2xl text-base leading-7 text-violet-100 sm:text-lg">
                  Create, organize and manage every company available to your
                  current role.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-stretch">
                <div className="rounded-2xl border border-white/15 bg-slate-950/25 px-5 py-4 backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-200">
                    Active Access
                  </p>
                  <p className="mt-1 text-lg font-black">
                    {isPermissionLoading
                      ? "Loading..."
                      : access?.roleName || "No active role"}
                  </p>
                  <p className="mt-1 text-sm text-violet-100">
                    {canViewCompanies
                      ? "Company viewing enabled"
                      : "Create your own company"}
                  </p>
                </div>

                {canCreateCompany && !isPermissionLoading && (
                  <button
                    type="button"
                    onClick={scrollToCompanyForm}
                    className="w-full rounded-xl border border-white/25 bg-white/10 px-6 py-3 text-center font-bold text-white backdrop-blur transition hover:bg-white/20 sm:w-auto"
                  >
                    + Add Company
                  </button>
                )}
              </div>
            </div>
          </section>

          {permissionError && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-semibold text-red-700">
              {permissionError}
            </div>
          )}

          {isPermissionLoading ? (
            <div className="mt-6 rounded-3xl border border-violet-100 bg-white p-8 text-center font-semibold text-slate-600 shadow-xl shadow-violet-100/50">
              Loading company permissions...
            </div>
          ) : !canViewCompanies && !canCreateCompany ? (
            <div className="mt-6 rounded-3xl border border-red-200 bg-white p-8 text-center shadow-xl">
              <div className="text-4xl">🔒</div>
              <h2 className="mt-4 text-2xl font-black text-slate-900">
                Company access is restricted
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-slate-600">
                Your current role does not include the company.view permission
                for this workspace.
              </p>
            </div>
          ) : (
            <div className="mt-6 min-w-0 space-y-6 sm:mt-8">
              <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
                <StatCard
                  label="Total Companies"
                  value={isLoading ? "..." : companies.length}
                  detail="Companies available to your current account"
                  valueClassName="text-violet-700"
                />
                <StatCard
                  label="Active Companies"
                  value={isLoading ? "..." : companies.length}
                  detail="Companies ready for business transactions"
                  valueClassName="text-emerald-600"
                />
                <StatCard
                  label="GST Registered"
                  value={isLoading ? "..." : gstRegisteredCompanies}
                  detail="Companies with GST details added"
                  valueClassName="text-violet-700"
                />
                <StatCard
                  label="This Month"
                  value={isLoading ? "..." : currentMonthCompanies}
                  detail="Companies added during the current month"
                  valueClassName="text-orange-600"
                />
              </section>

              <section className="rounded-3xl border border-violet-100 bg-white p-4 shadow-xl shadow-violet-100/40 sm:p-5 lg:p-6">
                <label className="mb-3 block font-semibold text-slate-800">
                  Search Companies
                </label>

                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by company name, GST, PAN, city, email or phone..."
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition placeholder:text-sm placeholder:text-slate-500 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100 sm:px-5 sm:py-4 sm:placeholder:text-base"
                />
              </section>

              <CompanyManager searchQuery={searchQuery} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  valueClassName,
}: {
  label: string;
  value: string | number;
  detail: string;
  valueClassName: string;
}) {
  return (
    <div className="rounded-3xl border border-violet-100 bg-white p-5 shadow-lg shadow-violet-100/40 sm:p-6">
      <p className="font-medium text-slate-600">{label}</p>
      <h2 className={`mt-3 break-words text-3xl font-bold sm:text-4xl ${valueClassName}`}>
        {value}
      </h2>
      <p className="mt-2 text-sm text-slate-500">{detail}</p>
    </div>
  );
}