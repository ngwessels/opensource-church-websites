"use client";

import { useCallback, useEffect, useState } from "react";

import { getRecaptchaSiteKey, isRecaptchaEnabled } from "@/lib/recaptcha/config";

/** @type {Promise<void> | null} */
let scriptLoadPromise = null;

/**
 * @param {string} siteKey
 * @returns {Promise<void>}
 */
function loadRecaptchaScript(siteKey) {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (window.grecaptcha?.execute) {
    return Promise.resolve();
  }

  if (!scriptLoadPromise) {
    scriptLoadPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-recaptcha-v3="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Failed to load reCAPTCHA.")), {
          once: true,
        });
        return;
      }

      const script = document.createElement("script");
      script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
      script.async = true;
      script.defer = true;
      script.dataset.recaptchaV3 = "true";
      script.onload = () => resolve();
      script.onerror = () => {
        scriptLoadPromise = null;
        reject(new Error("Failed to load reCAPTCHA."));
      };
      document.head.appendChild(script);
    });
  }

  return scriptLoadPromise;
}

export function useRecaptchaV3() {
  const enabled = isRecaptchaEnabled();
  const siteKey = getRecaptchaSiteKey();
  const [ready, setReady] = useState(!enabled);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setReady(true);
      setError(null);
      return;
    }

    let cancelled = false;

    loadRecaptchaScript(siteKey)
      .then(() => {
        if (cancelled) return;
        setReady(true);
        setError(null);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setReady(false);
        setError(
          loadError instanceof Error ? loadError.message : "Failed to load reCAPTCHA.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, siteKey]);

  const execute = useCallback(
    async (action) => {
      if (!enabled) {
        return null;
      }

      if (!ready) {
        throw new Error("reCAPTCHA is not ready yet. Wait a moment and try again.");
      }

      await loadRecaptchaScript(siteKey);

      return new Promise((resolve, reject) => {
        window.grecaptcha.ready(async () => {
          try {
            const token = await window.grecaptcha.execute(siteKey, { action });
            resolve(token);
          } catch (executeError) {
            reject(
              executeError instanceof Error
                ? executeError
                : new Error("Failed to execute reCAPTCHA."),
            );
          }
        });
      });
    },
    [enabled, ready, siteKey],
  );

  return {
    enabled,
    ready: !enabled || ready,
    error,
    execute,
  };
}
