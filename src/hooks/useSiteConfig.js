"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";

import { getFirebaseFirestore } from "@/lib/firebase/firestore";
import { COLLECTIONS, SITE_CONFIG_ID } from "@/lib/firestore/paths";

export function useSiteConfig() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getFirebaseFirestore();
    const ref = doc(db, COLLECTIONS.site, SITE_CONFIG_ID);
    const unsub = onSnapshot(ref, (snap) => {
      setConfig(snap.exists() ? snap.data() : null);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { config, loading };
}
