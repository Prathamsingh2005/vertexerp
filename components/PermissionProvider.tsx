"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  type CompanyAccess,
  type PermissionCode,
  hasPermission,
  normalizeCompanyAccessRow,
} from "@/lib/permissions";

export type PermissionContextValue = {
  access: CompanyAccess | null;
  isLoading: boolean;
  error: string;
  isOwner: boolean;
  can: (permission: PermissionCode) => boolean;
  refreshAccess: () => Promise<void>;
};

export const PermissionContext =
  createContext<PermissionContextValue | null>(null);

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

  return "Company permissions could not be loaded.";
}

export default function PermissionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [access, setAccess] = useState<CompanyAccess | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshAccess = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        setAccess(null);
        return;
      }

      const { data, error: accessError } = await supabase.rpc(
        "get_my_company_access",
        {
          p_company_id: null,
        }
      );

      if (accessError) {
        throw accessError;
      }

      const row = Array.isArray(data) ? data[0] : data;
      setAccess(normalizeCompanyAccessRow(row));
    } catch (loadError) {
      setAccess(null);
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAccess();

    const refreshEvents = [
      "vertexerp-active-company-updated",
      "vertexerp-membership-updated",
      "vertexerp-permissions-updated",
    ];

    refreshEvents.forEach((eventName) => {
      window.addEventListener(eventName, refreshAccess);
    });

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      refreshAccess();
    });

    return () => {
      refreshEvents.forEach((eventName) => {
        window.removeEventListener(eventName, refreshAccess);
      });

      subscription.unsubscribe();
    };
  }, [refreshAccess]);

  const can = useCallback(
    (permission: PermissionCode) => hasPermission(access, permission),
    [access]
  );

  const value = useMemo<PermissionContextValue>(
    () => ({
      access,
      isLoading,
      error,
      isOwner: access?.roleCode === "owner",
      can,
      refreshAccess,
    }),
    [access, can, error, isLoading, refreshAccess]
  );

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}