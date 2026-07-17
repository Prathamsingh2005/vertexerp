"use client";

import { useEffect, useState } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { createClient } from "@/lib/supabase/client";

type CompanySettings = {
  id: string;
  name: string;
  gst_registration_type: string;
  gst_filing_frequency: string;
  default_itc_status: string;
};

export default function CompanyGSTSettingsCard() {
  const { can } = usePermissions();
  const canEdit = can("company.edit");
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  async function loadSettings() {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setSettings(null);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("active_company_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile?.active_company_id) {
        setSettings(null);
        return;
      }

      const { data, error } = await supabase
        .from("companies")
        .select(
          "id, name, gst_registration_type, gst_filing_frequency, default_itc_status",
        )
        .eq("id", profile.active_company_id)
        .maybeSingle();

      if (error) throw error;
      setSettings((data as CompanySettings | null) || null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "GST settings could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
    window.addEventListener("vertexerp-active-company-updated", loadSettings);
    return () => {
      window.removeEventListener("vertexerp-active-company-updated", loadSettings);
    };
  }, []);

  async function saveSettings() {
    if (!settings || !canEdit) return;
    setIsSaving(true);
    setMessage("");

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("companies")
        .update({
          gst_registration_type: settings.gst_registration_type,
          gst_filing_frequency: settings.gst_filing_frequency,
          default_itc_status: settings.default_itc_status,
        })
        .eq("id", settings.id);

      if (error) throw error;
      setMessage("Company GST registration settings updated successfully.");
      window.dispatchEvent(new Event("vertexerp-gst-data-updated"));
      window.dispatchEvent(new Event("vertexerp-active-company-updated"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "GST settings could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <section className="mt-6 rounded-3xl border border-violet-100 bg-white p-6 font-semibold text-slate-600 shadow-lg">
        Loading company GST registration settings...
      </section>
    );
  }

  if (!settings) return null;

  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-xl shadow-violet-100/40 sm:mt-8">
      <div className="bg-gradient-to-r from-violet-950 via-violet-800 to-violet-700 px-5 py-5 text-white sm:px-6">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-200">
          GST Registration Profile
        </p>
        <h2 className="mt-2 text-2xl font-black">{settings.name}</h2>
        <p className="mt-1 text-sm text-violet-100">
          Control the default GST and ITC workflow used by purchase reviews.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 p-5 sm:p-6 lg:grid-cols-3">
        <SettingSelect
          label="Registration Type"
          value={settings.gst_registration_type}
          disabled={!canEdit || isSaving}
          options={[
            ["REGULAR", "Regular"],
            ["COMPOSITION", "Composition"],
            ["SEZ", "SEZ"],
            ["UNREGISTERED", "Unregistered"],
          ]}
          onChange={(value) =>
            setSettings((current) =>
              current
                ? {
                    ...current,
                    gst_registration_type: value,
                    gst_filing_frequency:
                      value === "UNREGISTERED" || value === "COMPOSITION"
                        ? "NOT_APPLICABLE"
                        : current.gst_filing_frequency === "NOT_APPLICABLE"
                          ? "MONTHLY"
                          : current.gst_filing_frequency,
                    default_itc_status:
                      value === "UNREGISTERED" || value === "COMPOSITION"
                        ? "NOT_APPLICABLE"
                        : current.default_itc_status === "NOT_APPLICABLE"
                          ? "PENDING_REVIEW"
                          : current.default_itc_status,
                  }
                : current,
            )
          }
        />

        <SettingSelect
          label="Return Frequency"
          value={settings.gst_filing_frequency}
          disabled={!canEdit || isSaving}
          options={[
            ["MONTHLY", "Monthly"],
            ["QUARTERLY", "Quarterly"],
            ["NOT_APPLICABLE", "Not Applicable"],
          ]}
          onChange={(value) =>
            setSettings((current) =>
              current ? { ...current, gst_filing_frequency: value } : current,
            )
          }
        />

        <SettingSelect
          label="Default Purchase ITC"
          value={settings.default_itc_status}
          disabled={!canEdit || isSaving}
          options={[
            ["PENDING_REVIEW", "Pending Review"],
            ["ELIGIBLE", "Eligible"],
            ["INELIGIBLE", "Ineligible"],
            ["NOT_APPLICABLE", "Not Applicable"],
          ]}
          onChange={(value) =>
            setSettings((current) =>
              current ? { ...current, default_itc_status: value } : current,
            )
          }
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-violet-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-sm font-semibold text-slate-600">
          {message || (canEdit ? "Settings are company-specific." : "Read-only access is active.")}
        </p>
        {canEdit && (
          <button
            type="button"
            onClick={saveSettings}
            disabled={isSaving}
            className="rounded-xl bg-violet-600 px-5 py-3 font-black text-white transition hover:bg-violet-700 disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save GST Settings"}
          </button>
        )}
      </div>
    </section>
  );
}

function SettingSelect({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <label className="mb-2 block font-bold text-slate-800">{label}</label>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}