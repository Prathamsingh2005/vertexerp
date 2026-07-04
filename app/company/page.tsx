"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import CompanyManager from "@/components/CompanyManager";

type Company = {
  id: string;
  name: string;
  gstNumber: string;
  panNumber: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  createdAt?: string;
};

const COMPANIES_KEY = "VertexERP_companies";
const COMPANIES_EVENT = "VertexERP-companies-updated";

function readCompanies(): Company[] {
  try {
    const savedCompanies = window.localStorage.getItem(COMPANIES_KEY);

    if (!savedCompanies) {
      return [];
    }

    const parsedCompanies = JSON.parse(savedCompanies);

    return Array.isArray(parsedCompanies) ? parsedCompanies : [];
  } catch {
    return [];
  }
}

function isCurrentMonth(dateValue?: string) {
  if (!dateValue) {
    return false;
  }

  const date = new Date(dateValue);
  const today = new Date();

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return (
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export default function CompanyPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  function loadCompanies() {
    setCompanies(readCompanies());
  }

  useEffect(() => {
    loadCompanies();

    window.addEventListener(COMPANIES_EVENT, loadCompanies);
    window.addEventListener("storage", loadCompanies);

    return () => {
      window.removeEventListener(COMPANIES_EVENT, loadCompanies);
      window.removeEventListener("storage", loadCompanies);
    };
  }, []);

  const companyStats = useMemo(() => {
    const gstRegistered = companies.filter((company) =>
      Boolean(company.gstNumber?.trim())
    ).length;

    const recentlyAdded = companies.filter((company) =>
      isCurrentMonth(company.createdAt)
    ).length;

    return {
      totalCompanies: companies.length,
      activeCompanies: companies.length,
      gstRegistered,
      recentlyAdded,
    };
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
          <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
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
              className="w-fit rounded-xl px-7 py-3 font-semibold text-white shadow-xl transition hover:scale-[1.02] active:scale-[0.98]"
              style={{
                backgroundColor: "#2563eb",
                color: "#ffffff",
              }}
            >
              + Add Company
            </button>
          </div>

          <section className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-blue-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">
                Total Companies
              </p>

              <h2
                className="mt-3 text-4xl font-bold"
                style={{ color: "#2563eb" }}
              >
                {companyStats.totalCompanies}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Companies saved in this VertexERP account
              </p>
            </div>

            <div className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">
                Active Companies
              </p>

              <h2
                className="mt-3 text-4xl font-bold"
                style={{ color: "#059669" }}
              >
                {companyStats.activeCompanies}
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
                className="mt-3 text-4xl font-bold"
                style={{ color: "#7e22ce" }}
              >
                {companyStats.gstRegistered}
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
                className="mt-3 text-4xl font-bold"
                style={{ color: "#ea580c" }}
              >
                {companyStats.recentlyAdded}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Companies added during the current month
              </p>
            </div>
          </section>

          <section className="mb-8 rounded-3xl border border-slate-100 bg-white p-5 shadow-lg">
            <div className="relative">
              <span className="absolute left-5 top-3.5 text-lg text-slate-400">
                🔍
              </span>

              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by company name, GST, PAN, city, email or phone..."
                className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-14 pr-5 text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </section>

          <CompanyManager searchQuery={searchQuery} />
        </main>
      </div>
    </div>
  );
}