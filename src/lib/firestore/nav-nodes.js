import { doc, writeBatch } from "firebase/firestore";

import { COLLECTIONS } from "@/lib/firestore/paths";
import { serializeNavNode } from "@/lib/firestore/serialize";

function nodeSignature(node) {
  return JSON.stringify(serializeNavNode(node));
}

/**
 * Persist nav node changes from a before/after pair (e.g. quick-link edits).
 * @param {import('firebase/firestore').Firestore} db
 * @param {object[]} before
 * @param {object[]} after
 */
export async function persistNavNodeChanges(db, before, after) {
  const batch = writeBatch(db);
  const beforeMap = new Map(before.map((node) => [node.id, node]));
  const afterMap = new Map(after.map((node) => [node.id, node]));

  for (const [id] of beforeMap) {
    if (!afterMap.has(id)) {
      batch.delete(doc(db, COLLECTIONS.navNodes, id));
    }
  }

  for (const [id, node] of afterMap) {
    const prev = beforeMap.get(id);
    if (!prev || nodeSignature(prev) !== nodeSignature(node)) {
      batch.set(doc(db, COLLECTIONS.navNodes, id), serializeNavNode(node), { merge: true });
    }
  }

  await batch.commit();
}
