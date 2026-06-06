"use client";

import { McpSection } from "@/components/account/McpSection";
import { MfaSection } from "@/components/account/MfaSection";
import { ProfileSection } from "@/components/account/ProfileSection";
import { SecuritySection } from "@/components/account/SecuritySection";
import { useUserProfile } from "@/hooks/useUserProfile";

export function AccountPage() {
  const { role, loading } = useUserProfile();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">Loading…</div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile, security settings, two-factor authentication
          {role === "admin" ? ", and MCP connections" : ""}.
        </p>
      </div>

      <ProfileSection role={role} />
      <SecuritySection />
      <MfaSection />
      {role === "admin" && <McpSection />}
    </div>
  );
}
