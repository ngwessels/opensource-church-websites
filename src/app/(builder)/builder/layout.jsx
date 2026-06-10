"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { BuilderShell } from "@/components/builder/BuilderShell";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";

export default function BuilderLayout({ children }) {
  const { user, loading, configured } = useAuth();
  const { isAdmin, loading: profileLoading } = useUserProfile();
  const router = useRouter();

  useEffect(() => {
    if (!loading && configured && !user) {
      router.replace("/login");
    }
  }, [user, loading, configured, router]);

  useEffect(() => {
    if (!loading && !profileLoading && configured && user && !isAdmin) {
      router.replace("/login?error=admin_required");
    }
  }, [user, loading, profileLoading, configured, isAdmin, router]);

  if (loading || configured === null || (user && profileLoading)) {
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

  if (!user || !isAdmin) return null;

  return <BuilderShell>{children}</BuilderShell>;
}
