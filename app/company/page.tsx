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

      if (error) {
        throw error;
      }

      setCompanies(data || []);
    } catch {
      setCompanies([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadCompanyStats();

    window.addEventListener(
      "smarterp-companies-updated",
      loadCompanyStats
    );

    return () => {
      window.removeEventListener(
        "smarterp-companies-updated",
        loadCompanyStats
      );
    };
  }, []);

  const currentMonthCompanies = useMemo(() => {
    const currentDate = new Date();

    return companies.filter((company) => {
      const createdDate = new Date(company.created_at);

      return (
        createdDate.getMonth() === currentDate.getMonth() &&
        createdDate.getFullYear() === currentDate.getFullYear()
      );
    }).length;
  }, [companies]);

  const gstRegisteredCompanies = useMemo(() => {
    return companies.filter((company) =>
      Boolean(company.gst_number?.trim())
    ).length;
  }, [companies]);

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

        <main className="p-6 md:p-8">
          <section className="mb-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-4xl font-bold text-slate-900">
                  🏢 Company Management
                </h1>

                <p className="mt-2 text-lg text-slate-600">
                  Create, manage and organize all your companies from one place.
                </p>
              </div>

              <button
                type="button"
                onClick={scrollToCompanyForm}
                className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white shadow-lg transition hover:scale-[1.02] hover:bg-blue-700 active:scale-[0.98]"
              >
                + Add Company
              </button>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-blue-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">
                Total Companies
              </p>

              <h2
                className="mt-3 text-3xl font-bold"
                style={{ color: "#2563eb" }}
              >
                {isLoading ? "..." : companies.length}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Companies saved in your cloud account
              </p>
            </div>

            <div className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">
                Active Companies
              </p>

              <h2
                className="mt-3 text-3xl font-bold"
                style={{ color: "#059669" }}
              >
                {isLoading ? "..." : companies.length}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Companies ready for business transactions
              </p>
            </div>

            <div className="rounded-3xl border border-purple-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">
                GST Registered
              </p>

              <h2
                className="mt-3 text-3xl font-bold"
                style={{ color: "#7e22ce" }}
              >
                {isLoading ? "..." : gstRegisteredCompanies}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Companies with GST details added
              </p>
            </div>

            <div className="rounded-3xl border border-orange-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">
                This Month
              </p>

              <h2
                className="mt-3 text-3xl font-bold"
                style={{ color: "#ea580c" }}
              >
                {isLoading ? "..." : currentMonthCompanies}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Companies added during the current month
              </p>
            </div>
          </section>

          <section className="mt-10 rounded-3xl border border-slate-100 bg-white p-6 shadow-xl">
            <label className="mb-3 block font-semibold text-slate-800">
              Search Companies
            </label>

            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by company name, GST, PAN, city, email or phone..."
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-5 py-4 text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </section>

          <CompanyManager searchQuery={searchQuery} />
        </main>
      </div>
    </div>
  );
}