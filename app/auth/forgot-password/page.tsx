"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  Mail,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <div className="relative flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#673de6] shadow-[0_12px_30px_rgba(103,61,230,0.3)]">
        <span className="text-lg font-black tracking-[-0.12em] text-white">
          VX
        </span>
        <span className="absolute bottom-[8px] left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#ffcd35]" />
      </div>

      <div>
        <p className="text-xl font-black tracking-tight text-[#2f1c6a]">
          Vertex<span className="text-[#673de6]">ERP</span>
        </p>
        <p className="text-xs font-semibold text-[#837b99]">
          Business Control Center
        </p>
      </div>
    </Link>
  );
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  function showMessage(nextMessage: string, error = false) {
    setMessage(nextMessage);
    setIsError(error);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanedEmail = email.trim().toLowerCase();

    if (!cleanedEmail) {
      showMessage("Enter your registered email address.", true);
      return;
    }

    setIsLoading(true);
    showMessage("");

    try {
      const supabase = createClient();

      const callbackUrl = new URL(
        "/auth/callback",
        window.location.origin
      );

      callbackUrl.searchParams.set(
        "next",
        "/auth/update-password"
      );

      const { error } =
        await supabase.auth.resetPasswordForEmail(
          cleanedEmail,
          {
            redirectTo: callbackUrl.toString(),
          }
        );

      if (error) {
        showMessage(
          "Password reset email could not be sent. Please try again.",
          true
        );
        return;
      }

      setIsSent(true);
      showMessage(
        "Password reset link sent. Check your inbox and spam folder."
      );
    } catch {
      showMessage(
        "Something went wrong. Please try again.",
        true
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f8f6ff]">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden bg-[#2f1c6a] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(159,122,234,0.45),transparent_32%),radial-gradient(circle_at_85%_80%,rgba(255,205,53,0.18),transparent_28%)]" />

          <div className="relative">
            <Link
              href="/auth"
              className="inline-flex items-center gap-2 text-sm font-bold text-violet-200 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Sign In
            </Link>

            <div className="mt-14">
              <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-white text-[#673de6]">
                <Mail className="h-7 w-7" />
              </div>

              <h1 className="mt-7 max-w-xl text-4xl font-black leading-tight tracking-[-0.035em] xl:text-5xl">
                Recover access to your business workspace.
              </h1>

              <p className="mt-5 max-w-lg text-base leading-8 text-violet-200/80">
                Enter your registered email address. VertexERP will send a
                secure password-reset link to your inbox.
              </p>
            </div>
          </div>

          <div className="relative rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm font-black text-white">
              Security reminder
            </p>
            <p className="mt-2 text-sm leading-7 text-violet-200/75">
              Never share your password-reset email or recovery link with
              anyone.
            </p>
          </div>
        </section>

        <section className="flex items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
          <div className="w-full max-w-md">
            <div className="mb-7 flex items-center justify-between lg:hidden">
              <Brand />

              <Link
                href="/auth"
                className="text-sm font-bold text-[#673de6]"
              >
                Sign In
              </Link>
            </div>

            <div className="rounded-[28px] border border-[#e2d9f7] bg-white p-5 shadow-[0_24px_70px_rgba(47,28,106,0.12)] sm:p-8">
              <div className="hidden lg:block">
                <Brand />
              </div>

              <div className="mt-7">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ede7ff] text-[#673de6]">
                  {isSent ? (
                    <CheckCircle2 className="h-6 w-6" />
                  ) : (
                    <Mail className="h-6 w-6" />
                  )}
                </span>

                <h1 className="mt-5 text-3xl font-black tracking-[-0.03em] text-[#2f1c6a]">
                  {isSent
                    ? "Check your email"
                    : "Forgot your password?"}
                </h1>

                <p className="mt-2 leading-7 text-[#736c87]">
                  {isSent
                    ? "Open the password-reset email and follow the secure link."
                    : "Enter the email address connected to your VertexERP account."}
                </p>
              </div>

              <form
                onSubmit={handleSubmit}
                className="mt-6 space-y-4"
              >
                <div>
                  <label
                    htmlFor="reset-email"
                    className="mb-2 block text-sm font-black text-[#3d315f]"
                  >
                    Email Address
                  </label>

                  <input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    placeholder="name@example.com"
                    autoComplete="email"
                    disabled={isLoading}
                    className="w-full rounded-xl border border-[#d9d0ec] bg-[#faf9ff] px-4 py-3 text-base text-[#2f1c6a] outline-none transition placeholder:text-[#a19ab4] focus:border-[#673de6] focus:bg-white focus:ring-4 focus:ring-[#673de6]/10 disabled:opacity-60"
                  />
                </div>

                {message && (
                  <div
                    aria-live="polite"
                    className={`rounded-xl border px-4 py-3 text-sm font-bold ${
                      isError
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#673de6] px-4 py-3.5 font-black text-white shadow-[0_12px_30px_rgba(103,61,230,0.24)] transition hover:-translate-y-0.5 hover:bg-[#5025d1] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading && (
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                  )}

                  {isLoading
                    ? "Sending reset link..."
                    : isSent
                      ? "Send Again"
                      : "Send Reset Link"}
                </button>
              </form>

              <Link
                href="/auth"
                className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-[#ded5f2] px-4 py-3 text-sm font-black text-[#673de6] transition hover:border-[#673de6] hover:bg-[#f5f2ff]"
              >
                <ArrowLeft className="h-4 w-4" />
                Return to Sign In
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}