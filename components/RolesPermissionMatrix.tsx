"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Eye,
  RefreshCw,
  ShieldCheck,
  ShieldQuestion,
  X,
} from "lucide-react";

import { usePermissions } from "@/hooks/usePermissions";
import { createClient } from "@/lib/supabase/client";

type RoleRow = {
  code: string;
  name: string;
  description: string;
  sort_order: number;
  is_system: boolean;
};

type PermissionRow = {
  code: string;
  module: string;
  name: string;
  description: string;
};

type RolePermissionRow = {
  role_code: string;
  permission_code: string;
  allowed: boolean;
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

  return "Role permissions could not be loaded.";
}

export default function RolesPermissionMatrix() {
  const { access, can } = usePermissions();

  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [rolePermissions, setRolePermissions] = useState<
    RolePermissionRow[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  const canManageRoles = can("roles.manage");

  const loadMatrix = useCallback(async () => {
    setIsLoading(true);
    setMessage("");

    try {
      const supabase = createClient();

      const [rolesResponse, permissionsResponse, matrixResponse] =
        await Promise.all([
          supabase
            .from("roles")
            .select(
              "code, name, description, sort_order, is_system",
            )
            .order("sort_order", { ascending: true }),

          supabase
            .from("permissions")
            .select("code, module, name, description")
            .order("module", { ascending: true })
            .order("name", { ascending: true }),

          supabase
            .from("role_permissions")
            .select("role_code, permission_code, allowed"),
        ]);

      if (rolesResponse.error) {
        throw rolesResponse.error;
      }

      if (permissionsResponse.error) {
        throw permissionsResponse.error;
      }

      if (matrixResponse.error) {
        throw matrixResponse.error;
      }

      setRoles((rolesResponse.data || []) as RoleRow[]);
      setPermissions(
        (permissionsResponse.data || []) as PermissionRow[],
      );
      setRolePermissions(
        (matrixResponse.data || []) as RolePermissionRow[],
      );
    } catch (error) {
      setRoles([]);
      setPermissions([]);
      setRolePermissions([]);
      setMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMatrix();
  }, [loadMatrix]);

  const permissionMap = useMemo(() => {
    const map = new Set<string>();

    rolePermissions
      .filter((entry) => entry.allowed)
      .forEach((entry) => {
        map.add(
          `${entry.role_code}:${entry.permission_code}`,
        );
      });

    return map;
  }, [rolePermissions]);

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, PermissionRow[]>();

    permissions.forEach((permission) => {
      const existing = groups.get(permission.module) || [];

      existing.push(permission);
      groups.set(permission.module, existing);
    });

    return Array.from(groups.entries());
  }, [permissions]);

  const rolePermissionCounts = useMemo(
    () =>
      new Map(
        roles.map((role) => [
          role.code,
          permissions.filter((permission) =>
            permissionMap.has(
              `${role.code}:${permission.code}`,
            ),
          ).length,
        ]),
      ),
    [permissionMap, permissions, roles],
  );

  return (
    <div className="min-w-0 space-y-6">
      <section className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-violet-950 via-violet-800 to-violet-600 p-6 text-white shadow-2xl shadow-violet-900/20 sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />

        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-violet-300/10 blur-3xl" />

        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-violet-100 backdrop-blur">
              <ShieldCheck className="h-4 w-4" />
              Access Control
            </div>

            <span className="mt-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/15 shadow-lg backdrop-blur">
              <ShieldCheck className="h-7 w-7" />
            </span>

            <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
              Roles &amp; Permission Matrix
            </h1>

            <p className="mt-3 max-w-3xl text-base leading-7 text-violet-100 sm:text-lg">
              Review exactly which VertexERP modules and actions
              are available to each built-in company role.
            </p>
          </div>

          <button
            type="button"
            onClick={loadMatrix}
            disabled={isLoading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3 font-bold text-white backdrop-blur transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            <RefreshCw
              className={`h-5 w-5 ${
                isLoading ? "animate-spin" : ""
              }`}
            />

            Refresh Matrix
          </button>
        </div>
      </section>

      {message && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-sm">
          {message}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Roles" value={roles.length} />

        <Metric
          label="Permissions"
          value={permissions.length}
        />

        <Metric
          label="Modules"
          value={groupedPermissions.length}
        />

        <Metric
          label="Your Role"
          value={access?.roleName || "Not assigned"}
          text
        />
      </section>

      <section
        className={`rounded-3xl border p-5 shadow-sm sm:p-6 ${
          canManageRoles
            ? "border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50"
            : "border-blue-200 bg-blue-50"
        }`}
      >
        <div className="flex items-start gap-3">
          {canManageRoles ? (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white">
              <ShieldCheck className="h-5 w-5" />
            </span>
          ) : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
              <Eye className="h-5 w-5" />
            </span>
          )}

          <div>
            <h2
              className={`font-black ${
                canManageRoles
                  ? "text-violet-950"
                  : "text-blue-950"
              }`}
            >
              {canManageRoles
                ? "Owner-level role administration"
                : "Read-only permission reference"}
            </h2>

            <p
              className={`mt-1 text-sm leading-6 ${
                canManageRoles
                  ? "text-violet-800"
                  : "text-blue-800"
              }`}
            >
              Built-in role permissions are currently controlled
              by the database migration. Custom role editing will
              be added after business-table RLS enforcement is
              complete.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4 md:hidden">
        {isLoading ? (
          <div className="rounded-3xl border border-violet-100 bg-white px-6 py-14 text-center text-slate-500 shadow-lg shadow-violet-100/40">
            Loading permission matrix...
          </div>
        ) : (
          roles.map((role) => (
            <article
              key={role.code}
              className="rounded-3xl border border-violet-100 bg-white p-5 shadow-lg shadow-violet-100/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words font-black text-slate-950">
                    {role.name}
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {role.description}
                  </p>
                </div>

                <span className="shrink-0 rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700">
                  {rolePermissionCounts.get(role.code) || 0}
                </span>
              </div>

              <div className="mt-5 space-y-4">
                {groupedPermissions.map(
                  ([module, modulePermissions]) => {
                    const allowed = modulePermissions.filter(
                      (permission) =>
                        permissionMap.has(
                          `${role.code}:${permission.code}`,
                        ),
                    );

                    if (allowed.length === 0) {
                      return null;
                    }

                    return (
                      <div key={module}>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                          {module}
                        </p>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {allowed.map((permission) => (
                            <span
                              key={permission.code}
                              className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"
                            >
                              {permission.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </article>
          ))
        )}
      </section>

      <section className="hidden min-w-0 overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-xl shadow-violet-100/40 md:block">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[1250px]">
            <thead className="sticky top-0 bg-gradient-to-r from-violet-950 via-violet-800 to-violet-600 text-white">
              <tr>
                <th className="sticky left-0 z-20 min-w-[300px] bg-violet-950 px-5 py-4 text-left text-sm font-black">
                  Permission
                </th>

                {roles.map((role) => (
                  <th
                    key={role.code}
                    className="min-w-[150px] px-4 py-4 text-center text-sm font-black"
                  >
                    {role.name}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={roles.length + 1}
                    className="px-6 py-16 text-center text-slate-500"
                  >
                    Loading permission matrix...
                  </td>
                </tr>
              ) : (
                groupedPermissions.flatMap(
                  ([module, modulePermissions]) => [
                    <tr
                      key={`${module}-heading`}
                      className="bg-violet-100"
                    >
                      <td
                        colSpan={roles.length + 1}
                        className="px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-violet-800"
                      >
                        {module}
                      </td>
                    </tr>,

                    ...modulePermissions.map((permission) => (
                      <tr
                        key={permission.code}
                        className="group border-b border-slate-100 transition hover:bg-violet-50"
                      >
                        <td className="sticky left-0 z-10 bg-white px-5 py-4 transition group-hover:bg-violet-50">
                          <p className="font-bold text-slate-900">
                            {permission.name}
                          </p>

                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {permission.description}
                          </p>
                        </td>

                        {roles.map((role) => {
                          const allowed = permissionMap.has(
                            `${role.code}:${permission.code}`,
                          );

                          return (
                            <td
                              key={role.code}
                              className="px-4 py-4 text-center"
                            >
                              <span
                                className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full ${
                                  allowed
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-slate-100 text-slate-400"
                                }`}
                                title={
                                  allowed
                                    ? "Permission allowed"
                                    : "Permission not allowed"
                                }
                              >
                                {allowed ? (
                                  <Check className="h-4 w-4" />
                                ) : (
                                  <X className="h-4 w-4" />
                                )}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    )),
                  ],
                )
              )}
            </tbody>
          </table>
        </div>
      </section>

      {!isLoading && roles.length === 0 && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-center shadow-sm">
          <ShieldQuestion className="mx-auto h-8 w-8 text-amber-700" />

          <p className="mt-3 font-black text-amber-950">
            No roles were returned
          </p>

          <p className="mt-1 text-sm text-amber-800">
            Confirm that the Roles &amp; Permissions foundation
            SQL completed successfully.
          </p>
        </section>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  text = false,
}: {
  label: string;
  value: number | string;
  text?: boolean;
}) {
  return (
    <article className="rounded-3xl border border-violet-100 bg-white p-5 shadow-lg shadow-violet-100/40 transition hover:-translate-y-0.5 hover:shadow-xl sm:p-6">
      <p className="text-sm font-bold text-slate-600">
        {label}
      </p>

      <p
        className={`mt-2 break-words font-black text-slate-950 ${
          text ? "text-xl" : "text-3xl"
        }`}
      >
        {value}
      </p>
    </article>
  );
}