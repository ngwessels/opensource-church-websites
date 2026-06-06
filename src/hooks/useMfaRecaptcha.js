"use client";

import { useEffect, useRef, useState } from "react";

import {
  clearRecaptchaVerifier,
  createAndRenderRecaptchaVerifier,
} from "@/lib/firebase/mfa";

export function useMfaRecaptcha(active, containerId) {
  const verifierRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [setupError, setSetupError] = useState(null);

  useEffect(() => {
    if (!active) {
      clearRecaptchaVerifier(verifierRef.current);
      verifierRef.current = null;
      return;
    }

    let cancelled = false;

    async function setup() {
      clearRecaptchaVerifier(verifierRef.current);
      verifierRef.current = null;

      try {
        const verifier = await createAndRenderRecaptchaVerifier(containerId);
        if (cancelled) {
          clearRecaptchaVerifier(verifier);
          return;
        }
        verifierRef.current = verifier;
        setReady(true);
        setSetupError(null);
      } catch (error) {
        if (!cancelled) {
          setReady(false);
          setSetupError(
            error instanceof Error ? error.message : "Failed to load reCAPTCHA.",
          );
        }
      }
    }

    const timer = window.setTimeout(() => {
      setReady(false);
      setSetupError(null);
      setup();
    }, 100);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      clearRecaptchaVerifier(verifierRef.current);
      verifierRef.current = null;
    };
  }, [active, containerId]);

  return {
    ready: active && ready,
    setupError: active ? setupError : null,
    getVerifier: () => (active ? verifierRef.current : null),
    resetVerifier: () => {
      clearRecaptchaVerifier(verifierRef.current);
      verifierRef.current = null;
      setReady(false);
    },
  };
}
