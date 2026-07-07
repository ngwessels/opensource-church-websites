"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { BuilderShell } from "@/components/builder/BuilderShell";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";

const FINANCE_ALLOWED_PREFIXES = ["/builder/donations", "/builder/account"];
const FINANCE_HOME = "/builder/donations";

function isFinanceAllowedPath(pathname) {
  return FINANCE_ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export default function BuilderLayout({ children }) {
  const { user, loading, configured } = useAuth();
  const { canAccessBuilder, isFinance, loading: profileLoading, profileReady } = useUserProfile();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && configured && !user) {
      router.replace("/login");
    }
  }, [user, loading, configured, router]);

  useEffect(() => {
    if (!loading && profileReady && configured && user && !canAccessBuilder) {
      router.replace("/login?error=admin_required");
    }
  }, [user, loading, profileReady, configured, canAccessBuilder, router]);

  useEffect(() => {
    if (!profileReady || !isFinance || !pathname) return;
    if (!isFinanceAllowedPath(pathname)) {
      router.replace(FINANCE_HOME);
    }
  }, [profileReady, isFinance, pathname, router]);

  if (loading || configured === null || (user && !profileReady && profileLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted p-4">
        <div className="max-w-md rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          Firebase is not configured. Add credentials to <code>.env.local</code>.
        </div>
      </div>
    );
  }

  if (!user || !canAccessBuilder) return null;

  if (isFinance && pathname && !isFinanceAllowedPath(pathname)) return null;

  return <BuilderShell>{children}</BuilderShell>;
}
