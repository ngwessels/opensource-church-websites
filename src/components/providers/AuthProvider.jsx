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
import { ensureUserProfile } from "@/lib/site/bootstrap";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
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
        setUser(nextUser);
        if (nextUser) {
          try {
            const db = getFirebaseFirestore();
            await ensureUserProfile(db, nextUser);
          } catch (err) {
            console.error("[auth] profile bootstrap failed", err);
          }
        }
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

  const value = useMemo(
    () => ({
      user,
      loading,
      configured,
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
      loading,
      configured,
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
