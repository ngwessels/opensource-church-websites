"use client";

import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";

import { getFirebaseFirestore } from "@/lib/firebase/firestore";
import { COLLECTIONS } from "@/lib/firestore/paths";

export function usePages() {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getFirebaseFirestore();
    const unsub = onSnapshot(collection(db, COLLECTIONS.pages), (snap) => {
      setPages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { pages, loading };
}
