"use client";

import { type FormEvent, useEffect, useState } from "react";

export type LedgerInput = {
  name: string;
  group: string;
  openingBalance: number;
  mobile: string;
  email: string;
  gst: string;
  state: string;
  stateCode: string;
  pincode: string;
  address: string;
};

export type EditableLedger = LedgerInput & {
  id: string;
};

type LedgerFormProps = {
  onSaveLedger: (ledger: LedgerInput) => Promise<boolean>;
  editingLedger: EditableLedger | null;
  onCancelEdit: () => void;
  isSaving: boolean;
};

type LedgerFormState = {
  name: string;
  group: string;
  openingBalance: string;
  mobile: string;
  email: string;
  gst: string;
  state: string;
  stateCode: string;
  pincode: string;
  address: string;
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

const INITIAL_FORM: LedgerFormState = {
  name: "",
  group: "Customer",
  openingBalance: "",
  mobile: "",
  email: "",
  gst: "",
  state: "",
  stateCode: "",
  pincode: "",
  address: "",
};

function isPartyLedger(group: string) {
  return group === "Customer" || group === "Supplier";
}

function isValidGstin(value: string) {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(
    value
  );
}

export default function LedgerForm({
  onSaveLedger,
  editingLedger,
  onCancelEdit,
  isSaving,
}: LedgerFormProps) {
  const [form, setForm] = useState<LedgerFormState>(INITIAL_FORM);
  const [message, setMessage] = useState("");

  const isEditing = Boolean(editingLedger);
  const partyLedger = isPartyLedger(form.group);

  useEffect(() => {
    if (!editingLedger) {
      setForm(INITIAL_FORM);
      setMessage("");
      return;
    }

    setForm({
      name: editingLedger.name,
      group: editingLedger.group,
      openingBalance: String(editingLedger.openingBalance || ""),
      mobile: editingLedger.mobile,
      email: editingLedger.email,
      gst: editingLedger.gst,
      state: editingLedger.state,
      stateCode: editingLedger.stateCode,
      pincode: editingLedger.pincode,
      address: editingLedger.address,
    });
    setMessage("");
  }, [editingLedger]);

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(""), 4000);
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

  function handleGstChange(value: string) {
    const gst = value.toUpperCase().replace(/\s+/g, "");
    const possibleStateCode = gst.slice(0, 2);
    const matchingState = INDIA_STATES.find(
      (state) => state.code === possibleStateCode
    );

    setForm((current) => ({
      ...current,
      gst,
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

  function handleGroupChange(group: string) {
    setForm((current) => ({
      ...current,
      group,
      gst: isPartyLedger(group) ? current.gst : "",
      state: isPartyLedger(group) ? current.state : "",
      stateCode: isPartyLedger(group) ? current.stateCode : "",
      pincode: isPartyLedger(group) ? current.pincode : "",
    }));
  }

  function validateForm() {
    if (!form.name.trim()) {
      return "Please enter a ledger name.";
    }

    if (partyLedger && !form.stateCode) {
      return "Please select the customer or supplier state.";
    }

    const gstNumber = form.gst.trim().toUpperCase();

    if (gstNumber && !isValidGstin(gstNumber)) {
      return "Please enter a valid 15-character GSTIN.";
    }

    if (
      gstNumber &&
      form.stateCode &&
      gstNumber.slice(0, 2) !== form.stateCode
    ) {
      return "GSTIN State Code must match the selected party state.";
    }

    if (
      form.pincode.trim() &&
      !/^[0-9]{6}$/.test(form.pincode.trim())
    ) {
      return "Pincode must contain exactly 6 digits.";
    }

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationMessage = validateForm();

    if (validationMessage) {
      showMessage(validationMessage);
      return;
    }

    const saved = await onSaveLedger({
      name: form.name.trim(),
      group: form.group,
      openingBalance: Number(form.openingBalance) || 0,
      mobile: form.mobile.trim(),
      email: form.email.trim(),
      gst: form.gst.trim().toUpperCase(),
      state: partyLedger ? form.state : "",
      stateCode: partyLedger ? form.stateCode : "",
      pincode: partyLedger ? form.pincode.trim() : "",
      address: form.address.trim(),
    });

    if (saved && !isEditing) {
      setForm(INITIAL_FORM);
    }
  }

  function resetForm() {
    if (isEditing) {
      onCancelEdit();
      return;
    }

    setForm(INITIAL_FORM);
    setMessage("");
  }

  return (
    <form
      id="create-ledger"
      onSubmit={handleSubmit}
      className="mb-6 mt-6 rounded-3xl border border-slate-100 bg-white p-4 shadow-xl sm:mb-10 sm:mt-8 sm:p-6 lg:p-8"
    >
      <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between lg:mb-8">
        <div>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
            {isEditing ? "Edit Ledger & GST Setup" : "Add New Ledger"}
          </h2>

          <p className="mt-1 text-sm text-slate-600 sm:text-base">
            {isEditing
              ? "Update party state, GST identity and contact details."
              : "Create a customer, supplier, bank, cash or expense ledger."}
          </p>
        </div>

        <div className="w-fit rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
          {isEditing ? "Updating Ledger" : "New Ledger"}
        </div>
      </div>

      {message && (
        <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 sm:mb-6 sm:text-base">
          {message}
        </div>
      )}

      {partyLedger && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Customer and Supplier State is required for automatic
          intra-state or inter-state GST classification. GSTIN is
          optional, but its first two digits must match the selected
          State Code.
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Field
          label="Ledger Name *"
          value={form.name}
          placeholder="Enter ledger name"
          onChange={(value) =>
            setForm((current) => ({ ...current, name: value }))
          }
        />

        <SelectField
          label="Ledger Group"
          value={form.group}
          disabled={isEditing}
          options={[
            "Customer",
            "Supplier",
            "Bank",
            "Cash",
            "Expense",
          ]}
          onChange={handleGroupChange}
        />

        <Field
          label="Opening Balance"
          type="number"
          value={form.openingBalance}
          placeholder="₹ 0.00"
          disabled={isEditing}
          min="0"
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              openingBalance: value,
            }))
          }
        />

        <Field
          label="Mobile Number"
          type="tel"
          value={form.mobile}
          placeholder="Enter mobile number"
          onChange={(value) =>
            setForm((current) => ({ ...current, mobile: value }))
          }
        />

        <Field
          label="Email Address"
          type="email"
          value={form.email}
          placeholder="Enter email address"
          onChange={(value) =>
            setForm((current) => ({ ...current, email: value }))
          }
        />

        {partyLedger && (
          <>
            <Field
              label="GST Number"
              value={form.gst}
              placeholder="Example: 09ABCDE1234F1Z5"
              maxLength={15}
              onChange={handleGstChange}
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
              label="Pincode"
              value={form.pincode}
              placeholder="6-digit pincode"
              maxLength={6}
              inputMode="numeric"
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  pincode: value.replace(/\D/g, "").slice(0, 6),
                }))
              }
            />
          </>
        )}
      </div>

      <div className="mt-5 sm:mt-6">
        <label className="mb-2 block font-semibold text-slate-800">
          Address
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
          placeholder={
            partyLedger
              ? "Enter registered party address"
              : "Enter address or account notes"
          }
          className="w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
        />
      </div>

      {isEditing && (
        <p className="mt-4 text-sm font-medium text-amber-700">
          Ledger Group and Opening Balance are locked during edit to
          protect existing transactions and accounting history.
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:gap-4">
        <button
          type="submit"
          disabled={isSaving}
          className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-7"
        >
          {isSaving
            ? "Saving..."
            : isEditing
              ? "Update Ledger"
              : "Save Ledger"}
        </button>

        <button
          type="button"
          onClick={resetForm}
          disabled={isSaving}
          className="w-full rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-7"
        >
          {isEditing ? "Cancel Edit" : "Reset"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
  type = "text",
  maxLength,
  disabled = false,
  readOnly = false,
  min,
  inputMode,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  type?: string;
  maxLength?: number;
  disabled?: boolean;
  readOnly?: boolean;
  min?: string;
  inputMode?: "text" | "numeric" | "decimal" | "tel" | "email";
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
        disabled={disabled}
        readOnly={readOnly}
        min={min}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none transition ${
          disabled || readOnly
            ? "cursor-not-allowed bg-slate-200 text-slate-600"
            : "bg-slate-50 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
        }`}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-2 block font-semibold text-slate-800">
        {label}
      </label>

      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-800 outline-none transition ${
          disabled
            ? "cursor-not-allowed bg-slate-200"
            : "bg-slate-50 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
        }`}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
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
        Party State *
      </label>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
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