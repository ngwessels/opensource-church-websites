"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { MfaSignInChallenge } from "@/components/account/MfaSignInChallenge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { getBuilderHomeHref } from "@/lib/auth/roles";
import { getMfaResolver, isMfaError } from "@/lib/firebase/mfa";

const QUERY_ERRORS = {
  signup_closed: "Public signup is closed. Contact your site administrator for an invitation.",
  admin_required:
    "You do not have permission to access the website builder or donations area. Contact your administrator.",
};

export function SignInForm({
  mode = "login",
  redirectTo = "/builder/edit",
  authRedirectMode = "default",
  hideDefaultHeader = false,
}) {
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
  } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [mfaResolver, setMfaResolver] = useState(null);
  const [siteInitialized, setSiteInitialized] = useState(null);
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

  const immediateRedirect = authRedirectMode === "immediate";

  useEffect(() => {
    if (!redirectAfterAuth || authLoading || !user) return;
    const destination =
      redirectTo === "/builder/edit" ? getBuilderHomeHref(userRole) : redirectTo;
    if (redirectTo === "/builder/edit" && userRole == null) return;
    if (immediateRedirect) {
      window.location.assign(destination);
      return;
    }
    router.push(destination);
    setRedirectAfterAuth(false);
  }, [
    redirectAfterAuth,
    authLoading,
    user,
    userRole,
    router,
    redirectTo,
    immediateRedirect,
  ]);

  useEffect(() => {
    if (!immediateRedirect || authLoading || !user) return;
    const destination =
      redirectTo === "/builder/edit" ? getBuilderHomeHref(userRole) : redirectTo;
    if (redirectTo === "/builder/edit" && userRole == null) return;
    window.location.replace(destination);
  }, [immediateRedirect, authLoading, user, userRole, redirectTo]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/site-status")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setSiteInitialized(Boolean(data.initialized));
      })
      .catch(() => {
        if (!cancelled) setSiteInitialized(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (isSignup) {
        if (siteInitialized) {
          setError(QUERY_ERRORS.signup_closed);
          return;
        }
        await signUpWithEmail(email, password, displayName || undefined);
      } else {
        await signInWithEmail(email, password);
      }
      if (immediateRedirect) {
        setRedirectAfterAuth(true);
        return;
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

  function handleMfaSuccess() {
    setRedirectAfterAuth(true);
  }

  function handleMfaCancel() {
    setMfaResolver(null);
    setError(null);
  }

  if (configured === null || siteInitialized === null) {
    return (
      <div className="w-full max-w-md space-y-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Firebase is not configured. Copy <code>.env.example</code> to{" "}
          <code>.env.local</code> and add your Firebase credentials.
        </div>
      </div>
    );
  }

  if (mfaResolver) {
    return (
      <MfaSignInChallenge
        resolver={mfaResolver}
        onSuccess={handleMfaSuccess}
        onCancel={handleMfaCancel}
      />
    );
  }

  const showSignupLink = !isSignup && !siteInitialized;

  return (
    <div className="w-full max-w-md space-y-6">
      {!hideDefaultHeader && (
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {isSignup ? "Create an account" : "Sign in"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isSignup
              ? "Set up access to manage your church website."
              : "Access your church website builder."}
          </p>
        </div>
      )}

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
            placeholder="you@church.org"
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

        <Button type="submit" disabled={submitting || (isSignup && siteInitialized)} className="w-full">
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
            <Link href="/login" className="font-medium text-foreground hover:underline">
              Sign in
            </Link>
          </>
        ) : showSignupLink ? (
          <>
            Need an account?{" "}
            <Link href="/signup" className="font-medium text-foreground hover:underline">
              Sign up
            </Link>
          </>
        ) : (
          <>Contact your administrator for an invitation.</>
        )}
      </p>
    </div>
  );
}
