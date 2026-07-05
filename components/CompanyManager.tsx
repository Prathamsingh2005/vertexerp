"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type CompanyForm = {
  name: string;
  gstNumber: string;
  panNumber: string;
  email: string;
  phone: string;
  city: string;
  address: string;
};

type Company = CompanyForm & {
  id: string;
  createdAt: string;
};

type CompanyRow = {
  id: string;
  name: string;
  gst_number: string | null;
  pan_number: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  address: string | null;
  created_at: string;
};

type CompanyManagerProps = {
  searchQuery?: string;
};

const EMPTY_FORM: CompanyForm = {
  name: "",
  gstNumber: "",
  panNumber: "",
  email: "",
  phone: "",
  city: "",
  address: "",
};

function mapCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    name: row.name ?? "",
    gstNumber: row.gst_number ?? "",
    panNumber: row.pan_number ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    city: row.city ?? "",
    address: row.address ?? "",
    createdAt: row.created_at,
  };
}

export default function CompanyManager({
  searchQuery = "",
}: CompanyManagerProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [form, setForm] = useState<CompanyForm>(EMPTY_FORM);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingActive, setIsUpdatingActive] = useState(false);

  function showMessage(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 4000);
  }

  function notifyCompanyChange() {
    window.dispatchEvent(new Event("smarterp-companies-updated"));
    window.dispatchEvent(new Event("vertexerp-active-company-updated"));
  }

  async function getSignedInUser() {
    const supabase = createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      throw new Error("Please sign in before managing companies.");
    }

    return { supabase, user };
  }

  async function loadCompanies() {
    setIsLoading(true);

    try {
      const { supabase, user } = await getSignedInUser();

      const [companyResponse, profileResponse] = await Promise.all([
        supabase
          .from("companies")
          .select(
            "id, name, gst_number, pan_number, email, phone, city, address, created_at"
          )
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("active_company_id")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

      if (companyResponse.error) {
        throw companyResponse.error;
      }

      if (profileResponse.error) {
        throw profileResponse.error;
      }

      setCompanies((companyResponse.data ?? []).map(mapCompany));
      setActiveCompanyId(profileResponse.data?.active_company_id ?? null);
    } catch (error) {
      setCompanies([]);
      setActiveCompanyId(null);
      showMessage(
        error instanceof Error ? error.message : "Companies could not be loaded."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadCompanies();
  }, []);

  const activeCompany = useMemo(
    () => companies.find((company) => company.id === activeCompanyId) ?? null,
    [companies, activeCompanyId]
  );

  const filteredCompanies = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return companies;
    }

    return companies.filter((company) =>
      [
        company.name,
        company.gstNumber,
        company.panNumber,
        company.email,
        company.phone,
        company.city,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [companies, searchQuery]);

  async function setActiveCompany(companyId: string | null) {
    const { supabase, user } = await getSignedInUser();

    const { error } = await supabase
      .from("profiles")
      .update({ active_company_id: companyId })
      .eq("id", user.id);

    if (error) {
      throw error;
    }

    setActiveCompanyId(companyId);
    notifyCompanyChange();
  }

  async function saveCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.name.trim()) {
      showMessage("Please enter a company name.");
      return;
    }

    if (companies.length >= 5) {
      showMessage("You can create a maximum of 5 companies.");
      return;
    }

    setIsSaving(true);

    try {
      const { supabase, user } = await getSignedInUser();

      const { data, error } = await supabase
        .from("companies")
        .insert({
          owner_id: user.id,
          name: form.name.trim(),
          gst_number: form.gstNumber.trim().toUpperCase() || null,
          pan_number: form.panNumber.trim().toUpperCase() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          city: form.city.trim() || null,
          address: form.address.trim() || null,
        })
        .select(
          "id, name, gst_number, pan_number, email, phone, city, address, created_at"
        )
        .single();

      if (error) {
        throw error;
      }

      const savedCompany = mapCompany(data);
      setCompanies((current) => [savedCompany, ...current]);
      setForm(EMPTY_FORM);

      if (!activeCompanyId) {
        await setActiveCompany(savedCompany.id);
        showMessage(
          `Company saved. ${savedCompany.name} is now your active company.`
        );
      } else {
        notifyCompanyChange();
        showMessage("Company saved to the cloud successfully.");
      }
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : "Company could not be saved."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSetActive(company: Company) {
    if (company.id === activeCompanyId) {
      showMessage(`${company.name} is already the active company.`);
      return;
    }

    setIsUpdatingActive(true);

    try {
      await setActiveCompany(company.id);
      showMessage(`${company.name} is now the active company.`);
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Active company could not be updated."
      );
    } finally {
      setIsUpdatingActive(false);
    }
  }

  async function deleteCompany(company: Company) {
    const confirmed = window.confirm(
      `Delete "${company.name}"? All database records linked to this company will also be removed.`
    );

    if (!confirmed) {
      return;
    }

    try {
      const { supabase } = await getSignedInUser();

      const { error } = await supabase
        .from("companies")
        .delete()
        .eq("id", company.id);

      if (error) {
        throw error;
      }

      const remainingCompanies = companies.filter((item) => item.id !== company.id);
      setCompanies(remainingCompanies);

      if (company.id === activeCompanyId) {
        await setActiveCompany(remainingCompanies[0]?.id ?? null);
      } else {
        notifyCompanyChange();
      }

      showMessage("Company deleted successfully.");
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : "Company could not be deleted."
      );
    }
  }

  return (
    <>
      <section className="mt-8 rounded-3xl border border-blue-100 bg-blue-50 p-5">
        <p className="text-sm font-bold text-blue-800">Active Company</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xl font-bold text-slate-900">
            {isLoading
              ? "Loading active company..."
              : activeCompany?.name || "No active company selected"}
          </p>
          <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-bold text-blue-700 shadow-sm">
            {activeCompany ? "Ready for transactions" : "Select a company below"}
          </span>
        </div>
      </section>

      <form
        id="company-form"
        onSubmit={saveCompany}
        className="mt-8 rounded-3xl border border-slate-100 bg-white p-8 shadow-xl"
      >
        <div className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Add New Company</h2>
            <p className="mt-1 text-slate-600">
              Save company details securely to your VertexERP account.
            </p>
          </div>
          <div className="w-fit rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
            Cloud Database
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 font-medium text-blue-700">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          <Field
            label="Company Name *"
            value={form.name}
            placeholder="Enter company name"
            onChange={(value) => setForm({ ...form, name: value })}
          />
          <Field
            label="GST Number"
            value={form.gstNumber}
            placeholder="Example: 09ABCDE1234F1Z5"
            onChange={(value) => setForm({ ...form, gstNumber: value })}
          />
          <Field
            label="PAN Number"
            value={form.panNumber}
            placeholder="Example: ABCDE1234F"
            onChange={(value) => setForm({ ...form, panNumber: value })}
          />
          <Field
            label="Email Address"
            type="email"
            value={form.email}
            placeholder="Enter company email"
            onChange={(value) => setForm({ ...form, email: value })}
          />
          <Field
            label="Phone Number"
            type="tel"
            value={form.phone}
            placeholder="Enter phone number"
            onChange={(value) => setForm({ ...form, phone: value })}
          />
          <Field
            label="City"
            value={form.city}
            placeholder="Enter city name"
            onChange={(value) => setForm({ ...form, city: value })}
          />
        </div>

        <div className="mt-6">
          <label className="mb-2 block font-semibold text-slate-800">Company Address</label>
          <textarea
            rows={4}
            value={form.address}
            onChange={(event) => setForm({ ...form, address: event.target.value })}
            placeholder="Enter complete company address"
            className="w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <div className="mt-8 flex flex-wrap gap-4">
          <button
            type="submit"
            disabled={isSaving || isLoading}
            className="rounded-xl bg-blue-600 px-7 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save Company"}
          </button>
          <button
            type="button"
            onClick={() => {
              setForm(EMPTY_FORM);
              setMessage("");
            }}
            className="rounded-xl border border-slate-300 bg-white px-7 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Reset
          </button>
        </div>
      </form>

      <section className="mt-10 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-8 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Company List</h2>
            <p className="mt-1 text-slate-600">Companies saved in your VertexERP cloud account.</p>
          </div>
          <div className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
            Total Companies: {companies.length} / 5
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px]">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-left">
                <Header>Company</Header>
                <Header>GST Number</Header>
                <Header>Phone</Header>
                <Header>City</Header>
                <Header>Status</Header>
                <Header>Action</Header>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <EmptyRow text="Loading companies from the cloud..." />
              ) : filteredCompanies.length === 0 ? (
                <EmptyRow
                  text={
                    companies.length === 0
                      ? "No companies added yet. Add your first company using the form above."
                      : "No matching company found. Try a different search term."
                  }
                />
              ) : (
                filteredCompanies.map((company) => {
                  const isActive = company.id === activeCompanyId;
                  return (
                    <tr key={company.id} className="border-b border-slate-100 transition hover:bg-blue-50">
                      <td className="px-6 py-5">
                        <p className="font-bold text-slate-900">{company.name}</p>
                        <p className="mt-1 text-sm text-slate-500">{company.email || "No email added"}</p>
                      </td>
                      <td className="px-6 py-5 text-slate-700">{company.gstNumber || "—"}</td>
                      <td className="px-6 py-5 text-slate-700">{company.phone || "—"}</td>
                      <td className="px-6 py-5 text-slate-700">{company.city || "—"}</td>
                      <td className="px-6 py-5">
                        <span className={isActive ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700" : "rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"}>
                          {isActive ? "Active Company" : "Available"}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            disabled={isUpdatingActive || isActive}
                            onClick={() => handleSetActive(company)}
                            className="font-semibold text-blue-600 transition hover:text-blue-800 disabled:cursor-not-allowed disabled:text-slate-400"
                          >
                            {isActive ? "Selected" : "Set Active"}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteCompany(company)}
                            className="font-semibold text-red-500 transition hover:text-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-2 block font-semibold text-slate-800">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
      />
    </div>
  );
}

function Header({ children }: { children: React.ReactNode }) {
  return <th className="px-6 py-4 text-sm font-bold text-slate-700">{children}</th>;
}

function EmptyRow({ text }: { text: string }) {
  return (
    <tr>
      <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
        {text}
      </td>
    </tr>
  );
}