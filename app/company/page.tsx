"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import CompanyManager from "@/components/CompanyManager";
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

  async function loadCompanyStats() {
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
        .eq("owner_id", user.id);

      if (error) throw error;
      setCompanies(data || []);
    } catch {
      setCompanies([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadCompanyStats();
    window.addEventListener("smarterp-companies-updated", loadCompanyStats);

    return () => {
      window.removeEventListener(
        "smarterp-companies-updated",
        loadCompanyStats
      );
    };
  }, []);

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
    () => companies.filter((company) => Boolean(company.gst_number?.trim())).length,
    [companies]
  );

  function scrollToCompanyForm() {
    document.getElementById("company-form")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <div className="min-w-0 flex-1">
        <Navbar />

        <main className="p-4 sm:p-6 lg:p-8">
          <section className="mb-6 lg:mb-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
                  🏢 Company Management
                </h1>

                <p className="mt-2 max-w-3xl text-base text-slate-600 sm:text-lg">
                  Create, manage and organize all your companies from one place.
                </p>
              </div>

              <button
                type="button"
                onClick={scrollToCompanyForm}
                className="w-full rounded-xl bg-blue-600 px-6 py-3 font-bold text-white shadow-lg transition hover:bg-blue-700 hover:shadow-xl active:scale-[0.98] sm:w-fit"
              >
                + Add Company
              </button>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
            <StatCard
              label="Total Companies"
              value={isLoading ? "..." : companies.length}
              detail="Companies saved in your cloud account"
              valueClassName="text-blue-600"
              borderClassName="border-blue-100"
            />
            <StatCard
              label="Active Companies"
              value={isLoading ? "..." : companies.length}
              detail="Companies ready for business transactions"
              valueClassName="text-emerald-600"
              borderClassName="border-emerald-100"
            />
            <StatCard
              label="GST Registered"
              value={isLoading ? "..." : gstRegisteredCompanies}
              detail="Companies with GST details added"
              valueClassName="text-purple-700"
              borderClassName="border-purple-100"
            />
            <StatCard
              label="This Month"
              value={isLoading ? "..." : currentMonthCompanies}
              detail="Companies added during the current month"
              valueClassName="text-orange-600"
              borderClassName="border-orange-100"
            />
          </section>

          <section className="mt-6 rounded-3xl border border-slate-100 bg-white p-4 shadow-xl sm:mt-8 sm:p-5 lg:mt-10 lg:p-6">
            <label className="mb-3 block font-semibold text-slate-800">
              Search Companies
            </label>

            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by company name, GST, PAN, city, email or phone..."
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-sm placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 sm:px-5 sm:py-4 sm:placeholder:text-base"
            />
          </section>

          <CompanyManager searchQuery={searchQuery} />
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
  borderClassName,
}: {
  label: string;
  value: string | number;
  detail: string;
  valueClassName: string;
  borderClassName: string;
}) {
  return (
    <div className={`rounded-3xl border bg-white p-5 shadow-lg sm:p-6 ${borderClassName}`}>
      <p className="font-medium text-slate-600">{label}</p>
      <h2 className={`mt-3 text-3xl font-bold sm:text-4xl ${valueClassName}`}>
        {value}
      </h2>
      <p className="mt-2 text-sm text-slate-500">{detail}</p>
    </div>
  );
}