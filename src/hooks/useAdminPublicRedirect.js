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
  const { isAdmin, profileReady } = useUserProfile();

  const authResolved = !authLoading && configured !== null;
  const shouldRedirect =
    enabled && authResolved && Boolean(user) && profileReady && isAdmin;

  useEffect(() => {
    if (!shouldRedirect) return;

    const publicPath = pageSlug ? `/${pageSlug}` : "/";
    const search = window.location.search;
    router.replace(`${toBuilderHref(publicPath, true)}${search}`);
  }, [shouldRedirect, pageSlug, router]);

  // Only hide the public page once we know an admin is being redirected.
  return { checking: shouldRedirect };
}
