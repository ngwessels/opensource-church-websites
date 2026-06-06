import { getAnalytics, isSupported } from "firebase/analytics";

import { getFirebaseApp } from "./client";

let analytics = null;

export async function getFirebaseAnalytics() {
  if (analytics) return analytics;
  if (!(await isSupported())) return null;

  analytics = getAnalytics(getFirebaseApp());
  return analytics;
}
