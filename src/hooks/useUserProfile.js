"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { getFirebaseFirestore } from "@/lib/firebase/firestore";
import { COLLECTIONS } from "@/lib/firestore/paths";

export function useUserProfile() {
  const { user, userRole, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    let unsub = () => {};
    let cancelled = false;
    let retryTimer = null;
    setLoading(true);

    async function attachListener(forceTokenRefresh = false) {
      try {
        await user.getIdToken(forceTokenRefresh);
      } catch {
        // Listener may still succeed with a cached token.
      }
      if (cancelled) return;

      const db = getFirebaseFirestore();
      unsub();

      unsub = onSnapshot(
        doc(db, COLLECTIONS.users, user.uid),
        (snap) => {
          setProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null);
          setLoading(false);
        },
        (err) => {
          console.warn("[useUserProfile] snapshot error", err);
          if (!forceTokenRefresh && err?.code === "permission-denied") {
            retryTimer = window.setTimeout(() => {
              if (!cancelled) void attachListener(true);
            }, 400);
            return;
          }
          setProfile(null);
          setLoading(false);
        },
      );
    }

    void attachListener(false);

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      unsub();
    };
  }, [user]);

  const role = user ? (profile?.role ?? userRole ?? null) : null;
  const isAdmin = role === "admin";
  const isFinance = role === "finance";
  const canAccessBuilder = isAdmin || isFinance;
  const canManageDonations = canAccessBuilder;
  const profileReady = !user || (!authLoading && role != null);

  return {
    profile: user ? profile : null,
    loading: user ? !profileReady && loading : false,
    profileReady,
    role,
    isAdmin,
    isFinance,
    canAccessBuilder,
    canManageDonations,
  };
}
