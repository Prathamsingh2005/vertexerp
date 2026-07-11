"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AccountType = "Asset" | "Liability" | "Equity" | "Income" | "Expense";
type VoucherType = "Journal" | "Contra";
type VoucherStatus = "DRAFT" | "POSTED" | "VOID";
type LockType = "FINANCIAL_YEAR" | "MONTHLY" | "CUSTOM";

type ProfileRow = {
  active_company_id: string | null;
};

type ChartAccountRow = {
  id: string;
  code: string;
  name: string;
  account_type: AccountType;
  normal_balance: "Debit" | "Credit";
  account_group: string;
  system_key: string | null;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
};

type VoucherRow = {
  id: string;
  voucher_number: string;
  voucher_date: string;
  voucher_type: VoucherType;
  source_type: string | null;
  narration: string | null;
  status: VoucherStatus;
  created_at: string;
};

type EntryRow = {
  id: string;
  voucher_id: string;
  account_id: string;
  line_number: number;
  debit: number | string | null;
  credit: number | string | null;
  description: string | null;
};

type VoucherWithEntries = VoucherRow & {
  entries: EntryRow[];
};

type PeriodLockRow = {
  id: string;
  lock_name: string;
  lock_type: LockType;
  locked_until_date: string;
  reason: string;
  is_active: boolean;
  locked_at: string;
  unlocked_at: string | null;
  unlocked_reason: string | null;
};

type AccountForm = {
  code: string;
  name: string;
  accountType: AccountType;
  accountGroup: string;
  description: string;
  isActive: boolean;
};

type VoucherLine = {
  accountId: string;
  debit: string;
  credit: string;
  description: string;
};

const protectedSystemKeys = new Set([
  "accounts_receivable",
  "accounts_payable",
  "inventory",
  "gst_input",
  "gst_output",
  "sales_revenue",
  "cost_of_goods_sold",
]);

const emptyAccountForm: AccountForm = {
  code: "",
  name: "",
  accountType: "Expense",
  accountGroup: "",
  description: "",
  isActive: true,
};

function createEmptyLine(): VoucherLine {
  return {
    accountId: "",
    debit: "",
    credit: "",
    description: "",
  };
}

function toNumber(value: unknown) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function formatCurrency(amount: number) {
  return `₹${toNumber(amount).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateValue: string) {
  if (!dateValue) {
    return "—";
  }

  const parsedDate = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return dateValue;
  }

  return parsedDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentFinancialYearEnd() {
  const today = new Date();
  const year = today.getMonth() + 1 >= 4 ? today.getFullYear() + 1 : today.getFullYear();
  return `${year}-03-31`;
}

function getTotals(lines: VoucherLine[]) {
  return lines.reduce(
    (totals, line) => ({
      debit: totals.debit + toNumber(line.debit),
      credit: totals.credit + toNumber(line.credit),
    }),
    { debit: 0, credit: 0 }
  );
}

function isProtectedAccount(account: ChartAccountRow) {
  return !!account.system_key && protectedSystemKeys.has(account.system_key);
}

function getAccountLabel(account: ChartAccountRow) {
  return `${account.code} — ${account.name}`;
}

export default function AccountingManager() {
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<ChartAccountRow[]>([]);
  const [vouchers, setVouchers] = useState<VoucherWithEntries[]>([]);
  const [periodLocks, setPeriodLocks] = useState<PeriodLockRow[]>([]);

  const [activeTab, setActiveTab] = useState<"vouchers" | "accounts" | "locks" | "history">("vouchers");
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [isSavingVoucher, setIsSavingVoucher] = useState(false);
  const [isSavingLock, setIsSavingLock] = useState(false);

  const [accountForm, setAccountForm] = useState<AccountForm>(emptyAccountForm);
  const [editingAccount, setEditingAccount] = useState<ChartAccountRow | null>(null);

  const [voucherType, setVoucherType] = useState<VoucherType>("Journal");
  const [voucherDate, setVoucherDate] = useState(getTodayDate());
  const [voucherNumber, setVoucherNumber] = useState("");
  const [narration, setNarration] = useState("");
  const [voucherLines, setVoucherLines] = useState<VoucherLine[]>([
    createEmptyLine(),
    createEmptyLine(),
  ]);
  const [editingVoucher, setEditingVoucher] = useState<VoucherWithEntries | null>(null);

  const [lockName, setLockName] = useState("");
  const [lockType, setLockType] = useState<LockType>("FINANCIAL_YEAR");
  const [lockedUntilDate, setLockedUntilDate] = useState(getCurrentFinancialYearEnd());
  const [lockReason, setLockReason] = useState("");

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);

    window.setTimeout(() => {
      setMessage("");
    }, 3500);
  }

  async function loadAccountingData() {
    setIsLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setActiveCompanyId(null);
        setAccounts([]);
        setVouchers([]);
        setPeriodLocks([]);
        showMessage("Please sign in to manage accounting.");
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

      const companyId = (profile as ProfileRow | null)?.active_company_id || null;
      setActiveCompanyId(companyId);

      if (!companyId) {
        setAccounts([]);
        setVouchers([]);
        setPeriodLocks([]);
        showMessage("Select an active company from the Companies page first.");
        return;
      }

      const [accountsResponse, vouchersResponse, locksResponse] = await Promise.all([
        supabase
          .from("chart_of_accounts")
          .select(
            "id, code, name, account_type, normal_balance, account_group, system_key, description, is_system, is_active"
          )
          .eq("company_id", companyId)
          .order("code", { ascending: true }),
        supabase
          .from("accounting_vouchers")
          .select(
            "id, voucher_number, voucher_date, voucher_type, source_type, narration, status, created_at"
          )
          .eq("company_id", companyId)
          .eq("source_type", "manual")
          .order("voucher_date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("accounting_period_locks")
          .select(
            "id, lock_name, lock_type, locked_until_date, reason, is_active, locked_at, unlocked_at, unlocked_reason"
          )
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),
      ]);

      if (accountsResponse.error) {
        throw accountsResponse.error;
      }

      if (vouchersResponse.error) {
        throw vouchersResponse.error;
      }

      if (locksResponse.error) {
        throw locksResponse.error;
      }

      const nextAccounts = (accountsResponse.data || []) as ChartAccountRow[];
      const nextVouchers = (vouchersResponse.data || []) as VoucherRow[];
      let nextEntries: EntryRow[] = [];

      if (nextVouchers.length > 0) {
        const { data: entriesData, error: entriesError } = await supabase
          .from("accounting_entries")
          .select("id, voucher_id, account_id, line_number, debit, credit, description")
          .in(
            "voucher_id",
            nextVouchers.map((voucher) => voucher.id)
          )
          .order("line_number", { ascending: true });

        if (entriesError) {
          throw entriesError;
        }

        nextEntries = (entriesData || []) as EntryRow[];
      }

      const entriesByVoucher = new Map<string, EntryRow[]>();

      nextEntries.forEach((entry) => {
        entriesByVoucher.set(entry.voucher_id, [
          ...(entriesByVoucher.get(entry.voucher_id) || []),
          entry,
        ]);
      });

      setAccounts(nextAccounts);
      setVouchers(
        nextVouchers.map((voucher) => ({
          ...voucher,
          entries: entriesByVoucher.get(voucher.id) || [],
        }))
      );
      setPeriodLocks((locksResponse.data || []) as PeriodLockRow[]);
    } catch (error) {
      setAccounts([]);
      setVouchers([]);
      setPeriodLocks([]);
      showMessage(
        error instanceof Error
          ? error.message
          : "Accounting data could not be loaded."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadAccountingData();

    function handleCompanyChange() {
      loadAccountingData();
    }

    window.addEventListener("vertexerp-active-company-updated", handleCompanyChange);

    return () => {
      window.removeEventListener("vertexerp-active-company-updated", handleCompanyChange);
    };
  }, []);

  const accountById = useMemo(() => {
    const nextMap = new Map<string, ChartAccountRow>();

    accounts.forEach((account) => {
      nextMap.set(account.id, account);
    });

    return nextMap;
  }, [accounts]);

  const activeLockedUntilDate = useMemo(() => {
    const activeLocks = periodLocks.filter((lock) => lock.is_active);

    if (activeLocks.length === 0) {
      return null;
    }

    return activeLocks
      .map((lock) => lock.locked_until_date)
      .sort()
      .reverse()[0];
  }, [periodLocks]);

  const filteredAccounts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query || activeTab !== "accounts") {
      return accounts;
    }

    return accounts.filter((account) =>
      [
        account.code,
        account.name,
        account.account_type,
        account.account_group,
        account.system_key || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [accounts, searchTerm, activeTab]);

  const filteredVouchers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query || activeTab !== "history") {
      return vouchers;
    }

    return vouchers.filter((voucher) =>
      [
        voucher.voucher_number,
        voucher.voucher_type,
        voucher.status,
        voucher.narration || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [vouchers, searchTerm, activeTab]);

  const postingAccounts = useMemo(() => {
    return accounts.filter((account) => {
      if (!account.is_active) {
        return false;
      }

      if (voucherType === "Contra") {
        return account.system_key === "cash" || account.system_key === "bank";
      }

      return !isProtectedAccount(account);
    });
  }, [accounts, voucherType]);

  const voucherTotals = useMemo(() => getTotals(voucherLines), [voucherLines]);
  const voucherDifference = Math.abs(voucherTotals.debit - voucherTotals.credit);

  function resetAccountForm() {
    setAccountForm(emptyAccountForm);
    setEditingAccount(null);
  }

  function resetVoucherForm() {
    setVoucherType("Journal");
    setVoucherDate(getTodayDate());
    setVoucherNumber("");
    setNarration("");
    setVoucherLines([createEmptyLine(), createEmptyLine()]);
    setEditingVoucher(null);
  }

  function resetLockForm() {
    setLockName("");
    setLockType("FINANCIAL_YEAR");
    setLockedUntilDate(getCurrentFinancialYearEnd());
    setLockReason("");
  }

  function updateVoucherLine(index: number, field: keyof VoucherLine, value: string) {
    setVoucherLines((currentLines) =>
      currentLines.map((line, currentIndex) => {
        if (currentIndex !== index) {
          return line;
        }

        if (field === "debit" && value) {
          return { ...line, debit: value, credit: "" };
        }

        if (field === "credit" && value) {
          return { ...line, credit: value, debit: "" };
        }

        return { ...line, [field]: value };
      })
    );
  }

  function addVoucherLine() {
    setVoucherLines((currentLines) => [...currentLines, createEmptyLine()]);
  }

  function removeVoucherLine(index: number) {
    setVoucherLines((currentLines) => {
      if (currentLines.length <= 2) {
        showMessage("A voucher needs at least two lines.");
        return currentLines;
      }

      return currentLines.filter((_, currentIndex) => currentIndex !== index);
    });
  }

  function handleVoucherTypeChange(nextType: VoucherType) {
    setVoucherType(nextType);
    setVoucherLines([createEmptyLine(), createEmptyLine()]);
  }

  function startEditAccount(account: ChartAccountRow) {
    if (account.is_system) {
      showMessage("System accounts are protected.");
      return;
    }

    setAccountForm({
      code: account.code,
      name: account.name,
      accountType: account.account_type,
      accountGroup: account.account_group,
      description: account.description || "",
      isActive: account.is_active,
    });
    setEditingAccount(account);
    setActiveTab("accounts");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEditVoucher(voucher: VoucherWithEntries) {
    if (voucher.status !== "POSTED") {
      showMessage("Only posted manual vouchers can be edited.");
      return;
    }

    setVoucherType(voucher.voucher_type);
    setVoucherDate(voucher.voucher_date);
    setVoucherNumber(voucher.voucher_number);
    setNarration(voucher.narration || "");
    setVoucherLines(
      voucher.entries.length > 0
        ? voucher.entries.map((entry) => ({
            accountId: entry.account_id,
            debit: toNumber(entry.debit) > 0 ? String(entry.debit) : "",
            credit: toNumber(entry.credit) > 0 ? String(entry.credit) : "",
            description: entry.description || "",
          }))
        : [createEmptyLine(), createEmptyLine()]
    );
    setEditingVoucher(voucher);
    setActiveTab("vouchers");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveAccount() {
    if (!activeCompanyId) {
      showMessage("Select an active company first.");
      return;
    }

    if (!accountForm.code.trim()) {
      showMessage("Account code is required.");
      return;
    }

    if (!accountForm.name.trim()) {
      showMessage("Account name is required.");
      return;
    }

    if (!accountForm.accountGroup.trim()) {
      showMessage("Account group is required.");
      return;
    }

    setIsSavingAccount(true);

    try {
      const supabase = createClient();

      if (editingAccount) {
        const { error } = await supabase.rpc("update_custom_chart_account", {
          p_account_id: editingAccount.id,
          p_code: accountForm.code.trim(),
          p_name: accountForm.name.trim(),
          p_account_group: accountForm.accountGroup.trim(),
          p_description: accountForm.description.trim() || null,
          p_is_active: accountForm.isActive,
        });

        if (error) {
          throw error;
        }

        showMessage("Account updated successfully.");
      } else {
        const { error } = await supabase.rpc("create_custom_chart_account", {
          p_company_id: activeCompanyId,
          p_code: accountForm.code.trim(),
          p_name: accountForm.name.trim(),
          p_account_type: accountForm.accountType,
          p_account_group: accountForm.accountGroup.trim(),
          p_description: accountForm.description.trim() || null,
        });

        if (error) {
          throw error;
        }

        showMessage("Account created successfully.");
      }

      resetAccountForm();
      await loadAccountingData();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Account could not be saved.");
    } finally {
      setIsSavingAccount(false);
    }
  }

  async function saveVoucher() {
    if (!activeCompanyId) {
      showMessage("Select an active company first.");
      return;
    }

    if (!voucherDate) {
      showMessage("Voucher date is required.");
      return;
    }

    if (!narration.trim()) {
      showMessage("Narration is required.");
      return;
    }

    const payloadLines = voucherLines.map((line) => ({
      account_id: line.accountId || null,
      party_ledger_id: null,
      debit: toNumber(line.debit),
      credit: toNumber(line.credit),
      description: line.description.trim() || null,
    }));

    const hasInvalidLine = payloadLines.some((line) => {
      if (!line.account_id) {
        return true;
      }

      if (line.debit > 0 && line.credit > 0) {
        return true;
      }

      if (line.debit <= 0 && line.credit <= 0) {
        return true;
      }

      return false;
    });

    if (hasInvalidLine) {
      showMessage("Every line needs an account and either Debit or Credit.");
      return;
    }

    if (voucherDifference >= 0.01) {
      showMessage("Debit and Credit totals must be equal.");
      return;
    }

    setIsSavingVoucher(true);

    try {
      const supabase = createClient();

      if (editingVoucher) {
        const { error } = await supabase.rpc("update_manual_accounting_voucher", {
          p_voucher_id: editingVoucher.id,
          p_voucher_date: voucherDate,
          p_narration: narration.trim(),
          p_entries: payloadLines,
          p_voucher_number: voucherNumber.trim() || null,
        });

        if (error) {
          throw error;
        }

        showMessage("Voucher updated successfully.");
      } else {
        const { error } = await supabase.rpc("create_manual_accounting_voucher", {
          p_company_id: activeCompanyId,
          p_voucher_type: voucherType,
          p_voucher_date: voucherDate,
          p_narration: narration.trim(),
          p_entries: payloadLines,
          p_voucher_number: voucherNumber.trim() || null,
        });

        if (error) {
          throw error;
        }

        showMessage("Voucher posted successfully.");
      }

      resetVoucherForm();
      await loadAccountingData();
      window.dispatchEvent(new Event("vertexerp-payments-updated"));
      window.dispatchEvent(new Event("vertexerp-expenses-updated"));
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Voucher could not be saved.");
    } finally {
      setIsSavingVoucher(false);
    }
  }

  async function voidVoucher(voucher: VoucherWithEntries) {
    const reason = window.prompt(`Enter a reason to void ${voucher.voucher_number}:`);

    if (!reason?.trim()) {
      return;
    }

    setIsSavingVoucher(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.rpc("void_manual_accounting_voucher", {
        p_voucher_id: voucher.id,
        p_void_reason: reason.trim(),
      });

      if (error) {
        throw error;
      }

      showMessage("Voucher voided successfully.");
      await loadAccountingData();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Voucher could not be voided.");
    } finally {
      setIsSavingVoucher(false);
    }
  }

  async function createPeriodLock() {
    if (!activeCompanyId) {
      showMessage("Select an active company first.");
      return;
    }

    if (!lockName.trim()) {
      showMessage("Lock name is required.");
      return;
    }

    if (!lockedUntilDate) {
      showMessage("Locked until date is required.");
      return;
    }

    if (!lockReason.trim()) {
      showMessage("Lock reason is required.");
      return;
    }

    setIsSavingLock(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.rpc("create_accounting_period_lock", {
        p_company_id: activeCompanyId,
        p_lock_name: lockName.trim(),
        p_lock_type: lockType,
        p_locked_until_date: lockedUntilDate,
        p_reason: lockReason.trim(),
      });

      if (error) {
        throw error;
      }

      showMessage("Accounting period locked successfully.");
      resetLockForm();
      await loadAccountingData();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Period could not be locked.");
    } finally {
      setIsSavingLock(false);
    }
  }

  async function unlockPeriodLock(lock: PeriodLockRow) {
    const reason = window.prompt(`Enter unlock reason for ${lock.lock_name}:`);

    if (!reason?.trim()) {
      return;
    }

    setIsSavingLock(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.rpc("deactivate_accounting_period_lock", {
        p_lock_id: lock.id,
        p_unlock_reason: reason.trim(),
      });

      if (error) {
        throw error;
      }

      showMessage("Accounting period lock deactivated.");
      await loadAccountingData();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Period lock could not be deactivated.");
    } finally {
      setIsSavingLock(false);
    }
  }

  function renderTabs() {
    const tabs: { key: typeof activeTab; label: string }[] = [
      { key: "vouchers", label: "Vouchers" },
      { key: "accounts", label: "Chart of Accounts" },
      { key: "locks", label: "Period Locks" },
      { key: "history", label: "Voucher History" },
    ];

    return (
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setActiveTab(tab.key);
              setSearchTerm("");
            }}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab.key
                ? "bg-blue-600 text-white shadow-lg"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-100 bg-white p-4 shadow-lg sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Accounting Control Center
            </h2>
            <p className="mt-1 text-sm text-slate-600 sm:text-base">
              Manage custom accounts, manual vouchers, contra transfers and finalized accounting periods.
            </p>
          </div>

          {renderTabs()}
        </div>

        {activeLockedUntilDate && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            Active accounting lock: transactions dated on or before {formatDate(activeLockedUntilDate)} are protected.
          </div>
        )}

        {message && (
          <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700">
            {message}
          </div>
        )}
      </section>

      {activeTab === "vouchers" && (
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-lg sm:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {editingVoucher ? "Edit Manual Voucher" : "Post Voucher"}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Debit and Credit totals must always match.
                </p>
              </div>

              {editingVoucher && (
                <button
                  type="button"
                  onClick={resetVoucherForm}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-100 sm:w-auto"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block font-semibold text-slate-800">Voucher Type</label>
                <select
                  value={voucherType}
                  onChange={(event) => handleVoucherTypeChange(event.target.value as VoucherType)}
                  disabled={!!editingVoucher}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <option value="Journal">Journal</option>
                  <option value="Contra">Contra</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block font-semibold text-slate-800">Voucher Date</label>
                <input
                  type="date"
                  value={voucherDate}
                  onChange={(event) => setVoucherDate(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block font-semibold text-slate-800">Voucher Number</label>
                <input
                  value={voucherNumber}
                  onChange={(event) => setVoucherNumber(event.target.value)}
                  placeholder="Auto generated when empty"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block font-semibold text-slate-800">Narration</label>
                <input
                  value={narration}
                  onChange={(event) => setNarration(event.target.value)}
                  placeholder={voucherType === "Contra" ? "Cash deposited into bank" : "Owner investment or adjustment"}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <p className="font-bold text-slate-900">Voucher Lines</p>
                <p className="mt-1 text-sm text-slate-600">
                  {voucherType === "Contra"
                    ? "Contra vouchers can use only Cash in Hand and Bank Account."
                    : "Controlled accounts are protected and handled by business workflows."}
                </p>
              </div>

              <div className="space-y-4 p-4">
                {voucherLines.map((line, index) => (
                  <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="font-bold text-slate-800">Line {index + 1}</p>
                      <button
                        type="button"
                        onClick={() => removeVoucherLine(index)}
                        className="rounded-lg border border-red-200 bg-white px-3 py-1 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_0.65fr_0.65fr]">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">Account</label>
                        <select
                          value={line.accountId}
                          onChange={(event) => updateVoucherLine(index, "accountId", event.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        >
                          <option value="">Select account</option>
                          {postingAccounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {getAccountLabel(account)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">Debit</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.debit}
                          onChange={(event) => updateVoucherLine(index, "debit", event.target.value)}
                          placeholder="0.00"
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">Credit</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.credit}
                          onChange={(event) => updateVoucherLine(index, "credit", event.target.value)}
                          placeholder="0.00"
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="mb-2 block text-sm font-semibold text-slate-700">Line Description</label>
                      <input
                        value={line.description}
                        onChange={(event) => updateVoucherLine(index, "description", event.target.value)}
                        placeholder="Optional line note"
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={addVoucherLine}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-100 sm:w-auto"
                >
                  Add Line
                </button>

                <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center">
                  <div className="rounded-xl bg-white px-4 py-3 text-right">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Debit</p>
                    <p className="font-bold text-slate-900">{formatCurrency(voucherTotals.debit)}</p>
                  </div>
                  <div className="rounded-xl bg-white px-4 py-3 text-right">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Credit</p>
                    <p className="font-bold text-slate-900">{formatCurrency(voucherTotals.credit)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div
              className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                voucherDifference < 0.01
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {voucherDifference < 0.01
                ? "Voucher is balanced."
                : `Difference: ${formatCurrency(voucherDifference)}`}
            </div>

            <button
              type="button"
              onClick={saveVoucher}
              disabled={isSavingVoucher || isLoading}
              className="mt-5 w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingVoucher ? "Saving..." : editingVoucher ? "Save Voucher Changes" : "Post Voucher"}
            </button>
          </div>

          <aside className="rounded-3xl border border-blue-100 bg-blue-50 p-4 shadow-lg sm:p-6">
            <h3 className="text-xl font-bold text-blue-950">Quick Examples</h3>

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-white p-4">
                <p className="font-bold text-slate-900">Owner Adds Capital</p>
                <p className="mt-2 text-sm text-slate-600">Cash in Hand Dr, Owner Capital Cr</p>
              </div>
              <div className="rounded-2xl bg-white p-4">
                <p className="font-bold text-slate-900">Cash Deposited in Bank</p>
                <p className="mt-2 text-sm text-slate-600">Bank Account Dr, Cash in Hand Cr</p>
              </div>
              <div className="rounded-2xl bg-white p-4">
                <p className="font-bold text-slate-900">Bank Withdrawn to Cash</p>
                <p className="mt-2 text-sm text-slate-600">Cash in Hand Dr, Bank Account Cr</p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Manual vouchers are for accounting adjustments. Sales, purchases,
              inventory, GST, receivables and payables should be handled from
              their own business pages.
            </div>
          </aside>
        </section>
      )}

      {activeTab === "accounts" && (
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-lg sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {editingAccount ? "Edit Account" : "Create Custom Account"}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  System accounts are protected. Custom accounts can be edited.
                </p>
              </div>

              {editingAccount && (
                <button
                  type="button"
                  onClick={resetAccountForm}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Cancel
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block font-semibold text-slate-800">Account Code</label>
                <input
                  value={accountForm.code}
                  onChange={(event) => setAccountForm((current) => ({ ...current, code: event.target.value }))}
                  placeholder="6100"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block font-semibold text-slate-800">Account Name</label>
                <input
                  value={accountForm.name}
                  onChange={(event) => setAccountForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Office Rent"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block font-semibold text-slate-800">Account Type</label>
                <select
                  value={accountForm.accountType}
                  onChange={(event) => setAccountForm((current) => ({ ...current, accountType: event.target.value as AccountType }))}
                  disabled={!!editingAccount}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <option value="Asset">Asset</option>
                  <option value="Liability">Liability</option>
                  <option value="Equity">Equity</option>
                  <option value="Income">Income</option>
                  <option value="Expense">Expense</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block font-semibold text-slate-800">Account Group</label>
                <input
                  value={accountForm.accountGroup}
                  onChange={(event) => setAccountForm((current) => ({ ...current, accountGroup: event.target.value }))}
                  placeholder="Indirect Expenses"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block font-semibold text-slate-800">Description</label>
                <textarea
                  value={accountForm.description}
                  onChange={(event) => setAccountForm((current) => ({ ...current, description: event.target.value }))}
                  rows={3}
                  placeholder="Optional account note"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>

              {editingAccount && (
                <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={accountForm.isActive}
                    onChange={(event) =>
                      setAccountForm((current) => ({ ...current, isActive: event.target.checked }))
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span className="font-semibold text-slate-700">Account is active</span>
                </label>
              )}

              <button
                type="button"
                onClick={saveAccount}
                disabled={isSavingAccount || isLoading}
                className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingAccount ? "Saving..." : editingAccount ? "Save Account Changes" : "Create Account"}
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-lg">
            <div className="border-b border-slate-200 p-4 sm:p-6">
              <h3 className="text-xl font-bold text-slate-900">Chart of Accounts</h3>
              <p className="mt-1 text-sm text-slate-600">
                System accounts are protected. Custom accounts can be edited.
              </p>

              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search accounts..."
                className="mt-4 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div className="p-4 md:hidden">
              {isLoading ? (
                <p className="py-10 text-center text-sm text-slate-500">Loading accounts...</p>
              ) : filteredAccounts.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-500">No accounts found.</p>
              ) : (
                <div className="space-y-4">
                  {filteredAccounts.map((account) => (
                    <article key={account.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-bold text-slate-900">{account.name}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {account.code} · {account.account_type}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                            account.is_system ? "bg-slate-200 text-slate-700" : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {account.is_system ? "System" : "Custom"}
                        </span>
                      </div>

                      <p className="mt-3 text-sm text-slate-600">
                        {account.account_group} · {account.normal_balance}
                      </p>

                      <button
                        type="button"
                        onClick={() => startEditAccount(account)}
                        disabled={account.is_system}
                        className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {account.is_system ? "Protected" : "Edit"}
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[900px]">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200 text-left">
                    <th className="px-6 py-4 text-sm font-bold text-slate-700">Account</th>
                    <th className="px-6 py-4 text-sm font-bold text-slate-700">Type</th>
                    <th className="px-6 py-4 text-sm font-bold text-slate-700">Group</th>
                    <th className="px-6 py-4 text-sm font-bold text-slate-700">Status</th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        Loading accounts...
                      </td>
                    </tr>
                  ) : filteredAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        No accounts found.
                      </td>
                    </tr>
                  ) : (
                    filteredAccounts.map((account) => (
                      <tr key={account.id} className="border-b border-slate-100 transition hover:bg-blue-50">
                        <td className="px-6 py-5">
                          <p className="font-bold text-slate-900">{account.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {account.code} · {account.normal_balance}
                          </p>
                        </td>
                        <td className="px-6 py-5 text-slate-700">{account.account_type}</td>
                        <td className="px-6 py-5 text-slate-700">{account.account_group}</td>
                        <td className="px-6 py-5">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              account.is_system
                                ? "bg-slate-100 text-slate-700"
                                : account.is_active
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-red-100 text-red-700"
                            }`}
                          >
                            {account.is_system ? "System" : account.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <button
                            type="button"
                            onClick={() => startEditAccount(account)}
                            disabled={account.is_system}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {account.is_system ? "Protected" : "Edit"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {activeTab === "locks" && (
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-lg sm:p-6">
            <h3 className="text-xl font-bold text-slate-900">Create Period Lock</h3>
            <p className="mt-1 text-sm text-slate-600">
              Lock finalized periods to prevent backdated transaction changes.
            </p>

            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              After locking, transactions dated on or before the locked date cannot be created, edited, deleted or voided.
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block font-semibold text-slate-800">Lock Name</label>
                <input
                  value={lockName}
                  onChange={(event) => setLockName(event.target.value)}
                  placeholder="FY 2025-26 Final Lock"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block font-semibold text-slate-800">Lock Type</label>
                <select
                  value={lockType}
                  onChange={(event) => setLockType(event.target.value as LockType)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                >
                  <option value="FINANCIAL_YEAR">Financial Year</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block font-semibold text-slate-800">Locked Until Date</label>
                <input
                  type="date"
                  value={lockedUntilDate}
                  onChange={(event) => setLockedUntilDate(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block font-semibold text-slate-800">Reason</label>
                <textarea
                  value={lockReason}
                  onChange={(event) => setLockReason(event.target.value)}
                  rows={3}
                  placeholder="Books finalized and reviewed"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <button
                type="button"
                onClick={createPeriodLock}
                disabled={isSavingLock || isLoading}
                className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingLock ? "Saving..." : "Lock Accounting Period"}
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-lg">
            <div className="border-b border-slate-200 p-4 sm:p-6">
              <h3 className="text-xl font-bold text-slate-900">Period Lock History</h3>
              <p className="mt-1 text-sm text-slate-600">
                Active locks protect finalized accounting periods.
              </p>

              <div
                className={`mt-4 rounded-2xl border px-4 py-4 ${
                  activeLockedUntilDate
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800"
                }`}
              >
                <p className="font-bold">
                  {activeLockedUntilDate ? "Period lock is active" : "No active period lock"}
                </p>
                <p className="mt-1 text-sm">
                  {activeLockedUntilDate
                    ? `Protected until ${formatDate(activeLockedUntilDate)}.`
                    : "Transactions are currently open for all dates."}
                </p>
              </div>
            </div>

            <div className="p-4 md:hidden">
              {isLoading ? (
                <p className="py-10 text-center text-sm text-slate-500">Loading period locks...</p>
              ) : periodLocks.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-500">No period locks created yet.</p>
              ) : (
                <div className="space-y-4">
                  {periodLocks.map((lock) => (
                    <article key={lock.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-bold text-slate-900">{lock.lock_name}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {lock.lock_type} · Until {formatDate(lock.locked_until_date)}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                            lock.is_active ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {lock.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>

                      <p className="mt-3 text-sm text-slate-700">{lock.reason}</p>

                      {lock.unlocked_reason && (
                        <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm text-slate-600">
                          Unlock reason: {lock.unlocked_reason}
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={() => unlockPeriodLock(lock)}
                        disabled={!lock.is_active || isSavingLock}
                        className="mt-4 w-full rounded-xl border border-red-200 bg-white px-4 py-2 font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Unlock
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[920px]">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200 text-left">
                    <th className="px-6 py-4 text-sm font-bold text-slate-700">Lock</th>
                    <th className="px-6 py-4 text-sm font-bold text-slate-700">Locked Until</th>
                    <th className="px-6 py-4 text-sm font-bold text-slate-700">Reason</th>
                    <th className="px-6 py-4 text-sm font-bold text-slate-700">Status</th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        Loading period locks...
                      </td>
                    </tr>
                  ) : periodLocks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        No period locks created yet.
                      </td>
                    </tr>
                  ) : (
                    periodLocks.map((lock) => (
                      <tr key={lock.id} className="border-b border-slate-100 transition hover:bg-blue-50">
                        <td className="px-6 py-5">
                          <p className="font-bold text-slate-900">{lock.lock_name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {lock.lock_type} · Created {formatDate(lock.locked_at.slice(0, 10))}
                          </p>
                        </td>
                        <td className="px-6 py-5 font-semibold text-slate-900">
                          {formatDate(lock.locked_until_date)}
                        </td>
                        <td className="px-6 py-5 text-slate-700">
                          <p>{lock.reason}</p>
                          {lock.unlocked_reason && (
                            <p className="mt-1 text-xs text-slate-500">
                              Unlock: {lock.unlocked_reason}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-5">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              lock.is_active ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {lock.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <button
                            type="button"
                            onClick={() => unlockPeriodLock(lock)}
                            disabled={!lock.is_active || isSavingLock}
                            className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Unlock
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {activeTab === "history" && (
        <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-lg">
          <div className="border-b border-slate-200 p-4 sm:p-6">
            <h3 className="text-xl font-bold text-slate-900">Manual Voucher History</h3>
            <p className="mt-1 text-sm text-slate-600">
              Manual vouchers are edited or voided, never hard-deleted.
            </p>

            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search vouchers..."
              className="mt-4 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div className="p-4 md:hidden">
            {isLoading ? (
              <p className="py-10 text-center text-sm text-slate-500">Loading vouchers...</p>
            ) : filteredVouchers.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">No manual vouchers found.</p>
            ) : (
              <div className="space-y-4">
                {filteredVouchers.map((voucher) => {
                  const totals = voucher.entries.reduce(
                    (total, entry) => ({
                      debit: total.debit + toNumber(entry.debit),
                      credit: total.credit + toNumber(entry.credit),
                    }),
                    { debit: 0, credit: 0 }
                  );

                  return (
                    <article key={voucher.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-bold text-slate-900">{voucher.voucher_number}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {formatDate(voucher.voucher_date)} · {voucher.voucher_type}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                            voucher.status === "POSTED" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {voucher.status}
                        </span>
                      </div>

                      <p className="mt-3 text-sm text-slate-700">{voucher.narration || "—"}</p>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-white p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Debit</p>
                          <p className="font-bold text-slate-900">{formatCurrency(totals.debit)}</p>
                        </div>
                        <div className="rounded-xl bg-white p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Credit</p>
                          <p className="font-bold text-slate-900">{formatCurrency(totals.credit)}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEditVoucher(voucher)}
                          disabled={voucher.status !== "POSTED"}
                          className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => voidVoucher(voucher)}
                          disabled={voucher.status !== "POSTED"}
                          className="flex-1 rounded-xl border border-red-200 bg-white px-4 py-2 font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Void
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1000px]">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-left">
                  <th className="px-6 py-4 text-sm font-bold text-slate-700">Voucher</th>
                  <th className="px-6 py-4 text-sm font-bold text-slate-700">Narration</th>
                  <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">Debit</th>
                  <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">Credit</th>
                  <th className="px-6 py-4 text-sm font-bold text-slate-700">Status</th>
                  <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      Loading vouchers...
                    </td>
                  </tr>
                ) : filteredVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      No manual vouchers found.
                    </td>
                  </tr>
                ) : (
                  filteredVouchers.map((voucher) => {
                    const totals = voucher.entries.reduce(
                      (total, entry) => ({
                        debit: total.debit + toNumber(entry.debit),
                        credit: total.credit + toNumber(entry.credit),
                      }),
                      { debit: 0, credit: 0 }
                    );

                    return (
                      <tr key={voucher.id} className="border-b border-slate-100 transition hover:bg-blue-50">
                        <td className="px-6 py-5">
                          <p className="font-bold text-slate-900">{voucher.voucher_number}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatDate(voucher.voucher_date)} · {voucher.voucher_type}
                          </p>
                        </td>
                        <td className="px-6 py-5 text-slate-700">{voucher.narration || "—"}</td>
                        <td className="px-6 py-5 text-right font-semibold text-slate-900">
                          {formatCurrency(totals.debit)}
                        </td>
                        <td className="px-6 py-5 text-right font-semibold text-slate-900">
                          {formatCurrency(totals.credit)}
                        </td>
                        <td className="px-6 py-5">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              voucher.status === "POSTED" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {voucher.status}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => startEditVoucher(voucher)}
                              disabled={voucher.status !== "POSTED"}
                              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => voidVoucher(voucher)}
                              disabled={voucher.status !== "POSTED"}
                              className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Void
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
      )}
    </div>
  );
}