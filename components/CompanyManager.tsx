"use client";

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { createClient } from "@/lib/supabase/client";

type CompanyForm = {
  name: string;
  legalName: string;
  tradeName: string;
  gstNumber: string;
  panNumber: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  stateCode: string;
  address: string;
};

type Company = CompanyForm & {
  id: string;
  ownerId: string;
  createdAt: string;
};

type CompanyRow = {
  id: string;
  owner_id: string;
  name: string;
  legal_name: string | null;
  trade_name: string | null;
  gst_number: string | null;
  pan_number: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  state_code: string | null;
  address: string | null;
  created_at: string;
};

type GstReadiness = {
  company_state_ready: boolean;
  ledgers_missing_state_code: number | string | null;
  products_missing_hsn_sac: number | string | null;
  sales_unclassified: number | string | null;
  purchases_unclassified: number | string | null;
  credit_notes_unclassified: number | string | null;
  debit_notes_unclassified: number | string | null;
};

type CompanyManagerProps = {
  searchQuery?: string;
};

const INDIA_STATES = [
  { code: "01", name: "Jammu and Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  {
    code: "26",
    name: "Dadra and Nagar Haveli and Daman and Diu",
  },
  { code: "27", name: "Maharashtra" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman and Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
] as const;

const EMPTY_FORM: CompanyForm = {
  name: "",
  legalName: "",
  tradeName: "",
  gstNumber: "",
  panNumber: "",
  email: "",
  phone: "",
  city: "",
  state: "",
  stateCode: "",
  address: "",
};

const COMPANY_SELECT =
  "id, owner_id, name, legal_name, trade_name, gst_number, pan_number, email, phone, city, state, state_code, address, created_at";

const COMPANY_DRAFT_STORAGE_PREFIX =
  "vertexerp-company-form-draft-v1";

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name ?? "",
    legalName: row.legal_name ?? "",
    tradeName: row.trade_name ?? "",
    gstNumber: row.gst_number ?? "",
    panNumber: row.pan_number ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
    stateCode: row.state_code ?? "",
    address: row.address ?? "",
    createdAt: row.created_at,
  };
}

function isValidGstin(value: string) {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(
    value
  );
}

function isValidPan(value: string) {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value);
}

function getCompanyDraftStorageKey(userId: string) {
  return `${COMPANY_DRAFT_STORAGE_PREFIX}:${userId}`;
}

function hasCompanyDraft(form: CompanyForm) {
  return Object.values(form).some((value) => value.trim().length > 0);
}

function isCompanyForm(value: unknown): value is CompanyForm {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return Object.keys(EMPTY_FORM).every(
    (key) => typeof candidate[key] === "string",
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const candidate = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };

    const parts = [
      typeof candidate.message === "string"
        ? candidate.message
        : "",
      typeof candidate.details === "string"
        ? candidate.details
        : "",
      typeof candidate.hint === "string"
        ? candidate.hint
        : "",
      typeof candidate.code === "string"
        ? `Code: ${candidate.code}`
        : "",
    ].filter(Boolean);

    if (parts.length > 0) {
      return parts.join(" · ");
    }
  }

  return fallback;
}

export default function CompanyManager({
  searchQuery = "",
}: CompanyManagerProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [form, setForm] = useState<CompanyForm>(EMPTY_FORM);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(
    null
  );
  const [gstReadiness, setGstReadiness] = useState<GstReadiness | null>(
    null
  );
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<
    "success" | "error" | "info"
  >("info");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isDraftReady, setIsDraftReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingActive, setIsUpdatingActive] = useState(false);
  const messageTimerRef = useRef<number | null>(null);
  const { can } = usePermissions();

  // Company creation is account-level. Supabase only allows inserts where
  // owner_id matches the signed-in user, so no company.create code exists.
  const canCreateCompany = true;
  const canEditCompany = can("company.edit");
  const canDeleteCompany = can("company.delete");

  function showMessage(
    text: string,
    tone: "success" | "error" | "info" = "info",
    autoClear = tone !== "error",
  ) {
    if (messageTimerRef.current !== null) {
      window.clearTimeout(messageTimerRef.current);
      messageTimerRef.current = null;
    }

    setMessageTone(tone);
    setMessage(text);

    if (autoClear) {
      messageTimerRef.current = window.setTimeout(() => {
        setMessage("");
        messageTimerRef.current = null;
      }, 5000);
    }
  }

  function clearCompanyDraft() {
    if (!currentUserId) {
      return;
    }

    window.localStorage.removeItem(
      getCompanyDraftStorageKey(currentUserId),
    );
  }

  function notifyCompanyChange() {
    window.dispatchEvent(new Event("smarterp-companies-updated"));
    window.dispatchEvent(new Event("vertexerp-active-company-updated"));
  }

  function resetForm() {
    clearCompanyDraft();
    setForm(EMPTY_FORM);
    setEditingCompanyId(null);
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

  async function loadGstReadiness(companyId: string | null) {
    if (!companyId) {
      setGstReadiness(null);
      return;
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc(
        "get_gst_data_readiness",
        {
          p_company_id: companyId,
        }
      );

      if (error) {
        throw error;
      }

      setGstReadiness(
        ((data || [])[0] as GstReadiness | undefined) || null
      );
    } catch {
      setGstReadiness(null);
    }
  }

  async function loadCompanies() {
    setIsLoading(true);

    try {
      const { supabase, user } = await getSignedInUser();
      setCurrentUserId(user.id);

      const [companyResponse, profileResponse] = await Promise.all([
        supabase
          .from("companies")
          .select(COMPANY_SELECT)
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

      const loadedCompanies = (
        (companyResponse.data || []) as CompanyRow[]
      ).map(mapCompany);

      const companyIds = new Set(
        loadedCompanies.map((company) => company.id)
      );

      const profileActiveCompanyId =
        profileResponse.data?.active_company_id || null;

      const nextActiveCompanyId =
        profileActiveCompanyId &&
        companyIds.has(profileActiveCompanyId)
          ? profileActiveCompanyId
          : null;

      setCompanies(loadedCompanies);
      setActiveCompanyId(nextActiveCompanyId);

      await loadGstReadiness(nextActiveCompanyId);
    } catch (error) {
      setCompanies([]);
      setActiveCompanyId(null);
      setGstReadiness(null);
      showMessage(
        getErrorMessage(error, "Companies could not be loaded."),
        "error",
        false,
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    if (!currentUserId || isDraftReady) {
      return;
    }

    try {
      const savedDraft = window.localStorage.getItem(
        getCompanyDraftStorageKey(currentUserId),
      );

      if (savedDraft) {
        const parsedDraft = JSON.parse(savedDraft) as {
          form?: unknown;
          editingCompanyId?: unknown;
        };

        if (isCompanyForm(parsedDraft.form)) {
          setForm(parsedDraft.form);

          if (
            typeof parsedDraft.editingCompanyId === "string" ||
            parsedDraft.editingCompanyId === null
          ) {
            setEditingCompanyId(parsedDraft.editingCompanyId);
          }

          showMessage(
            "Your unsaved company draft was restored.",
            "info",
          );
        }
      }
    } catch {
      window.localStorage.removeItem(
        getCompanyDraftStorageKey(currentUserId),
      );
    } finally {
      setIsDraftReady(true);
    }
  }, [currentUserId, isDraftReady]);

  useEffect(() => {
    if (!currentUserId || !isDraftReady || isSaving) {
      return;
    }

    const timer = window.setTimeout(() => {
      const storageKey =
        getCompanyDraftStorageKey(currentUserId);

      if (!hasCompanyDraft(form) && !editingCompanyId) {
        window.localStorage.removeItem(storageKey);
        return;
      }

      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          form,
          editingCompanyId,
          savedAt: new Date().toISOString(),
        }),
      );
    }, 250);

    return () => window.clearTimeout(timer);
  }, [
    currentUserId,
    editingCompanyId,
    form,
    isDraftReady,
    isSaving,
  ]);

  useEffect(() => {
    if (!hasCompanyDraft(form) || isSaving) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener(
        "beforeunload",
        handleBeforeUnload,
      );
    };
  }, [form, isSaving]);

  useEffect(() => {
    return () => {
      if (messageTimerRef.current !== null) {
        window.clearTimeout(messageTimerRef.current);
      }
    };
  }, []);

  const activeCompany = useMemo(
    () =>
      companies.find(
        (company) => company.id === activeCompanyId
      ) ?? null,
    [companies, activeCompanyId]
  );

  const ownedCompanyCount = useMemo(
    () =>
      companies.filter(
        (company) => company.ownerId === currentUserId,
      ).length,
    [companies, currentUserId],
  );

  const filteredCompanies = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return companies;
    }

    return companies.filter((company) =>
      [
        company.name,
        company.legalName,
        company.tradeName,
        company.gstNumber,
        company.panNumber,
        company.email,
        company.phone,
        company.city,
        company.state,
        company.stateCode,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [companies, searchQuery]);

  const gstPendingCount = useMemo(() => {
    if (!gstReadiness) {
      return 0;
    }

    return (
      toNumber(gstReadiness.ledgers_missing_state_code) +
      toNumber(gstReadiness.products_missing_hsn_sac) +
      toNumber(gstReadiness.sales_unclassified) +
      toNumber(gstReadiness.purchases_unclassified) +
      toNumber(gstReadiness.credit_notes_unclassified) +
      toNumber(gstReadiness.debit_notes_unclassified)
    );
  }, [gstReadiness]);

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
    await loadGstReadiness(companyId);
    notifyCompanyChange();
  }

  function handleStateChange(stateCode: string) {
    const selectedState = INDIA_STATES.find(
      (state) => state.code === stateCode
    );

    setForm((current) => ({
      ...current,
      state: selectedState?.name || "",
      stateCode: selectedState?.code || "",
    }));
  }

  function handleGstNumberChange(value: string) {
    const gstNumber = value.toUpperCase().replace(/\s+/g, "");
    const possibleStateCode = gstNumber.slice(0, 2);

    const matchingState = INDIA_STATES.find(
      (state) => state.code === possibleStateCode
    );

    setForm((current) => ({
      ...current,
      gstNumber,
      state:
        !current.stateCode && matchingState
          ? matchingState.name
          : current.state,
      stateCode:
        !current.stateCode && matchingState
          ? matchingState.code
          : current.stateCode,
    }));
  }

  function validateForm() {
    if (!form.name.trim()) {
      return "Please enter a company name.";
    }

    if (!form.stateCode || !form.state) {
      return "Please select the company state.";
    }

    if (!/^[0-9]{2}$/.test(form.stateCode)) {
      return "Company State Code must contain exactly 2 digits.";
    }

    const gstNumber = form.gstNumber.trim().toUpperCase();

    if (gstNumber && !isValidGstin(gstNumber)) {
      return "Please enter a valid 15-character GSTIN.";
    }

    if (
      gstNumber &&
      gstNumber.slice(0, 2) !== form.stateCode
    ) {
      return "GSTIN State Code must match the selected company state.";
    }

    const panNumber = form.panNumber.trim().toUpperCase();

    if (panNumber && !isValidPan(panNumber)) {
      return "Please enter a valid 10-character PAN Number.";
    }

    return null;
  }

  async function saveCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (editingCompanyId && !canEditCompany) {
      showMessage("Your role does not allow company editing.");
      return;
    }

    if (!editingCompanyId && !canCreateCompany) {
      showMessage("Your role does not allow company creation.");
      return;
    }

    setMessage("");

    const validationMessage = validateForm();

    if (validationMessage) {
      showMessage(validationMessage, "error", false);
      return;
    }

    if (!editingCompanyId && ownedCompanyCount >= 5) {
      showMessage(
        "You can create a maximum of 5 owned companies.",
        "error",
        false,
      );
      return;
    }

    setIsSaving(true);

    try {
      const { supabase, user } = await getSignedInUser();

      const payload = {
        name: form.name.trim(),
        legal_name:
          form.legalName.trim() || form.name.trim(),
        trade_name:
          form.tradeName.trim() || form.name.trim(),
        gst_number:
          form.gstNumber.trim().toUpperCase() || null,
        pan_number:
          form.panNumber.trim().toUpperCase() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        city: form.city.trim() || null,
        state: form.state,
        state_code: form.stateCode,
        address: form.address.trim() || null,
      };

      let savedRow: CompanyRow;

      if (editingCompanyId) {
        const { data, error } = await supabase
          .from("companies")
          .update(payload)
          .eq("id", editingCompanyId)
          .select(COMPANY_SELECT)
          .single();

        if (error) {
          throw error;
        }

        savedRow = data as CompanyRow;
      } else {
        const { data, error } = await supabase
          .from("companies")
          .insert({
            owner_id: user.id,
            ...payload,
          })
          .select(COMPANY_SELECT)
          .single();

        if (error) {
          throw error;
        }

        savedRow = data as CompanyRow;
      }

      const savedCompany = mapCompany(savedRow);

      if (editingCompanyId) {
        setCompanies((current) =>
          current.map((company) =>
            company.id === savedCompany.id
              ? savedCompany
              : company
          )
        );
      } else {
        setCompanies((current) => [
          savedCompany,
          ...current,
        ]);
      }

      const wasEditing = Boolean(editingCompanyId);
      resetForm();

      if (!activeCompanyId) {
        await setActiveCompany(savedCompany.id);
        showMessage(
          `Company saved. ${savedCompany.name} is now your active company.`,
          "success",
        );
        return;
      }

      if (savedCompany.id === activeCompanyId) {
        await loadGstReadiness(activeCompanyId);
      }

      notifyCompanyChange();
      showMessage(
        wasEditing
          ? "Company and GST details updated successfully."
          : "Company saved to the cloud successfully.",
        "success",
      );
    } catch (error) {
      showMessage(
        getErrorMessage(error, "Company could not be saved."),
        "error",
        false,
      );
    } finally {
      setIsSaving(false);
    }
  }

  function startEditCompany(company: Company) {
    if (!canEditCompany) {
      showMessage("Your role does not allow company editing.");
      return;
    }

    setEditingCompanyId(company.id);
    setForm({
      name: company.name,
      legalName: company.legalName,
      tradeName: company.tradeName,
      gstNumber: company.gstNumber,
      panNumber: company.panNumber,
      email: company.email,
      phone: company.phone,
      city: company.city,
      state: company.state,
      stateCode: company.stateCode,
      address: company.address,
    });
    setMessage("");

    window.setTimeout(() => {
      document
        .getElementById("company-form")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 50);
  }

  async function handleSetActive(company: Company) {
    if (company.id === activeCompanyId) {
      showMessage(
        `${company.name} is already the active company.`
      );
      return;
    }

    setIsUpdatingActive(true);

    try {
      await setActiveCompany(company.id);
      showMessage(
        `${company.name} is now the active company.`
      );
    } catch (error) {
      showMessage(
        getErrorMessage(
          error,
          "Active company could not be updated.",
        ),
        "error",
        false,
      );
    } finally {
      setIsUpdatingActive(false);
    }
  }

  async function deleteCompany(company: Company) {
    if (!canDeleteCompany) {
      showMessage("Your role does not allow company deletion.");
      return;
    }

    const confirmed = window.confirm(
      `Permanently delete "${company.name}"?\n\n` +
        "All invoices, purchases, products, ledgers, payments, expenses, " +
        "GST records, accounting records and team access linked to this " +
        "company will also be deleted.\n\n" +
        "This action cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    try {
      const { supabase } = await getSignedInUser();

      const { error } = await supabase.rpc(
        "delete_company_with_cleanup",
        {
          p_company_id: company.id,
        }
      );

      if (error) {
        throw error;
      }

      if (editingCompanyId === company.id) {
        resetForm();
      }

      await loadCompanies();
      notifyCompanyChange();

      showMessage(
        `${company.name} and all linked records were deleted successfully.`
      );
    } catch (error) {
      const errorMessage =
        error &&
        typeof error === "object" &&
        "message" in error &&
        typeof error.message === "string"
          ? error.message
          : "Company could not be deleted.";

      showMessage(errorMessage);
    }
  }

  return (
    <>
      <section className="mt-6 rounded-3xl border border-violet-100 bg-violet-50 p-4 sm:mt-8 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-sm font-bold text-violet-800">
              Active Company
            </p>

            <p className="mt-2 break-words text-lg font-bold text-slate-900 sm:text-xl">
              {isLoading
                ? "Loading active company..."
                : activeCompany?.name ||
                  "No active company selected"}
            </p>

            {activeCompany && (
              <p className="mt-1 text-sm text-slate-600">
                {activeCompany.state || "State not configured"}
                {activeCompany.stateCode
                  ? ` · State Code ${activeCompany.stateCode}`
                  : ""}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="w-fit rounded-full bg-white px-3 py-1.5 text-xs font-bold text-violet-700 shadow-sm">
              {activeCompany
                ? "Ready for transactions"
                : "Select a company below"}
            </span>

            {activeCompany && gstReadiness && (
              <span
                className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold shadow-sm ${
                  gstReadiness.company_state_ready &&
                  gstPendingCount === 0
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {gstReadiness.company_state_ready &&
                gstPendingCount === 0
                  ? "GST Data Ready"
                  : `${gstPendingCount} GST Records Pending`}
              </span>
            )}
          </div>
        </div>

        {activeCompany && gstReadiness && (
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <ReadinessCard
              label="Company State"
              value={
                gstReadiness.company_state_ready ? "Ready" : "Missing"
              }
              ready={gstReadiness.company_state_ready}
            />
            <ReadinessCard
              label="Party States"
              value={String(
                toNumber(
                  gstReadiness.ledgers_missing_state_code
                )
              )}
              ready={
                toNumber(
                  gstReadiness.ledgers_missing_state_code
                ) === 0
              }
            />
            <ReadinessCard
              label="Product HSN/SAC"
              value={String(
                toNumber(
                  gstReadiness.products_missing_hsn_sac
                )
              )}
              ready={
                toNumber(
                  gstReadiness.products_missing_hsn_sac
                ) === 0
              }
            />
            <ReadinessCard
              label="Sales Pending"
              value={String(
                toNumber(gstReadiness.sales_unclassified)
              )}
              ready={
                toNumber(gstReadiness.sales_unclassified) ===
                0
              }
            />
            <ReadinessCard
              label="Purchase Pending"
              value={String(
                toNumber(
                  gstReadiness.purchases_unclassified
                )
              )}
              ready={
                toNumber(
                  gstReadiness.purchases_unclassified
                ) === 0
              }
            />
            <ReadinessCard
              label="Returns Pending"
              value={String(
                toNumber(
                  gstReadiness.credit_notes_unclassified
                ) +
                  toNumber(
                    gstReadiness.debit_notes_unclassified
                  )
              )}
              ready={
                toNumber(
                  gstReadiness.credit_notes_unclassified
                ) +
                  toNumber(
                    gstReadiness.debit_notes_unclassified
                  ) ===
                0
              }
            />
          </div>
        )}
      </section>

      {message && (
        <div
          role={messageTone === "error" ? "alert" : "status"}
          aria-live="polite"
          className={`fixed right-4 top-20 z-[70] max-w-[calc(100vw-2rem)] rounded-2xl border px-5 py-4 text-sm font-bold shadow-2xl sm:right-6 sm:max-w-md sm:text-base ${
            messageTone === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : messageTone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-violet-200 bg-violet-50 text-violet-700"
          }`}
        >
          <div className="flex items-start gap-3">
            <span aria-hidden="true">
              {messageTone === "error"
                ? "⚠️"
                : messageTone === "success"
                  ? "✅"
                  : "ℹ️"}
            </span>

            <p className="min-w-0 flex-1 break-words">{message}</p>

            <button
              type="button"
              onClick={() => setMessage("")}
              aria-label="Close message"
              className="shrink-0 rounded-lg px-2 py-1 text-current transition hover:bg-black/5"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {!canCreateCompany && !canEditCompany && (
        <section className="mt-6 rounded-3xl border border-violet-100 bg-white p-6 text-center shadow-lg sm:mt-8">
          <div className="text-3xl">👁️</div>
          <h2 className="mt-3 text-xl font-black text-slate-900">
            Read-only company access
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
            You can view and select available companies, but your role does not
            allow company editing. New companies are created as your own workspace.
          </p>
        </section>
      )}

      {(canCreateCompany || (editingCompanyId && canEditCompany)) && (
      <form
        id="company-form"
        onSubmit={saveCompany}
        className="mt-6 rounded-3xl border border-slate-100 bg-white p-4 shadow-xl sm:mt-8 sm:p-6 lg:p-8"
      >
        <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-6 lg:mb-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
              {editingCompanyId
                ? "Edit Company & GST Setup"
                : "Add New Company"}
            </h2>

            <p className="mt-1 text-sm text-slate-600 sm:text-base">
              Save legal identity, registered state and company
              contact details securely.
            </p>
          </div>

          <div className="w-fit rounded-full bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700">
            {editingCompanyId
              ? "Updating Cloud Record"
              : "Cloud Database"}
          </div>
        </div>

        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Company State is required for automatic CGST/SGST or
          IGST classification. GSTIN is optional, but when entered,
          its first two digits must match the selected State Code.
        </div>

        <div className="mb-5 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-800">
          <strong>Draft protection active:</strong> entered details are
          automatically saved in this browser and restored after a reload or
          browser-tab switch. The draft clears only after a successful save or
          Reset.
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          <Field
            label="Company Name *"
            value={form.name}
            placeholder="Vertex Traders"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                name: value,
              }))
            }
          />

          <Field
            label="Legal Name"
            value={form.legalName}
            placeholder="Name registered with GST/PAN"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                legalName: value,
              }))
            }
          />

          <Field
            label="Trade Name"
            value={form.tradeName}
            placeholder="Customer-facing business name"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                tradeName: value,
              }))
            }
          />

          <Field
            label="GST Number"
            value={form.gstNumber}
            placeholder="Example: 09ABCDE1234F1Z5"
            maxLength={15}
            onChange={handleGstNumberChange}
          />

          <Field
            label="PAN Number"
            value={form.panNumber}
            placeholder="Example: ABCDE1234F"
            maxLength={10}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                panNumber: value
                  .toUpperCase()
                  .replace(/\s+/g, ""),
              }))
            }
          />

          <StateField
            value={form.stateCode}
            onChange={handleStateChange}
          />

          <Field
            label="State Code"
            value={form.stateCode}
            placeholder="Auto-filled"
            readOnly
            onChange={() => undefined}
          />

          <Field
            label="Email Address"
            type="email"
            value={form.email}
            placeholder="Enter company email"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                email: value,
              }))
            }
          />

          <Field
            label="Phone Number"
            type="tel"
            value={form.phone}
            placeholder="Enter phone number"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                phone: value,
              }))
            }
          />

          <Field
            label="City"
            value={form.city}
            placeholder="Enter city name"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                city: value,
              }))
            }
          />
        </div>

        <div className="mt-5 sm:mt-6">
          <label className="mb-2 block font-semibold text-slate-800">
            Company Address
          </label>

          <textarea
            rows={4}
            value={form.address}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                address: event.target.value,
              }))
            }
            placeholder="Enter complete registered company address"
            className="w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
          />
        </div>

        {message && (
          <div
            className={`mt-6 rounded-2xl border px-4 py-3 text-sm font-bold ${
              messageTone === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : messageTone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-violet-200 bg-violet-50 text-violet-700"
            }`}
          >
            {message}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:gap-4">
          <button
            type="submit"
            aria-busy={isSaving}
            disabled={isSaving || isLoading}
            className="w-full rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white shadow-lg transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-7"
          >
            {isSaving
              ? "Saving..."
              : editingCompanyId
                ? "Update Company"
                : "Save Company"}
          </button>

          <button
            type="button"
            onClick={() => {
              resetForm();
              setMessage("");
            }}
            className="w-full rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-100 sm:w-auto sm:px-7"
          >
            {editingCompanyId ? "Cancel Edit" : "Reset"}
          </button>
        </div>
      </form>

      )}

      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl sm:mt-8 lg:mt-10">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 lg:py-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Company List
            </h2>

            <p className="mt-1 text-sm text-slate-600 sm:text-base">
              Edit existing companies to complete their GST
              identity and registered state.
            </p>
          </div>

          <div className="rounded-full bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700">
            Owned Companies: {ownedCompanyCount} / 5 · Available:{" "}
            {companies.length}
          </div>
        </div>

        <div className="p-4 md:hidden">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-slate-500">
              Loading companies from the cloud...
            </p>
          ) : filteredCompanies.length === 0 ? (
            <div className="py-10 text-center text-slate-500">
              <p className="font-semibold text-slate-700">
                {companies.length === 0
                  ? "No companies added yet"
                  : "No matching company found"}
              </p>

              <p className="mt-2 text-sm">
                {companies.length === 0
                  ? "Add your first company using the form above."
                  : "Try a different search term."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCompanies.map((company) => {
                const isActive =
                  company.id === activeCompanyId;
                const stateReady =
                  /^[0-9]{2}$/.test(company.stateCode);

                return (
                  <article
                    key={company.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-bold text-slate-900">
                          {company.name}
                        </p>

                        <p className="mt-1 truncate text-sm text-slate-500">
                          {company.legalName ||
                            company.email ||
                            "No legal name added"}
                        </p>
                      </div>

                      <span
                        className={
                          isActive
                            ? "shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700"
                            : "shrink-0 rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700"
                        }
                      >
                        {isActive ? "Active" : "Available"}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <InfoBox
                        label="GST Number"
                        value={company.gstNumber || "—"}
                      />
                      <InfoBox
                        label="State"
                        value={
                          company.state
                            ? `${company.state} (${company.stateCode || "—"})`
                            : "—"
                        }
                      />
                      <InfoBox
                        label="City"
                        value={company.city || "—"}
                      />
                      <InfoBox
                        label="GST Setup"
                        value={
                          stateReady
                            ? "State Ready"
                            : "State Missing"
                        }
                        valueClassName={
                          stateReady
                            ? "text-emerald-700"
                            : "text-amber-700"
                        }
                      />
                    </div>

                    {company.address && (
                      <div className="mt-3 rounded-xl bg-white p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Address
                        </p>

                        <p className="mt-1 text-sm leading-6 text-slate-700">
                          {company.address}
                        </p>
                      </div>
                    )}

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {canEditCompany && (
                        <button
                          type="button"
                          onClick={() => startEditCompany(company)}
                          className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm font-bold text-violet-700 transition hover:bg-violet-100"
                        >
                          Edit
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={
                          isUpdatingActive || isActive
                        }
                        onClick={() =>
                          handleSetActive(company)
                        }
                        className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm font-bold text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        {isActive ? "Selected" : "Set Active"}
                      </button>

                      {canDeleteCompany && (
                        <button
                          type="button"
                          onClick={() => deleteCompany(company)}
                          className="col-span-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[1350px]">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-left">
                <Header>Company</Header>
                <Header>Legal / Trade Name</Header>
                <Header>GST Number</Header>
                <Header>Registered State</Header>
                <Header>Phone</Header>
                <Header>Status</Header>
                <Header>Action</Header>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <EmptyRow
                  colSpan={7}
                  text="Loading companies from the cloud..."
                />
              ) : filteredCompanies.length === 0 ? (
                <EmptyRow
                  colSpan={7}
                  text={
                    companies.length === 0
                      ? "No companies added yet. Add your first company using the form above."
                      : "No matching company found. Try a different search term."
                  }
                />
              ) : (
                filteredCompanies.map((company) => {
                  const isActive =
                    company.id === activeCompanyId;
                  const stateReady =
                    /^[0-9]{2}$/.test(company.stateCode);

                  return (
                    <tr
                      key={company.id}
                      className="border-b border-slate-100 transition hover:bg-violet-50"
                    >
                      <td className="px-6 py-5">
                        <p className="font-bold text-slate-900">
                          {company.name}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {company.email ||
                            "No email added"}
                        </p>
                      </td>

                      <td className="px-6 py-5">
                        <p className="font-semibold text-slate-800">
                          {company.legalName || "—"}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {company.tradeName || "—"}
                        </p>
                      </td>

                      <td className="px-6 py-5 text-slate-700">
                        {company.gstNumber || "—"}
                      </td>

                      <td className="px-6 py-5">
                        <p className="font-semibold text-slate-800">
                          {company.state || "—"}
                        </p>

                        <p
                          className={`mt-1 text-sm font-semibold ${
                            stateReady
                              ? "text-emerald-700"
                              : "text-amber-700"
                          }`}
                        >
                          {stateReady
                            ? `State Code ${company.stateCode}`
                            : "State setup pending"}
                        </p>
                      </td>

                      <td className="px-6 py-5 text-slate-700">
                        {company.phone || "—"}
                      </td>

                      <td className="px-6 py-5">
                        <span
                          className={
                            isActive
                              ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700"
                              : "rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"
                          }
                        >
                          {isActive
                            ? "Active Company"
                            : "Available"}
                        </span>
                      </td>

                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          {canEditCompany && (
                            <button
                              type="button"
                              onClick={() => startEditCompany(company)}
                              className="font-semibold text-violet-600 transition hover:text-violet-800"
                            >
                              Edit
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={
                              isUpdatingActive || isActive
                            }
                            onClick={() =>
                              handleSetActive(company)
                            }
                            className="font-semibold text-violet-600 transition hover:text-violet-800 disabled:cursor-not-allowed disabled:text-slate-400"
                          >
                            {isActive
                              ? "Selected"
                              : "Set Active"}
                          </button>

                          {canDeleteCompany && (
                            <button
                              type="button"
                              onClick={() => deleteCompany(company)}
                              className="font-semibold text-red-500 transition hover:text-red-700"
                            >
                              Delete
                            </button>
                          )}
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
  maxLength,
  readOnly = false,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  type?: string;
  maxLength?: number;
  readOnly?: boolean;
}) {
  return (
    <div>
      <label className="mb-2 block font-semibold text-slate-800">
        {label}
      </label>

      <input
        type={type}
        value={value}
        maxLength={maxLength}
        readOnly={readOnly}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        className={`w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none transition ${
          readOnly
            ? "cursor-not-allowed bg-slate-200 text-slate-600"
            : "bg-slate-50 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
        }`}
      />
    </div>
  );
}

function StateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (stateCode: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block font-semibold text-slate-800">
        Registered State *
      </label>

      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
      >
        <option value="">Select state</option>

        {INDIA_STATES.map((state) => (
          <option key={state.code} value={state.code}>
            {state.code} · {state.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function ReadinessCard({
  label,
  value,
  ready,
}: {
  label: string;
  value: string;
  ready: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p
        className={`mt-1 text-lg font-black ${
          ready ? "text-emerald-700" : "text-amber-700"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function InfoBox({
  label,
  value,
  valueClassName = "text-slate-800",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p
        className={`mt-1 break-words font-semibold ${valueClassName}`}
      >
        {value}
      </p>
    </div>
  );
}

function Header({ children }: { children: ReactNode }) {
  return (
    <th className="px-6 py-4 text-sm font-bold text-slate-700">
      {children}
    </th>
  );
}

function EmptyRow({
  text,
  colSpan,
}: {
  text: string;
  colSpan: number;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-6 py-12 text-center text-slate-500"
      >
        {text}
      </td>
    </tr>
  );
}