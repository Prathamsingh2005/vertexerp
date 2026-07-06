"use client";

import { useEffect, useMemo, useState } from "react";
import LedgerForm from "./LedgerForm";
import LedgerTable from "./LedgerTable";
import { createClient } from "@/lib/supabase/client";

type LedgerInput = {
  name: string;
  group: string;
  openingBalance: number;
  mobile: string;
  email: string;
  gst: string;
  address: string;
};

type Ledger = LedgerInput & {
  id: string;
};

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

type ProfileRow = {
  active_company_id: string | null;
};

type CompanyRow = {
  name: string;
};

type LedgerManagerProps = {
  searchQuery?: string;
};

function mapLedgerRow(row: LedgerRow): Ledger {
  return {
    id: row.id,
    name: row.name || "",
    group: row.ledger_type || "Other",
    openingBalance: Number(row.opening_balance || 0),
    mobile: row.mobile || "",
    email: row.email || "",
    gst: row.gst_number || "",
    address: row.address || "",
  };
}

export default function LedgerManager({
  searchQuery = "",
}: LedgerManagerProps) {
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [activeCompanyName, setActiveCompanyName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);

    window.setTimeout(() => {
      setMessage("");
    }, 4000);
  }

  function notifyLedgerUpdate() {
    window.dispatchEvent(new Event("vertexerp-ledgers-updated"));
  }

  async function loadLedgers() {
    setIsLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setLedgers([]);
        setActiveCompanyId(null);
        setActiveCompanyName("");
        showMessage("Please sign in before managing ledgers.");
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

      const profileData = profile as ProfileRow | null;
      const companyId = profileData?.active_company_id || null;

      setActiveCompanyId(companyId);

      if (!companyId) {
        setLedgers([]);
        setActiveCompanyName("");
        showMessage("Select an active company from the Companies page first.");
        return;
      }

      const [ledgerResponse, companyResponse] = await Promise.all([
        supabase
          .from("ledgers")
          .select(
            "id, name, ledger_type, opening_balance, mobile, email, gst_number, address"
          )
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),
        supabase
          .from("companies")
          .select("name")
          .eq("id", companyId)
          .maybeSingle(),
      ]);

      if (ledgerResponse.error) {
        throw ledgerResponse.error;
      }

      if (companyResponse.error) {
        throw companyResponse.error;
      }

      const company = companyResponse.data as CompanyRow | null;

      setActiveCompanyName(company?.name || "");
      setLedgers((ledgerResponse.data || []).map(mapLedgerRow));
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Ledgers could not be loaded from the cloud database.";

      setLedgers([]);
      showMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadLedgers();

    window.addEventListener(
      "vertexerp-active-company-updated",
      loadLedgers
    );

    return () => {
      window.removeEventListener(
        "vertexerp-active-company-updated",
        loadLedgers
      );
    };
  }, []);

  const filteredLedgers = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return ledgers;
    }

    return ledgers.filter((ledger) => {
      const searchableText = [
        ledger.name,
        ledger.group,
        ledger.mobile,
        ledger.email,
        ledger.gst,
        ledger.address,
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [ledgers, searchQuery]);

  async function addLedger(ledgerInput: LedgerInput) {
    if (!activeCompanyId) {
      showMessage("Select an active company before creating a ledger.");
      return;
    }

    const ledgerName = ledgerInput.name.trim();

    if (!ledgerName) {
      showMessage("Please enter a ledger name.");
      return;
    }

    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("ledgers")
        .insert({
          company_id: activeCompanyId,
          name: ledgerName,
          ledger_type: ledgerInput.group,
          opening_balance: Number(ledgerInput.openingBalance || 0),
          mobile: ledgerInput.mobile.trim() || null,
          email: ledgerInput.email.trim() || null,
          gst_number: ledgerInput.gst.trim().toUpperCase() || null,
          address: ledgerInput.address.trim() || null,
        })
        .select(
          "id, name, ledger_type, opening_balance, mobile, email, gst_number, address"
        )
        .single();

      if (error) {
        throw error;
      }

      setLedgers((currentLedgers) => [
        mapLedgerRow(data),
        ...currentLedgers,
      ]);

      notifyLedgerUpdate();
      showMessage("Ledger saved to the cloud database successfully.");
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Ledger could not be saved.";

      showMessage(errorMessage);
    }
  }

  async function deleteLedger(ledgerId: string) {
    const shouldDelete = window.confirm(
      "Delete this ledger? This action cannot be undone."
    );

    if (!shouldDelete) {
      return;
    }

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("ledgers")
        .delete()
        .eq("id", ledgerId);

      if (error) {
        throw error;
      }

      setLedgers((currentLedgers) =>
        currentLedgers.filter((ledger) => ledger.id !== ledgerId)
      );

      notifyLedgerUpdate();
      showMessage("Ledger deleted successfully.");
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Ledger could not be deleted.";

      showMessage(errorMessage);
    }
  }

  return (
    <>
      <section className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-4 sm:mt-8 sm:p-5">
        <p className="text-sm font-bold text-blue-800">Active Company</p>

        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="break-words text-lg font-bold text-slate-900 sm:text-xl">
            {isLoading
              ? "Loading company..."
              : activeCompanyName || "No active company selected"}
          </p>

          <span className="w-fit rounded-full bg-white px-3 py-1.5 text-xs font-bold text-blue-700 shadow-sm">
            {activeCompanyId
              ? "Ledgers are saved in cloud"
              : "Select a company first"}
          </span>
        </div>
      </section>

      {message && (
        <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 sm:mt-6 sm:text-base">
          {message}
        </div>
      )}

      <div
        className={
          !activeCompanyId && !isLoading
            ? "pointer-events-none opacity-60"
            : ""
        }
      >
        <LedgerForm onAddLedger={addLedger} />
      </div>

      {isLoading ? (
        <div className="mt-6 rounded-3xl border border-slate-100 bg-white p-6 text-center text-slate-500 shadow-xl sm:mt-10 sm:p-10">
          Loading ledgers from the cloud database...
        </div>
      ) : (
        <LedgerTable
          ledgers={filteredLedgers}
          onDeleteLedger={deleteLedger}
        />
      )}
    </>
  );
}