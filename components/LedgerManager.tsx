"use client";

import { useEffect, useMemo, useState } from "react";
import LedgerForm, {
  type EditableLedger,
  type LedgerInput,
  type OpeningBalanceSide,
} from "./LedgerForm";
import LedgerTable from "./LedgerTable";
import { createClient } from "@/lib/supabase/client";

type Ledger = EditableLedger;

type LedgerRow = {
  id: string;
  name: string;
  ledger_type: string;
  opening_balance: number | string | null;
  opening_balance_side: OpeningBalanceSide | null;
  opening_balance_date: string | null;
  mobile: string | null;
  email: string | null;
  gst_number: string | null;
  state: string | null;
  state_code: string | null;
  pincode: string | null;
  address: string | null;
};

type ProfileRow = {
  active_company_id: string | null;
};

type CompanyRow = {
  name: string;
  state: string | null;
  state_code: string | null;
  financial_year_start: string | null;
};

type LedgerManagerProps = {
  searchQuery?: string;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

const LEDGER_SELECT =
  "id, name, ledger_type, opening_balance, opening_balance_side, opening_balance_date, mobile, email, gst_number, state, state_code, pincode, address";

function getDefaultSide(group: string): OpeningBalanceSide {
  return group === "Supplier" ? "Credit" : "Debit";
}

function mapLedgerRow(row: LedgerRow): Ledger {
  return {
    id: row.id,
    name: row.name || "",
    group: row.ledger_type || "Other",
    openingBalance: Number(row.opening_balance || 0),
    openingBalanceSide:
      row.opening_balance_side || getDefaultSide(row.ledger_type),
    openingBalanceDate: row.opening_balance_date || "",
    mobile: row.mobile || "",
    email: row.email || "",
    gst: row.gst_number || "",
    state: row.state || "",
    stateCode: row.state_code || "",
    pincode: row.pincode || "",
    address: row.address || "",
  };
}

function isPartyLedger(group: string) {
  return group === "Customer" || group === "Supplier";
}

function isValidGstin(value: string) {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(
    value
  );
}

export default function LedgerManager({
  searchQuery = "",
  canCreate,
  canEdit,
  canDelete,
}: LedgerManagerProps) {
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(
    null
  );
  const [activeCompanyName, setActiveCompanyName] = useState("");
  const [activeCompanyState, setActiveCompanyState] = useState("");
  const [activeCompanyStateCode, setActiveCompanyStateCode] =
    useState("");
  const [
    activeCompanyFinancialYearStart,
    setActiveCompanyFinancialYearStart,
  ] = useState("");
  const [editingLedgerId, setEditingLedgerId] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(""), 4500);
  }

  function notifyLedgerUpdate() {
    window.dispatchEvent(new Event("vertexerp-ledgers-updated"));
    window.dispatchEvent(new Event("vertexerp-gst-data-updated"));
    window.dispatchEvent(new Event("vertexerp-accounting-updated"));
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
        setActiveCompanyState("");
        setActiveCompanyStateCode("");
        setActiveCompanyFinancialYearStart("");
        setEditingLedgerId(null);
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

      const companyId =
        (profile as ProfileRow | null)?.active_company_id || null;

      setActiveCompanyId(companyId);
      setEditingLedgerId(null);

      if (!companyId) {
        setLedgers([]);
        setActiveCompanyName("");
        setActiveCompanyState("");
        setActiveCompanyStateCode("");
        setActiveCompanyFinancialYearStart("");
        showMessage("Select an active company from the Companies page first.");
        return;
      }

      const [ledgerResponse, companyResponse] = await Promise.all([
        supabase
          .from("ledgers")
          .select(LEDGER_SELECT)
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),
        supabase
          .from("companies")
          .select("name, state, state_code, financial_year_start")
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
      setActiveCompanyState(company?.state || "");
      setActiveCompanyStateCode(company?.state_code || "");
      setActiveCompanyFinancialYearStart(
        company?.financial_year_start || ""
      );
      setLedgers(
        ((ledgerResponse.data || []) as LedgerRow[]).map(mapLedgerRow)
      );
    } catch (error) {
      setLedgers([]);
      showMessage(
        error instanceof Error
          ? error.message
          : "Ledgers could not be loaded from the cloud database."
      );
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

  const editingLedger = useMemo(
    () =>
      ledgers.find((ledger) => ledger.id === editingLedgerId) || null,
    [ledgers, editingLedgerId]
  );

  const filteredLedgers = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return ledgers;
    }

    return ledgers.filter((ledger) => {
      const searchableText = [
        ledger.name,
        ledger.group,
        ledger.openingBalanceSide,
        ledger.openingBalanceDate,
        ledger.mobile,
        ledger.email,
        ledger.gst,
        ledger.state,
        ledger.stateCode,
        ledger.pincode,
        ledger.address,
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [ledgers, searchQuery]);

  const partyReadiness = useMemo(() => {
    const partyLedgers = ledgers.filter((ledger) =>
      isPartyLedger(ledger.group)
    );

    const missingState = partyLedgers.filter(
      (ledger) => !/^[0-9]{2}$/.test(ledger.stateCode)
    ).length;

    return {
      ready: partyLedgers.length - missingState,
      missingState,
    };
  }, [ledgers]);

  function validateLedgerInput(ledgerInput: LedgerInput) {
    if (!ledgerInput.name.trim()) {
      return "Please enter a ledger name.";
    }

    if (
      !Number.isFinite(ledgerInput.openingBalance) ||
      ledgerInput.openingBalance < 0
    ) {
      return "Opening Balance cannot be negative.";
    }

    if (
      ledgerInput.openingBalance > 0 &&
      !ledgerInput.openingBalanceDate
    ) {
      return "Please select the Opening Balance Date.";
    }

    if (
      ledgerInput.openingBalanceSide !== "Debit" &&
      ledgerInput.openingBalanceSide !== "Credit"
    ) {
      return "Opening Balance Side must be Debit or Credit.";
    }

    if (
      isPartyLedger(ledgerInput.group) &&
      !/^[0-9]{2}$/.test(ledgerInput.stateCode)
    ) {
      return "Customer or Supplier State is required.";
    }

    const gstNumber = ledgerInput.gst.trim().toUpperCase();

    if (gstNumber && !isValidGstin(gstNumber)) {
      return "Please enter a valid 15-character GSTIN.";
    }

    if (
      gstNumber &&
      ledgerInput.stateCode &&
      gstNumber.slice(0, 2) !== ledgerInput.stateCode
    ) {
      return "GSTIN State Code must match the selected party state.";
    }

    return null;
  }

  async function saveLedger(ledgerInput: LedgerInput) {
    if (editingLedgerId && !canEdit) {
      showMessage("You do not have permission to edit ledgers.");
      return false;
    }

    if (!editingLedgerId && !canCreate) {
      showMessage("You do not have permission to create ledgers.");
      return false;
    }

    if (!activeCompanyId) {
      showMessage("Select an active company before creating a ledger.");
      return false;
    }

    const validationMessage = validateLedgerInput(ledgerInput);

    if (validationMessage) {
      showMessage(validationMessage);
      return false;
    }

    setIsSaving(true);

    try {
      const supabase = createClient();

      const commonPayload = {
        p_company_id: activeCompanyId,
        p_name: ledgerInput.name.trim(),
        p_opening_balance: Number(ledgerInput.openingBalance || 0),
        p_opening_balance_side: ledgerInput.openingBalanceSide,
        p_opening_balance_date:
          ledgerInput.openingBalanceDate ||
          activeCompanyFinancialYearStart ||
          null,
        p_mobile: ledgerInput.mobile.trim() || null,
        p_email: ledgerInput.email.trim() || null,
        p_gst_number:
          ledgerInput.gst.trim().toUpperCase() || null,
        p_state: ledgerInput.state.trim() || null,
        p_state_code: ledgerInput.stateCode.trim() || null,
        p_pincode: ledgerInput.pincode.trim() || null,
        p_address: ledgerInput.address.trim() || null,
      };

      if (editingLedgerId) {
        const { data, error } = await supabase
          .rpc("update_ledger_with_opening_balance", {
            ...commonPayload,
            p_ledger_id: editingLedgerId,
          })
          .single();

        if (error) {
          throw error;
        }

        const updatedLedger = mapLedgerRow(data as LedgerRow);

        setLedgers((currentLedgers) =>
          currentLedgers.map((ledger) =>
            ledger.id === updatedLedger.id ? updatedLedger : ledger
          )
        );
        setEditingLedgerId(null);
        notifyLedgerUpdate();
        showMessage(
          "Ledger and opening balance voucher updated successfully."
        );
        return true;
      }

      const { data, error } = await supabase
        .rpc("create_ledger_with_opening_balance", {
          ...commonPayload,
          p_ledger_type: ledgerInput.group,
        })
        .single();

      if (error) {
        throw error;
      }

      setLedgers((currentLedgers) => [
        mapLedgerRow(data as LedgerRow),
        ...currentLedgers,
      ]);

      notifyLedgerUpdate();
      showMessage(
        "Ledger and opening balance voucher saved successfully."
      );
      return true;
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Ledger could not be saved."
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  function startEditLedger(ledger: Ledger) {
    if (!canEdit) {
      showMessage("You do not have permission to edit ledgers.");
      return;
    }

    setEditingLedgerId(ledger.id);
    setMessage("");

    window.setTimeout(() => {
      document.getElementById("create-ledger")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  function cancelEditLedger() {
    setEditingLedgerId(null);
    setMessage("");
  }

  async function deleteLedger(ledgerId: string) {
    if (!canDelete) {
      showMessage("You do not have permission to delete ledgers.");
      return;
    }

    if (!activeCompanyId) {
      showMessage("Select an active company first.");
      return;
    }

    const shouldDelete = window.confirm(
      "Delete this ledger? The linked opening voucher will be voided. Ledgers used by business transactions cannot be deleted."
    );

    if (!shouldDelete) {
      return;
    }

    try {
      const supabase = createClient();

      const { error } = await supabase.rpc(
        "delete_ledger_with_opening_balance",
        {
          p_company_id: activeCompanyId,
          p_ledger_id: ledgerId,
        }
      );

      if (error) {
        throw error;
      }

      setLedgers((currentLedgers) =>
        currentLedgers.filter((ledger) => ledger.id !== ledgerId)
      );

      if (editingLedgerId === ledgerId) {
        setEditingLedgerId(null);
      }

      notifyLedgerUpdate();
      showMessage("Ledger deleted and opening voucher voided.");
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Ledger could not be deleted."
      );
    }
  }

  return (
    <>
      <section className="mt-6 overflow-hidden rounded-3xl border border-violet-200 bg-gradient-to-r from-violet-950 via-violet-800 to-violet-700 p-5 text-white shadow-xl shadow-violet-900/15 sm:mt-8 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-200">
              Active Company
            </p>

            <p className="mt-2 break-words text-xl font-black text-white sm:text-2xl">
              {isLoading
                ? "Loading company..."
                : activeCompanyName || "No active company selected"}
            </p>

            {activeCompanyId && (
              <p className="mt-1 text-sm text-violet-100">
                {activeCompanyState || "Company state not configured"}
                {activeCompanyStateCode
                  ? ` · State Code ${activeCompanyStateCode}`
                  : ""}
                {activeCompanyFinancialYearStart
                  ? ` · FY starts ${activeCompanyFinancialYearStart}`
                  : ""}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="w-fit rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black text-white backdrop-blur">
              {activeCompanyId
                ? "Ledgers and opening vouchers are synced"
                : "Select a company first"}
            </span>

            {activeCompanyId && (
              <span
                className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold shadow-sm ${
                  partyReadiness.missingState === 0
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {partyReadiness.missingState === 0
                  ? `${partyReadiness.ready} Party States Ready`
                  : `${partyReadiness.missingState} Party States Pending`}
              </span>
            )}
          </div>
        </div>
      </section>

      {message && (
        <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-800 sm:mt-6 sm:text-base">
          {message}
        </div>
      )}

      {(canCreate || editingLedger) && (
        <div
          className={
            !activeCompanyId && !isLoading
              ? "pointer-events-none opacity-60"
              : ""
          }
        >
          <LedgerForm
            onSaveLedger={saveLedger}
            editingLedger={editingLedger}
            onCancelEdit={cancelEditLedger}
            isSaving={isSaving}
            canCreate={canCreate}
            canEdit={canEdit}
            defaultOpeningBalanceDate={
              activeCompanyFinancialYearStart
            }
          />
        </div>
      )}

      {isLoading ? (
        <div className="mt-6 rounded-3xl border border-violet-100 bg-white p-6 text-center text-slate-500 shadow-xl shadow-slate-200/60 sm:mt-10 sm:p-10">
          Loading ledgers from the cloud database...
        </div>
      ) : (
        <LedgerTable
          ledgers={filteredLedgers}
          onEditLedger={startEditLedger}
          onDeleteLedger={deleteLedger}
          canCreate={canCreate}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}
    </>
  );
}