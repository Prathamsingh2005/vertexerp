"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";

type CompanyFormData = {
  name: string;
  gstNumber: string;
  panNumber: string;
  email: string;
  phone: string;
  city: string;
  address: string;
};

type Company = CompanyFormData & {
  id: string;
  createdAt: string;
};

type CompanyManagerProps = {
  searchQuery?: string;
};

const STORAGE_KEY = "VertexERP_companies";
const COMPANIES_EVENT = "VertexERP-companies-updated";

const initialForm: CompanyFormData = {
  name: "",
  gstNumber: "",
  panNumber: "",
  email: "",
  phone: "",
  city: "",
  address: "",
};

export default function CompanyManager({
  searchQuery = "",
}: CompanyManagerProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [form, setForm] = useState<CompanyFormData>(initialForm);
  const [message, setMessage] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);

    window.setTimeout(() => {
      setMessage("");
    }, 3000);
  }

  useEffect(() => {
    try {
      const savedCompanies = window.localStorage.getItem(STORAGE_KEY);

      if (!savedCompanies) {
        setCompanies([]);
        return;
      }

      const parsedCompanies = JSON.parse(savedCompanies);

      if (!Array.isArray(parsedCompanies)) {
        setCompanies([]);
        return;
      }

      const normalizedCompanies = parsedCompanies.map((company) => ({
        ...company,
        createdAt: company.createdAt || new Date().toISOString(),
      }));

      setCompanies(normalizedCompanies);
    } catch {
      setCompanies([]);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(companies));
    window.dispatchEvent(new Event(COMPANIES_EVENT));
  }, [companies, isLoaded]);

  const filteredCompanies = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return companies;
    }

    return companies.filter((company) => {
      const searchableText = [
        company.name,
        company.gstNumber,
        company.panNumber,
        company.email,
        company.phone,
        company.city,
        company.address,
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [companies, searchQuery]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.name.trim()) {
      showMessage("Please enter a company name.");
      return;
    }

    const newCompany: Company = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      gstNumber: form.gstNumber.trim().toUpperCase(),
      panNumber: form.panNumber.trim().toUpperCase(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      city: form.city.trim(),
      address: form.address.trim(),
      createdAt: new Date().toISOString(),
    };

    setCompanies((currentCompanies) => [
      newCompany,
      ...currentCompanies,
    ]);

    setForm(initialForm);

    showMessage("Company saved successfully.");
  }

  function resetForm() {
    setForm(initialForm);
    setMessage("");
  }

  function deleteCompany(companyId: string, companyName: string) {
    const shouldDelete = window.confirm(
      `Delete "${companyName}" company?`
    );

    if (!shouldDelete) {
      return;
    }

    setCompanies((currentCompanies) =>
      currentCompanies.filter((company) => company.id !== companyId)
    );

    showMessage("Company deleted successfully.");
  }

  return (
    <>
      <form
        id="company-form"
        onSubmit={handleSubmit}
        className="mt-8 rounded-3xl border border-slate-100 bg-white p-8 shadow-xl"
      >
        <div className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Add New Company
            </h2>

            <p className="mt-1 text-slate-600">
              Enter company details to start managing billing, inventory and
              accounts.
            </p>
          </div>

          <div className="w-fit rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
            New Company
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 font-medium text-blue-700">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="mb-2 block font-semibold text-slate-800">
              Company Name *
            </label>

            <input
              type="text"
              value={form.name}
              onChange={(event) =>
                setForm({
                  ...form,
                  name: event.target.value,
                })
              }
              placeholder="Enter company name"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-2 block font-semibold text-slate-800">
              GST Number
            </label>

            <input
              type="text"
              value={form.gstNumber}
              onChange={(event) =>
                setForm({
                  ...form,
                  gstNumber: event.target.value,
                })
              }
              placeholder="Example: 09ABCDE1234F1Z5"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-2 block font-semibold text-slate-800">
              PAN Number
            </label>

            <input
              type="text"
              value={form.panNumber}
              onChange={(event) =>
                setForm({
                  ...form,
                  panNumber: event.target.value,
                })
              }
              placeholder="Example: ABCDE1234F"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-2 block font-semibold text-slate-800">
              Email Address
            </label>

            <input
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm({
                  ...form,
                  email: event.target.value,
                })
              }
              placeholder="Enter company email"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-2 block font-semibold text-slate-800">
              Phone Number
            </label>

            <input
              type="tel"
              value={form.phone}
              onChange={(event) =>
                setForm({
                  ...form,
                  phone: event.target.value,
                })
              }
              placeholder="Enter phone number"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-2 block font-semibold text-slate-800">
              City
            </label>

            <input
              type="text"
              value={form.city}
              onChange={(event) =>
                setForm({
                  ...form,
                  city: event.target.value,
                })
              }
              placeholder="Enter city name"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </div>
        </div>

        <div className="mt-6">
          <label className="mb-2 block font-semibold text-slate-800">
            Company Address
          </label>

          <textarea
            rows={4}
            value={form.address}
            onChange={(event) =>
              setForm({
                ...form,
                address: event.target.value,
              })
            }
            placeholder="Enter complete company address"
            className="w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <div className="mt-8 flex flex-wrap gap-4">
          <button
            type="submit"
            className="rounded-xl px-7 py-3 font-semibold text-white shadow-lg transition hover:scale-[1.02] active:scale-[0.98]"
            style={{
              backgroundColor: "#2563eb",
              color: "#ffffff",
            }}
          >
            Save Company
          </button>

          <button
            type="button"
            onClick={resetForm}
            className="rounded-xl border border-slate-300 bg-white px-7 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Reset
          </button>
        </div>
      </form>

      <section className="mt-10 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-8 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Company List
            </h2>

            <p className="mt-1 text-slate-600">
              View and manage all companies in your VertexERP account.
            </p>
          </div>

          <div className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
            Showing: {filteredCompanies.length} / {companies.length}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-left">
                <th className="px-6 py-4 text-sm font-bold text-slate-700">
                  Company
                </th>

                <th className="px-6 py-4 text-sm font-bold text-slate-700">
                  GST Number
                </th>

                <th className="px-6 py-4 text-sm font-bold text-slate-700">
                  Phone
                </th>

                <th className="px-6 py-4 text-sm font-bold text-slate-700">
                  City
                </th>

                <th className="px-6 py-4 text-sm font-bold text-slate-700">
                  Status
                </th>

                <th className="px-6 py-4 text-sm font-bold text-slate-700">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {companies.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    <p className="text-lg font-semibold text-slate-700">
                      No companies added yet
                    </p>

                    <p className="mt-2">
                      Add your first company using the form above.
                    </p>
                  </td>
                </tr>
              ) : filteredCompanies.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    <p className="text-lg font-semibold text-slate-700">
                      No matching companies found
                    </p>

                    <p className="mt-2">
                      Try a different company name, GST number, city or phone.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredCompanies.map((company) => (
                  <tr
                    key={company.id}
                    className="border-b border-slate-100 transition hover:bg-blue-50"
                  >
                    <td className="px-6 py-5">
                      <p className="font-bold text-slate-900">
                        {company.name}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {company.email || "No email added"}
                      </p>
                    </td>

                    <td className="px-6 py-5 text-slate-700">
                      {company.gstNumber || "—"}
                    </td>

                    <td className="px-6 py-5 text-slate-700">
                      {company.phone || "—"}
                    </td>

                    <td className="px-6 py-5 text-slate-700">
                      {company.city || "—"}
                    </td>

                    <td className="px-6 py-5">
                      <span
                        className="rounded-full px-3 py-1 text-xs font-bold"
                        style={{
                          backgroundColor: "#dcfce7",
                          color: "#166534",
                        }}
                      >
                        Active
                      </span>
                    </td>

                    <td className="px-6 py-5">
                      <button
                        type="button"
                        onClick={() =>
                          deleteCompany(company.id, company.name)
                        }
                        className="font-semibold text-red-600 transition hover:text-red-800"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}