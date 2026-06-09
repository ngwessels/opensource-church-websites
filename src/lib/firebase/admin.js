import "server-only";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let adminApp = null;

function isValidPrivateKey(privateKey) {
  return (
    typeof privateKey === "string" &&
    privateKey.includes("-----BEGIN") &&
    privateKey.includes("PRIVATE KEY-----")
  );
}

function getAdminCredentials() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey || !isValidPrivateKey(privateKey)) {
    return null;
  }
  return { projectId, clientEmail, privateKey };
}

function canUseAppHostingAdc() {
  return Boolean(process.env.FIREBASE_CONFIG);
}

export function isFirebaseAdminConfigured() {
  return getAdminCredentials() !== null || canUseAppHostingAdc();
}

export function getFirebaseAdminApp() {
  if (adminApp) return adminApp;

  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return adminApp;
  }

  // App Hosting injects FIREBASE_CONFIG and provides ADC — prefer that over
  // FIREBASE_ADMIN_* even when those vars are set (they are often stale or
  // incorrectly escaped in hosted secret stores).
  if (canUseAppHostingAdc()) {
    adminApp = initializeApp();
    return adminApp;
  }

  const credentials = getAdminCredentials();
  if (credentials) {
    adminApp = initializeApp({
      credential: cert(credentials),
      projectId: credentials.projectId,
    });
    return adminApp;
  }

  return null;
}

export function getFirebaseAdminFirestore() {
  const app = getFirebaseAdminApp();
  return app ? getFirestore(app) : null;
}
