import { getFirestore } from "firebase/firestore";

import { getFirebaseApp } from "./client";

let db = null;

export function getFirebaseFirestore() {
  if (!db) {
    db = getFirestore(getFirebaseApp());
  }
  return db;
}
