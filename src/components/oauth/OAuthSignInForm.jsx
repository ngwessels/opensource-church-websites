"use client";

import { SignInForm } from "@/components/auth/SignInForm";

export function OAuthSignInForm() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Sign in to authorize</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in with your parish admin account to connect an MCP client to your site.
        </p>
      </div>
      <SignInForm mode="login" redirectTo="/oauth/consent" />
    </div>
  );
}
