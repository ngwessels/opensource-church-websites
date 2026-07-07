"use client";

import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { getFirebaseFirestore } from "@/lib/firebase/firestore";
import { COLLECTIONS } from "@/lib/firestore/paths";

export function usePages() {
  const { user, loading: authLoading } = useAuth();
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading && !user) {
        setPages([]);
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    const db = getFirebaseFirestore();
    const unsub = onSnapshot(
      collection(db, COLLECTIONS.pages),
      (snap) => {
        setPages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => {
        setPages([]);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [user, authLoading]);

  return { pages, loading };
}
