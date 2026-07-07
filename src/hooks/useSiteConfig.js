"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";

import { getFirebaseFirestore } from "@/lib/firebase/firestore";
import { COLLECTIONS, SITE_CONFIG_ID } from "@/lib/firestore/paths";

export function useSiteConfig({ enabled = true } = {}) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setConfig(null);
      setLoading(false);
      return;
    }

    const db = getFirebaseFirestore();
    const ref = doc(db, COLLECTIONS.site, SITE_CONFIG_ID);
    const unsub = onSnapshot(ref, (snap) => {
      setConfig(snap.exists() ? snap.data() : null);
      setLoading(false);
    });
    return () => unsub();
  }, [enabled]);

  return { config, loading };
}
