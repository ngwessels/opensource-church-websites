"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/hooks/useAuth";
import { getBuilderHomeHref } from "@/lib/auth/roles";

export default function DashboardPage() {
  const router = useRouter();
  const { user, userRole, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (userRole == null) return;
    router.replace(getBuilderHomeHref(userRole));
  }, [loading, user, userRole, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted text-muted-foreground">
      Loading…
    </div>
  );
}
