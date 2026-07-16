"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
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

export default function UpdatePasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [isUpdated, setIsUpdated] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function checkRecoverySession() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isMounted) {
        return;
      }

      setHasRecoverySession(Boolean(user));
      setIsCheckingSession(false);
    }

    checkRecoverySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) {
        return;
      }

      setHasRecoverySession(Boolean(session?.user));
      setIsCheckingSession(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  function showMessage(nextMessage: string, error = false) {
    setMessage(nextMessage);
    setIsError(error);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword.length < 8) {
      showMessage(
        "Password must contain at least 8 characters.",
        true
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage(
        "New password and confirm password do not match.",
        true
      );
      return;
    }

    setIsLoading(true);
    showMessage("");

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        showMessage(
          "Password could not be updated. The recovery link may have expired.",
          true
        );
        return;
      }

      await supabase.auth.signOut();

      setIsUpdated(true);
      setNewPassword("");
      setConfirmPassword("");
      showMessage(
        "Password updated successfully. You can now sign in with your new password."
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

  if (isCheckingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8f6ff]">
        <div className="flex items-center gap-3 rounded-2xl border border-[#e0d6fa] bg-white px-5 py-4 font-bold text-[#673de6] shadow-lg">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          Verifying recovery link...
        </div>
      </main>
    );
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
                <LockKeyhole className="h-7 w-7" />
              </div>

              <h1 className="mt-7 max-w-xl text-4xl font-black leading-tight tracking-[-0.035em] xl:text-5xl">
                Create a secure new password.
              </h1>

              <p className="mt-5 max-w-lg text-base leading-8 text-violet-200/80">
                Choose a password that is difficult to guess and different
                from passwords used on other websites.
              </p>
            </div>
          </div>

          <div className="relative rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm font-black text-white">
              Recommended password
            </p>
            <p className="mt-2 text-sm leading-7 text-violet-200/75">
              Use at least 8 characters with uppercase, lowercase, numbers
              and symbols.
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
                  {isUpdated ? (
                    <CheckCircle2 className="h-6 w-6" />
                  ) : (
                    <LockKeyhole className="h-6 w-6" />
                  )}
                </span>

                <h1 className="mt-5 text-3xl font-black tracking-[-0.03em] text-[#2f1c6a]">
                  {isUpdated
                    ? "Password updated"
                    : hasRecoverySession
                      ? "Set new password"
                      : "Recovery link unavailable"}
                </h1>

                <p className="mt-2 leading-7 text-[#736c87]">
                  {isUpdated
                    ? "Your account is ready. Sign in using the new password."
                    : hasRecoverySession
                      ? "Enter and confirm your new VertexERP password."
                      : "This recovery link is invalid, expired or has already been used."}
                </p>
              </div>

              {hasRecoverySession && !isUpdated ? (
                <form
                  onSubmit={handleSubmit}
                  className="mt-6 space-y-4"
                >
                  <PasswordField
                    label="New Password"
                    value={newPassword}
                    onChange={setNewPassword}
                    visible={showPassword}
                    onToggle={() =>
                      setShowPassword((current) => !current)
                    }
                    placeholder="Enter new password"
                  />

                  <PasswordField
                    label="Confirm New Password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    visible={showPassword}
                    onToggle={() =>
                      setShowPassword((current) => !current)
                    }
                    placeholder="Confirm new password"
                  />

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
                      ? "Updating password..."
                      : "Update Password"}
                  </button>
                </form>
              ) : (
                message && (
                  <div
                    aria-live="polite"
                    className={`mt-6 rounded-xl border px-4 py-3 text-sm font-bold ${
                      isError
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {message}
                  </div>
                )
              )}

              {!hasRecoverySession && !isUpdated && (
                <Link
                  href="/auth/forgot-password"
                  className="mt-6 flex items-center justify-center rounded-xl bg-[#673de6] px-4 py-3.5 font-black text-white transition hover:bg-[#5025d1]"
                >
                  Request New Reset Link
                </Link>
              )}

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

function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggle,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-black text-[#3d315f]">
        {label}
      </label>

      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="new-password"
          className="w-full rounded-xl border border-[#d9d0ec] bg-[#faf9ff] px-4 py-3 pr-12 text-base text-[#2f1c6a] outline-none transition placeholder:text-[#a19ab4] focus:border-[#673de6] focus:bg-white focus:ring-4 focus:ring-[#673de6]/10"
        />

        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#7b7390] transition hover:text-[#673de6]"
        >
          {visible ? (
            <EyeOff className="h-5 w-5" />
          ) : (
            <Eye className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  );
}