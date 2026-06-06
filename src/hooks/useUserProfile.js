"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { getFirebaseFirestore } from "@/lib/firebase/firestore";
import { COLLECTIONS } from "@/lib/firestore/paths";

export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const db = getFirebaseFirestore();
    const unsub = onSnapshot(
      doc(db, COLLECTIONS.users, user.uid),
      (snap) => {
        setProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setLoading(false);
      },
      () => {
        setProfile(null);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [user]);

  const role = user ? (profile?.role ?? null) : null;
  const isAdmin = role === "admin";

  return {
    profile: user ? profile : null,
    loading: user ? loading : false,
    role,
    isAdmin,
  };
}
