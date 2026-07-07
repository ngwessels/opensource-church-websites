"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { MfaSignInChallenge } from "@/components/account/MfaSignInChallenge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { canAccessDonorPortal } from "@/lib/auth/roles";
import { getMfaResolver, isMfaError } from "@/lib/firebase/mfa";

const QUERY_ERRORS = {
  staff_account:
    "This email is registered for site administration. Use the staff login page instead.",
};

/**
 * @param {object} props
 * @param {'login' | 'signup'} [props.mode]
 */
export function DonorAuthForm({ mode = "login" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    user,
    userRole,
    loading: authLoading,
    configured,
    authError,
    clearAuthError,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    sendVerificationEmail,
  } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [mfaResolver, setMfaResolver] = useState(null);
  const [redirectAfterAuth, setRedirectAfterAuth] = useState(false);

  const isSignup = mode === "signup";
  const queryError = searchParams.get("error");
  const queryMessage = queryError ? QUERY_ERRORS[queryError] : null;

  useEffect(() => {
    if (authError) {
      setError(authError);
      clearAuthError?.();
    }
  }, [authError, clearAuthError]);

  useEffect(() => {
    if (queryMessage) {
      setError(queryMessage);
    }
  }, [queryMessage]);

  useEffect(() => {
    if (!redirectAfterAuth || authLoading || !user) return;
    if (!canAccessDonorPortal(userRole)) return;
    router.push("/give/account");
    setRedirectAfterAuth(false);
  }, [redirectAfterAuth, authLoading, user, userRole, router]);

  useEffect(() => {
    if (authLoading || !user || !canAccessDonorPortal(userRole)) return;
    router.replace("/give/account");
  }, [authLoading, user, userRole, router]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (isSignup) {
        await signUpWithEmail(email, password, displayName || undefined);
        try {
          await sendVerificationEmail();
        } catch {
          // Verification is optional for portal access.
        }
      } else {
        await signInWithEmail(email, password);
      }
      setRedirectAfterAuth(true);
    } catch (err) {
      if (!isSignup && isMfaError(err)) {
        setMfaResolver(getMfaResolver(err));
        return;
      }
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setSubmitting(true);

    try {
      await signInWithGoogle();
      setRedirectAfterAuth(true);
    } catch (err) {
      if (isMfaError(err)) {
        setMfaResolver(getMfaResolver(err));
        return;
      }
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (configured === null) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (!configured) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Firebase is not configured. Copy <code>.env.example</code> to <code>.env.local</code> and add
        your Firebase credentials.
      </div>
    );
  }

  if (mfaResolver) {
    return (
      <MfaSignInChallenge
        resolver={mfaResolver}
        onSuccess={() => setRedirectAfterAuth(true)}
        onCancel={() => {
          setMfaResolver(null);
          setError(null);
        }}
      />
    );
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {isSignup ? "Create your giving account" : "Sign in to My Giving"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isSignup
            ? "Track your donations and manage recurring gifts."
            : "View your donation history and manage recurring gifts."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {isSignup && (
          <div className="space-y-2">
            <Label htmlFor="displayName">Name</Label>
            <Input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Jane Doe"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-card px-2 text-muted-foreground">or</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={handleGoogleSignIn}
        disabled={submitting}
        className="w-full"
      >
        Continue with Google
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <Link href="/give/account/login" className="font-medium text-foreground hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/give/account/signup" className="font-medium text-foreground hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>

      {!isSignup && (
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/give/account/forgot-password" className="hover:underline">
            Forgot password?
          </Link>
        </p>
      )}

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/give" className="hover:underline">
          Back to Give
        </Link>
      </p>
    </div>
  );
}
