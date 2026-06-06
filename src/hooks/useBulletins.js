"use client";

import { useCallback, useEffect, useState } from "react";

export function useBulletins() {
  const [bulletins, setBulletins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bulletins");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load bulletins.");
      }
      setBulletins(data.bulletins ?? []);
      setError(null);
    } catch (err) {
      setBulletins([]);
      setError(err.message || "Failed to load bulletins.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { bulletins, loading, error, refresh };
}
