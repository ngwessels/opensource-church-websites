"use client";

import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { SignInForm } from "@/components/auth/SignInForm";
import { Card, CardContent } from "@/components/ui/card";

export default function SignupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/site-status")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.initialized) {
          router.replace("/login?error=signup_closed");
          return;
        }
        setChecking(false);
      })
      .catch(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted to-accent/30 px-4 py-12">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted to-accent/30 px-4 py-12">
      <Card className="relative z-10 w-full max-w-md shadow-lg">
        <CardContent className="p-8">
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
            <SignInForm mode="signup" />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
