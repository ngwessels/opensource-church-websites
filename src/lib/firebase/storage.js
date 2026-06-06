import { getStorage } from "firebase/storage";

import { getFirebaseApp } from "./client";

let storage = null;

export function getFirebaseStorage() {
  if (!storage) {
    storage = getStorage(getFirebaseApp());
  }
  return storage;
}
