"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { getFirebaseFirestore } from "@/lib/firebase/firestore";
import { COLLECTIONS } from "@/lib/firestore/paths";

export function useUserProfile() {
  const { user, userRole } = useAuth();
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
    setLoading(true);

    async function subscribe() {
      try {
        await user.getIdToken(true);
      } catch {
        // Continue — listener may still succeed with cached token.
      }
      if (cancelled) return;

      const db = getFirebaseFirestore();
      unsub = onSnapshot(
        doc(db, COLLECTIONS.users, user.uid),
        (snap) => {
          setProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null);
          setLoading(false);
        },
        (err) => {
          console.warn("[useUserProfile] snapshot error", err);
          setProfile(null);
          setLoading(false);
        },
      );
    }

    subscribe();
    return () => {
      cancelled = true;
      unsub();
    };
  }, [user]);

  const role = user ? (profile?.role ?? userRole ?? null) : null;
  const isAdmin = role === "admin";
  // Ready when Firestore resolved or server confirmed role via ensure-profile.
  const profileReady = !user || !loading || userRole != null;

  return {
    profile: user ? profile : null,
    loading: user ? loading && userRole == null : false,
    profileReady,
    role,
    isAdmin,
  };
}
