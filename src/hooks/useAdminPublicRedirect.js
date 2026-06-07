"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { toBuilderHref } from "@/lib/builder/navigation";

/**
 * Sends signed-in site admins from the public site to the matching builder page.
 */
export function useAdminPublicRedirect({ enabled, pageSlug }) {
  const router = useRouter();
  const { user, loading: authLoading, configured } = useAuth();
  const { isAdmin, loading: profileLoading } = useUserProfile();

  const checking = enabled && (authLoading || configured === null || (user && profileLoading));
  const shouldRedirect = enabled && !checking && Boolean(user && isAdmin);

  useEffect(() => {
    if (!shouldRedirect) return;

    const publicPath = pageSlug ? `/${pageSlug}` : "/";
    router.replace(toBuilderHref(publicPath, true));
  }, [shouldRedirect, pageSlug, router]);

  return { checking: checking || shouldRedirect };
}
