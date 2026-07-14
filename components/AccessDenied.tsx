"use client";

import Link from "next/link";
import { LockKeyhole, ShieldAlert } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

export default function AccessDenied({
  title = "Access Restricted",
  description = "Your current company role does not allow access to this section.",
}: {
  title?: string;
  description?: string;
}) {
  const { access } = usePermissions();

  return (
    <div className="flex min-h-[65vh] items-center justify-center p-4">
      <section className="w-full max-w-xl rounded-3xl border border-red-200 bg-white p-6 text-center shadow-xl sm:p-8">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-red-50 text-red-600">
          <ShieldAlert className="h-8 w-8" />
        </span>

        <h1 className="mt-5 text-2xl font-black text-slate-950 sm:text-3xl">
          {title}
        </h1>

        <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-600 sm:text-base">
          {description}
        </p>

        {access && (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">
              Current Role
            </p>
            <p className="mt-1 font-black text-slate-900">
              {access.roleName}
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 font-bold text-white transition hover:bg-slate-800"
          >
            <LockKeyhole className="h-4 w-4" />
            Back to Dashboard
          </Link>

          <Link
            href="/company"
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-50"
          >
            Change Company
          </Link>
        </div>
      </section>
    </div>
  );
}