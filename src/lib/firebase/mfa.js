import {
  EmailAuthProvider,
  GoogleAuthProvider,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  getMultiFactorResolver,
  initializeRecaptchaConfig,
  multiFactor,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
} from "firebase/auth";

import { getFirebaseAuth } from "./auth";

let recaptchaConfigPromise = null;

export function getEnrolledFactors(user) {
  if (!user) return [];
  return multiFactor(user).enrolledFactors;
}

export function hasPasswordProvider(user) {
  return user?.providerData.some((p) => p.providerId === "password") ?? false;
}

export function hasGoogleProvider(user) {
  return user?.providerData.some((p) => p.providerId === "google.com") ?? false;
}

export function isMfaError(error) {
  return error?.code === "auth/multi-factor-auth-required";
}

export function isLocalhostPhoneAuthBlocked() {
  if (typeof window === "undefined") return false;
  return window.location.hostname === "localhost";
}

export async function ensureRecaptchaConfig() {
  if (!recaptchaConfigPromise) {
    const auth = getFirebaseAuth();
    recaptchaConfigPromise = initializeRecaptchaConfig(auth).catch((error) => {
      recaptchaConfigPromise = null;
      throw error;
    });
  }
  return recaptchaConfigPromise;
}

export async function createAndRenderRecaptchaVerifier(containerId) {
  await ensureRecaptchaConfig();

  const auth = getFirebaseAuth();
  const verifier = new RecaptchaVerifier(auth, containerId, {
    size: "normal",
    callback: () => {},
    "expired-callback": () => {},
  });
  await verifier.render();
  return verifier;
}

export function clearRecaptchaVerifier(verifier) {
  try {
    verifier?.clear?.();
  } catch {
    // Verifier may already be cleared.
  }
}

export function formatMfaError(error) {
  const code = error?.code;

  if (code === "auth/invalid-app-credential") {
    if (isLocalhostPhoneAuthBlocked()) {
      return (
        "Phone verification does not work on localhost. Open the app at http://127.0.0.1:3000 " +
        "(add 127.0.0.1 to Firebase Authorized domains), or use a test phone number from the Firebase Console."
      );
    }
    return (
      "Phone verification failed (invalid app credential). Confirm Phone auth and SMS MFA are enabled, " +
      "your domain is listed under Firebase Authorized domains, and complete the reCAPTCHA checkbox."
    );
  }

  if (code === "auth/invalid-phone-number") {
    return "Invalid phone number. Use E.164 format, e.g. +15551234567.";
  }

  if (code === "auth/too-many-requests") {
    return "Too many attempts. Wait a few minutes and try again.";
  }

  return error instanceof Error ? error.message : "Phone verification failed.";
}

export async function reauthenticateEmail(user, password) {
  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, credential);
}

export async function reauthenticateGoogle(user) {
  await reauthenticateWithPopup(user, new GoogleAuthProvider());
}

/** @deprecated Use createAndRenderRecaptchaVerifier */
export function createRecaptchaVerifier(containerId) {
  const auth = getFirebaseAuth();
  return new RecaptchaVerifier(auth, containerId, { size: "invisible" });
}

export async function startPhoneEnrollment(user, phoneNumber, recaptchaVerifier) {
  await ensureRecaptchaConfig();
  const auth = getFirebaseAuth();
  const session = await multiFactor(user).getSession();
  const phoneAuthProvider = new PhoneAuthProvider(auth);
  return phoneAuthProvider.verifyPhoneNumber(
    { phoneNumber, session },
    recaptchaVerifier,
  );
}

export async function completePhoneEnrollment(
  user,
  verificationId,
  code,
  displayName = "Phone number",
) {
  const cred = PhoneAuthProvider.credential(verificationId, code);
  const assertion = PhoneMultiFactorGenerator.assertion(cred);
  await multiFactor(user).enroll(assertion, displayName);
}

export async function unenrollFactor(user, factorUid) {
  await multiFactor(user).unenroll(factorUid);
}

export function getMfaResolver(error) {
  const auth = getFirebaseAuth();
  return getMultiFactorResolver(auth, error);
}

export async function startMfaSignIn(resolver, hintIndex, recaptchaVerifier) {
  await ensureRecaptchaConfig();
  const auth = getFirebaseAuth();
  const phoneAuthProvider = new PhoneAuthProvider(auth);
  return phoneAuthProvider.verifyPhoneNumber(
    {
      multiFactorHint: resolver.hints[hintIndex],
      session: resolver.session,
    },
    recaptchaVerifier,
  );
}

export async function resolveMfaSignIn(resolver, verificationId, code) {
  const cred = PhoneAuthProvider.credential(verificationId, code);
  const assertion = PhoneMultiFactorGenerator.assertion(cred);
  return resolver.resolveSignIn(assertion);
}

export function formatPhoneHint(hint) {
  return hint?.displayName || "your phone";
}
