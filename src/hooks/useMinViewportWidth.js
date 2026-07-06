"use client";

import { useEffect, useState } from "react";

/**
 * Whether the viewport is at least `minWidth` pixels wide.
 * Returns `undefined` until measured on the client (avoids SSR mismatch).
 * @param {number} minWidth
 */
export function useMinViewportWidth(minWidth) {
  const [meets, setMeets] = useState(undefined);

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(min-width: ${minWidth}px)`);
    const update = () => setMeets(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, [minWidth]);

  return meets;
}
