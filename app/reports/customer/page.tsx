"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";

type LedgerRow = {
  id: string;
  name: string;
  ledger_type: string;
  opening_balance: number | string | null;
  mobile: string | null;
  email: string | null;
  gst_number: string | null;
  address: string | null;
};

type SaleRow = {
  id: string;
  customer_id: string | null;
  payment_mode: string;
  grand_total: number | string | null;
};

type PaymentRow = {
  id: string;
  payment_type: string;
  party_id: string | null;
  amount: number | string | null;
};

type ProfileRow = {
  active_company_id: string | null;
};

type CustomerReportRow = {
  id: string;
  name: string;
  mobile: string;
  email: string;
  gst: string;
  openingBalance: number;
  invoiceCount: number;
  totalSales: number;
  creditSales: number;
  receivedAmount: number;
  pendingAmount: number;
};

function toNumber(value: unknown) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function formatCurrency(amount: number) {
  return `₹${toNumber(amount).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function isCustomerLedger(ledgerType: string) {
  return String(ledgerType || "").trim().toLowerCase() === "customer";
}

function isCreditPayment(paymentMode: string) {
  return String(paymentMode || "").trim().toLowerCase() === "credit";
}

function isCustomerReceipt(paymentType: string) {
  return (
    String(paymentType || "").trim().toLowerCase() ===
    "customer receipt"
  );
}

export default function CustomerReportPage() {
  const [ledgers, setLedgers] = useState<LedgerRow[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);

    window.setTimeout(() => {
      setMessage("");
    }, 4500);
  }

  async function loadCustomerReportData() {
    setIsLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setLedgers([]);
        setSales([]);
        setPayments([]);
        showMessage("Please sign in to view the customer report.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("active_company_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      const activeCompanyId =
        (profile as ProfileRow | null)?.active_company_id || null;

      if (!activeCompanyId) {
        setLedgers([]);
        setSales([]);
        setPayments([]);
        showMessage("Select an active company from the Companies page first.");
        return;
      }

      const [ledgersResponse, salesResponse, paymentsResponse] =
        await Promise.all([
          supabase
            .from("ledgers")
            .select(
              "id, name, ledger_type, opening_balance, mobile, email, gst_number, address"
            )
            .eq("company_id", activeCompanyId)
            .order("name", { ascending: true }),
          supabase
            .from("sales")
            .select("id, customer_id, payment_mode, grand_total")
            .eq("company_id", activeCompanyId),
          supabase
            .from("payments")
            .select("id, payment_type, party_id, amount")
            .eq("company_id", activeCompanyId),
        ]);

      if (ledgersResponse.error) {
        throw ledgersResponse.error;
      }

      if (salesResponse.error) {
        throw salesResponse.error;
      }

      if (paymentsResponse.error) {
        throw paymentsResponse.error;
      }

      setLedgers((ledgersResponse.data || []) as LedgerRow[]);
      setSales((salesResponse.data || []) as SaleRow[]);
      setPayments((paymentsResponse.data || []) as PaymentRow[]);
    } catch (error) {
      setLedgers([]);
      setSales([]);
      setPayments([]);

      showMessage(
        error instanceof Error
          ? error.message
          : "Customer report data could not be loaded from the cloud database."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadCustomerReportData();

    const refreshEvents = [
      "vertexerp-ledgers-updated",
      "vertexerp-sales-updated",
      "vertexerp-payments-updated",
      "vertexerp-active-company-updated",
    ];

    refreshEvents.forEach((eventName) => {
      window.addEventListener(eventName, loadCustomerReportData);
    });

    return () => {
      refreshEvents.forEach((eventName) => {
        window.removeEventListener(eventName, loadCustomerReportData);
      });
    };
  }, []);

  const customerRows = useMemo<CustomerReportRow[]>(() => {
    const customerMap = new Map<string, CustomerReportRow>();

    ledgers
      .filter((ledger) => isCustomerLedger(ledger.ledger_type))
      .forEach((customer) => {
        customerMap.set(customer.id, {
          id: customer.id,
          name: customer.name || "Unnamed Customer",
          mobile: customer.mobile || "",
          email: customer.email || "",
          gst: customer.gst_number || "",
          openingBalance: toNumber(customer.opening_balance),
          invoiceCount: 0,
          totalSales: 0,
          creditSales: 0,
          receivedAmount: 0,
          pendingAmount: 0,
        });
      });

    sales.forEach((sale) => {
      if (!sale.customer_id) {
        return;
      }

      const customer = customerMap.get(sale.customer_id);

      if (!customer) {
        return;
      }

      const invoiceAmount = toNumber(sale.grand_total);

      customer.invoiceCount += 1;
      customer.totalSales += invoiceAmount;

      if (isCreditPayment(sale.payment_mode)) {
        customer.creditSales += invoiceAmount;
      }
    });

    payments
      .filter((payment) => isCustomerReceipt(payment.payment_type))
      .forEach((payment) => {
        if (!payment.party_id) {
          return;
        }

        const customer = customerMap.get(payment.party_id);

        if (!customer) {
          return;
        }

        customer.receivedAmount += toNumber(payment.amount);
      });

    customerMap.forEach((customer) => {
      customer.pendingAmount = Math.max(
        0,
        customer.creditSales - customer.receivedAmount
      );
    });

    return Array.from(customerMap.values()).sort(
      (first, second) => second.totalSales - first.totalSales
    );
  }, [ledgers, sales, payments]);

  const filteredCustomers = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    if (!search) {
      return customerRows;
    }

    return customerRows.filter(
      (customer) =>
        customer.name.toLowerCase().includes(search) ||
        customer.mobile.includes(search) ||
        customer.email.toLowerCase().includes(search) ||
        customer.gst.toLowerCase().includes(search)
    );
  }, [customerRows, searchTerm]);

  const totalSales = customerRows.reduce(
    (total, customer) => total + customer.totalSales,
    0
  );

  const totalPending = customerRows.reduce(
    (total, customer) => total + customer.pendingAmount,
    0
  );

  const totalReceived = customerRows.reduce(
    (total, customer) => total + customer.receivedAmount,
    0
  );

  const activeCustomers = customerRows.filter(
    (customer) => customer.invoiceCount > 0
  ).length;

  function resetSearch() {
    setSearchTerm("");
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <div className="min-w-0 flex-1">
        <Navbar />

        <main className="p-6 md:p-8">
          <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-900">
                👥 Customer Report
              </h1>

              <p className="mt-2 text-lg text-slate-600">
                Review customer sales, receipts and outstanding balances.
              </p>
            </div>

            <Link
              href="/reports"
              className="w-fit rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              ← Back to Reports
            </Link>
          </div>

          {message && (
            <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 font-medium text-blue-700">
              {message}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">Total Customers</p>

              <h2 className="mt-3 text-4xl font-bold text-blue-600">
                {isLoading ? "..." : customerRows.length}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Customer ledgers in active company
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">Active Customers</p>

              <h2 className="mt-3 text-4xl font-bold text-green-600">
                {isLoading ? "..." : activeCustomers}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Customers with at least one sales invoice
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">
                Total Customer Sales
              </p>

              <h2 className="mt-3 text-4xl font-bold text-purple-600">
                {isLoading ? "..." : formatCurrency(totalSales)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Revenue from all cloud sales invoices
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
              <p className="font-medium text-slate-600">Outstanding Amount</p>

              <h2 className="mt-3 text-4xl font-bold text-orange-500">
                {isLoading ? "..." : formatCurrency(totalPending)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Credit sales minus saved customer receipts
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-6">
              <p className="font-semibold text-emerald-800">
                Customer Receipts
              </p>

              <p className="mt-2 text-3xl font-bold text-emerald-600">
                {isLoading ? "..." : formatCurrency(totalReceived)}
              </p>

              <p className="mt-2 text-sm text-emerald-700">
                Total receipts recorded against customer balances
              </p>
            </div>

            <div className="rounded-3xl border border-blue-100 bg-blue-50 p-6">
              <p className="font-semibold text-blue-800">
                Balance Calculation
              </p>

              <p className="mt-2 text-sm leading-6 text-blue-700">
                Outstanding is calculated as credit sales minus customer
                receipts. Opening balance is displayed separately for reference.
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search customer by name, mobile, email or GST..."
                className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none placeholder:text-slate-500 transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 lg:col-span-3"
              />

              <button
                type="button"
                onClick={resetSearch}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Reset Search
              </button>
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-8 py-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Customer Summary
                </h2>

                <p className="mt-1 text-slate-600">
                  {isLoading
                    ? "Loading customer data from the cloud..."
                    : `${filteredCustomers.length} customer${
                        filteredCustomers.length !== 1 ? "s" : ""
                      } found`}
                </p>
              </div>

              <div className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                Sales: {isLoading ? "..." : formatCurrency(totalSales)}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1250px]">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200 text-left">
                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Customer
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Mobile
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      GST Number
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Opening Balance
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Invoices
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Total Sales
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Receipts
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Outstanding
                    </th>

                    <th className="px-6 py-4 text-sm font-bold text-slate-700">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-6 py-12 text-center text-slate-500"
                      >
                        Loading customer report from the cloud database...
                      </td>
                    </tr>
                  ) : filteredCustomers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-6 py-12 text-center text-slate-500"
                      >
                        <p className="text-lg font-semibold text-slate-700">
                          No customers found
                        </p>

                        <p className="mt-2">
                          Add a Customer ledger or create a sales invoice.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((customer) => (
                      <tr
                        key={customer.id}
                        className="border-b border-slate-100 transition hover:bg-blue-50"
                      >
                        <td className="px-6 py-5">
                          <p className="font-bold text-slate-900">
                            {customer.name}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {customer.email || "No email added"}
                          </p>
                        </td>

                        <td className="px-6 py-5 text-slate-700">
                          {customer.mobile || "—"}
                        </td>

                        <td className="px-6 py-5 text-slate-700">
                          {customer.gst || "—"}
                        </td>

                        <td className="px-6 py-5 font-semibold text-slate-700">
                          {formatCurrency(customer.openingBalance)}
                        </td>

                        <td className="px-6 py-5 font-semibold text-slate-700">
                          {customer.invoiceCount}
                        </td>

                        <td className="px-6 py-5 font-bold text-blue-700">
                          {formatCurrency(customer.totalSales)}
                        </td>

                        <td className="px-6 py-5 font-bold text-emerald-600">
                          {formatCurrency(customer.receivedAmount)}
                        </td>

                        <td className="px-6 py-5 font-bold text-orange-600">
                          {formatCurrency(customer.pendingAmount)}
                        </td>

                        <td className="px-6 py-5">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              customer.pendingAmount > 0
                                ? "bg-orange-100 text-orange-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {customer.pendingAmount > 0
                              ? "Payment Due"
                              : "Clear"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}