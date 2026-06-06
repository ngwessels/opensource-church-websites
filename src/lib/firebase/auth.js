import { getAuth } from "firebase/auth";

import { getFirebaseApp } from "./client";

let auth = null;

export function getFirebaseAuth() {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}
