"use client";

import { logEvent } from "firebase/analytics";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function AnalyticsProvider({ children }) {
  const pathname = usePathname();

  useEffect(() => {
    async function track() {
      const { getFirebaseAnalytics } = await import("@/lib/firebase/analytics");
      const analytics = await getFirebaseAnalytics();
      if (analytics) {
        logEvent(analytics, "page_view", { page_path: pathname });
      }
    }
    track().catch(() => {});
  }, [pathname]);

  return children;
}
