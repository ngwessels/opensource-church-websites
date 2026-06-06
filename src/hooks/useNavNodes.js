"use client";

import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";

import { getFirebaseFirestore } from "@/lib/firebase/firestore";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { buildNavTree } from "@/lib/sitemap/tree";

export function useNavNodes() {
  const [nodes, setNodes] = useState([]);
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getFirebaseFirestore();
    const q = query(collection(db, COLLECTIONS.navNodes), orderBy("order"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setNodes(list);
      setTree(buildNavTree(list));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { nodes, tree, loading };
}
