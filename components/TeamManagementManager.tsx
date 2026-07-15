"use client";

import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Ban,
  CheckCircle2,
  Clipboard,
  Clock3,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";

type RoleRow = {
  code: string;
  name: string;
  description: string;
  sort_order: number;
};

type MemberRow = {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  role_code: string;
  status: "active" | "inactive";
  joined_at: string | null;
  created_at: string;
};

type InvitationRow = {
  id: string;
  email: string;
  role_code: string;
  token: string;
  status: "pending" | "accepted" | "expired" | "cancelled";
  expires_at: string;
  created_at: string;
};

type InviteRpcRow = {
  invitation_id: string;
  invitation_token: string;
  invitation_expires_at: string;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "The requested team operation could not be completed.";
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TeamManagementManager() {
  const { access, can, isOwner, refreshAccess } = usePermissions();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState("");
  const [busyInvitationId, setBusyInvitationId] = useState("");
  const [message, setMessage] = useState("");
  const [latestInviteLink, setLatestInviteLink] = useState("");
  const [form, setForm] = useState({
    email: "",
    roleCode: "viewer",
    expiresInDays: "7",
  });

  const canManageTeam = can("team.manage");

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(""), 4500);
  }

  const loadTeamData = useCallback(async () => {
    if (!access?.companyId) {
      setRoles([]);
      setMembers([]);
      setInvitations([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();

      const [rolesResponse, membersResponse] = await Promise.all([
        supabase
          .from("roles")
          .select("code, name, description, sort_order")
          .order("sort_order", { ascending: true }),
        supabase
          .from("company_members")
          .select(
            "id, user_id, email, display_name, role_code, status, joined_at, created_at"
          )
          .eq("company_id", access.companyId)
          .order("created_at", { ascending: true }),
      ]);

      if (rolesResponse.error) {
        throw rolesResponse.error;
      }

      if (membersResponse.error) {
        throw membersResponse.error;
      }

      setRoles((rolesResponse.data || []) as RoleRow[]);
      setMembers((membersResponse.data || []) as MemberRow[]);

      if (canManageTeam) {
        const invitationsResponse = await supabase
          .from("company_invitations")
          .select(
            "id, email, role_code, token, status, expires_at, created_at"
          )
          .eq("company_id", access.companyId)
          .eq("status", "pending")
          .order("created_at", { ascending: false });

        if (invitationsResponse.error) {
          throw invitationsResponse.error;
        }

        setInvitations(
          (invitationsResponse.data || []) as InvitationRow[]
        );
      } else {
        setInvitations([]);
      }
    } catch (error) {
      setRoles([]);
      setMembers([]);
      setInvitations([]);
      showMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [access?.companyId, canManageTeam]);

  useEffect(() => {
    loadTeamData();
  }, [loadTeamData]);

  const roleNameByCode = useMemo(
    () => new Map(roles.map((role) => [role.code, role.name])),
    [roles]
  );

  const assignableRoles = useMemo(
    () => roles.filter((role) => role.code !== "owner"),
    [roles]
  );

  const summary = useMemo(
    () => ({
      total: members.length,
      active: members.filter((member) => member.status === "active").length,
      inactive: members.filter((member) => member.status === "inactive").length,
      pending: invitations.length,
    }),
    [invitations.length, members]
  );

  function buildInviteLink(token: string) {
    return `${window.location.origin}/invite/${token}`;
  }

  async function copyText(text: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(text);
      showMessage(successMessage);
    } catch {
      showMessage("Copy failed. Select and copy the invitation link manually.");
    }
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!access?.companyId || !canManageTeam) {
      showMessage("You do not have permission to invite company members.");
      return;
    }

    const email = form.email.trim().toLowerCase();
    const expiresInDays = Number(form.expiresInDays);

    if (!email) {
      showMessage("Enter the employee email address.");
      return;
    }

    setIsSaving(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc(
        "create_company_invitation",
        {
          p_company_id: access.companyId,
          p_email: email,
          p_role_code: form.roleCode,
          p_expires_in_days: expiresInDays,
        }
      );

      if (error) {
        throw error;
      }

      const row = (
        Array.isArray(data) ? data[0] : data
      ) as InviteRpcRow | null;

      if (!row?.invitation_token) {
        throw new Error("Invitation token was not returned.");
      }

      const inviteLink = buildInviteLink(row.invitation_token);
      setLatestInviteLink(inviteLink);
      setForm({
        email: "",
        roleCode: "viewer",
        expiresInDays: "7",
      });

      await loadTeamData();
      window.dispatchEvent(new Event("vertexerp-membership-updated"));

      showMessage(
        "Invitation created. Copy or email the secure invitation link."
      );
    } catch (error) {
      showMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function updateMemberRole(member: MemberRow, roleCode: string) {
    if (!access?.companyId || !canManageTeam || member.role_code === "owner") {
      return;
    }

    setBusyMemberId(member.id);

    try {
      const supabase = createClient();
      const { error } = await supabase.rpc(
        "update_company_member_role",
        {
          p_company_id: access.companyId,
          p_member_id: member.id,
          p_role_code: roleCode,
        }
      );

      if (error) {
        throw error;
      }

      await loadTeamData();
      await refreshAccess();
      window.dispatchEvent(new Event("vertexerp-membership-updated"));
      showMessage("Member role updated successfully.");
    } catch (error) {
      showMessage(getErrorMessage(error));
    } finally {
      setBusyMemberId("");
    }
  }

  async function toggleMemberStatus(member: MemberRow) {
    if (!access?.companyId || !canManageTeam || member.role_code === "owner") {
      return;
    }

    const nextStatus =
      member.status === "active" ? "inactive" : "active";

    setBusyMemberId(member.id);

    try {
      const supabase = createClient();
      const { error } = await supabase.rpc(
        "update_company_member_status",
        {
          p_company_id: access.companyId,
          p_member_id: member.id,
          p_status: nextStatus,
        }
      );

      if (error) {
        throw error;
      }

      await loadTeamData();
      window.dispatchEvent(new Event("vertexerp-membership-updated"));
      showMessage(
        nextStatus === "active"
          ? "Member access reactivated."
          : "Member access deactivated."
      );
    } catch (error) {
      showMessage(getErrorMessage(error));
    } finally {
      setBusyMemberId("");
    }
  }

  async function cancelInvitation(invitation: InvitationRow) {
    if (!access?.companyId || !canManageTeam) {
      return;
    }

    setBusyInvitationId(invitation.id);

    try {
      const supabase = createClient();
      const { error } = await supabase.rpc(
        "cancel_company_invitation",
        {
          p_company_id: access.companyId,
          p_invitation_id: invitation.id,
        }
      );

      if (error) {
        throw error;
      }

      await loadTeamData();
      showMessage("Pending invitation cancelled.");
    } catch (error) {
      showMessage(getErrorMessage(error));
    } finally {
      setBusyInvitationId("");
    }
  }

  function emailInvitation(invitation: InvitationRow) {
    const link = buildInviteLink(invitation.token);
    const subject = encodeURIComponent(
      `Invitation to join ${access?.companyName || "VertexERP"}`
    );
    const body = encodeURIComponent(
      `You have been invited to join ${
        access?.companyName || "a company"
      } on VertexERP as ${
        roleNameByCode.get(invitation.role_code) || invitation.role_code
      }.\n\nOpen this secure invitation link:\n${link}\n\nThis invitation expires on ${formatDate(
        invitation.expires_at
      )}.`
    );

    window.location.href = `mailto:${invitation.email}?subject=${subject}&body=${body}`;
  }

  return (
    <div className="min-w-0 space-y-6">
      <section className="overflow-hidden rounded-[30px] border border-violet-500/20 bg-gradient-to-br from-violet-950 via-violet-800 to-violet-600 p-5 text-white shadow-2xl shadow-violet-900/20 sm:p-7 lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
              <Users className="h-6 w-6" />
            </span>
            <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">
              Team Management
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-violet-100 sm:text-base">
              Invite employees, assign controlled roles and deactivate access
              without sharing the company Owner account.
            </p>
          </div>

          <div className="rounded-2xl border border-white/15 bg-slate-950/25 px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-violet-200">
              Active Company
            </p>
            <p className="mt-1 font-black text-white">
              {access?.companyName || "No active company"}
            </p>
            <p className="mt-1 text-sm text-emerald-300">
              Your role: {access?.roleName || "Not assigned"}
            </p>
          </div>
        </div>
      </section>

      {message && (
        <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700">
          {message}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total Members" value={summary.total} icon={<Users />} />
        <SummaryCard label="Active Members" value={summary.active} icon={<CheckCircle2 />} />
        <SummaryCard label="Inactive Members" value={summary.inactive} icon={<Ban />} />
        <SummaryCard label="Pending Invites" value={summary.pending} icon={<Clock3 />} />
      </section>

      {canManageTeam ? (
        <form
          onSubmit={handleInvite}
          className="rounded-3xl border border-violet-100 bg-white p-5 shadow-xl sm:p-6"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
              <UserPlus className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-black text-slate-950">
                Invite Employee
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Create a secure invitation link. Send it only to the email
                address entered below.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="xl:col-span-2">
              <label className="mb-2 block text-sm font-bold text-slate-800">
                Employee Email *
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                placeholder="employee@example.com"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-800">
                Role *
              </label>
              <select
                value={form.roleCode}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    roleCode: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
              >
                {assignableRoles.map((role) => (
                  <option key={role.code} value={role.code}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-800">
                Expires In
              </label>
              <select
                value={form.expiresInDays}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    expiresInDays: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
              >
                <option value="3">3 days</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 font-bold text-white shadow-lg transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isSaving ? (
              <RefreshCw className="h-5 w-5 animate-spin" />
            ) : (
              <UserPlus className="h-5 w-5" />
            )}
            {isSaving ? "Creating Invite..." : "Create Invitation"}
          </button>

          {latestInviteLink && (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-black text-emerald-900">
                Latest invitation link
              </p>
              <p className="mt-2 break-all rounded-xl bg-white px-3 py-2 text-sm text-slate-700">
                {latestInviteLink}
              </p>
              <button
                type="button"
                onClick={() =>
                  copyText(
                    latestInviteLink,
                    "Invitation link copied successfully."
                  )
                }
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white"
              >
                <Clipboard className="h-4 w-4" />
                Copy Link
              </button>
            </div>
          )}
        </form>
      ) : (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-6 w-6 text-amber-700" />
            <div>
              <h2 className="font-black text-amber-950">View-only team access</h2>
              <p className="mt-1 text-sm leading-6 text-amber-800">
                Your role can view company members but cannot invite, deactivate
                or change roles.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-xl">
        <div className="flex items-center justify-between gap-4 border-b border-violet-100 p-5 sm:p-6">
          <div>
            <h2 className="text-xl font-black text-slate-950">
              Company Members
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Owner access is protected and cannot be deactivated.
            </p>
          </div>
          <button
            type="button"
            onClick={loadTeamData}
            disabled={isLoading}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 transition hover:bg-violet-50 disabled:opacity-50"
            aria-label="Refresh team"
          >
            <RefreshCw
              className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        <div className="divide-y divide-violet-100">
          {isLoading ? (
            <p className="px-6 py-14 text-center text-slate-500">
              Loading company members...
            </p>
          ) : members.length === 0 ? (
            <p className="px-6 py-14 text-center text-slate-500">
              No company memberships found.
            </p>
          ) : (
            members.map((member) => {
              const isProtectedOwner = member.role_code === "owner";
              const isBusy = busyMemberId === member.id;

              return (
                <article
                  key={member.id}
                  className="flex flex-col gap-4 p-5 transition hover:bg-violet-50 sm:p-6 xl:flex-row xl:items-center xl:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="break-words font-black text-slate-950">
                        {member.display_name ||
                          member.email ||
                          "Unnamed Member"}
                      </h3>
                      {isProtectedOwner && (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">
                          Protected Owner
                        </span>
                      )}
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${
                          member.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {member.status === "active" ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <p className="mt-1 break-all text-sm text-slate-600">
                      {member.email || "No email stored"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Joined: {formatDate(member.joined_at || member.created_at)}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-2">
                      <UserCog className="h-4 w-4 text-slate-500" />
                      {canManageTeam && !isProtectedOwner ? (
                        <select
                          value={member.role_code}
                          disabled={isBusy}
                          onChange={(event) =>
                            updateMemberRole(member, event.target.value)
                          }
                          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                        >
                          {assignableRoles.map((role) => (
                            <option key={role.code} value={role.code}>
                              {role.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700">
                          {roleNameByCode.get(member.role_code) ||
                            member.role_code}
                        </span>
                      )}
                    </div>

                    {canManageTeam && !isProtectedOwner && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => toggleMemberStatus(member)}
                        className={`rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:opacity-50 ${
                          member.status === "active"
                            ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                            : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        }`}
                      >
                        {isBusy
                          ? "Saving..."
                          : member.status === "active"
                            ? "Deactivate"
                            : "Reactivate"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      {canManageTeam && (
        <section className="overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-xl">
          <div className="border-b border-violet-100 p-5 sm:p-6">
            <h2 className="text-xl font-black text-slate-950">
              Pending Invitations
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Copy or email the secure link before its expiry.
            </p>
          </div>

          <div className="divide-y divide-violet-100">
            {invitations.length === 0 ? (
              <p className="px-6 py-12 text-center text-slate-500">
                No pending invitations.
              </p>
            ) : (
              invitations.map((invitation) => {
                const link = buildInviteLink(invitation.token);
                const isBusy = busyInvitationId === invitation.id;

                return (
                  <article
                    key={invitation.id}
                    className="flex flex-col gap-4 p-5 sm:p-6 xl:flex-row xl:items-center xl:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="break-all font-black text-slate-950">
                        {invitation.email}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {roleNameByCode.get(invitation.role_code) ||
                          invitation.role_code}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-amber-700">
                        Expires: {formatDate(invitation.expires_at)}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() =>
                          copyText(link, "Invitation link copied successfully.")
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-bold text-violet-700 hover:bg-violet-100"
                      >
                        <Clipboard className="h-4 w-4" />
                        Copy
                      </button>

                      <button
                        type="button"
                        onClick={() => emailInvitation(invitation)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-violet-50"
                      >
                        <Mail className="h-4 w-4" />
                        Email
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => cancelInvitation(invitation)}
                        className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        {isBusy ? "Cancelling..." : "Cancel"}
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      )}

      {isOwner && (
        <section className="rounded-3xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-6 w-6 text-violet-700" />
            <div>
              <h2 className="font-black text-violet-950">
                Owner Protection Enabled
              </h2>
              <p className="mt-1 text-sm leading-6 text-violet-800">
                Your Owner membership is synchronized with the company record
                and cannot be removed, downgraded or deactivated from this page.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <article className="rounded-3xl border border-violet-100 bg-white p-5 shadow-sm">
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </span>
      <p className="mt-4 text-sm font-bold text-slate-600">{label}</p>
      <p className="mt-1 text-3xl font-black text-slate-950">{value}</p>
    </article>
  );
}