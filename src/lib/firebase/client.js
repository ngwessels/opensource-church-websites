import { getApp, getApps, initializeApp } from "firebase/app";

import { getFirebaseClientConfig, isFirebaseConfigured } from "./config";

let app = null;

export function getFirebaseApp() {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured.");
  }

  if (!app) {
    app = getApps().length ? getApp() : initializeApp(getFirebaseClientConfig());
  }

  return app;
}
