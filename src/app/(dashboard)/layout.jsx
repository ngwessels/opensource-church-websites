"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/hooks/useAuth";

export default function DashboardLayout({ children }) {
  const { user, loading, configured, logOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && configured && !user) {
      router.replace("/login");
    }
  }, [user, loading, configured, router]);

  if (loading || configured === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted px-4">
        <div className="max-w-md rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          Firebase is not configured. Add your credentials to <code>.env.local</code>.
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-muted">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/builder/edit" className="text-sm font-semibold text-foreground">
            Church Builder
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <button
              type="button"
              onClick={() => logOut()}
              className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
