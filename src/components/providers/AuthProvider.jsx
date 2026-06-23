"use client";

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { createContext, useCallback, useEffect, useMemo, useState } from "react";

import { isFirebaseConfigured } from "@/lib/firebase/config";
import { ensureUserProfileClientFallback } from "@/lib/site/bootstrap";

export const AuthContext = createContext(null);

async function ensureProfileViaApi(user) {
  const token = await user.getIdToken();
  const res = await fetch("/api/auth/ensure-profile", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 403) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.message || "This site is closed to new signups. Contact your administrator.");
    err.code = "site_initialized";
    throw err;
  }

  if (res.status === 503) {
    return { fallback: true };
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Profile bootstrap failed");
  }

  return res.json();
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  // null until client mount — avoids SSR/client env mismatch hydration errors
  const [configured, setConfigured] = useState(null);

  useEffect(() => {
    setConfigured(isFirebaseConfigured());
  }, []);

  useEffect(() => {
    if (configured === null) return;

    if (!configured) {
      setLoading(false);
      return;
    }

    let unsubscribe = () => {};

    async function initAuth() {
      const { getFirebaseAuth } = await import("@/lib/firebase/auth");
      const { getFirebaseFirestore } = await import("@/lib/firebase/firestore");
      const auth = getFirebaseAuth();

      unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
        setAuthError(null);
        if (nextUser) {
          try {
            const result = await ensureProfileViaApi(nextUser);
            if (result?.fallback) {
              console.warn("[auth] Admin SDK unavailable — using client fallback for profile bootstrap");
              const db = getFirebaseFirestore();
              const { doc, getDoc } = await import("firebase/firestore");
              const { COLLECTIONS } = await import("@/lib/firestore/paths");
              await ensureUserProfileClientFallback(db, nextUser);
              const snap = await getDoc(doc(db, COLLECTIONS.users, nextUser.uid));
              setUserRole(snap.exists() ? snap.data()?.role ?? null : null);
            } else if (result?.role) {
              setUserRole(result.role);
              try {
                await nextUser.getIdToken(true);
              } catch {
                // Storage rules fall back to Firestore role lookup.
              }
            }
          } catch (err) {
            console.error("[auth] profile bootstrap failed", err);
            if (err?.code === "site_initialized" || err?.message?.includes("closed to new signups")) {
              setAuthError(err.message);
              await signOut(auth);
              setUser(null);
              setUserRole(null);
              setLoading(false);
              return;
            }
          }
        } else {
          setUserRole(null);
        }
        setUser(nextUser);
        setLoading(false);
      });
    }

    initAuth().catch(() => setLoading(false));
    return () => unsubscribe();
  }, [configured]);

  const signInWithEmail = useCallback(async (email, password) => {
    const { getFirebaseAuth } = await import("@/lib/firebase/auth");
    await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  }, []);

  const signUpWithEmail = useCallback(async (email, password, displayName) => {
    const { getFirebaseAuth } = await import("@/lib/firebase/auth");
    const auth = getFirebaseAuth();
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(credential.user, { displayName });
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { getFirebaseAuth } = await import("@/lib/firebase/auth");
    await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
  }, []);

  const logOut = useCallback(async () => {
    const { getFirebaseAuth } = await import("@/lib/firebase/auth");
    setAuthError(null);
    setUserRole(null);
    await signOut(getFirebaseAuth());
  }, []);

  const sendPasswordReset = useCallback(async (email) => {
    const { getFirebaseAuth } = await import("@/lib/firebase/auth");
    await sendPasswordResetEmail(getFirebaseAuth(), email);
  }, []);

  const updateUserPassword = useCallback(async (newPassword) => {
    const { getFirebaseAuth } = await import("@/lib/firebase/auth");
    const auth = getFirebaseAuth();
    if (!auth.currentUser) throw new Error("Not signed in.");
    await updatePassword(auth.currentUser, newPassword);
  }, []);

  const sendVerificationEmail = useCallback(async () => {
    const { getFirebaseAuth } = await import("@/lib/firebase/auth");
    const auth = getFirebaseAuth();
    if (!auth.currentUser) throw new Error("Not signed in.");
    await sendEmailVerification(auth.currentUser);
  }, []);

  const updateDisplayName = useCallback(async (displayName) => {
    const { getFirebaseAuth } = await import("@/lib/firebase/auth");
    const auth = getFirebaseAuth();
    if (!auth.currentUser) throw new Error("Not signed in.");
    await updateProfile(auth.currentUser, { displayName });
    await auth.currentUser.reload();
    setUser(auth.currentUser);
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const value = useMemo(
    () => ({
      user,
      userRole,
      loading,
      configured,
      authError,
      clearAuthError,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      logOut,
      sendPasswordReset,
      updateUserPassword,
      sendVerificationEmail,
      updateDisplayName,
    }),
    [
      user,
      userRole,
      loading,
      configured,
      authError,
      clearAuthError,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      logOut,
      sendPasswordReset,
      updateUserPassword,
      sendVerificationEmail,
      updateDisplayName,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
