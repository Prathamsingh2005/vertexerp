"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Check, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";

function getSafeNextPath() {
  if (typeof window === "undefined") {
    return "/dashboard";
  }

  const requestedPath = new URLSearchParams(window.location.search).get(
    "next"
  );

  if (
    requestedPath &&
    requestedPath.startsWith("/") &&
    !requestedPath.startsWith("//") &&
    !requestedPath.startsWith("/auth")
  ) {
    return requestedPath;
  }

  return "/dashboard";
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
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
    </div>
  );
}

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function redirectAuthenticatedUser() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isMounted) {
        return;
      }

      if (user) {
        window.location.replace(getSafeNextPath());
        return;
      }

      setIsCheckingSession(false);
    }

    redirectAuthenticatedUser();

    return () => {
      isMounted = false;
    };
  }, []);

  function showMessage(nextMessage: string, error = false) {
    setMessage(nextMessage);
    setIsError(error);
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    showMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanedEmail = email.trim().toLowerCase();

    if (!cleanedEmail || !password) {
      showMessage("Enter your email address and password.", true);
      return;
    }

    if (mode === "signup") {
      if (!fullName.trim()) {
        showMessage("Enter your full name.", true);
        return;
      }

      if (password.length < 6) {
        showMessage("Password must contain at least 6 characters.", true);
        return;
      }

      if (password !== confirmPassword) {
        showMessage("Password and confirm password do not match.", true);
        return;
      }
    }

    setIsLoading(true);
    showMessage("");

    const supabase = createClient();
    const nextPath = getSafeNextPath();

    try {
      if (mode === "signup") {
        const callbackUrl = new URL(
          "/auth/callback",
          window.location.origin
        );
        callbackUrl.searchParams.set("next", nextPath);

        const { data, error } = await supabase.auth.signUp({
          email: cleanedEmail,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
            },
            emailRedirectTo: callbackUrl.toString(),
          },
        });

        if (error) {
          showMessage(error.message, true);
          return;
        }

        if (!data.session) {
          showMessage(
            "Account created. Confirm your email, then you will be taken directly to your dashboard."
          );
          return;
        }

        window.location.replace(nextPath);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: cleanedEmail,
        password,
      });

      if (error) {
        showMessage("Incorrect email or password.", true);
        return;
      }

      window.location.replace(nextPath);
    } catch {
      showMessage("Something went wrong. Please try again.", true);
    } finally {
      setIsLoading(false);
    }
  }

  if (isCheckingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8f6ff]">
        <div className="flex items-center gap-3 rounded-2xl border border-[#e0d6fa] bg-white px-5 py-4 font-bold text-[#673de6] shadow-lg">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          Opening your workspace...
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
              href="/"
              className="inline-flex items-center gap-2 text-sm font-bold text-violet-200 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to website
            </Link>

            <div className="mt-12">
              <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-white text-xl font-black text-[#673de6]">
                VX
              </div>

              <h1 className="mt-7 max-w-xl text-4xl font-black leading-tight tracking-[-0.035em] xl:text-5xl">
                Your complete business workspace is ready.
              </h1>

              <p className="mt-5 max-w-lg text-base leading-8 text-violet-200/80">
                Sign in to manage companies, invoices, inventory,
                accounting, payments, reports and audit controls.
              </p>
            </div>
          </div>

          <div className="relative grid gap-4 sm:grid-cols-2">
            {[
              "Connected stock and accounting",
              "Company-wise cloud records",
              "Audit-safe financial workflows",
              "Mobile-responsive workspace",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10">
                  <Check className="h-4 w-4 text-[#ffcd35]" />
                </span>
                <p className="text-sm font-bold text-violet-100">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
          <div className="w-full max-w-md">
            <div className="mb-7 flex items-center justify-between lg:hidden">
              <Brand />
              <Link
                href="/"
                className="text-sm font-bold text-[#673de6]"
              >
                Home
              </Link>
            </div>

            <div className="rounded-[28px] border border-[#e2d9f7] bg-white p-5 shadow-[0_24px_70px_rgba(47,28,106,0.12)] sm:p-8">
              <div className="hidden lg:block">
                <Brand />
              </div>

              <div className="mt-7">
                <h1 className="text-3xl font-black tracking-[-0.03em] text-[#2f1c6a]">
                  {mode === "login"
                    ? "Welcome back"
                    : "Create your account"}
                </h1>

                <p className="mt-2 leading-7 text-[#736c87]">
                  {mode === "login"
                    ? "Sign in and continue directly to your VertexERP dashboard."
                    : "Start setting up your business workspace."}
                </p>
              </div>

              <div className="mt-6 grid grid-cols-2 rounded-xl bg-[#f1edff] p-1">
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className={`rounded-lg px-3 py-2.5 text-sm font-black transition ${
                    mode === "login"
                      ? "bg-white text-[#673de6] shadow-sm"
                      : "text-[#746d88]"
                  }`}
                >
                  Sign In
                </button>

                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className={`rounded-lg px-3 py-2.5 text-sm font-black transition ${
                    mode === "signup"
                      ? "bg-white text-[#673de6] shadow-sm"
                      : "text-[#746d88]"
                  }`}
                >
                  Create Account
                </button>
              </div>

              <form
                onSubmit={handleSubmit}
                className="mt-6 space-y-4"
              >
                {mode === "signup" && (
                  <Field
                    label="Full Name"
                    type="text"
                    value={fullName}
                    onChange={setFullName}
                    placeholder="Enter your full name"
                    autoComplete="name"
                  />
                )}

                <Field
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="name@example.com"
                  autoComplete="email"
                />

                <PasswordField
                  label="Password"
                  value={password}
                  onChange={setPassword}
                  visible={showPassword}
                  onToggle={() => setShowPassword((current) => !current)}
                  autoComplete={
                    mode === "login"
                      ? "current-password"
                      : "new-password"
                  }
                />

                {mode === "signup" && (
                  <PasswordField
                    label="Confirm Password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    visible={showPassword}
                    onToggle={() =>
                      setShowPassword((current) => !current)
                    }
                    autoComplete="new-password"
                  />
                )}

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
                    ? "Please wait..."
                    : mode === "login"
                      ? "Sign In to Dashboard"
                      : "Create Account"}
                </button>
              </form>
            </div>

            <p className="mt-5 text-center text-xs font-medium text-[#8c85a8]">
              By continuing, you agree to use VertexERP responsibly.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-black text-[#3d315f]">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-xl border border-[#d9d0ec] bg-[#faf9ff] px-4 py-3 text-base text-[#2f1c6a] outline-none transition placeholder:text-[#a19ab4] focus:border-[#673de6] focus:bg-white focus:ring-4 focus:ring-[#673de6]/10"
      />
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggle,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  autoComplete: string;
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
          placeholder="Enter your password"
          autoComplete={autoComplete}
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