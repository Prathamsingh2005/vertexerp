"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  LogIn,
  RefreshCw,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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

  return "The invitation could not be accepted.";
}

export default function AcceptInvitationPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params?.token || "";

  const [userEmail, setUserEmail] = useState("");
  const [isCheckingUser, setIsCheckingUser] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isAccepted, setIsAccepted] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function checkUser() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUserEmail(user?.email || "");
      setIsCheckingUser(false);
    }

    checkUser();
  }, []);

  async function acceptInvitation() {
    if (!token || !userEmail) {
      return;
    }

    setIsAccepting(true);
    setMessage("");

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Sign in before accepting this invitation.");
      }

      const { data, error } = await supabase.rpc(
        "accept_company_invitation",
        {
          p_token: token,
        }
      );

      if (error) {
        throw error;
      }

      const row = Array.isArray(data) ? data[0] : data;
      const companyId =
        row &&
        typeof row === "object" &&
        "company_id" in row &&
        typeof row.company_id === "string"
          ? row.company_id
          : "";

      if (companyId) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ active_company_id: companyId })
          .eq("id", user.id);

        if (profileError) {
          throw profileError;
        }
      }

      setIsAccepted(true);
      window.dispatchEvent(
        new Event("vertexerp-active-company-updated")
      );
      window.dispatchEvent(new Event("vertexerp-membership-updated"));

      window.setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 1400);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsAccepting(false);
    }
  }

  const loginHref = `/login?next=${encodeURIComponent(
    `/invite/${token}`
  )}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <section className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="bg-slate-950 p-6 text-white sm:p-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600">
            <UserPlus className="h-6 w-6" />
          </span>
          <h1 className="mt-5 text-3xl font-black">
            VertexERP Team Invitation
          </h1>
          <p className="mt-2 text-sm leading-7 text-slate-300">
            Accept this invitation using the exact email address selected by the
            company Owner or Admin.
          </p>
        </div>

        <div className="p-6 sm:p-8">
          {isCheckingUser ? (
            <div className="py-10 text-center">
              <RefreshCw className="mx-auto h-8 w-8 animate-spin text-blue-600" />
              <p className="mt-3 font-semibold text-slate-600">
                Checking signed-in account...
              </p>
            </div>
          ) : isAccepted ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
              <h2 className="mt-4 text-2xl font-black text-slate-950">
                Invitation Accepted
              </h2>
              <p className="mt-2 text-slate-600">
                Your company access is ready. Opening the dashboard...
              </p>
            </div>
          ) : userEmail ? (
            <>
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 text-blue-700" />
                  <div>
                    <p className="text-sm font-black text-blue-950">
                      Signed in as
                    </p>
                    <p className="mt-1 break-all text-sm text-blue-800">
                      {userEmail}
                    </p>
                  </div>
                </div>
              </div>

              {message && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {message}
                </div>
              )}

              <button
                type="button"
                onClick={acceptInvitation}
                disabled={isAccepting || !token}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white shadow-lg transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isAccepting ? (
                  <RefreshCw className="h-5 w-5 animate-spin" />
                ) : (
                  <UserPlus className="h-5 w-5" />
                )}
                {isAccepting ? "Accepting Invitation..." : "Accept Invitation"}
              </button>
            </>
          ) : (
            <div className="py-6 text-center">
              <LogIn className="mx-auto h-12 w-12 text-blue-600" />
              <h2 className="mt-4 text-2xl font-black text-slate-950">
                Sign in required
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Sign in using the email address that received this invitation,
                then reopen this link.
              </p>
              <Link
                href={loginHref}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 font-bold text-white"
              >
                <LogIn className="h-5 w-5" />
                Sign In
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}