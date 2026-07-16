"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  DatabaseBackup,
  Mail,
  MessageCircle,
  Phone,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";

import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import { usePermissions } from "@/hooks/usePermissions";

const SUPPORT_EMAIL = "prathamgaur2005@gmail.com";
const SUPPORT_PHONE = "+91 87370 72778";
const SUPPORT_PHONE_RAW = "918737072778";

export default function SettingsPage() {
  const {
    access,
    can,
    error: permissionError,
    isLoading: isPermissionLoading,
  } = usePermissions();

  const canViewTeam =
    can("team.view") || can("team.manage");

  const canViewRoles =
    can("roles.view") || can("roles.manage");

  const canExportBackup = can("backup.export");

  const availableTools = [
    canViewTeam,
    canViewRoles,
    canExportBackup,
  ].filter(Boolean).length;

  const whatsappMessage = encodeURIComponent(
    "Hello VertexERP Support, I need help with my VertexERP account."
  );

  return (
    <div className="flex min-h-screen bg-[#f3f6fb]">
      <Sidebar />

      <div className="min-w-0 flex-1 overflow-x-hidden">
        <Navbar />

        <main className="min-w-0 p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
          {permissionError && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-semibold text-red-700">
              {permissionError}
            </div>
          )}

          <section className="overflow-hidden rounded-[30px] bg-gradient-to-br from-violet-950 via-violet-800 to-violet-600 p-6 text-white shadow-2xl shadow-violet-900/20 sm:p-8 lg:p-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-violet-100 backdrop-blur">
                  <Settings2 className="h-4 w-4" />
                  Workspace Control Center
                </div>

                <h1 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                  Settings &amp; Support
                </h1>

                <p className="mt-3 max-w-2xl text-base leading-7 text-violet-100 sm:text-lg">
                  Manage team access, roles, backup tools and get direct help
                  from the VertexERP support team.
                </p>
              </div>

              <div className="rounded-2xl border border-white/15 bg-slate-950/25 px-5 py-4 backdrop-blur">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-200">
                  Current Access
                </p>

                <p className="mt-1 text-lg font-black">
                  {isPermissionLoading
                    ? "Loading..."
                    : access?.roleName || "No active role"}
                </p>

                <p className="mt-1 text-sm text-violet-100">
                  {availableTools} management tools available
                </p>
              </div>
            </div>
          </section>

          {isPermissionLoading ? (
            <div className="mt-6 rounded-3xl border border-violet-100 bg-white p-10 text-center font-semibold text-slate-600 shadow-xl shadow-violet-100/50 sm:mt-8">
              Loading settings permissions...
            </div>
          ) : (
            <>
              <section className="mt-6 sm:mt-8">
                <div className="mb-5">
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-violet-700">
                    Administration
                  </p>

                  <h2 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">
                    Workspace management
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
                    Only the tools allowed by your active company role are
                    displayed below.
                  </p>
                </div>

                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {canViewTeam && (
                    <SettingsCard
                      href="/settings/team"
                      icon={
                        <Users className="h-6 w-6" />
                      }
                      title="Team Management"
                      description="Invite members, manage company access and review team status."
                      badge={
                        can("team.manage")
                          ? "Management Access"
                          : "View Access"
                      }
                    />
                  )}

                  {canViewRoles && (
                    <SettingsCard
                      href="/settings/roles"
                      icon={
                        <ShieldCheck className="h-6 w-6" />
                      }
                      title="Roles & Permissions"
                      description="Control what each role can view, create, edit and delete."
                      badge={
                        can("roles.manage")
                          ? "Management Access"
                          : "View Access"
                      }
                    />
                  )}

                  {canExportBackup && (
                    <SettingsCard
                      href="/settings/backup"
                      icon={
                        <DatabaseBackup className="h-6 w-6" />
                      }
                      title="Backup & Export"
                      description="Prepare company backups and download table-wise CSV exports."
                      badge="Export Access"
                    />
                  )}
                </div>

                {availableTools === 0 && (
                  <div className="rounded-3xl border border-violet-100 bg-white p-8 text-center shadow-xl shadow-violet-100/40">
                    <div className="text-4xl">🔒</div>

                    <h3 className="mt-4 text-xl font-black text-slate-900">
                      No administration tools available
                    </h3>

                    <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
                      Your current company role does not include team, role or
                      backup permissions. Support options are still available
                      below.
                    </p>
                  </div>
                )}
              </section>

              <section className="mt-8 overflow-hidden rounded-[30px] border border-violet-100 bg-white shadow-xl shadow-violet-100/50 lg:mt-10">
                <div className="bg-gradient-to-r from-violet-950 via-violet-800 to-violet-600 p-6 text-white sm:p-8">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-white/15 p-3 backdrop-blur">
                      <MessageCircle className="h-6 w-6" />
                    </div>

                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-200">
                        VertexERP Assistance
                      </p>

                      <h2 className="mt-1 text-2xl font-black sm:text-3xl">
                        Help &amp; Support
                      </h2>
                    </div>
                  </div>

                  <p className="mt-4 max-w-2xl leading-7 text-violet-100">
                    Contact the VertexERP support team for login problems,
                    company setup, billing, GST, inventory, reports or
                    permission-related assistance.
                  </p>
                </div>

                <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-3 lg:p-8">
                  <SupportCard
                    icon={<Mail className="h-6 w-6" />}
                    label="Email Support"
                    value={SUPPORT_EMAIL}
                    href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
                      "VertexERP Support Request"
                    )}`}
                    buttonText="Send Email"
                  />

                  <SupportCard
                    icon={<MessageCircle className="h-6 w-6" />}
                    label="WhatsApp Support"
                    value={SUPPORT_PHONE}
                    href={`https://wa.me/${SUPPORT_PHONE_RAW}?text=${whatsappMessage}`}
                    buttonText="Open WhatsApp"
                    external
                  />

                  <SupportCard
                    icon={<Phone className="h-6 w-6" />}
                    label="Phone Support"
                    value={SUPPORT_PHONE}
                    href={`tel:+${SUPPORT_PHONE_RAW}`}
                    buttonText="Call Support"
                  />
                </div>

                <div className="border-t border-violet-100 bg-violet-50 px-5 py-4 text-center text-sm font-semibold text-violet-800 sm:px-8">
                  Please include your registered email and company name while
                  contacting support.
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function SettingsCard({
  href,
  icon,
  title,
  description,
  badge,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
  badge: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-[230px] flex-col rounded-3xl border border-violet-100 bg-white p-6 shadow-xl shadow-violet-100/40 transition duration-200 hover:-translate-y-1 hover:border-violet-300 hover:shadow-2xl hover:shadow-violet-200/60"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 transition group-hover:bg-violet-600 group-hover:text-white">
          {icon}
        </div>

        <span className="rounded-full bg-violet-50 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-violet-700">
          {badge}
        </span>
      </div>

      <h3 className="mt-6 text-xl font-black text-slate-950">
        {title}
      </h3>

      <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">
        {description}
      </p>

      <div className="mt-5 flex items-center gap-2 font-black text-violet-700">
        Open Settings
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

function SupportCard({
  icon,
  label,
  value,
  href,
  buttonText,
  external = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  href: string;
  buttonText: string;
  external?: boolean;
}) {
  return (
    <article className="flex flex-col rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
        {icon}
      </div>

      <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>

      <p className="mt-2 break-all text-base font-black text-slate-950">
        {value}
      </p>

      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer" : undefined}
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-violet-200 transition hover:bg-violet-700"
      >
        {buttonText}
        <ArrowRight className="h-4 w-4" />
      </a>
    </article>
  );
}