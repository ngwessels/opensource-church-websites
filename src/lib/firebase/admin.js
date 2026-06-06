import "server-only";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let adminApp = null;

function getAdminCredentials() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey };
}

export function isFirebaseAdminConfigured() {
  return getAdminCredentials() !== null;
}

export function getFirebaseAdminApp() {
  if (adminApp) return adminApp;

  const credentials = getAdminCredentials();
  if (!credentials) return null;

  adminApp =
    getApps().length > 0
      ? getApps()[0]
      : initializeApp({
          credential: cert(credentials),
          projectId: credentials.projectId,
        });

  return adminApp;
}

export function getFirebaseAdminFirestore() {
  const app = getFirebaseAdminApp();
  return app ? getFirestore(app) : null;
}
